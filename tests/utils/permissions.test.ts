import { describe, expect, test } from 'bun:test';
import { canModerate } from '../../src/utils/permissions.js';

function mockInteraction({ clientId, userId, ownerId, botHighest, memberHighest }) {
	return {
		client: { user: { id: clientId } },
		user: { id: userId },
		guild: {
			ownerId,
			members: { me: { roles: { highest: { position: botHighest } } } },
		},
		member: { roles: { highest: { position: memberHighest } } },
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
	test('allows moderation when all checks pass', () => {
		const interaction = mockInteraction(base);
		const target = mockTarget('user-1', 5);
		const result = canModerate(interaction, target);
		expect(result).toEqual({ allowed: true, reason: null });
	});

	test('disallows moderating the bot itself', () => {
		const interaction = mockInteraction(base);
		const target = mockTarget('bot-1', 5);
		const result = canModerate(interaction, target);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain('myself');
	});

	test('disallows self-moderation', () => {
		const interaction = mockInteraction(base);
		const target = mockTarget('mod-1', 5);
		const result = canModerate(interaction, target);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain('yourself');
	});

	test('disallows moderating the server owner', () => {
		const interaction = mockInteraction(base);
		const target = mockTarget('owner-1', 5);
		const result = canModerate(interaction, target);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain('server owner');
	});

	test('disallows when target role is >= bot role', () => {
		const interaction = mockInteraction(base);
		const target = mockTarget('user-1', 10);
		const result = canModerate(interaction, target);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain('My role');
	});

	test('disallows when target role is >= moderator role', () => {
		const interaction = mockInteraction(base);
		const target = mockTarget('user-1', 8);
		const result = canModerate(interaction, target);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain('Your role');
	});

	test('checks in priority order — bot self-check first', () => {
		// Target is bottom id AND owner — bot self-check should win
		const interaction = mockInteraction({ ...base, ownerId: 'bot-1' });
		const target = mockTarget('bot-1', 1);
		const result = canModerate(interaction, target);
		expect(result.reason).toContain('myself');
	});
});
