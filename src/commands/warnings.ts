import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { db } from '../db/index.js';
import { errorEmbed, warningListEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
	.setName('warnings')
	.setDescription('View active warnings for a user')
	.addUserOption((option) =>
		option.setName('user').setDescription('The user to check').setRequired(true),
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guildId) return;

	const targetUser = interaction.options.getUser('user', true);

	const warnings = db.getWarnings(interaction.guildId, targetUser.id, true);

	if (warnings.length === 0) {
		return interaction.reply({
			embeds: [errorEmbed(`${targetUser} has no active warnings.`)],
			flags: [MessageFlags.Ephemeral],
		});
	}

	const embed = warningListEmbed(targetUser, warnings);

	await interaction.reply({ embeds: [embed] });
}
