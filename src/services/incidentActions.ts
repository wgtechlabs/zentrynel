import type { Client } from 'discord.js';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';

/**
 * Discord Incident Actions API — disables DMs and/or invites server-wide.
 *
 * Discord only allows disabling for up to 24 hours at a time, so this service
 * periodically re-extends the timer for guilds that have these options enabled.
 *
 * Endpoint: PUT /guilds/{guild.id}/incident-actions
 * Body: { dms_disabled_until?: ISO8601, invites_disabled_until?: ISO8601 }
 */

/** How far ahead to set the disable expiry (24 hours). */
const DISABLE_DURATION_MS = 24 * 60 * 60 * 1000;

/** How often to refresh the incident action timers (every 12 hours). */
const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;

let refreshTimer: ReturnType<typeof setInterval> | null = null;

interface IncidentActionsBody {
	dms_disabled_until?: string | null;
	invites_disabled_until?: string | null;
}

/**
 * Apply incident actions (disable DMs / invites) for a single guild via
 * the Discord REST API.
 */
export async function applyIncidentActions(
	client: Client,
	guildId: string,
	dmDisabled: boolean,
	invitesDisabled: boolean,
): Promise<void> {
	const body: IncidentActionsBody = {};

	if (dmDisabled) {
		body.dms_disabled_until = new Date(Date.now() + DISABLE_DURATION_MS).toISOString();
	} else {
		body.dms_disabled_until = null;
	}

	if (invitesDisabled) {
		body.invites_disabled_until = new Date(Date.now() + DISABLE_DURATION_MS).toISOString();
	} else {
		body.invites_disabled_until = null;
	}

	await client.rest.put(`/guilds/${guildId}/incident-actions`, { body });
}

/**
 * Refresh incident action timers for guilds on this shard that have DMs
 * or invites disabled.  Called on startup and then at a regular interval.
 *
 * Only processes guilds the current shard serves, and refreshes
 * sequentially to avoid flooding Discord's rate limiter.
 */
export async function refreshAllIncidentActions(client: Client): Promise<void> {
	const allGuilds = db.getGuildsWithIncidentActions();

	// Only refresh guilds this shard actually serves
	const guilds = allGuilds.filter((g) => client.guilds.cache.has(g.guild_id));

	if (guilds.length === 0) return;

	logger.info(`Refreshing incident actions for ${guilds.length} guild(s)…`);

	for (const config of guilds) {
		try {
			await applyIncidentActions(
				client,
				config.guild_id,
				config.dm_disabled === 1,
				config.invites_disabled === 1,
			);
		} catch (err) {
			logger.error(
				`Failed to refresh incident actions for guild ${config.guild_id}:`,
				err,
			);
		}
	}
}

/**
 * Start the periodic refresh loop.  Should be called once when the bot is
 * ready.
 */
export function startIncidentActionsRefresh(client: Client): void {
	if (refreshTimer) return;

	// Run immediately on startup
	refreshAllIncidentActions(client).catch((err) =>
		logger.error('Initial incident actions refresh failed:', err),
	);

	// Then refresh on a regular interval
	refreshTimer = setInterval(() => {
		refreshAllIncidentActions(client).catch((err) =>
			logger.error('Periodic incident actions refresh failed:', err),
		);
	}, REFRESH_INTERVAL_MS);
}

/**
 * Stop the periodic refresh loop (e.g. during shutdown).
 */
export function stopIncidentActionsRefresh(): void {
	if (refreshTimer) {
		clearInterval(refreshTimer);
		refreshTimer = null;
	}
}
