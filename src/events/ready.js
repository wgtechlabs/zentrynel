import { cacheGuildInvites } from '../services/inviteTracker.js';
import { logger } from '../utils/logger.js';

export const name = 'clientReady';
export const once = true;

export async function execute(client) {
	const shardId = client.shard?.ids.join(', ') ?? 'N/A';
	logger.info(`Shard ${shardId} ready. Logged in as ${client.user.tag}`);
	logger.info(`Serving ${client.guilds.cache.size} guilds on this shard`);

	for (const guild of client.guilds.cache.values()) {
		await cacheGuildInvites(guild);
	}
}
