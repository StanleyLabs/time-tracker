<script lang="ts">
	import { accountEmail, logout } from '#lib/state/auth.svelte.ts';
</script>

<svelte:head>
	<title>Time tracker</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-10">
	<h1 class="text-2xl font-semibold tracking-tight">You're signed in</h1>
	<p class="mt-2 text-stone-600 dark:text-stone-400">{accountEmail()}</p>
	<p class="mt-6 text-sm leading-6 text-stone-500 dark:text-stone-400">
		The timer and the rest of the app come in later phases.
	</p>
	<button
		type="button"
		class="mt-8 w-fit rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500"
		onclick={() => logout()}
	>
		Log out
	</button>
</main>
