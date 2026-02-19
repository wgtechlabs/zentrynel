import { clearGuildCache } from '../services/inviteTracker.js';
import { logger } from '../utils/logger.js';

export const name = 'guildDelete';
export const once = false;

export async function execute(guild) {
	clearGuildCache(guild.id);
	logger.info(`Removed from guild: ${guild.name} (${guild.id})`);
}
