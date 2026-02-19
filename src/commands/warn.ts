import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { ActionTypes } from '../config/constants.js';
import { db } from '../db/index.js';
import { send as sendModLog } from '../services/modLog.js';
import { checkEscalation } from '../services/moderation.js';
import { errorEmbed, successEmbed } from '../utils/embeds.js';
import { canModerate } from '../utils/permissions.js';

export const data = new SlashCommandBuilder()
	.setName('warn')
	.setDescription('Issue a warning to a user')
	.addUserOption((option) =>
		option.setName('user').setDescription('The user to warn').setRequired(true),
	)
	.addStringOption((option) => option.setName('reason').setDescription('Reason for the warning'))
	.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guildId || !interaction.guild) return;

	const targetUser = interaction.options.getUser('user', true);
	const reason = (interaction.options.getString('reason') || 'No reason provided').slice(0, 1000);

	const targetMember = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
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

	const { id } = db.addWarning(
		interaction.guildId,
		targetUser.id,
		interaction.user.id,
		reason,
	);
	const count = db.getActiveWarningCount(interaction.guildId, targetUser.id);

	db.logAction(
		interaction.guildId,
		ActionTypes.WARN,
		targetUser.id,
		interaction.user.id,
		reason,
		null,
		null,
	);

	await sendModLog(interaction.guild, {
		actionType: ActionTypes.WARN,
		targetUser,
		moderator: interaction.user,
		reason,
		extra: `Warning #${id} — Total active: ${count}`,
	});

	await targetUser
		.send(
			`You have been warned in **${interaction.guild?.name}**.\n**Reason:** ${reason}\n**Active warnings:** ${count}`,
		)
		.catch(() => {});

	const embed = successEmbed(
		'Warning Issued',
		`${targetUser} has been warned.\n**Reason:** ${reason}\n**Warning ID:** #${id}\n**Active warnings:** ${count}`,
	);

	await interaction.reply({ embeds: [embed] });

	await checkEscalation(interaction, targetUser, count);
}
