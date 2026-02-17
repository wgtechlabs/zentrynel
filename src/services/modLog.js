import { db } from '../db/index.js';
import { modActionEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';

export async function send(guild, { actionType, targetUser, moderator, reason, duration, extra }) {
	const config = await db.getGuildConfig(guild.id);

	if (!config.log_channel_id) return;

	const channel =
		guild.channels.cache.get(config.log_channel_id) ||
		(await guild.channels.fetch(config.log_channel_id).catch(() => null));

	if (!channel) {
		logger.warn(`Log channel ${config.log_channel_id} not found in guild ${guild.id}`);
		return;
	}

	const embed = modActionEmbed({ actionType, targetUser, moderator, reason, duration, extra });

	await channel.send({ embeds: [embed] }).catch((err) => {
		logger.error(`Failed to send mod log in guild ${guild.id}:`, err.message);
	});
}
