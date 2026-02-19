import { EmbedBuilder } from 'discord.js';
import { BOT_VERSION, Colors } from '../config/constants.js';

const FOOTER = { text: `Zentrynel v${BOT_VERSION} — Built by Waren Gonzaga (WG Tech Labs)` };

export function successEmbed(title, description) {
	return new EmbedBuilder()
		.setColor(Colors.INFO)
		.setTitle(title)
		.setDescription(description)
		.setFooter(FOOTER)
		.setTimestamp();
}

export function errorEmbed(description) {
	return new EmbedBuilder()
		.setColor(Colors.ERROR)
		.setTitle('Error')
		.setDescription(description)
		.setFooter(FOOTER)
		.setTimestamp();
}

export function modActionEmbed({ actionType, targetUser, moderator, reason, duration, extra }) {
	const color = Colors[actionType] || Colors.INFO;

	const embed = new EmbedBuilder()
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

export function warningListEmbed(targetUser, warnings) {
	const embed = new EmbedBuilder()
		.setColor(Colors.WARN)
		.setTitle(`Warnings for ${targetUser.tag || targetUser.username}`)
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
