import type { GuildMember } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import { db } from '../db/index.js';
import { resolveUsedInvite } from '../services/inviteTracker.js';
import { logger } from '../utils/logger.js';

export const name = 'guildMemberAdd';
export const once = false;

export async function execute(member: GuildMember): Promise<void> {
	const config = db.getGuildConfig(member.guild.id);

	const botMember = member.guild.members.me;
	if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
		if (config.on_join_role_id || (config.verification_enabled && config.unverified_role_id)) {
			logger.warn(
				`Missing Manage Roles permission in guild ${member.guild.id} for role assignment on join`,
			);
		}
		return;
	}

	// On-join role: always assigned independently of verification
	if (config.on_join_role_id) {
		const onJoinRole = await member.guild.roles
			.fetch(config.on_join_role_id)
			.catch(() => null);

		if (onJoinRole) {
			if (onJoinRole.position < botMember.roles.highest.position) {
				if (!member.roles.cache.has(onJoinRole.id)) {
					try {
						await member.roles.add(onJoinRole, 'Auto-assign on-join role');
					} catch (err) {
						logger.error(
							`Failed to auto-assign on-join role to ${member.id} in guild ${member.guild.id}:`,
							(err as Error).message,
						);
					}
				}
			} else {
				logger.warn(
					`Cannot assign on-join role in guild ${member.guild.id}: role hierarchy is too high`,
				);
			}
		} else {
			logger.warn(
				`On-join role ${config.on_join_role_id} not found in guild ${member.guild.id}`,
			);
		}
	}

	// Verification: only runs when enabled
	if (!config.verification_enabled || !config.unverified_role_id) return;

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
		try {
			await member.roles.add(unverifiedRole, 'Auto-assign unverified role on join');
		} catch (err) {
			logger.error(
				`Failed to auto-assign unverified role to ${member.id} in guild ${member.guild.id}:`,
				(err as Error).message,
			);
			return;
		}
	}

	let inviteCode: string | null = null;
	try {
		inviteCode = await resolveUsedInvite(member.guild);
	} catch (err) {
		logger.error(`Failed to resolve invite for member ${member.id} in guild ${member.guild.id}:`, err);
	}

	db.upsertVerificationState(member.guild.id, member.id, {
		status: 'PENDING',
		attempts: 0,
		manual_required: 0,
		review_message_id: null,
		manual_reason: null,
		invite_code: inviteCode,
	});
}
