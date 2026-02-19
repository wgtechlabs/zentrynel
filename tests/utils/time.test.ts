import { describe, expect, test } from 'bun:test';
import { formatDuration, parseDuration } from '../../src/utils/time.js';

describe('parseDuration', () => {
	test('returns null for falsy input', () => {
		expect(parseDuration(null)).toBeNull();
		expect(parseDuration(undefined)).toBeNull();
		expect(parseDuration('')).toBeNull();
	});

	test('returns null for invalid format', () => {
		expect(parseDuration('abc')).toBeNull();
		expect(parseDuration('10')).toBeNull();
		expect(parseDuration('10x')).toBeNull();
		expect(parseDuration('h10')).toBeNull();
		expect(parseDuration('1.5h')).toBeNull();
	});

	test('parses seconds', () => {
		expect(parseDuration('1s')).toBe(1_000);
		expect(parseDuration('30s')).toBe(30_000);
		expect(parseDuration('60S')).toBe(60_000);
	});

	test('parses minutes', () => {
		expect(parseDuration('1m')).toBe(60_000);
		expect(parseDuration('30m')).toBe(1_800_000);
		expect(parseDuration('60M')).toBe(3_600_000);
	});

	test('parses hours', () => {
		expect(parseDuration('1h')).toBe(3_600_000);
		expect(parseDuration('24h')).toBe(86_400_000);
		expect(parseDuration('24H')).toBe(86_400_000);
	});

	test('parses days', () => {
		expect(parseDuration('1d')).toBe(86_400_000);
		expect(parseDuration('7d')).toBe(604_800_000);
		expect(parseDuration('7D')).toBe(604_800_000);
	});

	test('handles whitespace around input', () => {
		expect(parseDuration('  5m  ')).toBe(300_000);
	});
});

describe('formatDuration', () => {
	test('returns "0 seconds" for zero or falsy', () => {
		expect(formatDuration(0)).toBe('0 seconds');
		expect(formatDuration(null)).toBe('0 seconds');
		expect(formatDuration(undefined)).toBe('0 seconds');
		expect(formatDuration(-1)).toBe('0 seconds');
	});

	test('formats seconds only', () => {
		expect(formatDuration(1_000)).toBe('1 second');
		expect(formatDuration(5_000)).toBe('5 seconds');
	});

	test('formats minutes only', () => {
		expect(formatDuration(60_000)).toBe('1 minute');
		expect(formatDuration(120_000)).toBe('2 minutes');
	});

	test('formats hours only', () => {
		expect(formatDuration(3_600_000)).toBe('1 hour');
		expect(formatDuration(7_200_000)).toBe('2 hours');
	});

	test('formats days only', () => {
		expect(formatDuration(86_400_000)).toBe('1 day');
		expect(formatDuration(172_800_000)).toBe('2 days');
	});

	test('formats combined durations', () => {
		// 1 day, 2 hours, 3 minutes, 4 seconds
		const ms = 86_400_000 + 7_200_000 + 180_000 + 4_000;
		expect(formatDuration(ms)).toBe('1 day, 2 hours, 3 minutes, 4 seconds');
	});

	test('skips zero components', () => {
		// 1 hour, 30 seconds (no days, no minutes)
		const ms = 3_600_000 + 30_000;
		expect(formatDuration(ms)).toBe('1 hour, 30 seconds');
	});

	test('parseDuration and formatDuration round-trip', () => {
		expect(formatDuration(parseDuration('1d'))).toBe('1 day');
		expect(formatDuration(parseDuration('2h'))).toBe('2 hours');
		expect(formatDuration(parseDuration('30m'))).toBe('30 minutes');
		expect(formatDuration(parseDuration('45s'))).toBe('45 seconds');
	});
});
