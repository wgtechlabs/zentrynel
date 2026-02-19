import type { Guild } from 'discord.js';
import { logger } from '../utils/logger.js';

interface InviteEntry {
	uses: number;
	maxUses: number;
}

/** guildId → Map<inviteCode, InviteEntry> */
const inviteCache = new Map<string, Map<string, InviteEntry>>();

/** Per-guild promise queue to serialize invite resolution and prevent race conditions. */
const guildLocks = new Map<string, Promise<unknown>>();

function withGuildLock<T>(guildId: string, fn: () => Promise<T>): Promise<T> {
	const prev = guildLocks.get(guildId) ?? Promise.resolve();
	const next = prev.then(fn, fn);
	guildLocks.set(guildId, next);
	// Clean up the lock entry once the chain settles to avoid memory leaks
	next.finally(() => {
		if (guildLocks.get(guildId) === next) {
			guildLocks.delete(guildId);
		}
	});
	return next;
}

export async function cacheGuildInvites(guild: Guild): Promise<void> {
	return withGuildLock(guild.id, async () => {
		try {
			const invites = await guild.invites.fetch();
			const cache = new Map<string, InviteEntry>();
			for (const invite of invites.values()) {
				cache.set(invite.code, {
					uses: invite.uses ?? 0,
					maxUses: invite.maxUses ?? 0,
				});
			}
			inviteCache.set(guild.id, cache);
		} catch {
			logger.warn(`Could not cache invites for guild ${guild.id}`);
		}
	});
}

/**
 * Resolve which invite code a new member used by diffing cached vs current invite counts.
 *
 * Race condition note: concurrent calls to guild.invites.fetch() can read
 * identical stale counts, causing duplicate attribution (two members credited
 * to the same invite) or lost attribution (an invite use increment is consumed
 * by the wrong call). This is mitigated by serializing resolution per guild
 * using a promise-based mutex (withGuildLock).
 *
 * One-time invite detection: invites with maxUses that are fully consumed get
 * deleted by Discord and won't appear in guild.invites.fetch(). We detect these
 * by diffing old cache keys against new keys — a disappeared code whose cached
 * uses === maxUses - 1 was likely the used invite.
 */
export async function resolveUsedInvite(guild: Guild): Promise<string | null> {
	return withGuildLock(guild.id, async () => {
		try {
			const newInvites = await guild.invites.fetch();
			const oldCache = inviteCache.get(guild.id) ?? new Map<string, InviteEntry>();
			let usedCode: string | null = null;

			// Check for use-count increases on still-existing invites
			for (const invite of newInvites.values()) {
				const oldEntry = oldCache.get(invite.code);
				const oldUses = oldEntry?.uses ?? 0;
				if ((invite.uses ?? 0) > oldUses) {
					usedCode = invite.code;
					break;
				}
			}

			// Detect one-time invites that were deleted after being fully consumed
			if (!usedCode) {
				const newCodes = new Set<string>();
				for (const invite of newInvites.values()) {
					newCodes.add(invite.code);
				}
				for (const [code, entry] of oldCache) {
					if (!newCodes.has(code) && entry.maxUses > 0 && entry.uses === entry.maxUses - 1) {
						usedCode = code;
						break;
					}
				}
			}

			// Update cache with fresh counts
			const cache = new Map<string, InviteEntry>();
			for (const invite of newInvites.values()) {
				cache.set(invite.code, {
					uses: invite.uses ?? 0,
					maxUses: invite.maxUses ?? 0,
				});
			}
			inviteCache.set(guild.id, cache);

			return usedCode;
		} catch {
			logger.warn(`Could not resolve invite for guild ${guild.id}`);
			return null;
		}
	});
}

export function clearGuildCache(guildId: string): void {
	inviteCache.delete(guildId);
	guildLocks.delete(guildId);
}
