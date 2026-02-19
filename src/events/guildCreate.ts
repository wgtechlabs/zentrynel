import type { Guild } from 'discord.js';
import { db } from '../db/index.js';
import { cacheGuildInvites } from '../services/inviteTracker.js';
import { logger } from '../utils/logger.js';

export const name = 'guildCreate';
export const once = false;

export async function execute(guild: Guild): Promise<void> {
	db.upsertGuildConfig(guild.id, {});
	await cacheGuildInvites(guild);
	logger.info(`Joined guild: ${guild.name} (${guild.id})`);
}
