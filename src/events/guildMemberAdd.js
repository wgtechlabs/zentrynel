import { PermissionFlagsBits } from 'discord.js';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';

export const name = 'guildMemberAdd';
export const once = false;

export async function execute(member) {
	const config = db.getGuildConfig(member.guild.id);
	if (!config.verification_enabled || !config.unverified_role_id) return;

	const botMember = member.guild.members.me;
	if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
		logger.warn(
			`Missing Manage Roles permission in guild ${member.guild.id} for verification role setup`,
		);
		return;
	}

	const unverifiedRole = await member.guild.roles
		.fetch(config.unverified_role_id)
		.catch(() => null);
	if (!unverifiedRole) {
		logger.warn(
			`Unverified role ${config.unverified_role_id} not found in guild ${member.guild.id}`,
		);
		return;
	}

	if (unverifiedRole.position >= botMember.roles.highest.position) {
		logger.warn(
			`Cannot assign unverified role in guild ${member.guild.id}: role hierarchy is too high`,
		);
		return;
	}

	if (member.roles.highest.position >= botMember.roles.highest.position) {
		logger.warn(
			`Cannot manage member ${member.id} in guild ${member.guild.id}: role hierarchy is too high`,
		);
		return;
	}

	if (!member.roles.cache.has(unverifiedRole.id)) {
		await member.roles
			.add(unverifiedRole, 'Auto-assign unverified role on join')
			.catch((err) =>
				logger.error(
					`Failed to auto-assign unverified role to ${member.id} in guild ${member.guild.id}:`,
					err.message,
				),
			);
	}

	db.upsertVerificationState(member.guild.id, member.id, {
		status: 'PENDING',
		attempts: 0,
		manual_required: 0,
		review_message_id: null,
		manual_reason: null,
	});
}
