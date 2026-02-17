import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { env } from './config/env.js';
import { db } from './db/index.js';
import { loadCommands } from './handlers/commandLoader.js';
import { registerCommands } from './handlers/commandRegistrar.js';
import { loadEvents } from './handlers/eventLoader.js';
import { logger } from './utils/logger.js';

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildModeration,
		GatewayIntentBits.MessageContent,
	],
});

client.commands = new Collection();

db.initialize();

await loadCommands(client);
await loadEvents(client);
await registerCommands();

await client.login(env.DISCORD_TOKEN);
