import type { Collection, SlashCommandBuilder } from 'discord.js';

// --- Discord Client augmentation ---

declare module 'discord.js' {
	interface Client {
		commands: Collection<string, Command>;
	}
}

// --- Command shape ---

export interface Command {
	data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
	execute: (...args: unknown[]) => Promise<void>;
}

// --- Database row types ---

export interface GuildConfig {
	guild_id: string;
	log_channel_id: string | null;
	mute_role_id: string | null;
	verify_channel_id: string | null;
	review_channel_id: string | null;
	verified_role_id: string | null;
	unverified_role_id: string | null;
	verification_enabled: number;
	verification_min_account_age_hours: number;
	verification_max_attempts: number;
	warn_threshold_mute: number;
	warn_threshold_kick: number;
	warn_threshold_ban: number;
	mute_duration_default: number;
	dm_disabled: number;
	invites_disabled: number;
	created_at?: string;
	updated_at?: string;
}

export interface VerificationState {
	guild_id: string;
	user_id: string;
	status: string;
	attempts: number;
	risk_score: number;
	risk_reasons: string | null;
	manual_required: number;
	review_message_id: string | null;
	manual_reason: string | null;
	last_challenge_at: string | null;
	invite_code: string | null;
	created_at?: string;
	updated_at?: string;
}

export interface Warning {
	id: number;
	guild_id: string;
	user_id: string;
	moderator_id: string;
	reason: string;
	active: number;
	created_at: string;
}

export interface ModAction {
	id: number;
	guild_id: string;
	action_type: string;
	user_id: string;
	moderator_id: string;
	reason: string | null;
	duration: number | null;
	metadata: string | null;
	created_at: string;
}

// --- Env ---

export interface Env {
	DISCORD_TOKEN: string;
	CLIENT_ID: string;
	DEV_GUILD_ID: string | null;
	NODE_ENV: string;
	DB_PATH: string;
}
