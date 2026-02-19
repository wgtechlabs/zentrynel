import type { EmbedBuilder, User } from 'discord.js';
import { EmbedBuilder as EmbedBuilderImpl } from 'discord.js';
import { BOT_VERSION, Colors } from '../config/constants.js';

export const FOOTER = { text: `Zentrynel v${BOT_VERSION} — Built by Waren Gonzaga (WG Tech Labs)` };

export function successEmbed(title: string, description: string): EmbedBuilder {
	return new EmbedBuilderImpl()
		.setColor(Colors.INFO)
		.setTitle(title)
		.setDescription(description)
		.setFooter(FOOTER)
		.setTimestamp();
}

export function errorEmbed(description: string): EmbedBuilder {
	return new EmbedBuilderImpl()
		.setColor(Colors.ERROR)
		.setTitle('Error')
		.setDescription(description)
		.setFooter(FOOTER)
		.setTimestamp();
}

interface ModActionEmbedOptions {
	actionType: string;
	targetUser: User;
	moderator: User;
	reason?: string | null;
	duration?: string | null;
	extra?: string | null;
}

export function modActionEmbed({
	actionType,
	targetUser,
	moderator,
	reason,
	duration,
	extra,
}: ModActionEmbedOptions): EmbedBuilder {
	const color = (Colors as Record<string, number>)[actionType] ?? Colors.INFO;

	const embed = new EmbedBuilderImpl()
		.setColor(color)
		.setTitle(`${actionType}`)
		.addFields(
			{ name: 'User', value: `${targetUser} (${targetUser.id})`, inline: true },
			{ name: 'Moderator', value: `${moderator} (${moderator.id})`, inline: true },
			{ name: 'Reason', value: reason || 'No reason provided' },
		)
		.setFooter(FOOTER)
		.setTimestamp();

	if (duration) {
		embed.addFields({ name: 'Duration', value: duration, inline: true });
	}

	if (extra) {
		embed.addFields({ name: 'Details', value: extra, inline: true });
	}

	return embed;
}

interface WarnTarget {
	tag?: string;
	username?: string;
}

interface WarnRow {
	id: number;
	created_at: string;
	reason: string;
	moderator_id: string;
}

export function warningListEmbed(targetUser: WarnTarget, warnings: WarnRow[]): EmbedBuilder {
	const embed = new EmbedBuilderImpl()
		.setColor(Colors.WARN)
		.setTitle(`Warnings for ${targetUser.tag ?? targetUser.username}`)
		.setDescription(`Total active warnings: **${warnings.length}**`)
		.setFooter(FOOTER)
		.setTimestamp();

	for (const warn of warnings.slice(0, 25)) {
		embed.addFields({
			name: `#${warn.id} — ${warn.created_at}`,
			value: `**Reason:** ${warn.reason}\n**By:** <@${warn.moderator_id}>`,
		});
	}

	return embed;
}
