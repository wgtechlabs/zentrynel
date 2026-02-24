import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	EmbedBuilder,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { Colors } from '../config/constants.js';
import { db } from '../db/index.js';
import { applyIncidentActions } from '../services/incidentActions.js';
import { FOOTER, errorEmbed, successEmbed } from '../utils/embeds.js';
import { formatDuration, parseDuration } from '../utils/time.js';

export const data = new SlashCommandBuilder()
	.setName('config')
	.setDescription('Configure Zentrynel settings for this server')
	.addSubcommand((sub) =>
		sub.setName('view').setDescription('View the current server configuration'),
	)
	.addSubcommand((sub) =>
		sub
			.setName('logchannel')
			.setDescription('Set the mod log channel')
			.addChannelOption((option) =>
				option
					.setName('channel')
					.setDescription('The channel for mod action logs')
					.addChannelTypes(ChannelType.GuildText)
					.setRequired(true),
			),
	)
	.addSubcommand((sub) =>
		sub
			.setName('thresholds')
			.setDescription('Set warning escalation thresholds')
			.addIntegerOption((option) =>
				option
					.setName('mute')
					.setDescription('Warnings before auto-mute')
					.setMinValue(1)
					.setMaxValue(50),
			)
			.addIntegerOption((option) =>
				option
					.setName('kick')
					.setDescription('Warnings before auto-kick')
					.setMinValue(1)
					.setMaxValue(50),
			)
			.addIntegerOption((option) =>
				option
					.setName('ban')
					.setDescription('Warnings before auto-ban')
					.setMinValue(1)
					.setMaxValue(50),
			),
	)
	.addSubcommand((sub) =>
		sub
			.setName('muteduration')
			.setDescription('Set the default mute duration')
			.addStringOption((option) =>
				option
					.setName('duration')
					.setDescription('Default duration (e.g., 10m, 1h, 2d)')
					.setRequired(true),
			),
	)
	.addSubcommand((sub) =>
		sub
			.setName('verificationenable')
			.setDescription('Enable or disable member verification')
			.addBooleanOption((option) =>
				option
					.setName('enabled')
					.setDescription('Enable or disable verification')
					.setRequired(true),
			),
	)
	.addSubcommand((sub) =>
		sub
			.setName('verificationchannels')
			.setDescription('Set verify and manual review channels')
			.addChannelOption((option) =>
				option
					.setName('verify')
					.setDescription('Channel where members can start verification')
					.addChannelTypes(ChannelType.GuildText)
					.setRequired(true),
			)
			.addChannelOption((option) =>
				option
					.setName('review')
					.setDescription('Channel for moderator manual verification reviews')
					.addChannelTypes(ChannelType.GuildText)
					.setRequired(true),
			),
	)
	.addSubcommand((sub) =>
		sub
			.setName('verificationroles')
			.setDescription('Set verified and unverified roles')
			.addRoleOption((option) =>
				option
					.setName('verified')
					.setDescription('Role granted after successful verification')
					.setRequired(true),
			)
			.addRoleOption((option) =>
				option
					.setName('unverified')
					.setDescription('Role for members pending verification')
					.setRequired(true),
			),
	)
	.addSubcommand((sub) =>
		sub
			.setName('verificationrules')
			.setDescription('Set automated verification thresholds')
			.addStringOption((option) =>
				option
					.setName('minage')
					.setDescription('Minimum account age (e.g. 1h, 24h, 2d)')
					.setMaxLength(10),
			)
			.addIntegerOption((option) =>
				option
					.setName('maxattempts')
					.setDescription('Maximum automated challenge attempts')
					.setMinValue(1)
					.setMaxValue(10),
			),
	)
	.addSubcommand((sub) =>
		sub
			.setName('verificationpanel')
			.setDescription('Post the verification panel in the configured verify channel'),
	)
	.addSubcommand((sub) =>
		sub
			.setName('onjoinrole')
			.setDescription('Set or clear the auto-assigned on-join role')
			.addRoleOption((option) =>
				option
					.setName('role')
					.setDescription('Role auto-assigned when a member joins (omit to clear)'),
			),
	)
	.addSubcommand((sub) =>
		sub
			.setName('disabledms')
			.setDescription('Permanently disable or re-enable DMs server-wide')
			.addBooleanOption((option) =>
				option
					.setName('disable')
					.setDescription('True to disable DMs, false to re-enable them')
					.setRequired(true),
			),
	)
	.addSubcommand((sub) =>
		sub
			.setName('disableinvites')
			.setDescription('Permanently disable or re-enable server invites')
			.addBooleanOption((option) =>
				option
					.setName('disable')
					.setDescription('True to disable invites, false to re-enable them')
					.setRequired(true),
			),
	)
	.addSubcommand((sub) => sub.setName('reset').setDescription('Reset all settings to defaults'))
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	const sub = interaction.options.getSubcommand();

	switch (sub) {
		case 'view':
			return handleView(interaction);
		case 'logchannel':
			return handleLogChannel(interaction);
		case 'thresholds':
			return handleThresholds(interaction);
		case 'muteduration':
			return handleMuteDuration(interaction);
		case 'verificationenable':
			return handleVerificationEnable(interaction);
		case 'verificationchannels':
			return handleVerificationChannels(interaction);
		case 'verificationroles':
			return handleVerificationRoles(interaction);
		case 'verificationrules':
			return handleVerificationRules(interaction);
		case 'verificationpanel':
			return handleVerificationPanel(interaction);
		case 'onjoinrole':
			return handleOnJoinRole(interaction);
		case 'disabledms':
			return handleDisableDms(interaction);
		case 'disableinvites':
			return handleDisableInvites(interaction);
		case 'reset':
			return handleReset(interaction);
	}
}

