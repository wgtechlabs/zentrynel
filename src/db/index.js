import * as driver from './sqlite.js';

export const db = {
	initialize: () => driver.initialize(),
	close: () => driver.close(),

	getGuildConfig: (guildId) => driver.getGuildConfig(guildId),
	upsertGuildConfig: (guildId, config) => driver.upsertGuildConfig(guildId, config),
	deleteGuildConfig: (guildId) => driver.deleteGuildConfig(guildId),
	getVerificationState: (guildId, userId) => driver.getVerificationState(guildId, userId),
	upsertVerificationState: (guildId, userId, state) =>
		driver.upsertVerificationState(guildId, userId, state),
	deleteVerificationState: (guildId, userId) => driver.deleteVerificationState(guildId, userId),

	addWarning: (guildId, userId, moderatorId, reason) =>
		driver.addWarning(guildId, userId, moderatorId, reason),
	getWarnings: (guildId, userId, activeOnly) => driver.getWarnings(guildId, userId, activeOnly),
	getActiveWarningCount: (guildId, userId) => driver.getActiveWarningCount(guildId, userId),
	deactivateWarning: (guildId, warningId) => driver.deactivateWarning(guildId, warningId),
	clearWarnings: (guildId, userId) => driver.clearWarnings(guildId, userId),

	logAction: (guildId, actionType, userId, moderatorId, reason, duration, metadata) =>
		driver.logAction(guildId, actionType, userId, moderatorId, reason, duration, metadata),
	getActions: (guildId, userId, limit) => driver.getActions(guildId, userId, limit),
};
