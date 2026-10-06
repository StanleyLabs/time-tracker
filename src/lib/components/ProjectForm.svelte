<script lang="ts">
	import { untrack } from 'svelte';
	import ColorPicker from '#lib/components/ColorPicker.svelte';
	import { parseColor, parseHourlyRate, parseName } from '#lib/db/fields.ts';
	import type { ProjectInput, ProjectRecord } from '#lib/types.ts';

	type Props = {
		clientId: string;
		clientColor: string;
		project?: ProjectRecord | null;
		onsave: (input: ProjectInput) => Promise<void>;
		oncancel: () => void;
	};

	let { clientId, clientColor, project = null, onsave, oncancel }: Props = $props();

	let name = $state(untrack(() => project?.name ?? ''));
	let useClientColor = $state(untrack(() => (project ? project.color === null : true)));
	let color = $state(untrack(() => project?.color ?? clientColor));
	let rate = $state(untrack(() => (project?.hourlyRate == null ? '' : String(project.hourlyRate))));
	let errorMessage = $state('');
	let saving = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		saving = true;
		try {
			await onsave({
				clientId,
				name: parseName(name),
				color: useClientColor ? null : parseColor(color),
				hourlyRate: parseHourlyRate(rate)
			});
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not save the project.';
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-4" onsubmit={submit}>
	<div class="space-y-1.5">
		<label for="project-name" class="block text-sm font-medium">Name</label>
		<input
			id="project-name"
			required
			maxlength="200"
			bind:value={name}
			class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-teal-700 dark:border-stone-700 dark:bg-stone-950 dark:focus:border-teal-500"
		/>
	</div>

	<div class="space-y-2">
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" bind:checked={useClientColor} />
			Use client color
		</label>
		{#if !useClientColor}
			<ColorPicker bind:value={color} label="Project color" />
		{/if}
	</div>

	<div class="space-y-1.5">
		<label for="project-rate" class="block text-sm font-medium">Hourly rate</label>
		<input
			id="project-rate"
			inputmode="decimal"
			placeholder="Uses the client rate when empty"
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
			{saving ? 'Saving…' : 'Save project'}
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