async function handleView(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guildId) return;

	const config = db.getGuildConfig(interaction.guildId);

	const embed = new EmbedBuilder()
		.setColor(Colors.INFO)
		.setTitle('Zentrynel Configuration')
		.addFields(
			{
				name: 'Log Channel',
				value: config.log_channel_id ? `<#${config.log_channel_id}>` : 'Not set',
				inline: true,
			},
			{
				name: 'Default Mute Duration',
				value: formatDuration(config.mute_duration_default),
				inline: true,
			},
			{ name: '\u200b', value: '\u200b', inline: true },
			{
				name: 'Verification',
				value: config.verification_enabled ? 'Enabled' : 'Disabled',
				inline: true,
			},
			{
				name: 'Verify Channel',
				value: config.verify_channel_id ? `<#${config.verify_channel_id}>` : 'Not set',
				inline: true,
			},
			{
				name: 'Review Channel',
				value: config.review_channel_id ? `<#${config.review_channel_id}>` : 'Not set',
				inline: true,
			},
			{
				name: 'Verified Role',
				value: config.verified_role_id ? `<@&${config.verified_role_id}>` : 'Not set',
				inline: true,
			},
			{
				name: 'Unverified Role',
				value: config.unverified_role_id ? `<@&${config.unverified_role_id}>` : 'Not set',
				inline: true,
			},
			{
				name: 'Verification Rules',
				value: `Min account age: **${formatDuration(config.verification_min_account_age_hours * 3_600_000)}**\nMax attempts: **${config.verification_max_attempts}**`,
				inline: true,
			},
			{ name: '\u200b', value: '\u200b', inline: true },
			{
				name: 'Auto-Mute Threshold',
				value: `${config.warn_threshold_mute} warnings`,
				inline: true,
			},
			{
				name: 'Auto-Kick Threshold',
				value: `${config.warn_threshold_kick} warnings`,
				inline: true,
			},
			{
				name: 'Auto-Ban Threshold',
				value: `${config.warn_threshold_ban} warnings`,
				inline: true,
			},
			{ name: '\u200b', value: '\u200b', inline: true },
			{
				name: 'On-Join Role',
				value: config.on_join_role_id ? `<@&${config.on_join_role_id}>` : 'Not set',
				inline: true,
			},
			{
				name: 'DMs Disabled',
				value: config.dm_disabled ? 'Yes' : 'No',
				inline: true,
			},
			{
				name: 'Invites Disabled',
				value: config.invites_disabled ? 'Yes' : 'No',
				inline: true,
			},
		)
		.setFooter(FOOTER)
		.setTimestamp();

	await interaction.reply({ embeds: [embed] });
}

