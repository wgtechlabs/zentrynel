import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { ActionTypes } from '../config/constants.js';
import { db } from '../db/index.js';
import { send as sendModLog } from '../services/modLog.js';
import { errorEmbed, successEmbed } from '../utils/embeds.js';

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
	if (!interaction.guildId || !interaction.guild) return;

	const amount = interaction.options.getInteger('amount');
	const filterUser = interaction.options.getUser('user');

	await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

	const fetched = await interaction.channel?.messages.fetch({ limit: amount });

	let toDelete = fetched;
	if (filterUser) {
		toDelete = fetched.filter((msg) => msg.author.id === filterUser.id);
	}

	const deleted = await interaction.channel?.bulkDelete(toDelete, true);

	await db.logAction(
		interaction.guildId,
		ActionTypes.PURGE,
		filterUser?.id || 'channel',
		interaction.user.id,
		filterUser ? `Purged messages from ${filterUser.tag || filterUser.username}` : 'Bulk purge',
		null,
		{ count: deleted.size, channel: interaction.channel?.id },
	);

	await sendModLog(interaction.guild, {
		actionType: ActionTypes.PURGE,
		targetUser: filterUser || interaction.user,
		moderator: interaction.user,
		reason: filterUser
			? `Purged ${deleted.size} messages from ${filterUser}`
			: `Purged ${deleted.size} messages`,
		extra: `Channel: <#${interaction.channel?.id}>`,
	});

	const embed = successEmbed(
		'Messages Purged',
		`Deleted **${deleted.size}** message(s)${filterUser ? ` from ${filterUser}` : ''}.`,
	);

	await interaction.editReply({ embeds: [embed] });
}
