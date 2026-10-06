<script lang="ts">
	import { untrack } from 'svelte';
	import ColorPicker from '#lib/components/ColorPicker.svelte';
	import { defaultColor } from '#lib/colors.ts';
	import { parseColor, parseHourlyRate, parseName } from '#lib/db/fields.ts';
	import type { ClientInput, ClientRecord } from '#lib/types.ts';

	type Props = {
		client?: ClientRecord | null;
		onsave: (input: ClientInput) => Promise<void>;
		oncancel: () => void;
	};

	let { client = null, onsave, oncancel }: Props = $props();

	let name = $state(untrack(() => client?.name ?? ''));
	let color = $state(untrack(() => client?.color ?? defaultColor));
	let rate = $state(untrack(() => (client?.hourlyRate == null ? '' : String(client.hourlyRate))));
	let errorMessage = $state('');
	let saving = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		saving = true;
		try {
			await onsave({
				name: parseName(name),
				color: parseColor(color),
				hourlyRate: parseHourlyRate(rate)
			});
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not save the client.';
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-4" onsubmit={submit}>
	<div class="space-y-1.5">
		<label for="client-name" class="block text-sm font-medium">Name</label>
		<input
			id="client-name"
			required
			maxlength="200"
			bind:value={name}
			class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-teal-700 dark:border-stone-700 dark:bg-stone-950 dark:focus:border-teal-500"
		/>
	</div>

	<ColorPicker bind:value={color} />

	<div class="space-y-1.5">
		<label for="client-rate" class="block text-sm font-medium">Hourly rate</label>
		<input
			id="client-rate"
			inputmode="decimal"
			placeholder="Optional"
			bind:value={rate}
			class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-teal-700 dark:border-stone-700 dark:bg-stone-950 dark:focus:border-teal-500"
		/>
	</div>

	{#if errorMessage}
		<p class="text-sm text-red-700 dark:text-red-400" role="alert">{errorMessage}</p>
	{/if}

	<div class="flex flex-wrap gap-2">
		<button
			type="submit"
			disabled={saving}
			class="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
		>
			{saving ? 'Saving…' : 'Save client'}
		</button>
		<button
			type="button"
			class="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-900"
			onclick={oncancel}
		>
			Cancel
		</button>
	</div>
</form>
