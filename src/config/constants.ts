import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let pkgVersion = 'unknown';
try {
	const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf-8'));
	pkgVersion = pkg.version || 'unknown';
} catch {
	// package.json missing or malformed — fall back gracefully
}

export const BOT_VERSION = pkgVersion;

export const Colors = {
	WARN: 0xffa500,
	MUTE: 0x3498db,
	KICK: 0xe67e22,
	BAN: 0xe74c3c,
	PURGE: 0x9b59b6,
	VERIFY_QUEUE: 0xffa500,
	VERIFY_APPROVE: 0x2ecc71,
	VERIFY_REJECT: 0xe74c3c,
	VERIFY_RECHECK: 0x3498db,
	INFO: 0x2ecc71,
	ERROR: 0xe74c3c,
};

export const ActionTypes = {
	WARN: 'WARN',
	MUTE: 'MUTE',
	KICK: 'KICK',
	BAN: 'BAN',
	PURGE: 'PURGE',
	VERIFY_QUEUE: 'VERIFY_QUEUE',
	VERIFY_APPROVE: 'VERIFY_APPROVE',
	VERIFY_REJECT: 'VERIFY_REJECT',
	VERIFY_RECHECK: 'VERIFY_RECHECK',
};

export const Defaults = {
	WARN_THRESHOLD_MUTE: 3,
	WARN_THRESHOLD_KICK: 5,
	WARN_THRESHOLD_BAN: 7,
	MUTE_DURATION_MS: 600_000,
	PURGE_MAX: 100,
	PURGE_MIN: 1,
	VERIFICATION_ENABLED: 0,
	VERIFICATION_MIN_ACCOUNT_AGE_HOURS: 24,
	VERIFICATION_MAX_ATTEMPTS: 3,
	DM_DISABLED: 0,
	INVITES_DISABLED: 0,
};
