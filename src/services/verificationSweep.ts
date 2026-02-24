import type { ActionRow, ButtonComponent, Client, Guild, GuildMember } from 'discord.js';
import {
	ActionRowBuilder,
	ButtonBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
} from 'discord.js';
import { ActionTypes, Colors } from '../config/constants.js';
import { db } from '../db/index.js';
import type { StaleManualReviewRow, StaleVerificationRow } from '../db/sqlite.js';
import { FOOTER } from '../utils/embeds.js';
import { formatDuration } from '../utils/time.js';
import { logger } from '../utils/logger.js';
import * as modLog from './modLog.js';
import { disableButtonRows } from './verification.js';

/** How often to run the sweep (2 minutes). */
const SWEEP_INTERVAL_MS = 2 * 60 * 1000;

/** Delay before the first sweep after bot ready (30 seconds). */
const STARTUP_DELAY_MS = 30 * 1000;

/** Maximum members to kick per guild per sweep tick. */
const PER_GUILD_CAP = 50;

/** Maximum total members to process per sweep tick across all guilds. */
const TOTAL_CAP = 200;

/** Delay between processing individual members (500ms = 2/sec). */
const PROCESS_DELAY_MS = 500;

/** Maximum manual reviews to remind per sweep tick. */
const REMIND_CAP = 50;

/** Maximum manual reviews to expire per sweep tick. */
const EXPIRE_CAP = 50;

let sweepTimer: ReturnType<typeof setInterval> | null = null;
let startupTimer: ReturnType<typeof setTimeout> | null = null;
let processing = false;

/**
 * Start the verification sweep loop. Should be called once when the bot
 * is ready. Waits 30 seconds before the first sweep to let the bot stabilize.
 */
export function startVerificationSweep(client: Client): void {
	if (sweepTimer || startupTimer) return;

	startupTimer = setTimeout(() => {
		startupTimer = null;

		sweepStaleVerifications(client).catch((err) =>
			logger.error('Initial verification sweep failed:', err),
		);

		sweepTimer = setInterval(() => {
			sweepStaleVerifications(client).catch((err) =>
				logger.error('Verification sweep failed:', err),
			);
		}, SWEEP_INTERVAL_MS);
	}, STARTUP_DELAY_MS);
}

/**
 * Stop the sweep loop. Called on graceful shutdown.
 */
export function stopVerificationSweep(): void {
	if (startupTimer) {
		clearTimeout(startupTimer);
		startupTimer = null;
	}
	if (sweepTimer) {
		clearInterval(sweepTimer);
		sweepTimer = null;
	}
}

/**
 * Sleep helper for rate-limiting.
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Core sweep with four phases:
 * A) Kick stale PENDING + REJECTED + REVIEW_EXPIRED members
 * B) Send reminder for manual reviews approaching expiry (75%)
 * C) Expire stale manual reviews (100%)
 * D) Kick expired members after review expiry (handled in phase A via status)
 */
async function sweepStaleVerifications(client: Client): Promise<void> {
	// Prevent concurrent sweeps if a previous one is still running
	if (processing) return;
	processing = true;

	try {
		// Phase B: Remind expiring manual reviews (non-destructive, runs first)
		await phaseRemindExpiringReviews(client);

		// Phase C: Expire stale manual reviews (sets REVIEW_EXPIRED, edits embeds)
		await phaseExpireStaleReviews(client);

		// Phase A+D: Kick stale PENDING + REJECTED + REVIEW_EXPIRED members
		await phaseKickStaleMembers(client);
	} catch (err) {
		logger.error('Verification sweep error:', err);
	} finally {
		processing = false;
	}
}

/**
 * Phase A+D: Kick stale PENDING, REJECTED, and REVIEW_EXPIRED members.
 */
