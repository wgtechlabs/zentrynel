import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { Colors } from '../config/constants.js';
import { db } from '../db/index.js';
import { errorEmbed, successEmbed } from '../utils/embeds.js';

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
	.addSubcommand((sub) => sub.setName('reset').setDescription('Reset all settings to defaults'))
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
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
		case 'reset':
			return handleReset(interaction);
	}
}

async function handleView(interaction) {
	const config = await db.getGuildConfig(interaction.guildId);

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
				value: formatMs(config.mute_duration_default),
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
		)
		.setTimestamp();

	await interaction.reply({ embeds: [embed] });
}

async function handleLogChannel(interaction) {
	const channel = interaction.options.getChannel('channel');

	const permissions = channel.permissionsFor(interaction.guild.members.me);
	if (!permissions?.has(['SendMessages', 'EmbedLinks'])) {
		return interaction.reply({
			embeds: [
				errorEmbed('I need **Send Messages** and **Embed Links** permissions in that channel.'),
			],
			ephemeral: true,
		});
	}

	await db.upsertGuildConfig(interaction.guildId, { log_channel_id: channel.id });

	await interaction.reply({
		embeds: [successEmbed('Log Channel Set', `Mod action logs will be sent to ${channel}.`)],
	});
}

async function handleThresholds(interaction) {
	const mute = interaction.options.getInteger('mute');
	const kick = interaction.options.getInteger('kick');
	const ban = interaction.options.getInteger('ban');

	if (!mute && !kick && !ban) {
		return interaction.reply({
			embeds: [errorEmbed('Provide at least one threshold to update.')],
			ephemeral: true,
		});
	}

	const config = await db.getGuildConfig(interaction.guildId);
	const newMute = mute ?? config.warn_threshold_mute;
	const newKick = kick ?? config.warn_threshold_kick;
	const newBan = ban ?? config.warn_threshold_ban;

	if (newMute >= newKick || newKick >= newBan) {
		return interaction.reply({
			embeds: [errorEmbed('Thresholds must be in ascending order: mute < kick < ban.')],
			ephemeral: true,
		});
	}

	await db.upsertGuildConfig(interaction.guildId, {
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

async function handleMuteDuration(interaction) {
	const { parseDuration, formatDuration } = await import('../utils/time.js');

	const input = interaction.options.getString('duration');
	const ms = parseDuration(input);

	if (!ms) {
		return interaction.reply({
			embeds: [errorEmbed('Invalid duration format. Use: 10s, 5m, 1h, 2d')],
			ephemeral: true,
		});
	}

	const maxTimeout = 28 * 24 * 60 * 60 * 1000;
	if (ms < 1_000 || ms > maxTimeout) {
		return interaction.reply({
			embeds: [errorEmbed('Duration must be between 1 second and 28 days.')],
			ephemeral: true,
		});
	}

	await db.upsertGuildConfig(interaction.guildId, { mute_duration_default: ms });

	await interaction.reply({
		embeds: [successEmbed('Default Mute Duration Updated', `Set to **${formatDuration(ms)}**.`)],
	});
}

async function handleReset(interaction) {
	await db.deleteGuildConfig(interaction.guildId);
	await db.upsertGuildConfig(interaction.guildId, {});

	await interaction.reply({
		embeds: [successEmbed('Configuration Reset', 'All settings have been reset to defaults.')],
	});
}

function formatMs(ms) {
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	return `${Math.floor(hours / 24)}d`;
}
