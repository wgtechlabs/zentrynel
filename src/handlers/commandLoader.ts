import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Client } from 'discord.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadCommands(client: Client): Promise<void> {
	const commandsPath = join(__dirname, '..', 'commands');
	const files = readdirSync(commandsPath).filter((f) => f.endsWith('.ts'));

	for (const file of files) {
		const filePath = join(commandsPath, file);
		const command = await import(`file://${filePath}`);

		if (!command.data || !command.execute) {
			logger.warn(`Skipping ${file}: missing "data" or "execute" export`);
			continue;
		}

		client.commands.set(command.data.name, command);
	}

	logger.info(`Loaded ${client.commands.size} commands`);
}