async function phaseKickStaleMembers(client: Client): Promise<void> {
	const staleMembers = db.getStaleVerificationStates();
	if (staleMembers.length === 0) return;

	const grouped = groupByGuild(staleMembers);
	let totalProcessed = 0;

	for (const [guildId, members] of grouped) {
		if (totalProcessed >= TOTAL_CAP) break;

		const guild = client.guilds.cache.get(guildId);
		if (!guild) continue;

		const botMember = guild.members.me;
		if (!botMember?.permissions.has(PermissionFlagsBits.KickMembers)) {
			logger.warn(
				`Missing Kick Members permission in guild ${guildId} — skipping verification sweep`,
			);
			continue;
		}

		const remaining = TOTAL_CAP - totalProcessed;
		const capped = members.slice(0, Math.min(PER_GUILD_CAP, remaining));

		for (const member of capped) {
			await processStaleVerification(guild, botMember, member);
			totalProcessed++;
			await sleep(PROCESS_DELAY_MS);
		}
	}
}

/**
 * Phase B: Send reminders for manual reviews approaching 75% of their timeout.
 */
async function phaseRemindExpiringReviews(client: Client): Promise<void> {
	const remindable = db.getRemindableManualReviews();
	if (remindable.length === 0) return;

	const capped = remindable.slice(0, REMIND_CAP);

	for (const row of capped) {
		try {
			const guild = client.guilds.cache.get(row.guild_id);
			if (!guild || !row.review_channel_id || !row.review_message_id) {
				// Mark reminded to avoid retrying
				db.upsertVerificationState(row.guild_id, row.user_id, { review_reminded: 1 });
				continue;
			}

			const reviewChannel =
				guild.channels.cache.get(row.review_channel_id) ||
				(await guild.channels.fetch(row.review_channel_id).catch(() => null));

			if (!reviewChannel?.isTextBased()) {
				db.upsertVerificationState(row.guild_id, row.user_id, { review_reminded: 1 });
				continue;
			}

			const reviewMessage = await reviewChannel.messages
				.fetch(row.review_message_id)
				.catch(() => null);

			if (!reviewMessage) {
				db.upsertVerificationState(row.guild_id, row.user_id, { review_reminded: 1 });
				continue;
			}

			// Calculate expiry timestamp
			const createdMs = new Date(row.created_at).getTime();
			const expiresAt = Math.floor((createdMs + row.manual_review_timeout) / 1000);

			await reviewMessage.reply({
				content: `⚠️ This review expires <t:${expiresAt}:R>. Please approve, reject, or take action before then.`,
			});

			db.upsertVerificationState(row.guild_id, row.user_id, { review_reminded: 1 });
		} catch (err) {
			logger.error(
				`Failed to send review reminder for ${row.user_id} in guild ${row.guild_id}:`,
				(err as Error).message,
			);
			// Mark reminded even on failure to prevent spam retries
			db.upsertVerificationState(row.guild_id, row.user_id, { review_reminded: 1 });
		}
		await sleep(PROCESS_DELAY_MS);
	}
}

/**
 * Phase C: Expire stale manual reviews — update status, edit review embeds.
 */
