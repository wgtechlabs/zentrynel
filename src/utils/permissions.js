export function canModerate(interaction, targetMember) {
	if (targetMember.id === interaction.client.user.id) {
		return { allowed: false, reason: 'I cannot moderate myself.' };
	}

	if (targetMember.id === interaction.user.id) {
		return { allowed: false, reason: 'You cannot moderate yourself.' };
	}

	if (targetMember.id === interaction.guild.ownerId) {
		return { allowed: false, reason: 'Cannot moderate the server owner.' };
	}

	const botMember = interaction.guild.members.me;
	if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
		return { allowed: false, reason: 'My role is not high enough to moderate this user.' };
	}

	if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
		return { allowed: false, reason: 'Your role is not high enough to moderate this user.' };
	}

	return { allowed: true, reason: null };
}
