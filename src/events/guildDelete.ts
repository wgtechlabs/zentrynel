import type { Guild } from 'discord.js';
import { db } from '../db/index.js';
import { clearGuildCache } from '../services/inviteTracker.js';
import { logger } from '../utils/logger.js';

export const name = 'guildDelete';
export const once = false;

export async function execute(guild: Guild): Promise<void> {
	db.deleteGuildConfig(guild.id);
	clearGuildCache(guild.id);
	logger.info(`Removed from guild: ${guild.name} (${guild.id})`);
}
