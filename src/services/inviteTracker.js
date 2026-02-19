import { logger } from '../utils/logger.js';

/** @type {Map<string, Map<string, number>>} guildId → Map<inviteCode, uses> */
const inviteCache = new Map();

export async function cacheGuildInvites(guild) {
	try {
		const invites = await guild.invites.fetch();
		const cache = new Map();
		for (const invite of invites.values()) {
			cache.set(invite.code, invite.uses ?? 0);
		}
		inviteCache.set(guild.id, cache);
	} catch {
		logger.warn(`Could not cache invites for guild ${guild.id}`);
	}
}

export async function resolveUsedInvite(guild) {
	try {
		const newInvites = await guild.invites.fetch();
		const oldCache = inviteCache.get(guild.id) ?? new Map();
		let usedCode = null;

		for (const invite of newInvites.values()) {
			const oldUses = oldCache.get(invite.code) ?? 0;
			if ((invite.uses ?? 0) > oldUses) {
				usedCode = invite.code;
				break;
			}
		}

		// Update cache with fresh counts
		const cache = new Map();
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

export function clearGuildCache(guildId) {
	inviteCache.delete(guildId);
}
