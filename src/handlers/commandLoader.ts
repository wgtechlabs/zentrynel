import type { Client } from 'discord.js';
import { commands } from './commandRegistry.js';
import { logger } from '../utils/logger.js';

export async function loadCommands(client: Client): Promise<void> {
	for (const command of commands) {
		if (!command.data || !command.execute) {
			logger.warn('Skipping command: missing "data" or "execute" export');
			continue;
		}
		client.commands.set(command.data.name, command);
	}

	const commandNames = [...client.commands.values()].map((command) => `/${command.data.name}`);
	logger.info(`Loaded ${client.commands.size} commands: ${commandNames.join(', ')}`);
}
