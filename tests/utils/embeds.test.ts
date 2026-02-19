import { describe, expect, test } from 'bun:test';
import { BOT_VERSION, Colors } from '../../src/config/constants.js';
import {
	errorEmbed,
	modActionEmbed,
	successEmbed,
	warningListEmbed,
} from '../../src/utils/embeds.js';

const EXPECTED_FOOTER = `Zentrynel v${BOT_VERSION} — Built by Waren Gonzaga (WG Tech Labs)`;

describe('successEmbed', () => {
	test('creates embed with correct title and description', () => {
		const embed = successEmbed('Test Title', 'Test description');
		const json = embed.toJSON();
		expect(json.title).toBe('Test Title');
		expect(json.description).toBe('Test description');
	});

	test('uses INFO color', () => {
		const embed = successEmbed('T', 'D');
		expect(embed.toJSON().color).toBe(Colors.INFO);
	});

	test('includes version footer', () => {
		const embed = successEmbed('T', 'D');
		expect(embed.toJSON().footer.text).toBe(EXPECTED_FOOTER);
	});

	test('sets timestamp', () => {
		const embed = successEmbed('T', 'D');
		expect(embed.toJSON().timestamp).toBeDefined();
	});
});

describe('errorEmbed', () => {
	test('creates embed with Error title', () => {
		const embed = errorEmbed('Something went wrong');
		const json = embed.toJSON();
		expect(json.title).toBe('Error');
		expect(json.description).toBe('Something went wrong');
	});

	test('uses ERROR color', () => {
		const embed = errorEmbed('err');
		expect(embed.toJSON().color).toBe(Colors.ERROR);
	});

	test('includes version footer', () => {
		const embed = errorEmbed('err');
		expect(embed.toJSON().footer.text).toBe(EXPECTED_FOOTER);
	});
});

describe('modActionEmbed', () => {
	const targetUser = { id: 'u1', toString: () => '<@u1>' };
	const moderator = { id: 'm1', toString: () => '<@m1>' };

	test('creates embed with action type title and fields', () => {
		const embed = modActionEmbed({
			actionType: 'WARN',
			targetUser,
			moderator,
			reason: 'Spam',
		});
		const json = embed.toJSON();
		expect(json.title).toBe('WARN');
		expect(json.fields).toHaveLength(3);
		expect(json.fields[0].name).toBe('User');
		expect(json.fields[1].name).toBe('Moderator');
		expect(json.fields[2].name).toBe('Reason');
		expect(json.fields[2].value).toBe('Spam');
	});

	test('shows "No reason provided" when reason is falsy', () => {
		const embed = modActionEmbed({
			actionType: 'KICK',
			targetUser,
			moderator,
			reason: null,
		});
		const reasonField = embed.toJSON().fields.find((f) => f.name === 'Reason');
		expect(reasonField.value).toBe('No reason provided');
	});

	test('adds duration field when provided', () => {
		const embed = modActionEmbed({
			actionType: 'MUTE',
			targetUser,
			moderator,
			reason: 'Spam',
			duration: '10 minutes',
		});
		const durationField = embed.toJSON().fields.find((f) => f.name === 'Duration');
		expect(durationField).toBeDefined();
		expect(durationField.value).toBe('10 minutes');
	});

	test('adds details field when extra provided', () => {
		const embed = modActionEmbed({
			actionType: 'BAN',
			targetUser,
			moderator,
			reason: 'Bad',
			extra: 'Deleted 7 days',
		});
		const detailsField = embed.toJSON().fields.find((f) => f.name === 'Details');
		expect(detailsField).toBeDefined();
		expect(detailsField.value).toBe('Deleted 7 days');
	});

	test('uses action type color', () => {
		const embed = modActionEmbed({
			actionType: 'BAN',
			targetUser,
			moderator,
			reason: 'test',
		});
		expect(embed.toJSON().color).toBe(Colors.BAN);
	});

	test('falls back to INFO color for unknown action type', () => {
		const embed = modActionEmbed({
			actionType: 'UNKNOWN',
			targetUser,
			moderator,
			reason: 'test',
		});
		expect(embed.toJSON().color).toBe(Colors.INFO);
	});

	test('includes version footer', () => {
		const embed = modActionEmbed({
			actionType: 'WARN',
			targetUser,
			moderator,
			reason: 'test',
		});
		expect(embed.toJSON().footer.text).toBe(EXPECTED_FOOTER);
	});
});

describe('warningListEmbed', () => {
	const targetUser = { tag: 'User#0001', username: 'user' };

	test('shows warning count in description', () => {
		const warnings = [
			{ id: 1, created_at: '2026-01-01', reason: 'Spam', moderator_id: 'm1' },
			{ id: 2, created_at: '2026-01-02', reason: 'Toxicity', moderator_id: 'm2' },
		];
		const embed = warningListEmbed(targetUser, warnings);
		const json = embed.toJSON();
		expect(json.description).toContain('2');
		expect(json.title).toContain('User#0001');
	});

	test('falls back to username when tag is missing', () => {
		const embed = warningListEmbed({ username: 'fallbackuser' }, []);
		expect(embed.toJSON().title).toContain('fallbackuser');
	});

	test('creates a field per warning (up to 25)', () => {
		const warnings = Array.from({ length: 30 }, (_, i) => ({
			id: i + 1,
			created_at: '2026-01-01',
			reason: `Reason ${i}`,
			moderator_id: 'm1',
		}));
		const embed = warningListEmbed(targetUser, warnings);
		// max 25 fields
		expect(embed.toJSON().fields.length).toBe(25);
	});

	test('uses WARN color', () => {
		const embed = warningListEmbed(targetUser, []);
		expect(embed.toJSON().color).toBe(Colors.WARN);
	});

	test('includes version footer', () => {
		const embed = warningListEmbed(targetUser, []);
		expect(embed.toJSON().footer.text).toBe(EXPECTED_FOOTER);
	});
});
