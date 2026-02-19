import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Client } from 'discord.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadCommands(client: Client): Promise<void> {
	const commandsPath = join(__dirname, '..', 'commands');
	const files = readdirSync(commandsPath).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

	for (const file of files) {
		const filePath = join(commandsPath, file);
		try {
			const command = await import(pathToFileURL(filePath).href);

			if (!command.data || !command.execute) {
				logger.warn(`Skipping ${file}: missing "data" or "execute" export`);
				continue;
			}

			if (typeof command.data.name !== 'string') {
				logger.warn(`Skipping ${file}: command.data.name is not a string`);
				continue;
			}

			client.commands.set(command.data.name, command);
		} catch (err) {
			logger.error(`Failed to load command from ${file}:`, err);
		}
	}

	logger.info(`Loaded ${client.commands.size} commands`);
}
