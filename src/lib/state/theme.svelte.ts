export type ThemePreference = 'system' | 'light' | 'dark';

/** Also read by the inline script in src/app.html. */
export const THEME_STORAGE_KEY = 'theme';

function isPreference(value: string | null): value is ThemePreference {
	return value === 'system' || value === 'light' || value === 'dark';
}

function readPreference(): ThemePreference {
	if (typeof localStorage === 'undefined') return 'system';
	const stored = localStorage.getItem(THEME_STORAGE_KEY);
	return isPreference(stored) ? stored : 'system';
}

function systemPrefersDark(): boolean {
	return (
		typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
	);
}

let preference = $state<ThemePreference>(readPreference());
let systemDark = $state(systemPrefersDark());
let listening = false;

function resolvedTheme(): 'light' | 'dark' {
	if (preference === 'system') return systemDark ? 'dark' : 'light';
	return preference;
}

function applyTheme(): void {
	if (typeof document === 'undefined') return;
	const dark = resolvedTheme() === 'dark';
	document.documentElement.classList.toggle('dark', dark);
	document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function initTheme(): void {
	applyTheme();
	if (listening || typeof window === 'undefined') return;
	listening = true;
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
		systemDark = event.matches;
		applyTheme();
	});
}

export function setTheme(next: ThemePreference): void {
	preference = next;
	localStorage.setItem(THEME_STORAGE_KEY, next);
	applyTheme();
}

export const theme = {
	get preference(): ThemePreference {
		return preference;
	}
};
