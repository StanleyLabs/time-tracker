export const colorPresets = [
	{ name: 'Green', value: '#059669' },
	{ name: 'Teal', value: '#0f766e' },
	{ name: 'Blue', value: '#2563eb' },
	{ name: 'Indigo', value: '#4f46e5' },
	{ name: 'Violet', value: '#7c3aed' },
	{ name: 'Rose', value: '#e11d48' },
	{ name: 'Orange', value: '#ea580c' },
	{ name: 'Amber', value: '#d97706' }
] as const;

export const defaultColor = colorPresets[0].value;

const rainbow =
	'conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)';

export function presetColor(value: string): (typeof colorPresets)[number] | undefined {
	const normalized = value.toLowerCase();
	return colorPresets.find((preset) => preset.value === normalized);
}

export { rainbow };
