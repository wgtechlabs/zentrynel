import { describe, expect, test } from 'bun:test';
import { canModerate } from '../../src/utils/permissions.js';

function mockInteraction({ clientId, userId, ownerId, botHighest, memberHighest }) {
	const member = { roles: { highest: { position: memberHighest } } };
	return {
		client: { user: { id: clientId } },
		user: { id: userId },
		guild: {
			ownerId,
			members: {
				me: { roles: { highest: { position: botHighest } } },
				fetch: async () => member,
			},
		},
		member,
	};
}

function mockTarget(id, rolePosition) {
	return { id, roles: { highest: { position: rolePosition } } };
}

const base = {
	clientId: 'bot-1',
	userId: 'mod-1',
	ownerId: 'owner-1',
	botHighest: 10,
	memberHighest: 8,
};

describe('canModerate', () => {
	test('allows moderation when all checks pass', async () => {
		const interaction = mockInteraction(base);
		const target = mockTarget('user-1', 5);
		const result = await canModerate(interaction, target);
		expect(result).toEqual({ allowed: true, reason: null });
	});

	test('disallows moderating the bot itself', async () => {
		const interaction = mockInteraction(base);
		const target = mockTarget('bot-1', 5);
		const result = await canModerate(interaction, target);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain('myself');
	});

	test('disallows self-moderation', async () => {
		const interaction = mockInteraction(base);
		const target = mockTarget('mod-1', 5);
		const result = await canModerate(interaction, target);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain('yourself');
	});

	test('disallows moderating the server owner', async () => {
		const interaction = mockInteraction(base);
		const target = mockTarget('owner-1', 5);
		const result = await canModerate(interaction, target);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain('server owner');
	});

	test('disallows when target role is >= bot role', async () => {
		const interaction = mockInteraction(base);
		const target = mockTarget('user-1', 10);
		const result = await canModerate(interaction, target);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain('My role');
	});

	test('disallows when target role is >= moderator role', async () => {
		const interaction = mockInteraction(base);
		const target = mockTarget('user-1', 8);
		const result = await canModerate(interaction, target);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain('Your role');
	});

	test('checks in priority order — bot self-check first', async () => {
		// Target is bottom id AND owner — bot self-check should win
		const interaction = mockInteraction({ ...base, ownerId: 'bot-1' });
		const target = mockTarget('bot-1', 1);
		const result = await canModerate(interaction, target);
		expect(result.reason).toContain('myself');
	});
});
