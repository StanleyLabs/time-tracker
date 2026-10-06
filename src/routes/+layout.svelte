<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import { auth, initAuth } from '#lib/state/auth.svelte.ts';
	import { initTheme } from '#lib/state/theme.svelte.ts';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	initTheme();
	initAuth();

	const onLoginPage = $derived(page.url.pathname === '/login');
	const showPage = $derived(
		auth.ready &&
			((auth.isAuthenticated && !onLoginPage) || (!auth.isAuthenticated && onLoginPage))
	);

	$effect(() => {
		if (!auth.ready) return;
		if (!auth.isAuthenticated && !onLoginPage) {
			void goto('/login', { replaceState: true });
		} else if (auth.isAuthenticated && onLoginPage) {
			void goto('/', { replaceState: true });
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex min-h-dvh flex-col bg-stone-100 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
	<header class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
		<p class="text-sm font-medium tracking-wide">Time tracker</p>
		<ThemeToggle />
	</header>

	{#if showPage}
		{@render children()}
	{:else}
		<p class="px-4 text-sm text-stone-500 dark:text-stone-400">Loading…</p>
	{/if}
</div>
