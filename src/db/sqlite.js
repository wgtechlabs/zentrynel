import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Database } from 'bun:sqlite';
import { Defaults } from '../config/constants.js';
import { env } from '../config/env.js';
import { createTables } from './schema.js';

let database = null;

export function initialize() {
	const dbDir = dirname(env.DB_PATH);

	if (!existsSync(dbDir)) {
		mkdirSync(dbDir, { recursive: true });
	}

	database = new Database(env.DB_PATH, { create: true, strict: true });
	database.run('PRAGMA journal_mode = WAL');
	database.run('PRAGMA foreign_keys = ON');
	createTables(database);
}

export function close() {
	if (database) {
		database.close();
		database = null;
	}
}

// --- Guild Config ---

const defaultConfig = {
	log_channel_id: null,
	mute_role_id: null,
	warn_threshold_mute: Defaults.WARN_THRESHOLD_MUTE,
	warn_threshold_kick: Defaults.WARN_THRESHOLD_KICK,
	warn_threshold_ban: Defaults.WARN_THRESHOLD_BAN,
	mute_duration_default: Defaults.MUTE_DURATION_MS,
};

export function getGuildConfig(guildId) {
	const row = database.query('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
	return row || { guild_id: guildId, ...defaultConfig };
}

export function upsertGuildConfig(guildId, config) {
	const current = getGuildConfig(guildId);
	const merged = { ...current, ...config };

	database
		.query(`
			INSERT INTO guild_config (guild_id, log_channel_id, mute_role_id, warn_threshold_mute, warn_threshold_kick, warn_threshold_ban, mute_duration_default, updated_at)
			VALUES ($guild_id, $log_channel_id, $mute_role_id, $warn_threshold_mute, $warn_threshold_kick, $warn_threshold_ban, $mute_duration_default, datetime('now'))
			ON CONFLICT(guild_id) DO UPDATE SET
				log_channel_id = $log_channel_id,
				mute_role_id = $mute_role_id,
				warn_threshold_mute = $warn_threshold_mute,
				warn_threshold_kick = $warn_threshold_kick,
				warn_threshold_ban = $warn_threshold_ban,
				mute_duration_default = $mute_duration_default,
				updated_at = datetime('now')
		`)
		.run({
			$guild_id: guildId,
			$log_channel_id: merged.log_channel_id,
			$mute_role_id: merged.mute_role_id,
			$warn_threshold_mute: merged.warn_threshold_mute,
			$warn_threshold_kick: merged.warn_threshold_kick,
			$warn_threshold_ban: merged.warn_threshold_ban,
			$mute_duration_default: merged.mute_duration_default,
		});
}

export function deleteGuildConfig(guildId) {
	database.query('DELETE FROM guild_config WHERE guild_id = ?').run(guildId);
}

// --- Warnings ---

export function addWarning(guildId, userId, moderatorId, reason) {
	const result = database
		.query('INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)')
		.run(guildId, userId, moderatorId, reason || 'No reason provided');
	return { id: result.lastInsertRowid };
}

export function getWarnings(guildId, userId, activeOnly = true) {
	if (activeOnly) {
		return database
			.query(
				'SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1 ORDER BY created_at DESC',
			)
			.all(guildId, userId);
	}
	return database
		.query('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC')
		.all(guildId, userId);
}

export function getActiveWarningCount(guildId, userId) {
	const row = database
		.query(
			'SELECT COUNT(*) as count FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1',
		)
		.get(guildId, userId);
	return row.count;
}

export function deactivateWarning(guildId, warningId) {
	database
		.query('UPDATE warnings SET active = 0 WHERE id = ? AND guild_id = ?')
		.run(warningId, guildId);
}

export function clearWarnings(guildId, userId) {
	database
		.query('UPDATE warnings SET active = 0 WHERE guild_id = ? AND user_id = ?')
		.run(guildId, userId);
}

// --- Mod Actions ---

export function logAction(guildId, actionType, userId, moderatorId, reason, duration, metadata) {
	const result = database
		.query(
			'INSERT INTO mod_actions (guild_id, action_type, user_id, moderator_id, reason, duration, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
		)
		.run(
			guildId,
			actionType,
			userId,
			moderatorId,
			reason || null,
			duration || null,
			metadata ? JSON.stringify(metadata) : null,
		);
	return { id: result.lastInsertRowid };
}

export function getActions(guildId, userId, limit = 10) {
	if (userId) {
		return database
			.query(
				'SELECT * FROM mod_actions WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?',
			)
			.all(guildId, userId, limit);
	}
	return database
		.query('SELECT * FROM mod_actions WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?')
		.all(guildId, limit);
}
