import type { ChatInputCommandInteraction, User } from 'discord.js';
import { ActionTypes } from '../config/constants.js';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { formatDuration } from '../utils/time.js';
import { send as sendModLog } from './modLog.js';

interface EscalationResult {
	escalated: boolean;
	action: string | null;
	error?: string;
}

export async function checkEscalation(
	interaction: ChatInputCommandInteraction,
	targetUser: User,
	warningCount: number,
): Promise<EscalationResult> {
	if (!interaction.guildId || !interaction.guild) return { escalated: false, action: null };

	const config = db.getGuildConfig(interaction.guildId);
	const targetMember = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);

	if (!targetMember) {
		return { escalated: false, action: null };
	}

	if (warningCount >= config.warn_threshold_ban) {
		try {
			await targetUser
				.send(
					`You have been banned from **${interaction.guild?.name}** for reaching ${warningCount} warnings.`,
				)
				.catch(() => {});

			await interaction.guild?.members.ban(targetUser, {
				reason: `Automatic ban: reached ${warningCount} warnings`,
			});

			db.logAction(
				interaction.guildId,
				ActionTypes.BAN,
				targetUser.id,
				interaction.client.user.id,
				`Automatic: ${warningCount} warnings reached`,
			);

			await sendModLog(interaction.guild, {
				actionType: ActionTypes.BAN,
				targetUser,
				moderator: interaction.client.user,
				reason: `Automatic: ${warningCount} warnings reached (threshold: ${config.warn_threshold_ban})`,
			});

			return { escalated: true, action: ActionTypes.BAN };
		} catch (err) {
			logger.error(`Auto-ban failed for ${targetUser.id}:`, (err as Error).message);
			return { escalated: false, action: ActionTypes.BAN, error: (err as Error).message };
		}
	} else if (warningCount >= config.warn_threshold_kick) {
		try {
			await targetUser
				.send(
					`You have been kicked from **${interaction.guild?.name}** for reaching ${warningCount} warnings.`,
				)
				.catch(() => {});

			await targetMember.kick(`Automatic kick: reached ${warningCount} warnings`);

			db.logAction(
				interaction.guildId,
				ActionTypes.KICK,
				targetUser.id,
				interaction.client.user.id,
				`Automatic: ${warningCount} warnings reached`,
			);

			await sendModLog(interaction.guild, {
				actionType: ActionTypes.KICK,
				targetUser,
				moderator: interaction.client.user,
				reason: `Automatic: ${warningCount} warnings reached (threshold: ${config.warn_threshold_kick})`,
			});

			return { escalated: true, action: ActionTypes.KICK };
		} catch (err) {
			logger.error(`Auto-kick failed for ${targetUser.id}:`, (err as Error).message);
			return { escalated: false, action: ActionTypes.KICK, error: (err as Error).message };
		}
	} else if (warningCount >= config.warn_threshold_mute) {
		try {
			const duration = config.mute_duration_default;

			await targetUser
				.send(
					`You have been muted in **${interaction.guild?.name}** for ${formatDuration(duration)} for reaching ${warningCount} warnings.`,
				)
				.catch(() => {});

			await targetMember.timeout(duration, `Automatic mute: reached ${warningCount} warnings`);

			db.logAction(
				interaction.guildId,
				ActionTypes.MUTE,
				targetUser.id,
				interaction.client.user.id,
				`Automatic: ${warningCount} warnings reached`,
				duration,
			);

			await sendModLog(interaction.guild, {
				actionType: ActionTypes.MUTE,
				targetUser,
				moderator: interaction.client.user,
				reason: `Automatic: ${warningCount} warnings reached (threshold: ${config.warn_threshold_mute})`,
				duration: formatDuration(duration),
			});

			return { escalated: true, action: ActionTypes.MUTE };
		} catch (err) {
			logger.error(`Auto-mute failed for ${targetUser.id}:`, (err as Error).message);
			return { escalated: false, action: ActionTypes.MUTE, error: (err as Error).message };
		}
	}

	return { escalated: false, action: null };
}
