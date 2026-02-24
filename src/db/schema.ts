import type { Database } from 'bun:sqlite';

export const CURRENT_VERSION = 6;

interface TableInfoRow {
	cid: number;
	name: string;
	type: string;
	notnull: number;
	dflt_value: unknown;
	pk: number;
}

interface SchemaVersionRow {
	version: number;
}

function ensureColumnsExist(
	database: Database,
	tableName: string,
	requiredColumns: string[],
): void {
	const columns = database.query(`PRAGMA table_info(${tableName})`).all() as TableInfoRow[];
	const names = new Set(columns.map((column) => column.name));

	for (const definition of requiredColumns) {
		const columnName = definition.split(' ')[0] ?? '';
		if (!columnName || names.has(columnName)) continue;
		database.run(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
	}
}

export function createTables(database: Database): void {
	database.run(`
		CREATE TABLE IF NOT EXISTS guild_config (
			guild_id TEXT PRIMARY KEY,
			log_channel_id TEXT,
			mute_role_id TEXT,
			verify_channel_id TEXT,
			review_channel_id TEXT,
			verified_role_id TEXT,
			unverified_role_id TEXT,
			on_join_role_id TEXT,
			verification_enabled INTEGER NOT NULL DEFAULT 0,
			verification_min_account_age_hours INTEGER NOT NULL DEFAULT 24,
			verification_max_attempts INTEGER NOT NULL DEFAULT 3,
			warn_threshold_mute INTEGER NOT NULL DEFAULT 3,
			warn_threshold_kick INTEGER NOT NULL DEFAULT 5,
			warn_threshold_ban INTEGER NOT NULL DEFAULT 7,
			mute_duration_default INTEGER NOT NULL DEFAULT 600000,
			verification_kick_timeout INTEGER NOT NULL DEFAULT 0,
			manual_review_timeout INTEGER NOT NULL DEFAULT 0,
			dm_disabled INTEGER NOT NULL DEFAULT 0,
			invites_disabled INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

	database.run(`
		CREATE TABLE IF NOT EXISTS warnings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			guild_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			moderator_id TEXT NOT NULL,
			reason TEXT NOT NULL DEFAULT 'No reason provided',
			active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

	database.run(`
		CREATE INDEX IF NOT EXISTS idx_warnings_guild_user_active
		ON warnings(guild_id, user_id, active)
	`);

	database.run(`
		CREATE TABLE IF NOT EXISTS mod_actions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			guild_id TEXT NOT NULL,
			action_type TEXT NOT NULL,
			user_id TEXT NOT NULL,
			moderator_id TEXT NOT NULL,
			reason TEXT,
			duration INTEGER,
			metadata TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

	database.run(`
		CREATE INDEX IF NOT EXISTS idx_mod_actions_guild
		ON mod_actions(guild_id)
	`);

	database.run(`
		CREATE TABLE IF NOT EXISTS verification_state (
			guild_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'PENDING',
			attempts INTEGER NOT NULL DEFAULT 0,
			risk_score INTEGER NOT NULL DEFAULT 0,
			risk_reasons TEXT,
			manual_required INTEGER NOT NULL DEFAULT 0,
			review_message_id TEXT,
			manual_reason TEXT,
			last_challenge_at TEXT,
			review_reminded INTEGER NOT NULL DEFAULT 0,
			invite_code TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now')),
			PRIMARY KEY (guild_id, user_id)
		)
	`);

	database.run(`
		CREATE INDEX IF NOT EXISTS idx_verification_state_guild_status
		ON verification_state(guild_id, status)
	`);

	database.run(`
		CREATE TABLE IF NOT EXISTS schema_version (
			version INTEGER PRIMARY KEY,
			applied_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

	ensureColumnsExist(database, 'guild_config', [
		'verify_channel_id TEXT',
		'review_channel_id TEXT',
		'verified_role_id TEXT',
		'unverified_role_id TEXT',
		'on_join_role_id TEXT',
		'verification_enabled INTEGER NOT NULL DEFAULT 0',
		'verification_min_account_age_hours INTEGER NOT NULL DEFAULT 24',
		'verification_max_attempts INTEGER NOT NULL DEFAULT 3',
		'dm_disabled INTEGER NOT NULL DEFAULT 0',
		'invites_disabled INTEGER NOT NULL DEFAULT 0',
		'verification_kick_timeout INTEGER NOT NULL DEFAULT 0',
		'manual_review_timeout INTEGER NOT NULL DEFAULT 0',
	]);
	ensureColumnsExist(database, 'verification_state', [
		'review_reminded INTEGER NOT NULL DEFAULT 0',
	]);
	ensureColumnsExist(database, 'verification_state', [
		'invite_code TEXT',
	]);

	const row = database
		.query('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
		.get() as SchemaVersionRow | undefined;
	if (!row) {
		database.run('INSERT INTO schema_version (version) VALUES (?)', [CURRENT_VERSION]);
	} else if (row.version < CURRENT_VERSION) {
		database.run('INSERT INTO schema_version (version) VALUES (?)', [CURRENT_VERSION]);
	}
}
