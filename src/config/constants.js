export const Colors = {
	WARN: 0xffa500,
	MUTE: 0x3498db,
	KICK: 0xe67e22,
	BAN: 0xe74c3c,
	PURGE: 0x9b59b6,
	INFO: 0x2ecc71,
	ERROR: 0xe74c3c,
};

export const ActionTypes = {
	WARN: 'WARN',
	MUTE: 'MUTE',
	KICK: 'KICK',
	BAN: 'BAN',
	PURGE: 'PURGE',
};

export const Defaults = {
	WARN_THRESHOLD_MUTE: 3,
	WARN_THRESHOLD_KICK: 5,
	WARN_THRESHOLD_BAN: 7,
	MUTE_DURATION_MS: 600_000,
	PURGE_MAX: 100,
	PURGE_MIN: 1,
};
