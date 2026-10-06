<script lang="ts">
	import { setTheme, theme, type ThemePreference } from '#lib/state/theme.svelte.ts';

	const options: { value: ThemePreference; label: string }[] = [
		{ value: 'system', label: 'System' },
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' }
	];
</script>

<div
	class="inline-flex rounded-full border border-stone-300 bg-white p-0.5 text-sm dark:border-stone-700 dark:bg-stone-900"
	role="radiogroup"
	aria-label="Color theme"
>
	{#each options as option (option.value)}
		<button
			type="button"
			role="radio"
			aria-checked={theme.preference === option.value}
			class="rounded-full px-3 py-1 {theme.preference === option.value
				? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
				: 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'}"
			onclick={() => setTheme(option.value)}
		>
			{option.label}
		</button>
	{/each}
</div>
