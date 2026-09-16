import { PermissionFlagsBits } from 'discord.js';
import type { Message } from 'discord.js';
import { ActionTypes } from '../config/constants.js';
import { db } from '../db/index.js';
import { send as sendModLog } from '../services/modLog.js';
import { honeypotWarningEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';

export const name = 'messageCreate';

export async function execute(message: Message): Promise<void> {
	if (message.author.bot) return;

	if (message.channel.isDMBased()) return;
	if (!message.guild || !message.member) return;

	const config = db.getGuildConfig(message.guild.id);
	if (
		!config.verification_honeypot_enabled ||
		message.channel.id !== config.verify_channel_id ||
		message.member.permissions.has(PermissionFlagsBits.Administrator) ||
		message.member.permissions.has(PermissionFlagsBits.ManageMessages)
	) {
		return;
	}

	const botMember = message.guild.members.me;
	if (!botMember) {
		logger.error(
			`Cannot enforce verification honeypot in guild ${message.guild.id}: bot member unavailable`,
		);
		return;
	}

	if (!('permissionsFor' in message.channel)) return;

	const channelPermissions = message.channel.permissionsFor(botMember);
	if (!channelPermissions?.has(['ManageMessages', 'SendMessages', 'EmbedLinks'])) {
		logger.error(
			`Cannot enforce verification honeypot in guild ${message.guild.id}: missing channel permissions`,
		);
		return;
	}

	try {
		await message.delete();
	} catch (err) {
		logger.error(
			`Failed to delete honeypot message from ${message.author.id} in guild ${message.guild.id}:`,
			(err as Error).message,
		);
		return;
	}

	const existingStrike = db.getActiveHoneypotStrike(message.guild.id, message.author.id);
	if (existingStrike) {
		if (!botMember.permissions.has(PermissionFlagsBits.BanMembers) || !message.member.bannable) {
			logger.error(
				`Cannot ban honeypot offender ${message.author.id} in guild ${message.guild.id}`,
			);
			return;
		}

		try {
			await message.guild.members.ban(message.author, {
				reason: 'Verification honeypot: repeated message within 24 hours',
			});
			db.logAction(
				message.guild.id,
				ActionTypes.BAN,
				message.author.id,
				message.client.user.id,
				'Verification honeypot: repeated message within 24 hours',
			);
			await sendModLog(message.guild, {
				actionType: ActionTypes.BAN,
				targetUser: message.author,
				moderator: message.client.user,
				reason: 'Verification honeypot: repeated message within 24 hours',
			});
		} catch (err) {
			logger.error(
				`Failed to ban honeypot offender ${message.author.id} in guild ${message.guild.id}:`,
				(err as Error).message,
			);
		}
		return;
	}

	try {
		const warning = await message.channel.send({
			content: `<@${message.author.id}>`,
			embeds: [honeypotWarningEmbed()],
			allowedMentions: { users: [message.author.id], roles: [], repliedUser: false },
		});
		db.addHoneypotStrike(message.guild.id, message.author.id);
		db.logAction(
			message.guild.id,
			ActionTypes.WARN,
			message.author.id,
			message.client.user.id,
			'Verification honeypot: first message in verify channel',
		);
		await sendModLog(message.guild, {
			actionType: ActionTypes.WARN,
			targetUser: message.author,
			moderator: message.client.user,
			reason: 'Verification honeypot: first message in verify channel',
		});
		setTimeout(
			() => {
				void warning.delete().catch((err: Error) => {
					logger.error(`Failed to remove honeypot warning ${warning.id}:`, err.message);
				});
			},
			3 * 60 * 1000,
		);
	} catch (err) {
		logger.error(
			`Failed to send honeypot warning to ${message.author.id} in guild ${message.guild.id}:`,
			(err as Error).message,
		);
	}
}
