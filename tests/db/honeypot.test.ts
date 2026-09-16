import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const databasePath = join(process.cwd(), '.test-honeypot.db');
process.env.DISCORD_TOKEN = 'test-token';
process.env.CLIENT_ID = 'test-client-id';
process.env.DB_PATH = databasePath;

const { db } = await import('../../src/db/index.js');

beforeAll(() => {
	db.initialize();
});

afterAll(() => {
	db.close();
	for (const suffix of ['', '-shm', '-wal']) {
		rmSync(`${databasePath}${suffix}`, { force: true });
	}
});

describe('verification honeypot persistence', () => {
	test('stores its opt-in setting and a 24-hour strike', () => {
		const guildId = 'guild';
		const userId = 'user';

		expect(db.getGuildConfig(guildId).verification_honeypot_enabled).toBe(0);

		db.upsertGuildConfig(guildId, { verification_honeypot_enabled: 1 });
		db.addHoneypotStrike(guildId, userId);

		expect(db.getGuildConfig(guildId).verification_honeypot_enabled).toBe(1);
		expect(db.getActiveHoneypotStrike(guildId, userId)).not.toBeNull();
	});
});
