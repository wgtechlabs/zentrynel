const UNITS: Record<string, number> = {
	s: 1_000,
	m: 60_000,
	h: 3_600_000,
	d: 86_400_000,
};

export function parseDuration(input: string | null | undefined): number | null {
	if (!input) return null;

	const match = input.trim().match(/^(\d+)(s|m|h|d)$/i);
	if (!match) return null;

	const value = Number.parseInt(match[1] ?? '0', 10);
	const unit = match[2]?.toLowerCase();

	return value * (UNITS[unit] ?? 0);
}

export function formatDuration(ms: number | null | undefined): string {
	if (!ms || ms <= 0) return '0 seconds';

	const parts: string[] = [];
	const days = Math.floor(ms / (UNITS.d ?? 0));
	const hours = Math.floor((ms % (UNITS.d ?? 0)) / (UNITS.h ?? 0));
	const minutes = Math.floor((ms % (UNITS.h ?? 0)) / (UNITS.m ?? 0));
	const seconds = Math.floor((ms % (UNITS.m ?? 0)) / (UNITS.s ?? 0));

	if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
	if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
	if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
	if (seconds > 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);

	return parts.join(', ');
}
