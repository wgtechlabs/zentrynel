export const CURRENT_VERSION = 1;

export function createTables(database) {
	database.run(`
		CREATE TABLE IF NOT EXISTS guild_config (
			guild_id TEXT PRIMARY KEY,
			log_channel_id TEXT,
			mute_role_id TEXT,
			warn_threshold_mute INTEGER NOT NULL DEFAULT 3,
			warn_threshold_kick INTEGER NOT NULL DEFAULT 5,
			warn_threshold_ban INTEGER NOT NULL DEFAULT 7,
			mute_duration_default INTEGER NOT NULL DEFAULT 600000,
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
		CREATE TABLE IF NOT EXISTS schema_version (
			version INTEGER PRIMARY KEY,
			applied_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

	const row = database
		.query('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
		.get();
	if (!row) {
		database.run('INSERT INTO schema_version (version) VALUES (?)', [CURRENT_VERSION]);
	}
}
