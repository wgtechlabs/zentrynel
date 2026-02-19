import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { env } from './config/env.js';
import { db } from './db/index.js';
import { loadCommands } from './handlers/commandLoader.js';
import { registerCommands } from './handlers/commandRegistrar.js';
import { loadEvents } from './handlers/eventLoader.js';
import type { Command } from './types.js';
import { logger } from './utils/logger.js';

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildInvites,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildModeration,
		GatewayIntentBits.MessageContent,
	],
});

client.commands = new Collection<string, Command>();

db.initialize();

await loadCommands(client);
await loadEvents(client);
await registerCommands();

await client.login(env.DISCORD_TOKEN);

function shutdown(): void {
	logger.info('Shutting down...');
	client.destroy();
	db.close();
	process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
