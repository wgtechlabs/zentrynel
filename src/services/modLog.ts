import type { Guild, TextChannel, User } from 'discord.js';
import { db } from '../db/index.js';
import { modActionEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';

interface ModLogOptions {
	actionType: string;
	targetUser: User | null;
	moderator: User;
	reason?: string | null;
	duration?: string | null;
	extra?: string | null;
}

export async function send(guild: Guild, options: ModLogOptions): Promise<void> {
	const config = db.getGuildConfig(guild.id);
	if (!config?.log_channel_id) return;

	const channel =
		(guild.channels.cache.get(config.log_channel_id) as TextChannel | undefined) ??
		((await guild.channels.fetch(config.log_channel_id).catch(() => null)) as TextChannel | null);

	if (!channel) {
		logger.warn(`Log channel ${config.log_channel_id} not found in guild ${guild.id}`);
		return;
	}

	const embed = modActionEmbed(options);

	await channel.send({ embeds: [embed] }).catch((err: Error) => {
		logger.error(`Failed to send mod log in guild ${guild.id}:`, err.message);
	});
}