async function phaseExpireStaleReviews(client: Client): Promise<void> {
	const expired = db.getExpiredManualReviews();
	if (expired.length === 0) return;

	const capped = expired.slice(0, EXPIRE_CAP);

	for (const row of capped) {
		try {
			const guild = client.guilds.cache.get(row.guild_id);
			if (!guild) {
				db.upsertVerificationState(row.guild_id, row.user_id, {
					status: 'REVIEW_EXPIRED',
					review_message_id: null,
				});
				continue;
			}

			// Update status to REVIEW_EXPIRED
			db.upsertVerificationState(row.guild_id, row.user_id, {
				status: 'REVIEW_EXPIRED',
				manual_reason: `Review expired after ${formatDuration(row.manual_review_timeout)}`,
				review_message_id: null,
			});

			// Try to edit the review embed
			if (row.review_channel_id && row.review_message_id) {
				const reviewChannel =
					guild.channels.cache.get(row.review_channel_id) ||
					(await guild.channels.fetch(row.review_channel_id).catch(() => null));

				if (reviewChannel?.isTextBased()) {
					const reviewMessage = await reviewChannel.messages
						.fetch(row.review_message_id)
						.catch(() => null);

					if (reviewMessage) {
						const expiredEmbed = reviewMessage.embeds[0]
							? EmbedBuilder.from(reviewMessage.embeds[0])
							: new EmbedBuilder();

						expiredEmbed
							.setColor(Colors.REVIEW_EXPIRED)
							.setTitle('Manual Review Expired')
							.addFields({
								name: 'Resolution',
								value: `Review expired after ${formatDuration(row.manual_review_timeout)} — member will be auto-kicked`,
							})
							.setFooter(FOOTER)
							.setTimestamp();

						// Disable all buttons
						const disabledComponents = disableButtonRows(
							reviewMessage.components as ActionRow<ButtonComponent>[],
						);

						await reviewMessage.edit({
							embeds: [expiredEmbed],
							components: disabledComponents,
						});
					}
				}
			}

			// Log the action
			const botUser = guild.client.user;
			db.logAction(
				row.guild_id,
				ActionTypes.REVIEW_EXPIRED,
				row.user_id,
				botUser.id,
				`Manual review expired after ${formatDuration(row.manual_review_timeout)}`,
				null,
				null,
			);

			await modLog.send(guild, {
				actionType: ActionTypes.REVIEW_EXPIRED,
				targetUser: await guild.client.users.fetch(row.user_id).catch(() => null),
				moderator: botUser,
				reason: `Manual review expired after ${formatDuration(row.manual_review_timeout)}`,
				extra: `Status was **MANUAL_REVIEW** since ${row.created_at} UTC`,
			});
		} catch (err) {
			logger.error(
				`Failed to expire review for ${row.user_id} in guild ${row.guild_id}:`,
				(err as Error).message,
			);
		}
		await sleep(PROCESS_DELAY_MS);
	}
}

/**
 * Group stale verification rows by guild ID.
 */
function groupByGuild(rows: StaleVerificationRow[]): Map<string, StaleVerificationRow[]> {
	const map = new Map<string, StaleVerificationRow[]>();
	for (const row of rows) {
		const existing = map.get(row.guild_id);
		if (existing) {
			existing.push(row);
		} else {
			map.set(row.guild_id, [row]);
		}
	}
	return map;
}

/**
 * Process a single stale member: fetch, validate, kick, log.
 * Errors are isolated per member — one failure doesn't block others.
 */
async function processStaleVerification(
	guild: Guild,
	botMember: GuildMember,
	row: StaleVerificationRow,
): Promise<void> {
	try {
		const member = await guild.members.fetch(row.user_id).catch(() => null);

		if (!member) {
			// Member already left — clean up the verification state
			db.deleteVerificationState(guild.id, row.user_id);
			return;
		}

		if (!member.kickable) {
			logger.warn(
				`Cannot kick member ${row.user_id} in guild ${guild.id}: not kickable (role hierarchy)`,
			);
			return;
		}

		const timeoutDisplay = formatDuration(row.verification_kick_timeout);
		const reason =
			row.status === 'PENDING'
				? `Failed to complete verification within ${timeoutDisplay}`
				: 'Failed to pass manual review process';

		await member.kick(reason);

		// Update verification state to KICKED
		db.upsertVerificationState(guild.id, row.user_id, { status: 'KICKED' });

		// Use appropriate action type based on original status
		const actionType = ActionTypes.VERIFY_KICK;

		// Log the action
		db.logAction(
			guild.id,
			actionType,
			row.user_id,
			botMember.user.id,
			reason,
			null,
			null,
		);

		// Send mod log
		await modLog.send(guild, {
			actionType,
			targetUser: member.user,
			moderator: botMember.user,
			reason,
			extra: `Status was **${row.status}** since ${row.created_at} UTC`,
		});
	} catch (err) {
		const discordError = err as { code?: number; message?: string };

		// Unknown Member (10007) — member left between fetch and kick
		if (discordError.code === 10007) {
			db.deleteVerificationState(guild.id, row.user_id);
			return;
		}

		logger.error(
			`Failed to process verification kick for ${row.user_id} in guild ${guild.id}:`,
			(err as Error).message,
		);
	}
}
