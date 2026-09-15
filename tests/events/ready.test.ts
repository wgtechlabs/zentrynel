import { expect, mock, test } from 'bun:test';
import { ActivityType, Collection } from 'discord.js';
import type { Client, PresenceData } from 'discord.js';

mock.module('../../src/services/incidentActions.js', () => ({
	startIncidentActionsRefresh: () => {},
}));
mock.module('../../src/services/inviteTracker.js', () => ({
	cacheGuildInvites: async () => {},
}));
mock.module('../../src/services/verificationSweep.js', () => ({
	startVerificationSweep: () => {},
}));

const { execute } = await import('../../src/events/ready.js');

test('sets an invite URL in the bot presence', async () => {
	const presences: PresenceData[] = [];
	const client = {
		shard: null,
		user: {
			tag: 'Zentrynel#0000',
			setPresence: (presence: PresenceData) => presences.push(presence),
		},
		guilds: { cache: new Collection() },
	} as unknown as Client;

	await execute(client);

	expect(presences).toEqual([
		{
			activities: [
				{
					name: 'Custom Status',
					state: 'Add me: https://wgtechlabs.com/zentrynel',
					type: ActivityType.Custom,
				},
			],
			status: 'online',
		},
	]);
});
