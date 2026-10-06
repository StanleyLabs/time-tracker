<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import ForgotToStop from '#lib/components/ForgotToStop.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import { flushNotesDraft, startTimer, stopTimer } from '#lib/db/timeEntries.ts';
	import { auth, initAuth, logout } from '#lib/state/auth.svelte.ts';
	import { catalog, stopCatalog, watchCatalog } from '#lib/state/catalog.svelte.ts';
	import { clock, setClockRunning, snapClock } from '#lib/state/clock.svelte.ts';
	import { initTheme } from '#lib/state/theme.svelte.ts';
	import {
		elapsedMs,
		FORGOT_TO_STOP_MS,
		formatClock,
		runningEntry
	} from '#lib/time.ts';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	initTheme();
	initAuth();

	let suppressForgotId = $state<string | null>(null);
	let shortcutBusy = false;
	let shortcutError = $state('');

	const onLoginPage = $derived(page.url.pathname === '/login');
	const showPage = $derived(
		auth.ready &&
			((auth.isAuthenticated && !onLoginPage) || (!auth.isAuthenticated && onLoginPage))
	);
	const running = $derived(runningEntry(catalog.timeEntries));
	const forgotEntry = $derived.by(() => {
		const entry = running;
		if (!entry || suppressForgotId === entry.id) return null;
		if (elapsedMs(entry, clock.now) < FORGOT_TO_STOP_MS) return null;
		return entry;
	});
	const forgotProjectName = $derived(
		catalog.projects.find((project) => project.id === forgotEntry?.projectId)?.name ?? 'This timer'
	);
	const pageTitle = $derived.by(() => {
		const path = page.url.pathname;
		if (path === '/login') return 'Sign in · Time tracker';
		if (path === '/entries') return 'Entries · Time tracker';
		if (path === '/clients') return 'Clients · Time tracker';
		return 'Time tracker';
	});
	const documentTitle = $derived.by(() => {
		const entry = running;
		if (!entry) return pageTitle;
		const project = entry.projectId
			? catalog.projects.find((item) => item.id === entry.projectId)
			: undefined;
		if (!project) return formatClock(elapsedMs(entry, clock.now));
		return `${formatClock(elapsedMs(entry, clock.now))} – ${project.name}`;
	});

	$effect(() => {
		if (!auth.ready) return;
		if (!auth.isAuthenticated && !onLoginPage) {
			void goto('/login', { replace: true });
		} else if (auth.isAuthenticated && onLoginPage) {
			void goto('/', { replace: true });
		}
	});

	$effect(() => {
		const userId = auth.user?.id;
		if (userId) watchCatalog(userId);
		else stopCatalog();
	});

	$effect(() => {
		setClockRunning(running !== undefined);
	});

	$effect(() => {
		const onVisible = () => {
			if (document.visibilityState !== 'visible') return;
			snapClock();
			suppressForgotId = null;
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	});

	function navClass(path: string): string {
		const current = page.url.pathname === path;
		return current
			? 'font-medium text-teal-800 dark:text-teal-400'
			: 'text-stone-600 dark:text-stone-400';
	}

	function isTypingTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		const tag = target.tagName;
		return (
			tag === 'INPUT' ||
			tag === 'TEXTAREA' ||
			tag === 'SELECT' ||
			tag === 'BUTTON' ||
			tag === 'A' ||
			target.isContentEditable
		);
	}

	async function onSpace() {
		if (shortcutBusy || !auth.isAuthenticated || !catalog.ready) return;
		const current = runningEntry(catalog.timeEntries);
		shortcutBusy = true;
		shortcutError = '';
		try {
			if (current) {
				await flushNotesDraft();
				await stopTimer(current.id);
				return;
			}
			await startTimer(null);
		} catch (error) {
			shortcutError = error instanceof Error ? error.message : 'Could not update the timer.';
		} finally {
			shortcutBusy = false;
		}
	}

	async function stopForgotten(end: Date) {
		const entry = running;
		if (!entry) return;
		await flushNotesDraft();
		await stopTimer(entry.id, end);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{documentTitle}</title>
</svelte:head>

<svelte:window
	onkeydown={(event) => {
		if (event.key !== ' ' || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
		if (isTypingTarget(event.target)) return;
		if (!auth.isAuthenticated) return;
		event.preventDefault();
		void onSpace();
	}}
/>

<div class="flex min-h-dvh flex-col bg-stone-100 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
	<header class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
		<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
			<a href="/" class="text-sm font-medium tracking-wide">Time tracker</a>
			{#if auth.isAuthenticated}
				<nav class="flex items-center gap-3 text-sm" aria-label="Main">
					<a href="/" class={navClass('/')} aria-current={page.url.pathname === '/' ? 'page' : undefined}>
						Timer
					</a>
					<a
						href="/entries"
						class={navClass('/entries')}
						aria-current={page.url.pathname === '/entries' ? 'page' : undefined}
					>
						Entries
					</a>
					<a
						href="/clients"
						class={navClass('/clients')}
						aria-current={page.url.pathname === '/clients' ? 'page' : undefined}
					>
						Clients
					</a>
				</nav>
			{/if}
		</div>
		<div class="flex items-center gap-3">
			{#if auth.isAuthenticated}
				<button
					type="button"
					class="text-sm text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
					onclick={() => logout()}
				>
					Log out
				</button>
			{/if}
			<ThemeToggle />
		</div>
	</header>

	{#if shortcutError}
		<p class="px-4 text-sm text-red-700 dark:text-red-400" role="alert">{shortcutError}</p>
	{/if}

	{#if showPage}
		{@render children()}
	{:else}
		<p class="px-4 text-sm text-stone-500 dark:text-stone-400">Loading…</p>
	{/if}
</div>

{#if forgotEntry}
	{@const overdue = forgotEntry}
	<ForgotToStop
		projectName={forgotProjectName}
		onkeep={() => (suppressForgotId = overdue.id)}
		onstop={stopForgotten}
	/>
{/if}
