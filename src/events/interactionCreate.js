import { MessageFlags } from 'discord.js';
import { logger } from '../utils/logger.js';

export const name = 'interactionCreate';
export const once = false;

export async function execute(interaction, client) {
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

		const reply = { content: 'There was an error executing this command.', flags: [MessageFlags.Ephemeral] };
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp(reply);
		} else {
			await interaction.reply(reply);
		}
	}
}
