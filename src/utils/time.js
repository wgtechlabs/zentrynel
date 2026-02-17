const UNITS = {
	s: 1_000,
	m: 60_000,
	h: 3_600_000,
	d: 86_400_000,
};

export function parseDuration(input) {
	if (!input) return null;

	const match = input.trim().match(/^(\d+)(s|m|h|d)$/i);
	if (!match) return null;

	const value = Number.parseInt(match[1], 10);
	const unit = match[2].toLowerCase();

	return value * UNITS[unit];
}

export function formatDuration(ms) {
	if (!ms || ms <= 0) return '0 seconds';

	const parts = [];
	const days = Math.floor(ms / UNITS.d);
	const hours = Math.floor((ms % UNITS.d) / UNITS.h);
	const minutes = Math.floor((ms % UNITS.h) / UNITS.m);
	const seconds = Math.floor((ms % UNITS.m) / UNITS.s);

	if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
	if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
	if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
	if (seconds > 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);

	return parts.join(', ');
}
