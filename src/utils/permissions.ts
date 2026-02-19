import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { GuildMember as GuildMemberClass } from 'discord.js';

interface ModerateResult {
	allowed: boolean;
	reason: string | null;
}

export async function canModerate(
	interaction: ChatInputCommandInteraction,
	targetMember: GuildMember,
): Promise<ModerateResult> {
	if (targetMember.id === interaction.client.user.id) {
		return { allowed: false, reason: 'I cannot moderate myself.' };
	}

	if (targetMember.id === interaction.user.id) {
		return { allowed: false, reason: 'You cannot moderate yourself.' };
	}

	if (targetMember.id === interaction.guild?.ownerId) {
		return { allowed: false, reason: 'Cannot moderate the server owner.' };
	}

	const botMember = interaction.guild?.members.me;
	if (!botMember) return { allowed: false, reason: 'Unable to resolve my own member.' };

	if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
		return { allowed: false, reason: 'My role is not high enough to moderate this user.' };
	}

	let invokerMember: GuildMember;
	if (interaction.member instanceof GuildMemberClass) {
		invokerMember = interaction.member;
	} else if (interaction.guild) {
		try {
			invokerMember = await interaction.guild.members.fetch(interaction.user.id);
		} catch {
			return { allowed: false, reason: 'Unable to resolve your membership.' };
		}
	} else {
		return { allowed: false, reason: 'Unable to resolve your membership.' };
	}
	if (targetMember.roles.highest.position >= invokerMember.roles.highest.position) {
		return { allowed: false, reason: 'Your role is not high enough to moderate this user.' };
	}

	return { allowed: true, reason: null };
}
