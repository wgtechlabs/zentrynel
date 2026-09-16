import { ActivityType, type Client } from 'discord.js';
import { BOT_VERSION } from '../config/constants.js';
import { startIncidentActionsRefresh } from '../services/incidentActions.js';
import { cacheGuildInvites } from '../services/inviteTracker.js';
import { startVerificationSweep } from '../services/verificationSweep.js';
import { logger } from '../utils/logger.js';

export const name = 'clientReady';
export const once = true;

export async function execute(client: Client): Promise<void> {
	const shardId = client.shard?.ids.join(', ') ?? 'N/A';
	logger.info(`Zentrynel v${BOT_VERSION} ready. Shard ${shardId} logged in as ${client.user?.tag}`);
	logger.info(`Serving ${client.guilds.cache.size} guilds on this shard`);

	client.user?.setPresence({
		activities: [
			{
				name: "I'm Watching You",
				state: "I'm Watching You",
				type: ActivityType.Custom,
			},
		],
		status: 'online',
	});

	await Promise.allSettled(client.guilds.cache.map((guild) => cacheGuildInvites(guild)));

	startIncidentActionsRefresh(client);
	startVerificationSweep(client);
}
