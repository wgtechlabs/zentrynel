import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { ActionTypes } from '../config/constants.js';
import { db } from '../db/index.js';
import { send as sendModLog } from '../services/modLog.js';
import { applyVerifiedRoles } from '../services/verification.js';
import { errorEmbed, successEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
	.setName('approve')
	.setDescription("Manually approve a member's verification")
	.addUserOption((option) =>
		option.setName('user').setDescription('The member to approve').setRequired(true),
	)
	.addStringOption((option) =>
		option.setName('reason').setDescription('Reason for manual approval'),
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guildId || !interaction.guild) {
		await interaction.reply({
			content: 'This command can only be used in a server.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const targetUser = interaction.options.getUser('user', true);
	const reason = (interaction.options.getString('reason') || 'No reason provided').slice(0, 1000);

	const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
	if (!targetMember) {
		await interaction.reply({
			embeds: [errorEmbed('Member not found in this server.')],
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const config = db.getGuildConfig(interaction.guildId);

	const roleResult = await applyVerifiedRoles(
		targetMember,
		config,
		`Manual verification approved by ${interaction.user.tag}: ${reason}`,
	);

	if (!roleResult.ok) {
		await interaction.reply({
			embeds: [errorEmbed(`Approval failed: ${roleResult.error}`)],
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	db.upsertVerificationState(interaction.guildId, targetUser.id, {
		status: 'VERIFIED',
		attempts: 0,
		manual_required: 0,
		review_message_id: null,
		manual_reason: null,
		last_challenge_at: null,
	});

	db.logAction(
		interaction.guildId,
		ActionTypes.VERIFY_APPROVE,
		targetUser.id,
		interaction.user.id,
		reason,
		null,
		{ mode: 'manual' },
	);

	await sendModLog(interaction.guild, {
		actionType: ActionTypes.VERIFY_APPROVE,
		targetUser,
		moderator: interaction.user,
		reason,
	});

	await interaction.reply({
		embeds: [
			successEmbed(
				'Member Approved',
				`${targetUser} has been manually verified.\n**Reason:** ${reason}`,
			),
		],
	});
}
