export async function getTotalGuildCount(client) {
	if (!client.shard) return client.guilds.cache.size;

	const results = await client.shard.fetchClientValues('guilds.cache.size');
	return results.reduce((sum, count) => sum + count, 0);
}

export async function getTotalMemberCount(client) {
	if (!client.shard) {
		return client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
	}

	const results = await client.shard.broadcastEval((c) =>
		c.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
	);
	return results.reduce((sum, count) => sum + count, 0);
}

export async function getShardStatuses(client) {
	if (!client.shard) return [client.ws.status];

	return client.shard.fetchClientValues('ws.status');
}
