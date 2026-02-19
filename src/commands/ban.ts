import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { ActionTypes } from '../config/constants.js';
import { db } from '../db/index.js';
import { send as sendModLog } from '../services/modLog.js';
import { errorEmbed, successEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { canModerate } from '../utils/permissions.js';

export const data = new SlashCommandBuilder()
	.setName('ban')
	.setDescription('Ban a user from the server')
	.addUserOption((option) =>
		option.setName('user').setDescription('The user to ban').setRequired(true),
	)
	.addStringOption((option) => option.setName('reason').setDescription('Reason for the ban'))
	.addIntegerOption((option) =>
		option
			.setName('delete_messages')
			.setDescription('Days of messages to delete (0-7)')
			.setMinValue(0)
			.setMaxValue(7),
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guildId || !interaction.guild) {
		await interaction.reply({
			content: 'This command can only be used in a server.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const targetUser = interaction.options.getUser('user', true);
	const reason = (interaction.options.getString('reason') || 'No reason provided').slice(0, 1000);
	const deleteMessageDays = interaction.options.getInteger('delete_messages') || 0;

	const targetMember = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);

	if (targetMember) {
		const check = await canModerate(interaction, targetMember);
		if (!check.allowed) {
			return interaction.reply({
				embeds: [errorEmbed(check.reason)],
				flags: [MessageFlags.Ephemeral],
			});
		}

		if (!targetMember.bannable) {
			return interaction.reply({
				embeds: [errorEmbed('I do not have permission to ban this user.')],
				flags: [MessageFlags.Ephemeral],
			});
		}
	}

	await targetUser
		.send(`You have been banned from **${interaction.guild?.name}**.\n**Reason:** ${reason}`)
		.catch(() => {});

	await interaction.guild?.members.ban(targetUser, {
		reason,
		deleteMessageSeconds: deleteMessageDays * 86_400,
	});

	db.logAction(
		interaction.guildId,
		ActionTypes.BAN,
		targetUser.id,
		interaction.user.id,
		reason,
		null,
		{ deleteMessageDays },
	);

	await sendModLog(interaction.guild, {
		actionType: ActionTypes.BAN,
		targetUser,
		moderator: interaction.user,
		reason,
		extra: deleteMessageDays > 0 ? `Deleted ${deleteMessageDays} day(s) of messages` : null,
	});

	const embed = successEmbed(
		'User Banned',
		`${targetUser} has been banned from the server.\n**Reason:** ${reason}`,
	);

	await interaction.reply({ embeds: [embed] });
}
