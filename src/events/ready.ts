import type { Client } from 'discord.js';
import { startIncidentActionsRefresh } from '../services/incidentActions.js';
import { cacheGuildInvites } from '../services/inviteTracker.js';
import { startVerificationSweep } from '../services/verificationSweep.js';
import { logger } from '../utils/logger.js';

export const name = 'clientReady';
export const once = true;

export async function execute(client: Client): Promise<void> {
	const shardId = client.shard?.ids.join(', ') ?? 'N/A';
	logger.info(`Shard ${shardId} ready. Logged in as ${client.user?.tag}`);
	logger.info(`Serving ${client.guilds.cache.size} guilds on this shard`);

	await Promise.allSettled(client.guilds.cache.map((guild) => cacheGuildInvites(guild)));

	startIncidentActionsRefresh(client);
	startVerificationSweep(client);
}
