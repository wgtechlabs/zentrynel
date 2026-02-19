import { randomInt, randomUUID } from 'node:crypto';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	MessageFlags,
	PermissionFlagsBits,
} from 'discord.js';
import { ActionTypes, Colors } from '../config/constants.js';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { send as sendModLog } from './modLog.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const challengeSessions = new Map();

const challengeTemplates = [
	{
		question: 'Which option is a fruit?',
		options: ['Apple', 'Brick', 'Chair', 'Cloud'],
		answer: 0,
	},
	{
		question: 'Which animal says "meow"?',
		options: ['Cat', 'Fish', 'Snake', 'Ant'],
		answer: 0,
	},
	{
		question: 'Which item can you drink?',
		options: ['Water', 'Stone', 'Paper', 'Sand'],
		answer: 0,
	},
	{
		question: 'Which color is common for grass?',
		options: ['Green', 'Purple', 'Orange', 'Black'],
		answer: 0,
	},
];

export async function handleVerificationInteraction(interaction) {
	if (!interaction.isButton()) return false;

	pruneChallengeSessions();

	const parts = interaction.customId.split(':');
	if (parts[0] !== 'verify') return false;

	if (parts[1] === 'start') {
		await handleVerificationStart(interaction);
		return true;
	}

	if (parts[1] === 'ans') {
		await handleChallengeAnswer(interaction, parts[2], parts[3]);
		return true;
	}

	if (parts[1] === 'review') {
		await handleManualReviewAction(interaction, parts[2], parts[3]);
		return true;
	}

	return false;
}

async function handleVerificationStart(interaction) {
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

	const embed = new EmbedBuilder()
		.setColor(Colors.INFO)
		.setTitle('Verification Challenge')
		.setDescription(
			`Answer this challenge to verify your account:\n\n**${challenge.question}**\n\nThis challenge expires in 5 minutes.`,
		)
		.setTimestamp();

	const row = new ActionRowBuilder().addComponents(challenge.buttons);
	await interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] });
}

async function handleChallengeAnswer(interaction, sessionId, answerValue) {
	const session = challengeSessions.get(sessionId);
	if (!session) {
		await interaction.update({
			content: 'This challenge has expired. Click the verify button again.',
			embeds: [],
			components: [],
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
		await interaction.update({
			content: failed.manualReview
				? failed.queueError
					? `Challenge timed out and manual review queue failed: ${failed.queueError}`
					: 'Challenge timed out. Your verification has been sent to manual moderator review.'
				: 'Challenge timed out. Click the verify button again.',
			embeds: [],
			components: [],
		});
		return;
	}

	const answerIndex = Number.parseInt(answerValue, 10);
	if (Number.isNaN(answerIndex) || answerIndex !== session.answerIndex) {
		const failed = await registerFailedAttempt(interaction, 'Incorrect challenge answer.');
		await interaction.update({
			content: failed.manualReview
				? failed.queueError
					? `Incorrect answer and manual review queue failed: ${failed.queueError}`
					: 'Incorrect answer. You reached the retry limit and were sent for manual moderator review.'
				: 'Incorrect answer. Click the verify button to try again.',
			embeds: [],
			components: [],
		});
		return;
	}

	const config = db.getGuildConfig(interaction.guildId);
	const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
	if (!member) {
		await interaction.update({
			content: 'Unable to load your server membership. Please try again.',
			embeds: [],
			components: [],
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
		await interaction.update({
			content: queued.error
				? `Automated verification passed, but role assignment and manual queue failed: ${queued.error}`
				: 'Automated verification passed, but role assignment needs moderator review.',
			embeds: [],
			components: [],
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

	await interaction.update({
		content: `Verification complete. You now have <@&${config.verified_role_id}>.`,
		embeds: [],
		components: [],
	});
}

async function handleManualReviewAction(interaction, decision, userId) {
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

function createChallenge(guildId, userId) {
	const template = challengeTemplates[randomInt(challengeTemplates.length)];
	const options = shuffle(
		template.options.map((label, originalIndex) => ({
			label,
			originalIndex,
		})),
	);
	const answerIndex = options.findIndex((option) => option.originalIndex === template.answer);
	const sessionId = randomUUID().split('-')[0];

	challengeSessions.set(sessionId, {
		guildId,
		userId,
		answerIndex,
		expiresAt: Date.now() + CHALLENGE_TTL_MS,
	});

	const buttons = options.map((option, index) =>
		new ButtonBuilder()
			.setCustomId(`verify:ans:${sessionId}:${index}`)
			.setLabel(option.label)
			.setStyle(ButtonStyle.Secondary),
	);

	return {
		question: template.question,
		buttons,
	};
}

function shuffle(items) {
	const next = [...items];
	for (let i = next.length - 1; i > 0; i--) {
		const j = randomInt(i + 1);
		const temp = next[i];
		next[i] = next[j];
		next[j] = temp;
	}
	return next;
}

function evaluateRisk(member, minAccountAgeHours) {
	const reasons = [];
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

async function registerFailedAttempt(interaction, detail) {
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

async function queueManualReview(guild, member, config, { reasons, riskScore, triggeredBy }) {
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

async function applyVerifiedRoles(member, config, reason) {
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

async function applyUnverifiedRoles(member, config, reason) {
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

function validateVerificationConfig(config) {
	if (!config.verification_enabled) return 'Verification is currently disabled by admins.';
	if (!config.verify_channel_id) return 'Verify channel is not configured.';
	if (!config.review_channel_id) return 'Review channel is not configured.';
	if (!config.verified_role_id || !config.unverified_role_id) {
		return 'Verified and unverified roles are not configured.';
	}
	return null;
}

function getAccountAgeHours(createdTimestamp) {
	return Math.floor((Date.now() - createdTimestamp) / (1000 * 60 * 60));
}

function buildManualReviewResultEmbed(interaction, actionType, message) {
	const baseEmbed = interaction.message.embeds[0]
		? EmbedBuilder.from(interaction.message.embeds[0])
		: new EmbedBuilder().setTitle('Manual Verification');

	return baseEmbed
		.setColor(Colors[actionType] || Colors.INFO)
		.addFields({ name: 'Resolution', value: message })
		.setTimestamp();
}

function disableButtonRows(rows) {
	return rows.map((row) =>
		new ActionRowBuilder().addComponents(
			row.components.map((component) => ButtonBuilder.from(component).setDisabled(true)),
		),
	);
}

function pruneChallengeSessions() {
	const now = Date.now();
	for (const [sessionId, session] of challengeSessions.entries()) {
		if (session.expiresAt <= now) {
			challengeSessions.delete(sessionId);
		}
	}
}
