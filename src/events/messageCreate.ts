import type { Message } from 'discord.js';

export const name = 'messageCreate';

export async function execute(message: Message): Promise<void> {
	if (message.author.bot) return;

	// Ignore all DMs — the bot does not initiate or respond to direct messages
	if (message.channel.isDMBased()) return;
}
