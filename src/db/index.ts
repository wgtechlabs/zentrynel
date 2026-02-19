import type { GuildConfig, ModAction, VerificationState, Warning } from '../types.js';
import * as driver from './sqlite.js';

export const db = {
	initialize: (): void => driver.initialize(),
	close: (): void => driver.close(),

	getGuildConfig: (guildId: string): GuildConfig => driver.getGuildConfig(guildId),
	upsertGuildConfig: (guildId: string, config: Partial<GuildConfig>): void =>
		driver.upsertGuildConfig(guildId, config),
	deleteGuildConfig: (guildId: string): void => driver.deleteGuildConfig(guildId),

	getVerificationState: (guildId: string, userId: string): VerificationState | null =>
		driver.getVerificationState(guildId, userId),
	upsertVerificationState: (
		guildId: string,
		userId: string,
		state: Partial<VerificationState>,
	): void => driver.upsertVerificationState(guildId, userId, state),
	deleteVerificationState: (guildId: string, userId: string): void =>
		driver.deleteVerificationState(guildId, userId),

	addWarning: (
		guildId: string,
		userId: string,
		moderatorId: string,
		reason?: string | null,
	): { id: number | bigint } => driver.addWarning(guildId, userId, moderatorId, reason),
	getWarnings: (guildId: string, userId: string, activeOnly?: boolean): Warning[] =>
		driver.getWarnings(guildId, userId, activeOnly),
	getActiveWarningCount: (guildId: string, userId: string): number =>
		driver.getActiveWarningCount(guildId, userId),
	deactivateWarning: (guildId: string, warningId: number | bigint): void =>
		driver.deactivateWarning(guildId, warningId),
	clearWarnings: (guildId: string, userId: string): void => driver.clearWarnings(guildId, userId),

	logAction: (
		guildId: string,
		actionType: string,
		userId: string,
		moderatorId: string,
		reason?: string | null,
		duration?: number | null,
		metadata?: unknown,
	): { id: number | bigint } =>
		driver.logAction(guildId, actionType, userId, moderatorId, reason, duration, metadata),
	getActions: (guildId: string, userId?: string | null, limit?: number): ModAction[] =>
		driver.getActions(guildId, userId, limit),
};
