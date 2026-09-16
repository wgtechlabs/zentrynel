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

	logger.info(`Loaded ${client.commands.size} commands:`);
	for (const [, cmd] of client.commands) {
		const json = cmd.data.toJSON();
		const subs = (json.options ?? []).filter((o) => o.type === 1);
		const subInfo =
			subs.length > 0
				? ` (${subs.length} subcommands: ${subs.map((s) => s.name).join(', ')})`
				: '';
		logger.info(`  /${json.name}${subInfo}`);
	}
}
