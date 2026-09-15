import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import { BOT_VERSION } from '../config/constants.js';
import { successEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
	.setName('version')
	.setDescription('Show the current Zentrynel version');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.reply({
		embeds: [successEmbed('Zentrynel version', `Running version **v${BOT_VERSION}**.`)],
	});
}
