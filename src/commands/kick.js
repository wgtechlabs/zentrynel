import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { ActionTypes } from '../config/constants.js';
import { db } from '../db/index.js';
import { send as sendModLog } from '../services/modLog.js';
import { errorEmbed, successEmbed } from '../utils/embeds.js';
import { canModerate } from '../utils/permissions.js';

export const data = new SlashCommandBuilder()
	.setName('kick')
	.setDescription('Kick a user from the server')
	.addUserOption((option) =>
		option.setName('user').setDescription('The user to kick').setRequired(true),
	)
	.addStringOption((option) => option.setName('reason').setDescription('Reason for the kick'))
	.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

export async function execute(interaction) {
	const targetUser = interaction.options.getUser('user');
	const reason = interaction.options.getString('reason') || 'No reason provided';

	const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
	if (!targetMember) {
		return interaction.reply({
			embeds: [errorEmbed('User not found in this server.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	const check = canModerate(interaction, targetMember);
	if (!check.allowed) {
		return interaction.reply({
			embeds: [errorEmbed(check.reason)],
			flags: [MessageFlags.Ephemeral],
		});
	}

	if (!targetMember.kickable) {
		return interaction.reply({
			embeds: [errorEmbed('I do not have permission to kick this user.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	await targetUser
		.send(`You have been kicked from **${interaction.guild.name}**.\n**Reason:** ${reason}`)
		.catch(() => {});

	await targetMember.kick(reason);

	await db.logAction(
		interaction.guildId,
		ActionTypes.KICK,
		targetUser.id,
		interaction.user.id,
		reason,
		null,
		null,
	);

	await sendModLog(interaction.guild, {
		actionType: ActionTypes.KICK,
		targetUser,
		moderator: interaction.user,
		reason,
	});

	const embed = successEmbed(
		'User Kicked',
		`${targetUser} has been kicked from the server.\n**Reason:** ${reason}`,
	);

	await interaction.reply({ embeds: [embed] });
}
