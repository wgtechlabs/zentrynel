import type { Client, Guild, GuildMember } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import { ActionTypes } from '../config/constants.js';
import { db } from '../db/index.js';
import type { StaleVerificationRow } from '../db/sqlite.js';
import { formatDuration } from '../utils/time.js';
import { logger } from '../utils/logger.js';
import * as modLog from './modLog.js';

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
 * Core sweep: queries all stale PENDING verification states across all
 * guilds in a single DB call, then processes kicks with rate limiting.
 */
async function sweepStaleVerifications(client: Client): Promise<void> {
	// Prevent concurrent sweeps if a previous one is still running
	if (processing) return;
	processing = true;

	try {
		const staleMembers = db.getStaleVerificationStates();
		if (staleMembers.length === 0) return;

		// Group by guild and cap per guild
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
	} catch (err) {
		logger.error('Verification sweep error:', err);
	} finally {
		processing = false;
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
		const reason = `Failed to complete verification within ${timeoutDisplay}`;

		await member.kick(reason);

		// Update verification state to KICKED
		db.upsertVerificationState(guild.id, row.user_id, { status: 'KICKED' });

		// Log the action
		db.logAction(
			guild.id,
			ActionTypes.VERIFY_KICK,
			row.user_id,
			botMember.user.id,
			reason,
			null,
			null,
		);

		// Send mod log
		await modLog.send(guild, {
			actionType: ActionTypes.VERIFY_KICK,
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
