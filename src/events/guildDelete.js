import { logger } from '../utils/logger.js';

export const name = 'guildDelete';
export const once = false;

export async function execute(guild) {
	logger.info(`Removed from guild: ${guild.name} (${guild.id})`);
}
