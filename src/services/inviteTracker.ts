import type { Guild } from 'discord.js';
import { logger } from '../utils/logger.js';

/** guildId → Map<inviteCode, uses> */
const inviteCache = new Map<string, Map<string, number>>();

export async function cacheGuildInvites(guild: Guild): Promise<void> {
	try {
		const invites = await guild.invites.fetch();
		const cache = new Map<string, number>();
		for (const invite of invites.values()) {
			cache.set(invite.code, invite.uses ?? 0);
		}
		inviteCache.set(guild.id, cache);
	} catch {
		logger.warn(`Could not cache invites for guild ${guild.id}`);
	}
}

export async function resolveUsedInvite(guild: Guild): Promise<string | null> {
	try {
		const newInvites = await guild.invites.fetch();
		const oldCache = inviteCache.get(guild.id) ?? new Map<string, number>();
		let usedCode: string | null = null;

		for (const invite of newInvites.values()) {
			const oldUses = oldCache.get(invite.code) ?? 0;
			if ((invite.uses ?? 0) > oldUses) {
				usedCode = invite.code;
				break;
			}
		}

		// Update cache with fresh counts
		const cache = new Map<string, number>();
		for (const invite of newInvites.values()) {
			cache.set(invite.code, invite.uses ?? 0);
		}
		inviteCache.set(guild.id, cache);

		return usedCode;
	} catch {
		logger.warn(`Could not resolve invite for guild ${guild.id}`);
		return null;
	}
}

export function clearGuildCache(guildId: string): void {
	inviteCache.delete(guildId);
}
