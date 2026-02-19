import { describe, expect, test } from 'bun:test';
import { ActionTypes, BOT_VERSION, Colors, Defaults } from '../../src/config/constants.js';

describe('BOT_VERSION', () => {
	test('is a valid semver string', () => {
		expect(BOT_VERSION).toMatch(/^\d+\.\d+\.\d+/);
	});

	test('matches package.json version', async () => {
		const pkg = await Bun.file('package.json').json();
		expect(BOT_VERSION).toBe(pkg.version);
	});
});

describe('Colors', () => {
	test('exports all expected color keys', () => {
		const expectedKeys = [
			'WARN',
			'MUTE',
			'KICK',
			'BAN',
			'PURGE',
			'VERIFY_QUEUE',
			'VERIFY_APPROVE',
			'VERIFY_REJECT',
			'VERIFY_RECHECK',
			'INFO',
			'ERROR',
		];
		for (const key of expectedKeys) {
			expect(Colors[key]).toBeDefined();
			expect(typeof Colors[key]).toBe('number');
		}
	});

	test('color values are valid 24-bit integers', () => {
		for (const [, value] of Object.entries(Colors)) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(0xffffff);
		}
	});
});

describe('ActionTypes', () => {
	test('exports all expected action type keys', () => {
		const expectedKeys = [
			'WARN',
			'MUTE',
			'KICK',
			'BAN',
			'PURGE',
			'VERIFY_QUEUE',
			'VERIFY_APPROVE',
			'VERIFY_REJECT',
			'VERIFY_RECHECK',
		];
		for (const key of expectedKeys) {
			expect(ActionTypes[key]).toBe(key);
		}
	});

	test('every action type has a corresponding color', () => {
		for (const key of Object.keys(ActionTypes)) {
			expect(Colors[key]).toBeDefined();
		}
	});
});

describe('Defaults', () => {
	test('threshold order is mute < kick < ban', () => {
		expect(Defaults.WARN_THRESHOLD_MUTE).toBeLessThan(Defaults.WARN_THRESHOLD_KICK);
		expect(Defaults.WARN_THRESHOLD_KICK).toBeLessThan(Defaults.WARN_THRESHOLD_BAN);
	});

	test('mute duration is a positive number', () => {
		expect(Defaults.MUTE_DURATION_MS).toBeGreaterThan(0);
	});

	test('purge limits are sane', () => {
		expect(Defaults.PURGE_MIN).toBeGreaterThanOrEqual(1);
		expect(Defaults.PURGE_MAX).toBeGreaterThan(Defaults.PURGE_MIN);
	});

	test('verification defaults are reasonable', () => {
		expect(Defaults.VERIFICATION_ENABLED).toBe(0);
		expect(Defaults.VERIFICATION_MIN_ACCOUNT_AGE_HOURS).toBeGreaterThan(0);
		expect(Defaults.VERIFICATION_MAX_ATTEMPTS).toBeGreaterThan(0);
	});
});
