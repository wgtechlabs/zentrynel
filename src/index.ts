import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Shard } from 'discord.js';
import { ShardingManager } from 'discord.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const manager = new ShardingManager(join(__dirname, 'bot.ts'), {
	token: env.DISCORD_TOKEN,
	totalShards: 'auto',
});

manager.on('shardCreate', (shard: Shard) => {
	logger.info(`Shard ${shard.id} launched`);

	shard.on('death', () => {
		logger.error(`Shard ${shard.id} died`);
	});

	shard.on('reconnecting', () => {
		logger.warn(`Shard ${shard.id} reconnecting`);
	});
});

manager.spawn().catch((err: unknown) => {
	logger.error('Failed to spawn shards:', err);
	process.exit(1);
});
