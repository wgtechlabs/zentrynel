import type { Client, Interaction } from 'discord.js';
import { MessageFlags } from 'discord.js';
import { handleVerificationInteraction } from '../services/verification.js';
import { logger } from '../utils/logger.js';

export const name = 'interactionCreate';
export const once = false;

export async function execute(interaction: Interaction, client: Client): Promise<void> {
	if (interaction.isButton() || interaction.isModalSubmit()) {
		try {
			const handled = await handleVerificationInteraction(interaction);
			if (handled) return;
		} catch (error) {
			logger.error(`Error handling component interaction ${interaction.customId}:`, error);
			const reply = {
				content: 'There was an error handling this interaction.',
				flags: [MessageFlags.Ephemeral],
			};
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp(reply);
			} else {
				await interaction.reply(reply);
			}
		}
		if (!interaction.isChatInputCommand()) return;
	}

	if (!interaction.isChatInputCommand()) return;

	const command = client.commands.get(interaction.commandName);
	if (!command) {
		logger.warn(`Unknown command: ${interaction.commandName}`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		logger.error(`Error executing /${interaction.commandName}:`, error);

		const reply = {
			content: 'There was an error executing this command.',
			flags: [MessageFlags.Ephemeral],
		};
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp(reply);
		} else {
			await interaction.reply(reply);
		}
	}
}
