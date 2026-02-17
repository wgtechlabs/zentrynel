import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { ActionTypes } from '../config/constants.js';
import { db } from '../db/index.js';
import { send as sendModLog } from '../services/modLog.js';
import { errorEmbed, successEmbed } from '../utils/embeds.js';
import { canModerate } from '../utils/permissions.js';
import { formatDuration, parseDuration } from '../utils/time.js';

const MAX_TIMEOUT = 28 * 24 * 60 * 60 * 1000; // 28 days

export const data = new SlashCommandBuilder()
	.setName('mute')
	.setDescription('Timeout (mute) a user')
	.addUserOption((option) =>
		option.setName('user').setDescription('The user to mute').setRequired(true),
	)
	.addStringOption((option) =>
		option.setName('duration').setDescription('Duration (e.g., 10m, 1h, 2d)'),
	)
	.addStringOption((option) => option.setName('reason').setDescription('Reason for the mute'))
	.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction) {
	const targetUser = interaction.options.getUser('user');
	const durationStr = interaction.options.getString('duration');
	const reason = interaction.options.getString('reason') || 'No reason provided';

	const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
	if (!targetMember) {
		return interaction.reply({
			embeds: [errorEmbed('User not found in this server.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	const check = canModerate(interaction, targetMember);
	if (!check.allowed) {
		return interaction.reply({ embeds: [errorEmbed(check.reason)], flags: [MessageFlags.Ephemeral] });
	}

	let durationMs;
	if (durationStr) {
		durationMs = parseDuration(durationStr);
		if (!durationMs) {
			return interaction.reply({
				embeds: [errorEmbed('Invalid duration format. Use: 10s, 5m, 1h, 2d')],
				flags: [MessageFlags.Ephemeral],
			});
		}
	} else {
		const config = await db.getGuildConfig(interaction.guildId);
		durationMs = config.mute_duration_default;
	}

	if (durationMs < 1_000 || durationMs > MAX_TIMEOUT) {
		return interaction.reply({
			embeds: [errorEmbed('Duration must be between 1 second and 28 days.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	await targetMember.timeout(durationMs, reason);

	await db.logAction(
		interaction.guildId,
		ActionTypes.MUTE,
		targetUser.id,
		interaction.user.id,
		reason,
		durationMs,
		null,
	);

	await sendModLog(interaction.guild, {
		actionType: ActionTypes.MUTE,
		targetUser,
		moderator: interaction.user,
		reason,
		duration: formatDuration(durationMs),
	});

	await targetUser
		.send(
			`You have been muted in **${interaction.guild.name}** for ${formatDuration(durationMs)}.\n**Reason:** ${reason}`,
		)
		.catch(() => {});

	const embed = successEmbed(
		'User Muted',
		`${targetUser} has been muted for ${formatDuration(durationMs)}.\n**Reason:** ${reason}`,
	);

	await interaction.reply({ embeds: [embed] });
}
