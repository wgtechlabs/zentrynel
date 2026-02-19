import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { LogEngine, LogMode } from '@wgtechlabs/log-engine';
import { logger } from '../../src/utils/logger.js';

describe('logger', () => {
	let captured: { level: string; message: string; data: unknown }[];

	beforeEach(() => {
		captured = [];
		LogEngine.configure({
			mode: LogMode.DEBUG,
			outputHandler: (level: string, message: string, data: unknown) => {
				captured.push({ level, message, data });
			},
			suppressConsoleOutput: true,
		});
	});

	afterEach(() => {
		LogEngine.configure({
			mode: LogMode.DEBUG,
			outputHandler: undefined as unknown as (level: string, message: string, data: unknown) => void,
			suppressConsoleOutput: false,
		});
	});

	test('info() logs at INFO level', () => {
		logger.info('test message');
		expect(captured.length).toBe(1);
		expect(captured[0].level).toBe('info');
		expect(captured[0].message).toContain('test message');
		expect(captured[0].message).toContain('[INFO]');
	});

	test('warn() logs at WARN level', () => {
		logger.warn('warning message');
		expect(captured.length).toBe(1);
		expect(captured[0].level).toBe('warn');
		expect(captured[0].message).toContain('warning message');
		expect(captured[0].message).toContain('[WARN]');
	});

	test('error() logs at ERROR level', () => {
		logger.error('error message');
		expect(captured.length).toBe(1);
		expect(captured[0].level).toBe('error');
		expect(captured[0].message).toContain('error message');
		expect(captured[0].message).toContain('[ERROR]');
	});

	test('debug() logs at DEBUG level', () => {
		logger.debug('debug message');
		expect(captured.length).toBe(1);
		expect(captured[0].level).toBe('debug');
		expect(captured[0].message).toContain('debug message');
		expect(captured[0].message).toContain('[DEBUG]');
	});

	test('extra data is passed through', () => {
		logger.info('msg', { key: 'value' });
		expect(captured.length).toBe(1);
		expect(captured[0].data).toEqual({ key: 'value' });
	});

	test('multiple extra args are passed as array', () => {
		logger.info('msg', 'extra1', 42);
		expect(captured.length).toBe(1);
		expect(captured[0].data).toEqual(['extra1', 42]);
	});

	test('all four log methods exist and are callable', () => {
		expect(typeof logger.info).toBe('function');
		expect(typeof logger.warn).toBe('function');
		expect(typeof logger.error).toBe('function');
		expect(typeof logger.debug).toBe('function');
	});
});
