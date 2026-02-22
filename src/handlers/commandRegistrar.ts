import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REST, Routes } from 'discord.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function registerCommands(): Promise<void> {
	const commandsPath = join(__dirname, '..', 'commands');
	const files = readdirSync(commandsPath).filter((f) => f.endsWith('.ts'));

	const commands: unknown[] = [];
	for (const file of files) {
		const filePath = join(commandsPath, file);
		const command = await import(`file://${filePath}`);
		if (command.data) {
			commands.push(command.data.toJSON());
		}
	}

	const rest = new REST().setToken(env.DISCORD_TOKEN);

	logger.info(`Built ${commands.length} commands:`);
	for (const cmd of commands) {
		const c = cmd as { name: string; options?: Array<{ type: number; name: string }> };
		const subs = (c.options ?? []).filter((o) => o.type === 1);
		const subInfo =
			subs.length > 0
				? ` (${subs.length} subcommands: ${subs.map((s) => s.name).join(', ')})`
				: '';
		logger.info(`  /${c.name}${subInfo}`);
	}

	if (env.DEV_GUILD_ID) {
		logger.info(`Registering ${commands.length} commands to guild ${env.DEV_GUILD_ID}...`);
		await rest.put(Routes.applicationGuildCommands(env.CLIENT_ID, env.DEV_GUILD_ID), {
			body: commands,
		});
		logger.info('Guild commands registered (instant).');
	} else {
		logger.info(`Registering ${commands.length} commands globally...`);
		await rest.put(Routes.applicationCommands(env.CLIENT_ID), { body: commands });
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
