<script lang="ts">
	import { ClientResponseError } from 'pocketbase';
	import { login } from '#lib/state/auth.svelte.ts';

	let email = $state('');
	let password = $state('');
	let errorMessage = $state('');
	let submitting = $state(false);

	function messageFor(error: unknown): string {
		if (error instanceof ClientResponseError) {
			if (error.status === 0) {
				return 'Could not reach PocketBase. Check that it is running and that VITE_POCKETBASE_URL is correct.';
			}
			if (error.status === 400 || error.status === 401 || error.status === 403) {
				return 'Email or password is incorrect.';
			}
		}
		return 'Could not sign in. Try again.';
	}

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		submitting = true;
		try {
			await login(email.trim(), password);
		} catch (error) {
			errorMessage = messageFor(error);
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in · Time tracker</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
	<div
		class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900"
	>
		<h1 class="text-2xl font-semibold tracking-tight">Sign in</h1>
		<p class="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-400">
			Use a record from the Users collection. The admin superuser cannot sign in here.
		</p>

		<form class="mt-8 space-y-4" onsubmit={onSubmit}>
			<div class="space-y-1.5">
				<label for="email" class="block text-sm font-medium">Email</label>
				<input
					id="email"
					name="email"
					type="email"
					autocomplete="email"
					required
					bind:value={email}
					class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-teal-700 dark:border-stone-700 dark:bg-stone-950 dark:focus:border-teal-500"
				/>
			</div>

			<div class="space-y-1.5">
				<label for="password" class="block text-sm font-medium">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					bind:value={password}
					class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-teal-700 dark:border-stone-700 dark:bg-stone-950 dark:focus:border-teal-500"
				/>
			</div>

			{#if errorMessage}
				<p class="text-sm text-red-700 dark:text-red-400" role="alert">{errorMessage}</p>
			{/if}

			<button
				type="submit"
				disabled={submitting}
				class="w-full rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
			>
				{submitting ? 'Signing in…' : 'Sign in'}
			</button>
		</form>
	</div>
</main>
