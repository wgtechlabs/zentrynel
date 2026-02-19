import type { Client } from 'discord.js';

export async function getTotalGuildCount(client: Client): Promise<number> {
	if (!client.shard) return client.guilds.cache.size;

	const results = await client.shard.fetchClientValues('guilds.cache.size');
	return (results as number[]).reduce((sum, count) => sum + count, 0);
}

export async function getTotalMemberCount(client: Client): Promise<number> {
	if (!client.shard) {
		return client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
	}

	const results = await client.shard.broadcastEval((c) =>
		c.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
	);
	return (results as number[]).reduce((sum, count) => sum + count, 0);
}

export async function getShardStatuses(client: Client): Promise<number[]> {
	if (!client.shard) return [client.ws.status];

	return client.shard.fetchClientValues('ws.status') as Promise<number[]>;
}
