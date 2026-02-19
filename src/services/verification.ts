import { randomInt, randomUUID } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	MessageFlags,
	ModalBuilder,
	PermissionFlagsBits,
	TextInputBuilder,
	TextInputStyle,
} from 'discord.js';
import type {
	ActionRow,
	ButtonComponent,
	ButtonInteraction,
	Guild,
	GuildMember,
	Interaction,
	ModalSubmitInteraction,
} from 'discord.js';
import { ActionTypes, BOT_VERSION, Colors } from '../config/constants.js';
import { db } from '../db/index.js';
import type { GuildConfig, VerificationState } from '../types.js';
import { FOOTER } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { send as sendModLog } from './modLog.js';

interface ChallengeSession {
	guildId: string;
	userId: string;
	answer: string;
	phase?: string;
	expiresAt: number;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const challengeSessions = new Map<string, ChallengeSession>();

const OPERATORS: { symbol: string; fn: (a: number, b: number) => number }[] = [
	{ symbol: '+', fn: (a, b) => a + b },
	{ symbol: '−', fn: (a, b) => a - b },
	{ symbol: '×', fn: (a, b) => a * b },
];

function generateCaptcha(): { text: string; answer: string } {
	const op = OPERATORS[randomInt(OPERATORS.length)] as NonNullable<(typeof OPERATORS)[number]>;
	let a: number;
	let b: number;
	if (op.symbol === '−') {
		a = randomInt(10, 99);
		b = randomInt(1, a);
	} else if (op.symbol === '×') {
		a = randomInt(2, 12);
		b = randomInt(2, 12);
	} else {
		a = randomInt(2, 50);
		b = randomInt(2, 50);
	}
	const answer = op.fn(a, b);
	const text = `${a} ${op.symbol} ${b} = ?`;
	return { text, answer: String(answer) };
}

/**
 * Paint a noisy background on a canvas context: fills with a dark HSL color,
 * draws bezier noise lines, and scatters random dots.
 */
function paintCanvasNoise(
	ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
	width: number,
	height: number,
	lineCount: number,
	dotCount: number,
): void {
	ctx.fillStyle = `hsl(${randomInt(200, 260)}, 15%, 18%)`;
	ctx.fillRect(0, 0, width, height);

	for (let i = 0; i < lineCount; i++) {
		ctx.strokeStyle = `hsla(${randomInt(0, 360)}, 50%, 50%, 0.4)`;
		ctx.lineWidth = randomInt(1, 3);
		ctx.beginPath();
		ctx.moveTo(randomInt(0, width), randomInt(0, height));
		ctx.bezierCurveTo(
			randomInt(0, width),
			randomInt(0, height),
			randomInt(0, width),
			randomInt(0, height),
			randomInt(0, width),
			randomInt(0, height),
		);
		ctx.stroke();
	}

	for (let i = 0; i < dotCount; i++) {
		ctx.fillStyle = `hsla(${randomInt(0, 360)}, 40%, 60%, ${(randomInt(20, 60) / 100).toFixed(2)})`;
		ctx.beginPath();
		ctx.arc(randomInt(0, width), randomInt(0, height), randomInt(1, 3), 0, Math.PI * 2);
		ctx.fill();
	}
}

function renderCaptchaImage(text: string): Buffer {
	const width = 280;
	const height = 90;
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	paintCanvasNoise(ctx, width, height, 6, 80);

	// Draw each character with individual distortion
	const chars = text.split('');
	const fontSize = 36;
	const totalWidth = chars.length * 24;
	let x = (width - totalWidth) / 2;

	for (const char of chars) {
		ctx.save();
		const angle = (randomInt(-15, 16) * Math.PI) / 180;
		const yOffset = randomInt(-6, 7);
		ctx.translate(x + 12, height / 2 + yOffset);
		ctx.rotate(angle);
		ctx.font = `bold ${fontSize + randomInt(-4, 5)}px monospace`;
		ctx.fillStyle = `hsl(${randomInt(0, 360)}, 70%, 75%)`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(char, 0, 0);
		ctx.restore();
		x += 24;
	}

	// Additional interference lines over text
	for (let i = 0; i < 3; i++) {
		ctx.strokeStyle = `hsla(${randomInt(0, 360)}, 60%, 60%, 0.3)`;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(randomInt(0, width), randomInt(0, height));
		ctx.lineTo(randomInt(0, width), randomInt(0, height));
		ctx.stroke();
	}

	return canvas.toBuffer('image/png');
}

export async function handleVerificationInteraction(interaction: Interaction): Promise<boolean> {
	if (interaction.isModalSubmit()) {
		const parts = interaction.customId.split(':');
		if (parts[0] === 'verify' && parts[1] === 'modal') {
			pruneChallengeSessions();
			await handleChallengeAnswer(interaction, parts[2]);
			return true;
		}
		if (parts[0] === 'verify' && parts[1] === 'ctxmodal') {
			pruneChallengeSessions();
			await handleContextAnswer(interaction, parts[2]);
			return true;
		}
		return false;
	}

	if (!interaction.isButton()) return false;

	pruneChallengeSessions();

	const parts = interaction.customId.split(':');
	if (parts[0] !== 'verify') return false;

	if (parts[1] === 'start') {
		await handleVerificationStart(interaction);
		return true;
	}

	if (parts[1] === 'answer') {
		await showAnswerModal(interaction, parts[2]);
		return true;
	}

	if (parts[1] === 'ctxanswer') {
		await showContextModal(interaction, parts[2]);
		return true;
	}

	if (parts[1] === 'review') {
		await handleManualReviewAction(interaction, parts[2], parts[3]);
		return true;
	}

	return false;
}

async function handleVerificationStart(interaction: ButtonInteraction): Promise<void> {
	if (!interaction.inGuild()) {
		await interaction.reply({
			content: 'Verification is only available in a server.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const config = db.getGuildConfig(interaction.guildId);
	const configError = validateVerificationConfig(config);
	if (configError) {
		await interaction.reply({ content: configError, flags: [MessageFlags.Ephemeral] });
		return;
	}

	if (config.verify_channel_id && interaction.channelId !== config.verify_channel_id) {
		await interaction.reply({
			content: `Please use verification in <#${config.verify_channel_id}>.`,
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
	if (!member) {
		await interaction.reply({
			content: 'Unable to load your server membership. Please try again.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	if (member.roles.cache.has(config.verified_role_id)) {
		db.upsertVerificationState(interaction.guildId, interaction.user.id, {
			status: 'VERIFIED',
			attempts: 0,
			manual_required: 0,
			review_message_id: null,
			manual_reason: null,
		});
		await interaction.reply({
			content: 'You are already verified.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const state = db.getVerificationState(interaction.guildId, interaction.user.id);
	if (state?.status === 'MANUAL_REVIEW') {
		await interaction.reply({
			content: 'Your verification is already in the moderator review queue.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const risk = evaluateRisk(member, Number(config.verification_min_account_age_hours));
	if (risk.manualRequired) {
		const queued = await queueManualReview(interaction.guild, member, config, {
			reasons: risk.reasons,
			riskScore: risk.score,
			triggeredBy: interaction.user,
		});
		await interaction.reply({
			content: queued.error
				? `Automated checks flagged your account, but review queue failed: ${queued.error}`
				: 'Automated checks flagged your account. A moderator will manually review your verification.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	if (Number(state?.attempts || 0) >= Number(config.verification_max_attempts)) {
		const queued = await queueManualReview(interaction.guild, member, config, {
			reasons: ['Maximum automated verification attempts reached.'],
			riskScore: risk.score,
			triggeredBy: interaction.user,
		});
		await interaction.reply({
			content: queued.error
				? `You need manual verification, but queue failed: ${queued.error}`
				: 'You reached the automated attempt limit. A moderator will manually review your verification.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const challenge = createChallenge(interaction.guildId, interaction.user.id);
	db.upsertVerificationState(interaction.guildId, interaction.user.id, {
		status: 'CHALLENGE',
		manual_required: 0,
		risk_score: risk.score,
		risk_reasons: risk.reasons.join(' | ') || null,
		last_challenge_at: new Date().toISOString(),
	});

	const captchaImage = renderCaptchaImage(challenge.captchaText);
	const attachment = new AttachmentBuilder(captchaImage, { name: 'captcha.png' });

	const embed = new EmbedBuilder()
		.setColor(Colors.INFO)
		.setTitle('Verification Challenge')
		.setDescription(
			'Solve the math problem shown in the image below and click **Submit Answer** to enter your answer.\n\nThis challenge expires in 5 minutes.',
		)
		.setImage('attachment://captcha.png')
		.setFooter(FOOTER)
		.setTimestamp();

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`verify:answer:${challenge.sessionId}`)
			.setLabel('Submit Answer')
			.setStyle(ButtonStyle.Primary),
	);

	await interaction.reply({
		embeds: [embed],
		components: [row],
		files: [attachment],
		flags: [MessageFlags.Ephemeral],
	});
}

async function showAnswerModal(interaction: ButtonInteraction, sessionId: string): Promise<void> {
	const session = challengeSessions.get(sessionId);
	if (!session) {
		await interaction.reply({
			content: 'This challenge has expired. Click the verify button again.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	if (session.guildId !== interaction.guildId || session.userId !== interaction.user.id) {
		await interaction.reply({
			content: 'This challenge belongs to another member.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const modal = new ModalBuilder()
		.setCustomId(`verify:modal:${sessionId}`)
		.setTitle('Verification Challenge');

	const answerInput = new TextInputBuilder()
		.setCustomId('answer')
		.setLabel('What is the answer to the math problem?')
		.setStyle(TextInputStyle.Short)
		.setPlaceholder('Type the number here')
		.setRequired(true)
		.setMaxLength(10);

	modal.addComponents(new ActionRowBuilder().addComponents(answerInput));
	await interaction.showModal(modal);
}

async function handleChallengeAnswer(
	interaction: ModalSubmitInteraction,
	sessionId: string,
): Promise<void> {
	const session = challengeSessions.get(sessionId);
	if (!session) {
		await interaction.reply({
			content: 'This challenge has expired. Click the verify button again.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	if (session.guildId !== interaction.guildId || session.userId !== interaction.user.id) {
		await interaction.reply({
			content: 'This challenge belongs to another member.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	challengeSessions.delete(sessionId);

	if (Date.now() > session.expiresAt) {
		const failed = await registerFailedAttempt(interaction, 'Challenge timed out.');
		await interaction.reply({
			content: failed.manualReview
				? failed.queueError
					? `Challenge timed out and manual review queue failed: ${failed.queueError}`
					: 'Challenge timed out. Your verification has been sent to manual moderator review.'
				: 'Challenge timed out. Click the verify button again.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const userAnswer = interaction.fields.getTextInputValue('answer').trim();
	if (userAnswer !== session.answer) {
		const failed = await registerFailedAttempt(interaction, 'Incorrect challenge answer.');
		await interaction.reply({
			content: failed.manualReview
				? failed.queueError
					? `Incorrect answer and manual review queue failed: ${failed.queueError}`
					: 'Incorrect answer. You reached the retry limit and were sent for manual moderator review.'
				: 'Incorrect answer. Click the verify button to try again.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	// CAPTCHA passed — present the context challenge (phase 2)
	const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
	if (!member) {
		await interaction.reply({
			content: 'Unable to load your server membership. Please try again.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const state = db.getVerificationState(interaction.guildId, interaction.user.id);
	const ctxChallenge = createContextChallenge(
		interaction.guildId,
		interaction.user.id,
		member,
		state,
	);

	const ctxImage = renderContextChallengeImage(ctxChallenge.lines);
	const attachment = new AttachmentBuilder(ctxImage, { name: 'context.png' });

	const embed = new EmbedBuilder()
		.setColor(Colors.INFO)
		.setTitle('Verification — Identity Check')
		.setDescription(
			`CAPTCHA passed! Now answer this question from the image below.\n\n${ctxChallenge.hint}\n\nThis challenge expires in 5 minutes.`,
		)
		.setImage('attachment://context.png')
		.setFooter(FOOTER)
		.setTimestamp();

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`verify:ctxanswer:${ctxChallenge.sessionId}`)
			.setLabel('Submit Answer')
			.setStyle(ButtonStyle.Primary),
	);

	await interaction.reply({
		embeds: [embed],
		components: [row],
		files: [attachment],
		flags: [MessageFlags.Ephemeral],
	});
}

// --- Context challenge generators ---

function formatDate(date: Date): string {
	return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function generateFakeDates(realDate: Date, count: number): string[] {
	const fakes = new Set<string>();
	const maxAttempts = count * 10;
	let attempts = 0;
	while (fakes.size < count && attempts < maxAttempts) {
		attempts++;
		const offsetDays = randomInt(1, 180) * (randomInt(2) === 0 ? 1 : -1);
		const fake = new Date(realDate.getTime() + offsetDays * 86_400_000);
		const formatted = formatDate(fake);
		if (formatted !== formatDate(realDate)) {
			fakes.add(formatted);
		}
	}
	return [...fakes];
}

function createContextChallenge(
	guildId: string,
	userId: string,
	member: GuildMember,
	verificationState: VerificationState | null,
): { sessionId: string; lines: string[]; hint: string } {
	const questionTypes = ['server_join', 'account_created'];
	if (verificationState?.invite_code) {
		questionTypes.push('invite_code');
	}

	const type = questionTypes[randomInt(questionTypes.length)] as string;
	const sessionId = randomUUID().split('-')[0];
	let lines: string[];
	let answer: string;
	let hint: string;

	if (type === 'server_join') {
		const joinDate = member.joinedAt ?? new Date();
		const correct = formatDate(joinDate);
		const fakes = generateFakeDates(joinDate, 3);
		const answerPos = randomInt(4);
		const options = [...fakes];
		options.splice(answerPos, 0, correct);
		answer = String(answerPos + 1);
		lines = ['When did you join this server?', '', ...options.map((o, i) => `${i + 1}. ${o}`)];
		hint = 'Type the **number** (1–4) of the correct date.';
	} else if (type === 'account_created') {
		const createdDate = member.user.createdAt;
		const correct = formatDate(createdDate);
		const fakes = generateFakeDates(createdDate, 3);
		const answerPos = randomInt(4);
		const options = [...fakes];
		options.splice(answerPos, 0, correct);
		answer = String(answerPos + 1);
		lines = [
			'When was your Discord account created?',
			'',
			...options.map((o, i) => `${i + 1}. ${o}`),
		];
		hint = 'Type the **number** (1–4) of the correct date.';
	} else {
		answer = verificationState?.invite_code ?? '';
		lines = ['What invite code did you use', 'to join this server?'];
		hint = 'Type the **exact invite code** (e.g. `aBcDeFg`).';
	}

	challengeSessions.set(sessionId, {
		guildId,
		userId,
		answer,
		phase: 'context',
		expiresAt: Date.now() + CHALLENGE_TTL_MS,
	});

	return { sessionId, lines, hint };
}

function renderContextChallengeImage(lines: string[]): Buffer {
	const lineHeight = 32;
	const padding = 24;
	const width = 520;
	const height = padding * 2 + lines.length * lineHeight;
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	paintCanvasNoise(ctx, width, height, 4, 40);

	// Draw lines with slight per-character distortion
	let y = padding + lineHeight / 2;
	for (const line of lines) {
		if (line === '') {
			y += lineHeight * 0.5;
			continue;
		}
		const isQuestion = !line.match(/^\d\./);
		const fontSize = isQuestion ? 20 : 18;
		const chars = line.split('');
		let x = padding;

		for (const char of chars) {
			ctx.save();
			const angle = (randomInt(-5, 6) * Math.PI) / 180;
			const yOff = randomInt(-2, 3);
			ctx.translate(x + 6, y + yOff);
			ctx.rotate(angle);
			ctx.font = `${isQuestion ? 'bold' : 'normal'} ${fontSize}px monospace`;
			ctx.fillStyle = isQuestion
				? `hsl(${randomInt(40, 60)}, 80%, 75%)`
				: `hsl(${randomInt(180, 220)}, 70%, 75%)`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(char, 0, 0);
			ctx.restore();
			x += fontSize * 0.62;
		}
		y += lineHeight;
	}

	// Interference lines over text
	for (let i = 0; i < 2; i++) {
		ctx.strokeStyle = `hsla(${randomInt(0, 360)}, 60%, 60%, 0.25)`;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(randomInt(0, width), randomInt(0, height));
		ctx.lineTo(randomInt(0, width), randomInt(0, height));
		ctx.stroke();
	}

	return canvas.toBuffer('image/png');
}

async function showContextModal(interaction: ButtonInteraction, sessionId: string): Promise<void> {
	const session = challengeSessions.get(sessionId);
	if (!session) {
		await interaction.reply({
			content: 'This challenge has expired. Click the verify button again.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	if (session.guildId !== interaction.guildId || session.userId !== interaction.user.id) {
		await interaction.reply({
			content: 'This challenge belongs to another member.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const modal = new ModalBuilder()
		.setCustomId(`verify:ctxmodal:${sessionId}`)
		.setTitle('Identity Verification');

	const answerInput = new TextInputBuilder()
		.setCustomId('ctxanswer')
		.setLabel('Your answer')
		.setStyle(TextInputStyle.Short)
		.setPlaceholder('Type the number or invite code')
		.setRequired(true)
		.setMaxLength(20);

	modal.addComponents(new ActionRowBuilder().addComponents(answerInput));
	await interaction.showModal(modal);
}

async function handleContextAnswer(
	interaction: ModalSubmitInteraction,
	sessionId: string,
): Promise<void> {
	const session = challengeSessions.get(sessionId);
	if (!session) {
		await interaction.reply({
			content: 'This challenge has expired. Click the verify button again.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	if (session.guildId !== interaction.guildId || session.userId !== interaction.user.id) {
		await interaction.reply({
			content: 'This challenge belongs to another member.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	challengeSessions.delete(sessionId);

	if (Date.now() > session.expiresAt) {
		const failed = await registerFailedAttempt(interaction, 'Challenge timed out.');
		await interaction.reply({
			content: failed.manualReview
				? failed.queueError
					? `Challenge timed out and manual review queue failed: ${failed.queueError}`
					: 'Challenge timed out. Your verification has been sent to manual moderator review.'
				: 'Challenge timed out. Click the verify button again.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const userAnswer = interaction.fields.getTextInputValue('ctxanswer').trim();
	if (userAnswer !== session.answer) {
		const failed = await registerFailedAttempt(interaction, 'Incorrect identity check answer.');
		await interaction.reply({
			content: failed.manualReview
				? failed.queueError
					? `Incorrect answer and manual review queue failed: ${failed.queueError}`
					: 'Incorrect answer. You reached the retry limit and were sent for manual moderator review.'
				: 'Incorrect answer. Click the verify button to try again.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	// Both phases passed — verify the member
	const config = db.getGuildConfig(interaction.guildId);
	const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
	if (!member) {
		await interaction.reply({
			content: 'Unable to load your server membership. Please try again.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const roleResult = await applyVerifiedRoles(
		member,
		config,
		`Automated verification approved by ${interaction.user.tag}`,
	);
	if (!roleResult.ok) {
		const queued = await queueManualReview(interaction.guild, member, config, {
			reasons: [roleResult.error],
			riskScore: 0,
			triggeredBy: interaction.user,
		});
		await interaction.reply({
			content: queued.error
				? `Automated verification passed, but role assignment and manual queue failed: ${queued.error}`
				: 'Automated verification passed, but role assignment needs moderator review.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	db.upsertVerificationState(interaction.guildId, interaction.user.id, {
		status: 'VERIFIED',
		attempts: 0,
		manual_required: 0,
		review_message_id: null,
		manual_reason: null,
		last_challenge_at: null,
	});

	db.logAction(
		interaction.guildId,
		ActionTypes.VERIFY_APPROVE,
		interaction.user.id,
		interaction.client.user.id,
		'Automated verification approved',
		null,
		{ mode: 'automatic' },
	);

	await sendModLog(interaction.guild, {
		actionType: ActionTypes.VERIFY_APPROVE,
		targetUser: interaction.user,
		moderator: interaction.client.user,
		reason: 'Automated verification approved',
	});

	await interaction.reply({
		content: `Verification complete. You now have <@&${config.verified_role_id}>.`,
		flags: [MessageFlags.Ephemeral],
	});
}

async function handleManualReviewAction(
	interaction: ButtonInteraction,
	decision: string,
	userId: string,
): Promise<void> {
	if (!interaction.inGuild()) {
		await interaction.reply({
			content: 'Manual verification actions can only be used in server channels.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
		await interaction.reply({
			content: 'You need Moderate Members permission to review verification requests.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const config = db.getGuildConfig(interaction.guildId);
	const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);
	let message = '';
	let actionType = ActionTypes.VERIFY_RECHECK;

	if (decision === 'approve') {
		if (!targetMember) {
			await interaction.reply({
				content: 'Member is no longer in this server.',
				flags: [MessageFlags.Ephemeral],
			});
			return;
		}

		const roleResult = await applyVerifiedRoles(
			targetMember,
			config,
			`Manual verification approved by ${interaction.user.tag}`,
		);
		if (!roleResult.ok) {
			await interaction.reply({
				content: `Manual approval failed: ${roleResult.error}`,
				flags: [MessageFlags.Ephemeral],
			});
			return;
		}

		db.upsertVerificationState(interaction.guildId, userId, {
			status: 'VERIFIED',
			attempts: 0,
			manual_required: 0,
			review_message_id: null,
			manual_reason: null,
			last_challenge_at: null,
		});

		actionType = ActionTypes.VERIFY_APPROVE;
		message = `Approved by ${interaction.user}`;

		db.logAction(
			interaction.guildId,
			actionType,
			userId,
			interaction.user.id,
			'Manual verification approved',
			null,
			{ mode: 'manual' },
		);

		await sendModLog(interaction.guild, {
			actionType,
			targetUser: targetMember.user,
			moderator: interaction.user,
			reason: 'Manual verification approved',
		});
	} else if (decision === 'reject') {
		if (targetMember) {
			const roleResult = await applyUnverifiedRoles(
				targetMember,
				config,
				`Manual verification rejected by ${interaction.user.tag}`,
			);
			if (!roleResult.ok) {
				await interaction.reply({
					content: `Manual rejection failed: ${roleResult.error}`,
					flags: [MessageFlags.Ephemeral],
				});
				return;
			}
		}

		db.upsertVerificationState(interaction.guildId, userId, {
			status: 'REJECTED',
			manual_required: 1,
			review_message_id: null,
			manual_reason: `Rejected by ${interaction.user.tag}`,
			last_challenge_at: null,
		});

		actionType = ActionTypes.VERIFY_REJECT;
		message = `Rejected by ${interaction.user}`;

		db.logAction(
			interaction.guildId,
			actionType,
			userId,
			interaction.user.id,
			'Manual verification rejected',
			null,
			{ mode: 'manual' },
		);

		if (targetMember) {
			await sendModLog(interaction.guild, {
				actionType,
				targetUser: targetMember.user,
				moderator: interaction.user,
				reason: 'Manual verification rejected',
			});
		}
	} else {
		db.upsertVerificationState(interaction.guildId, userId, {
			status: 'PENDING',
			attempts: 0,
			manual_required: 0,
			review_message_id: null,
			manual_reason: null,
			last_challenge_at: null,
		});

		actionType = ActionTypes.VERIFY_RECHECK;
		message = `Recheck requested by ${interaction.user}`;

		db.logAction(
			interaction.guildId,
			actionType,
			userId,
			interaction.user.id,
			'Manual verification reset for recheck',
			null,
			{ mode: 'manual' },
		);

		if (targetMember) {
			await sendModLog(interaction.guild, {
				actionType,
				targetUser: targetMember.user,
				moderator: interaction.user,
				reason: 'Manual verification reset for recheck',
			});
		}
	}

	const updatedEmbed = buildManualReviewResultEmbed(interaction, actionType, message);
	const disabledComponents = disableButtonRows(interaction.message.components);
	await interaction.update({ embeds: [updatedEmbed], components: disabledComponents });
	await interaction.followUp({
		content: `Manual verification updated for <@${userId}>.`,
		flags: [MessageFlags.Ephemeral],
	});
}

function createChallenge(
	guildId: string,
	userId: string,
): { sessionId: string; captchaText: string } {
	const captcha = generateCaptcha();
	const sessionId = randomUUID().split('-')[0];

	challengeSessions.set(sessionId, {
		guildId,
		userId,
		answer: captcha.answer,
		expiresAt: Date.now() + CHALLENGE_TTL_MS,
	});

	return {
		sessionId,
		captchaText: captcha.text,
	};
}

function evaluateRisk(
	member: GuildMember,
	minAccountAgeHours: number,
): { score: number; manualRequired: boolean; reasons: string[] } {
	const reasons: string[] = [];
	let score = 0;

	if (member.user.bot) {
		return {
			score: 100,
			manualRequired: true,
			reasons: ['Discord marks this account as a bot user.'],
		};
	}

	const accountAgeHours = getAccountAgeHours(member.user.createdTimestamp);
	if (accountAgeHours < minAccountAgeHours) {
		score += 2;
		reasons.push(`Account is only ${accountAgeHours}h old (minimum ${minAccountAgeHours}h).`); // hours kept for internal precision
	}

	if (!member.user.avatar) {
		score += 1;
		reasons.push('Account has no avatar.');
	}

	if (/\d{5,}/.test(member.user.username)) {
		score += 1;
		reasons.push('Username contains a long numeric sequence.');
	}

	if (/(free|nitro|airdrop|crypto|support|admin|mod)/i.test(member.user.username)) {
		score += 1;
		reasons.push('Username contains suspicious keyword patterns.');
	}

	return {
		score,
		manualRequired: score >= 3,
		reasons,
	};
}

async function registerFailedAttempt(
	interaction: ModalSubmitInteraction | ButtonInteraction,
	detail: string,
): Promise<{ manualReview: boolean; queueError: string | null }> {
	const config = db.getGuildConfig(interaction.guildId);
	const state = db.getVerificationState(interaction.guildId, interaction.user.id);
	const attempts = Number(state?.attempts || 0) + 1;
	const maxAttempts = Number(config.verification_max_attempts);

	if (attempts >= maxAttempts) {
		const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
		if (member) {
			db.upsertVerificationState(interaction.guildId, interaction.user.id, {
				attempts,
			});

			const queued = await queueManualReview(interaction.guild, member, config, {
				reasons: [detail, `Reached max attempts (${maxAttempts}).`],
				riskScore: Number(state?.risk_score || 0),
				triggeredBy: interaction.user,
			});
			return { manualReview: true, queueError: queued.error || null };
		}
		return { manualReview: true, queueError: 'Unable to resolve member for manual review.' };
	}

	db.upsertVerificationState(interaction.guildId, interaction.user.id, {
		status: 'PENDING',
		attempts,
		manual_required: 0,
		review_message_id: null,
		manual_reason: null,
	});
	return { manualReview: false, queueError: null };
}

async function queueManualReview(
	guild: Guild,
	member: GuildMember,
	config: GuildConfig,
	{
		reasons,
		riskScore,
		triggeredBy,
	}: { reasons: string[]; riskScore: number; triggeredBy: { toString(): string } | null },
): Promise<{ queued: boolean; error?: string; existing?: boolean }> {
	if (!config.review_channel_id) {
		logger.warn(`Review channel not configured for guild ${guild.id}`);
		return { queued: false, error: 'Review channel is not configured by admins.' };
	}

	const reviewChannel =
		guild.channels.cache.get(config.review_channel_id) ||
		(await guild.channels.fetch(config.review_channel_id).catch(() => null));

	if (!reviewChannel || !reviewChannel.isTextBased()) {
		logger.warn(`Review channel ${config.review_channel_id} missing in guild ${guild.id}`);
		return { queued: false, error: 'Review channel is missing or inaccessible.' };
	}

	const state = db.getVerificationState(guild.id, member.id);
	if (state?.review_message_id) {
		const existing = await reviewChannel.messages.fetch(state.review_message_id).catch(() => null);
		if (existing) {
			return { queued: true, existing: true };
		}
	}

	const reasonText =
		reasons && reasons.length > 0
			? reasons.map((item) => `- ${item}`).join('\n')
			: '- Manual review required.';

	const embed = new EmbedBuilder()
		.setColor(Colors.VERIFY_QUEUE)
		.setTitle('Manual Verification Required')
		.addFields(
			{ name: 'Member', value: `${member.user} (${member.user.id})` },
			{
				name: 'Account Age',
				value: `${getAccountAgeHours(member.user.createdTimestamp)} hours`,
				inline: true,
			},
			{ name: 'Risk Score', value: `${riskScore}`, inline: true },
			{ name: 'Triggered By', value: `${triggeredBy || 'System'}`, inline: true },
			{ name: 'Reasons', value: reasonText },
		)
		.setFooter(FOOTER)
		.setTimestamp();

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`verify:review:approve:${member.id}`)
			.setLabel('Approve')
			.setStyle(ButtonStyle.Success),
		new ButtonBuilder()
			.setCustomId(`verify:review:reject:${member.id}`)
			.setLabel('Reject')
			.setStyle(ButtonStyle.Danger),
		new ButtonBuilder()
			.setCustomId(`verify:review:recheck:${member.id}`)
			.setLabel('Request Recheck')
			.setStyle(ButtonStyle.Secondary),
	);

	const reviewMessage = await reviewChannel.send({ embeds: [embed], components: [row] });

	db.upsertVerificationState(guild.id, member.id, {
		status: 'MANUAL_REVIEW',
		manual_required: 1,
		risk_score: riskScore,
		risk_reasons: reasons?.join(' | ') || null,
		review_message_id: reviewMessage.id,
		manual_reason: reasons?.join(' | ') || 'Manual review required',
		last_challenge_at: null,
	});

	db.logAction(
		guild.id,
		ActionTypes.VERIFY_QUEUE,
		member.id,
		guild.client.user.id,
		'Moved to manual verification queue',
		null,
		{ reasons: reasons || [] },
	);

	await sendModLog(guild, {
		actionType: ActionTypes.VERIFY_QUEUE,
		targetUser: member.user,
		moderator: guild.client.user,
		reason: 'Moved to manual verification queue',
		extra: reasons?.join(' | ') || 'Manual review required',
	});

	return { queued: true, existing: false };
}

async function applyVerifiedRoles(
	member: GuildMember,
	config: GuildConfig,
	reason: string,
): Promise<{ ok: boolean; error?: string }> {
	if (!config.verified_role_id || !config.unverified_role_id) {
		return {
			ok: false,
			error: 'Verification roles are not fully configured.',
		};
	}

	const botMember = member.guild.members.me;
	if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
		return {
			ok: false,
			error: 'Bot is missing Manage Roles permission.',
		};
	}

	if (member.roles.highest.position >= botMember.roles.highest.position) {
		return {
			ok: false,
			error: 'Bot role is not high enough to manage this member.',
		};
	}

	const verifiedRole = await member.guild.roles.fetch(config.verified_role_id).catch(() => null);
	const unverifiedRole = await member.guild.roles
		.fetch(config.unverified_role_id)
		.catch(() => null);

	if (!verifiedRole || !unverifiedRole) {
		return {
			ok: false,
			error: 'Configured verification roles were not found.',
		};
	}

	if (
		verifiedRole.position >= botMember.roles.highest.position ||
		unverifiedRole.position >= botMember.roles.highest.position
	) {
		return {
			ok: false,
			error: 'Bot role must be higher than verified and unverified roles.',
		};
	}

	await member.roles.add(verifiedRole, reason);
	if (member.roles.cache.has(unverifiedRole.id)) {
		await member.roles.remove(unverifiedRole, reason);
	}

	return { ok: true };
}

async function applyUnverifiedRoles(
	member: GuildMember,
	config: GuildConfig,
	reason: string,
): Promise<{ ok: boolean; error?: string }> {
	if (!config.unverified_role_id || !config.verified_role_id) {
		return {
			ok: false,
			error: 'Verification roles are not fully configured.',
		};
	}

	const botMember = member.guild.members.me;
	if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
		return {
			ok: false,
			error: 'Bot is missing Manage Roles permission.',
		};
	}

	if (member.roles.highest.position >= botMember.roles.highest.position) {
		return {
			ok: false,
			error: 'Bot role is not high enough to manage this member.',
		};
	}

	const verifiedRole = await member.guild.roles.fetch(config.verified_role_id).catch(() => null);
	const unverifiedRole = await member.guild.roles
		.fetch(config.unverified_role_id)
		.catch(() => null);
	if (!verifiedRole || !unverifiedRole) {
		return {
			ok: false,
			error: 'Configured verification roles were not found.',
		};
	}

	if (
		verifiedRole.position >= botMember.roles.highest.position ||
		unverifiedRole.position >= botMember.roles.highest.position
	) {
		return {
			ok: false,
			error: 'Bot role must be higher than verified and unverified roles.',
		};
	}

	if (member.roles.cache.has(verifiedRole.id)) {
		await member.roles.remove(verifiedRole, reason);
	}
	if (!member.roles.cache.has(unverifiedRole.id)) {
		await member.roles.add(unverifiedRole, reason);
	}

	return { ok: true };
}

function validateVerificationConfig(config: GuildConfig): string | null {
	if (!config.verification_enabled) return 'Verification is currently disabled by admins.';
	if (!config.verify_channel_id) return 'Verify channel is not configured.';
	if (!config.review_channel_id) return 'Review channel is not configured.';
	if (!config.verified_role_id || !config.unverified_role_id) {
		return 'Verified and unverified roles are not configured.';
	}
	return null;
}

function getAccountAgeHours(createdTimestamp: number): number {
	return Math.floor((Date.now() - createdTimestamp) / (1000 * 60 * 60));
}

function buildManualReviewResultEmbed(
	interaction: ButtonInteraction,
	actionType: string,
	message: string,
): EmbedBuilder {
	const baseEmbed = interaction.message.embeds[0]
		? EmbedBuilder.from(interaction.message.embeds[0])
		: new EmbedBuilder().setTitle('Manual Verification');

	return baseEmbed
		.setColor(Colors[actionType] || Colors.INFO)
		.addFields({ name: 'Resolution', value: message })
		.setFooter(FOOTER)
		.setTimestamp();
}

function disableButtonRows(rows: ActionRow<ButtonComponent>[]): ActionRowBuilder<ButtonBuilder>[] {
	return rows.map((row) =>
		new ActionRowBuilder().addComponents(
			row.components.map((component) => ButtonBuilder.from(component).setDisabled(true)),
		),
	);
}

function pruneChallengeSessions(): void {
	const now = Date.now();
	for (const [sessionId, session] of challengeSessions.entries()) {
		if (session.expiresAt <= now) {
			challengeSessions.delete(sessionId);
		}
	}
}
