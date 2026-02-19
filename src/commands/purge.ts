import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { ActionTypes } from '../config/constants.js';
import { db } from '../db/index.js';
import { send as sendModLog } from '../services/modLog.js';
import { errorEmbed, successEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
	.setName('purge')
	.setDescription('Bulk delete messages from the current channel')
	.addIntegerOption((option) =>
		option
			.setName('amount')
			.setDescription('Number of messages to delete (1-100)')
			.setMinValue(1)
			.setMaxValue(100)
			.setRequired(true),
	)
	.addUserOption((option) =>
		option.setName('user').setDescription('Only delete messages from this user'),
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guildId || !interaction.guild) {
		await interaction.reply({
			content: 'This command can only be used in a server.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const amount = interaction.options.getInteger('amount', true);
	const filterUser = interaction.options.getUser('user');

	await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

	const channel = interaction.channel;
	if (!channel || !('messages' in channel)) {
		await interaction.editReply({
			embeds: [errorEmbed('Cannot purge messages in this channel type.')],
		});
		return;
	}

	let deletedCount: number;
	try {
		const fetched = await channel.messages.fetch({ limit: amount });

		let toDelete = fetched;
		if (filterUser) {
			toDelete = fetched.filter((msg) => msg.author.id === filterUser.id);
		}

		const deleted = await channel.bulkDelete(toDelete, true);
		deletedCount = deleted?.size ?? 0;
	} catch (err) {
		logger.error(`Failed to purge messages in channel ${channel.id}:`, err);
		await interaction.editReply({
			embeds: [errorEmbed(`Failed to purge messages: ${(err as Error).message}`)],
		});
		return;
	}

	db.logAction(
		interaction.guildId,
		ActionTypes.PURGE,
		filterUser?.id || 'channel',
		interaction.user.id,
		filterUser ? `Purged messages from ${filterUser.tag || filterUser.username}` : 'Bulk purge',
		null,
		{ count: deletedCount, channel: channel.id },
	);

	await sendModLog(interaction.guild, {
		actionType: ActionTypes.PURGE,
		targetUser: filterUser ?? null,
		moderator: interaction.user,
		reason: filterUser
			? `Purged ${deletedCount} messages from ${filterUser}`
			: `Purged ${deletedCount} messages`,
		extra: `Channel: <#${channel.id}>`,
	});

	const embed = successEmbed(
		'Messages Purged',
		`Deleted **${deletedCount}** message(s)${filterUser ? ` from ${filterUser}` : ''}.`,
	);

	await interaction.editReply({ embeds: [embed] });
}
