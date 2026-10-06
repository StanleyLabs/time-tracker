const hexColor = /^#[0-9a-f]{6}$/i;

export function parseName(value: string): string {
	const name = value.trim();
	if (!name) throw new Error('Name is required.');
	if (name.length > 200) throw new Error('Name must be 200 characters or less.');
	return name;
}

export function parseColor(value: string): string {
	const color = value.trim();
	if (!hexColor.test(color)) throw new Error('Choose a color.');
	return color.toLowerCase();
}

/** Blank means no rate is set. */
export function parseHourlyRate(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const rate = Number(trimmed);
	if (!Number.isFinite(rate) || rate < 0) throw new Error('Hourly rate must be zero or greater.');
	return rate;
}

export function formatRate(rate: number | null): string {
	if (rate === null) return 'No rate';
	return `${rate}/hr`;
}