async function handleLogChannel(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guildId) return;

	const channel = interaction.options.getChannel('channel', true);

	const botMember = interaction.guild?.members.me;
	if (!botMember) {
		return interaction.reply({
			embeds: [errorEmbed('Unable to resolve my own permissions.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	const permissions = channel.permissionsFor(botMember);
	if (!permissions?.has(['SendMessages', 'EmbedLinks'])) {
		return interaction.reply({
			embeds: [
				errorEmbed('I need **Send Messages** and **Embed Links** permissions in that channel.'),
			],
			flags: [MessageFlags.Ephemeral],
		});
	}

	db.upsertGuildConfig(interaction.guildId, { log_channel_id: channel.id });

	await interaction.reply({
		embeds: [successEmbed('Log Channel Set', `Mod action logs will be sent to ${channel}.`)],
	});
}

async function handleThresholds(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guildId) return;

	const mute = interaction.options.getInteger('mute');
	const kick = interaction.options.getInteger('kick');
	const ban = interaction.options.getInteger('ban');

	if (mute === null && kick === null && ban === null) {
		return interaction.reply({
			embeds: [errorEmbed('Provide at least one threshold to update.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	const config = db.getGuildConfig(interaction.guildId);
	const newMute = mute ?? config.warn_threshold_mute;
	const newKick = kick ?? config.warn_threshold_kick;
	const newBan = ban ?? config.warn_threshold_ban;

	if (newMute >= newKick || newKick >= newBan) {
		return interaction.reply({
			embeds: [errorEmbed('Thresholds must be in ascending order: mute < kick < ban.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	db.upsertGuildConfig(interaction.guildId, {
		warn_threshold_mute: newMute,
		warn_threshold_kick: newKick,
		warn_threshold_ban: newBan,
	});

	await interaction.reply({
		embeds: [
			successEmbed(
				'Thresholds Updated',
				`Auto-mute: **${newMute}** warnings\nAuto-kick: **${newKick}** warnings\nAuto-ban: **${newBan}** warnings`,
			),
		],
	});
}

async function handleMuteDuration(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guildId) return;

	const input = interaction.options.getString('duration', true);
	const ms = parseDuration(input);

	if (!ms) {
		return interaction.reply({
			embeds: [errorEmbed('Invalid duration format. Use: 10s, 5m, 1h, 2d')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	const maxTimeout = 28 * 24 * 60 * 60 * 1000;
	if (ms < 1_000 || ms > maxTimeout) {
		return interaction.reply({
			embeds: [errorEmbed('Duration must be between 1 second and 28 days.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	db.upsertGuildConfig(interaction.guildId, { mute_duration_default: ms });

	await interaction.reply({
		embeds: [successEmbed('Default Mute Duration Updated', `Set to **${formatDuration(ms)}**.`)],
	});
}

async function handleVerificationEnable(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guildId) return;

	const enabled = interaction.options.getBoolean('enabled', true);

	db.upsertGuildConfig(interaction.guildId, { verification_enabled: enabled ? 1 : 0 });

	await interaction.reply({
		embeds: [
			successEmbed(
				'Verification Updated',
				`Member verification is now **${enabled ? 'enabled' : 'disabled'}**.`,
			),
		],
	});
}

async function handleVerificationChannels(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guildId) return;

	const verifyChannel = interaction.options.getChannel('verify', true);
	const reviewChannel = interaction.options.getChannel('review', true);

	const verifyPermissions = verifyChannel.permissionsFor(interaction.guild?.members.me);
	if (!verifyPermissions?.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
		return interaction.reply({
			embeds: [
				errorEmbed(
					'I need **View Channel**, **Send Messages**, and **Embed Links** in the verify channel.',
				),
			],
			flags: [MessageFlags.Ephemeral],
		});
	}

	const reviewPermissions = reviewChannel.permissionsFor(interaction.guild?.members.me);
	if (!reviewPermissions?.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
		return interaction.reply({
			embeds: [
				errorEmbed(
					'I need **View Channel**, **Send Messages**, and **Embed Links** in the review channel.',
				),
			],
			flags: [MessageFlags.Ephemeral],
		});
	}

	db.upsertGuildConfig(interaction.guildId, {
		verify_channel_id: verifyChannel.id,
		review_channel_id: reviewChannel.id,
	});

	await interaction.reply({
		embeds: [
			successEmbed(
				'Verification Channels Updated',
				`Verify channel: ${verifyChannel}\nReview channel: ${reviewChannel}`,
			),
		],
	});
}

async function handleVerificationRoles(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guildId) return;

	const verifiedRole = interaction.options.getRole('verified', true);
	const unverifiedRole = interaction.options.getRole('unverified', true);

	if (verifiedRole.id === unverifiedRole.id) {
		return interaction.reply({
			embeds: [errorEmbed('Verified and unverified roles must be different roles.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	const botMember = interaction.guild?.members.me;
	if (!botMember) {
		return interaction.reply({
			embeds: [errorEmbed('Unable to resolve my own permissions.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
		return interaction.reply({
			embeds: [errorEmbed('I need the **Manage Roles** permission to manage verification roles.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	if (
		verifiedRole.position >= botMember.roles.highest.position ||
		unverifiedRole.position >= botMember.roles.highest.position
	) {
		return interaction.reply({
			embeds: [errorEmbed('My highest role must be above the verified and unverified roles.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	db.upsertGuildConfig(interaction.guildId, {
		verified_role_id: verifiedRole.id,
		unverified_role_id: unverifiedRole.id,
	});

	await interaction.reply({
		embeds: [
			successEmbed(
				'Verification Roles Updated',
				`Verified role: ${verifiedRole}\nUnverified role: ${unverifiedRole}`,
			),
		],
	});
}

async function handleOnJoinRole(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guildId) return;

	const role = interaction.options.getRole('role');

	const botMember = interaction.guild?.members.me;
	if (!botMember) {
		return interaction.reply({
			embeds: [errorEmbed('Unable to resolve my own permissions.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
		return interaction.reply({
			embeds: [errorEmbed('I need the **Manage Roles** permission to manage roles.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	// Clear the on-join role if no role is provided
	if (!role) {
		db.upsertGuildConfig(interaction.guildId, { on_join_role_id: null });
		return interaction.reply({
			embeds: [successEmbed('On-Join Role Cleared', 'The on-join role has been removed.')],
		});
	}

	if (role.position >= botMember.roles.highest.position) {
		return interaction.reply({
			embeds: [errorEmbed('My highest role must be above the on-join role.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	const config = db.getGuildConfig(interaction.guildId);

	if (role.id === config.verified_role_id || role.id === config.unverified_role_id) {
		return interaction.reply({
			embeds: [errorEmbed('On-join role must be different from verification roles.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	db.upsertGuildConfig(interaction.guildId, { on_join_role_id: role.id });

	const description = config.verification_enabled
		? `On-join role set to ${role}.\nThis role will be removed when a member is verified or rejected.`
		: `On-join role set to ${role}.`;

	await interaction.reply({
		embeds: [successEmbed('On-Join Role Set', description)],
	});
}

async function handleVerificationRules(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guildId) return;

	const minAgeRaw = interaction.options.getString('minage');
	const maxAttempts = interaction.options.getInteger('maxattempts');

	if (minAgeRaw === null && maxAttempts === null) {
		return interaction.reply({
			embeds: [errorEmbed('Provide at least one verification rule to update.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	let minAgeHours = null;
	if (minAgeRaw !== null) {
		const ms = parseDuration(minAgeRaw);
		if (ms === null || ms < 3_600_000) {
			return interaction.reply({
				embeds: [
					errorEmbed(
						'Invalid duration. Minimum is 1 hour. Use a format like `1h`, `24h`, or `2d`.',
					),
				],
				flags: [MessageFlags.Ephemeral],
			});
		}
		minAgeHours = Math.round(ms / 3_600_000);
		if (minAgeHours > 8760) {
			return interaction.reply({
				embeds: [errorEmbed('Minimum account age cannot exceed 365 days.')],
				flags: [MessageFlags.Ephemeral],
			});
		}
	}

	const config = db.getGuildConfig(interaction.guildId);

	db.upsertGuildConfig(interaction.guildId, {
		verification_min_account_age_hours: minAgeHours ?? config.verification_min_account_age_hours,
		verification_max_attempts: maxAttempts ?? config.verification_max_attempts,
	});

	const updated = db.getGuildConfig(interaction.guildId);
	await interaction.reply({
		embeds: [
			successEmbed(
				'Verification Rules Updated',
				`Min account age: **${formatDuration(updated.verification_min_account_age_hours * 3_600_000)}**\nMax attempts: **${updated.verification_max_attempts}**`,
			),
		],
	});
}

async function handleVerificationPanel(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guildId) return;

	const config = db.getGuildConfig(interaction.guildId);

	if (!config.verification_enabled) {
		return interaction.reply({
			embeds: [
				errorEmbed('Enable verification first using `/config verificationenable enabled:true`.'),
			],
			flags: [MessageFlags.Ephemeral],
		});
	}

	if (!config.verify_channel_id || !config.review_channel_id) {
		return interaction.reply({
			embeds: [errorEmbed('Set verification channels first using `/config verificationchannels`.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	if (!config.verified_role_id || !config.unverified_role_id) {
		return interaction.reply({
			embeds: [errorEmbed('Set verification roles first using `/config verificationroles`.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	const verifyChannel =
		interaction.guild?.channels.cache.get(config.verify_channel_id) ||
		(await interaction.guild?.channels.fetch(config.verify_channel_id).catch(() => null));

	if (!verifyChannel || verifyChannel.type !== ChannelType.GuildText) {
		return interaction.reply({
			embeds: [errorEmbed('The configured verify channel is missing or is not a text channel.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	const panelEmbed = new EmbedBuilder()
		.setColor(Colors.INFO)
		.setTitle('Community Verification')
		.setDescription(
			'Click the button below to start verification.\n\nIf automated checks fail, your request is queued for manual moderator review.',
		)
		.setFooter(FOOTER)
		.setTimestamp();

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId('verify:start')
			.setLabel('Start Verification')
			.setStyle(ButtonStyle.Primary),
	);

	const panelMessage = await verifyChannel.send({ embeds: [panelEmbed], components: [row] });

	await interaction.reply({
		embeds: [
			successEmbed(
				'Verification Panel Posted',
				`Verification panel posted in ${verifyChannel}.\n[Jump to message](${panelMessage.url})`,
			),
		],
		flags: [MessageFlags.Ephemeral],
	});
}

async function handleIncidentAction(
	interaction: ChatInputCommandInteraction,
	field: 'dm_disabled' | 'invites_disabled',
	label: string,
): Promise<void> {
	if (!interaction.guildId) return;

	const disable = interaction.options.getBoolean('disable', true);

	const botMember = interaction.guild?.members.me;
	if (!botMember?.permissions.has(PermissionFlagsBits.ManageGuild)) {
		return interaction.reply({
			embeds: [errorEmbed('I need the **Manage Server** permission to manage incident actions.')],
			flags: [MessageFlags.Ephemeral],
		});
	}

	const config = db.getGuildConfig(interaction.guildId);
	const dmDisabled = field === 'dm_disabled' ? disable : config.dm_disabled === 1;
	const invitesDisabled = field === 'invites_disabled' ? disable : config.invites_disabled === 1;

	try {
		await applyIncidentActions(interaction.client, interaction.guildId, dmDisabled, invitesDisabled);
	} catch {
		return interaction.reply({
			embeds: [
				errorEmbed(
					`Failed to update ${label} settings via Discord. Make sure I have the **Manage Server** permission and try again.`,
				),
			],
			flags: [MessageFlags.Ephemeral],
		});
	}

	db.upsertGuildConfig(interaction.guildId, { [field]: disable ? 1 : 0 });

	await interaction.reply({
		embeds: [
			successEmbed(
				`${label} Settings Updated`,
				disable
					? `${label} are now **disabled** server-wide. The restriction is automatically maintained.`
					: `${label} have been **re-enabled** server-wide.`,
			),
		],
	});
}

async function handleDisableDms(interaction: ChatInputCommandInteraction): Promise<void> {
	return handleIncidentAction(interaction, 'dm_disabled', 'DM');
}

async function handleDisableInvites(interaction: ChatInputCommandInteraction): Promise<void> {
	return handleIncidentAction(interaction, 'invites_disabled', 'Invite');
}

async function handleReset(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guildId) return;

	const config = db.getGuildConfig(interaction.guildId);

	// Re-enable DMs and invites via Discord API if they were disabled
	if (config.dm_disabled || config.invites_disabled) {
		try {
			await applyIncidentActions(interaction.client, interaction.guildId, false, false);
		} catch {
			// Best-effort — continue with the config reset
		}
	}

	db.deleteGuildConfig(interaction.guildId);
	db.upsertGuildConfig(interaction.guildId, {});

	await interaction.reply({
		embeds: [successEmbed('Configuration Reset', 'All settings have been reset to defaults.')],
	});
}
