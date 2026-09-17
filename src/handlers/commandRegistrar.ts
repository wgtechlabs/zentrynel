import { REST, Routes } from 'discord.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { commands } from './commandRegistry.js';

export async function registerCommands(): Promise<void> {
	const commandData = commands.map((command) => command.data.toJSON());

	const rest = new REST().setToken(env.DISCORD_TOKEN);

	logger.info(
		`Prepared ${commandData.length} commands for ${
			env.DEV_GUILD_ID ? 'guild' : 'global'
		} registration: ${commandData.map((command) => `/${command.name}`).join(', ')}`,
	);

	if (env.DEV_GUILD_ID) {
		// Clear stale global commands so they don't shadow guild-scoped ones
		const globalCommands = (await rest.get(Routes.applicationCommands(env.CLIENT_ID))) as
			unknown[];
		if (globalCommands.length > 0) {
			logger.info(
				`Clearing ${globalCommands.length} stale global commands to avoid shadowing...`,
			);
			await rest.put(Routes.applicationCommands(env.CLIENT_ID), { body: [] });
			logger.info('Global commands cleared.');
		}

		logger.info(`Registering ${commandData.length} commands to guild ${env.DEV_GUILD_ID}...`);
		await rest.put(Routes.applicationGuildCommands(env.CLIENT_ID, env.DEV_GUILD_ID), {
			body: commandData,
		});
		logger.info('Guild commands registered (instant).');
	} else {
		logger.info(`Registering ${commandData.length} commands globally...`);
		await rest.put(Routes.applicationCommands(env.CLIENT_ID), { body: commandData });
		logger.info('Global commands registered (may take up to 1 hour to propagate).');
	}
}

// Allow running as standalone script: bun run src/handlers/commandRegistrar.ts
const normalizedUrl = import.meta.url.replace(/\\/g, '/');
const normalizedArgv = `file://${process.argv[1]}`.replace(/\\/g, '/');
const isMain = normalizedUrl === normalizedArgv || process.argv[1]?.endsWith('commandRegistrar.ts');

if (isMain) {
	registerCommands().catch((err) => {
		logger.error('Failed to register commands:', err);
		process.exit(1);
	});
}
