<script lang="ts">
	import { untrack } from 'svelte';
	import { dateFromLocalInput } from '#lib/time.ts';

	type Props = {
		projectName: string;
		onkeep: () => void;
		onstop: (end: Date) => Promise<void>;
	};

	let { projectName, onkeep, onstop }: Props = $props();

	let endLocal = $state(
		untrack(() => {
			const now = new Date();
			const pad = (part: number) => String(part).padStart(2, '0');
			return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
		})
	);
	let errorMessage = $state('');
	let saving = $state(false);

	async function saveEnd() {
		errorMessage = '';
		saving = true;
		try {
			await onstop(dateFromLocalInput(endLocal));
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not stop the timer.';
		} finally {
			saving = false;
		}
	}
</script>

<div class="fixed inset-0 z-30 flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
	<div
		class="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-lg dark:border-stone-800 dark:bg-stone-900"
		role="dialog"
		aria-modal="true"
		aria-labelledby="forgot-title"
	>
		<h2 id="forgot-title" class="text-lg font-medium">This timer has been running for over 10 hours</h2>
		<p class="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-400">
			{projectName} is still running. Keep it going, or set the time you actually stopped.
		</p>
		<div class="mt-4 space-y-1.5">
			<label for="forgot-end" class="block text-sm font-medium">End time</label>
			<input
				id="forgot-end"
				type="datetime-local"
				bind:value={endLocal}
				class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-teal-700 dark:border-stone-700 dark:bg-stone-950 dark:focus:border-teal-500"
			/>
		</div>
		{#if errorMessage}
			<p class="mt-3 text-sm text-red-700 dark:text-red-400" role="alert">{errorMessage}</p>
		{/if}
		<div class="mt-5 flex flex-wrap gap-2">
			<button
				type="button"
				class="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
				disabled={saving}
				onclick={saveEnd}
			>
				{saving ? 'Saving…' : 'Set end time'}
			</button>
			<button
				type="button"
				class="rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50 disabled:cursor-not-allowed dark:border-stone-700 dark:hover:bg-stone-800"
				disabled={saving}
				onclick={onkeep}
			>
				Keep running
			</button>
		</div>
	</div>
</div>
