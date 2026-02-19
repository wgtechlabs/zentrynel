import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { logger } from '../../src/utils/logger.js';

describe('logger', () => {
	let originalLog;
	let originalWarn;
	let originalError;
	let captured;

	beforeEach(() => {
		captured = { log: [], warn: [], error: [] };
		originalLog = console.log;
		originalWarn = console.warn;
		originalError = console.error;
		console.log = (...args) => captured.log.push(args);
		console.warn = (...args) => captured.warn.push(args);
		console.error = (...args) => captured.error.push(args);
	});

	afterEach(() => {
		console.log = originalLog;
		console.warn = originalWarn;
		console.error = originalError;
	});

	test('info() logs with INFO tag', () => {
		logger.info('test message');
		expect(captured.log.length).toBe(1);
		expect(captured.log[0][0]).toContain('[INFO]');
		expect(captured.log[0][0]).toContain('test message');
	});

	test('warn() logs with WARN tag', () => {
		logger.warn('warning message');
		expect(captured.warn.length).toBe(1);
		expect(captured.warn[0][0]).toContain('[WARN]');
		expect(captured.warn[0][0]).toContain('warning message');
	});

	test('error() logs with ERROR tag', () => {
		logger.error('error message');
		expect(captured.error.length).toBe(1);
		expect(captured.error[0][0]).toContain('[ERROR]');
		expect(captured.error[0][0]).toContain('error message');
	});

	test('debug() logs with DEBUG tag in non-production', () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'development';
		logger.debug('debug message');
		expect(captured.log.length).toBe(1);
		expect(captured.log[0][0]).toContain('[DEBUG]');
		expect(captured.log[0][0]).toContain('debug message');
		process.env.NODE_ENV = originalEnv;
	});

	test('debug() is silent in production', () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'production';
		logger.debug('should not appear');
		expect(captured.log.length).toBe(0);
		process.env.NODE_ENV = originalEnv;
	});

	test('log output includes ISO-like timestamp', () => {
		logger.info('timestamp check');
		// Timestamp format: YYYY-MM-DD HH:MM:SS.mmm
		expect(captured.log[0][0]).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\]/);
	});

	test('extra arguments are passed through', () => {
		logger.info('msg', 'extra1', 42);
		expect(captured.log[0].length).toBe(3);
		expect(captured.log[0][1]).toBe('extra1');
		expect(captured.log[0][2]).toBe(42);
	});
});
