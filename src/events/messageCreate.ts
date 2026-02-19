import type { Message } from 'discord.js';
import { BOT_VERSION } from '../config/constants.js';

export const name = 'messageCreate';

export async function execute(message: Message): Promise<void> {
	if (message.author.bot) return;
	if (!message.channel.isDMBased()) return;

	await message.reply(
		[
			"**Hey there!** I don't accept direct messages. All my features work exclusively within servers.",
			'',
			`**Zentrynel** v${BOT_VERSION} — an open-source Discord moderation bot with an escalating strike system, CAPTCHA verification, and more.`,
			'',
			'**Links**',
			'GitHub: <https://github.com/wgtechlabs/zentrynel>',
			'Built by [WG Technology Labs](<https://github.com/wgtechlabs>)',
		].join('\n'),
	);
}
