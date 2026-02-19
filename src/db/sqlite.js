import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Defaults } from '../config/constants.js';
import { env } from '../config/env.js';
import { createTables } from './schema.js';

let database = null;

export function initialize() {
	const dbDir = dirname(env.DB_PATH);

	if (!existsSync(dbDir)) {
		mkdirSync(dbDir, { recursive: true });
	}

	database = new Database(env.DB_PATH, { create: true });
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
	verify_channel_id: null,
	review_channel_id: null,
	verified_role_id: null,
	unverified_role_id: null,
	verification_enabled: Defaults.VERIFICATION_ENABLED,
	verification_min_account_age_hours: Defaults.VERIFICATION_MIN_ACCOUNT_AGE_HOURS,
	verification_max_attempts: Defaults.VERIFICATION_MAX_ATTEMPTS,
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
			INSERT INTO guild_config (
				guild_id,
				log_channel_id,
				mute_role_id,
				verify_channel_id,
				review_channel_id,
				verified_role_id,
				unverified_role_id,
				verification_enabled,
				verification_min_account_age_hours,
				verification_max_attempts,
				warn_threshold_mute,
				warn_threshold_kick,
				warn_threshold_ban,
				mute_duration_default,
				updated_at
			)
			VALUES (
				$guild_id,
				$log_channel_id,
				$mute_role_id,
				$verify_channel_id,
				$review_channel_id,
				$verified_role_id,
				$unverified_role_id,
				$verification_enabled,
				$verification_min_account_age_hours,
				$verification_max_attempts,
				$warn_threshold_mute,
				$warn_threshold_kick,
				$warn_threshold_ban,
				$mute_duration_default,
				datetime('now')
			)
			ON CONFLICT(guild_id) DO UPDATE SET
				log_channel_id = $log_channel_id,
				mute_role_id = $mute_role_id,
				verify_channel_id = $verify_channel_id,
				review_channel_id = $review_channel_id,
				verified_role_id = $verified_role_id,
				unverified_role_id = $unverified_role_id,
				verification_enabled = $verification_enabled,
				verification_min_account_age_hours = $verification_min_account_age_hours,
				verification_max_attempts = $verification_max_attempts,
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
			$verify_channel_id: merged.verify_channel_id,
			$review_channel_id: merged.review_channel_id,
			$verified_role_id: merged.verified_role_id,
			$unverified_role_id: merged.unverified_role_id,
			$verification_enabled: merged.verification_enabled,
			$verification_min_account_age_hours: merged.verification_min_account_age_hours,
			$verification_max_attempts: merged.verification_max_attempts,
			$warn_threshold_mute: merged.warn_threshold_mute,
			$warn_threshold_kick: merged.warn_threshold_kick,
			$warn_threshold_ban: merged.warn_threshold_ban,
			$mute_duration_default: merged.mute_duration_default,
		});
}

export function deleteGuildConfig(guildId) {
	database.query('DELETE FROM guild_config WHERE guild_id = ?').run(guildId);
}

// --- Verification ---

const defaultVerificationState = {
	status: 'PENDING',
	attempts: 0,
	risk_score: 0,
	risk_reasons: null,
	manual_required: 0,
	review_message_id: null,
	manual_reason: null,
	last_challenge_at: null,
	invite_code: null,
};

export function getVerificationState(guildId, userId) {
	return (
		database
			.query('SELECT * FROM verification_state WHERE guild_id = ? AND user_id = ?')
			.get(guildId, userId) || null
	);
}

export function upsertVerificationState(guildId, userId, state) {
	const current = getVerificationState(guildId, userId);
	const merged = { ...defaultVerificationState, ...(current || {}), ...state };

	database
		.query(`
			INSERT INTO verification_state (
				guild_id,
				user_id,
				status,
				attempts,
				risk_score,
				risk_reasons,
				manual_required,
				review_message_id,
				manual_reason,
				last_challenge_at,
				invite_code,
				updated_at
			)
			VALUES (
				$guild_id,
				$user_id,
				$status,
				$attempts,
				$risk_score,
				$risk_reasons,
				$manual_required,
				$review_message_id,
				$manual_reason,
				$last_challenge_at,
				$invite_code,
				datetime('now')
			)
			ON CONFLICT(guild_id, user_id) DO UPDATE SET
				status = $status,
				attempts = $attempts,
				risk_score = $risk_score,
				risk_reasons = $risk_reasons,
				manual_required = $manual_required,
				review_message_id = $review_message_id,
				manual_reason = $manual_reason,
				last_challenge_at = $last_challenge_at,
				invite_code = $invite_code,
				updated_at = datetime('now')
		`)
		.run({
			$guild_id: guildId,
			$user_id: userId,
			$status: merged.status,
			$attempts: merged.attempts,
			$risk_score: merged.risk_score,
			$risk_reasons: merged.risk_reasons,
			$manual_required: merged.manual_required,
			$review_message_id: merged.review_message_id,
			$manual_reason: merged.manual_reason,
			$last_challenge_at: merged.last_challenge_at,
			$invite_code: merged.invite_code,
		});
}

export function deleteVerificationState(guildId, userId) {
	database
		.query('DELETE FROM verification_state WHERE guild_id = ? AND user_id = ?')
		.run(guildId, userId);
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
