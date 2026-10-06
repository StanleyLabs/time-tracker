<script lang="ts">
	import { untrack } from 'svelte';
	import { pocketBaseNow } from '#lib/db/dates.ts';
	import type { TimeEntryInput } from '#lib/db/timeEntries.ts';
	import ProjectMenu from '#lib/components/ProjectMenu.svelte';
	import { resolveEditedTime, toDateTimeLocal } from '#lib/time.ts';
	import type { ClientRecord, ProjectRecord, TimeEntryRecord } from '#lib/types.ts';

	type Props = {
		entry?: TimeEntryRecord | null;
		clients: ClientRecord[];
		projects: ProjectRecord[];
		defaultProjectId?: string;
		onsave: (input: TimeEntryInput) => Promise<void>;
		oncancel: () => void;
		ondelete?: () => void;
	};

	let {
		entry = null,
		clients,
		projects,
		defaultProjectId = '',
		onsave,
		oncancel,
		ondelete
	}: Props = $props();

	const inputClass =
		'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-teal-700 dark:border-stone-700 dark:bg-stone-950 dark:focus:border-teal-500';

	const options = $derived.by(() => {
		const clientsById = new Map(clients.map((client) => [client.id, client]));
		return projects
			.filter((project) => {
				const client = clientsById.get(project.clientId);
				if (!client) return false;
				if (entry && project.id === entry.projectId) return true;
				return !project.archived && !client.archived;
			})
			.sort((a, b) => {
				const clientA = clientsById.get(a.clientId)?.name ?? '';
				const clientB = clientsById.get(b.clientId)?.name ?? '';
				return clientA.localeCompare(clientB) || a.name.localeCompare(b.name);
			});
	});

	const running = $derived(entry !== null && entry.endTime === null);

	let projectId = $state(
		untrack(() => {
			if (entry) return entry.projectId ?? '';
			return defaultProjectId || options[0]?.id || '';
		})
	);
	let startLocal = $state(
		untrack(() => {
			if (entry) return toDateTimeLocal(entry.startTime);
			return toDateTimeLocal(pocketBaseNow(new Date(Date.now() - 60 * 60 * 1000)));
		})
	);
	let endLocal = $state(
		untrack(() => {
			if (entry?.endTime) return toDateTimeLocal(entry.endTime);
			if (entry) return '';
			return toDateTimeLocal(pocketBaseNow());
		})
	);
	let notes = $state(untrack(() => entry?.notes ?? ''));
	let billable = $state(untrack(() => entry?.billable ?? true));
	let errorMessage = $state('');
	let saving = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		saving = true;
		try {
			if (!projectId && !entry) throw new Error('Choose a project.');
			if (!startLocal) throw new Error('Add a start time.');
			if (!endLocal && !running) throw new Error('Add an end time.');
			await onsave({
				projectId: projectId || null,
				startTime: resolveEditedTime(entry?.startTime ?? null, startLocal) ?? '',
				endTime: resolveEditedTime(entry?.endTime ?? null, endLocal),
				notes,
				billable
			});
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not save the entry.';
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-4" onsubmit={submit}>
	<div>
		<ProjectMenu
			id="entry-project"
			{projectId}
			{clients}
			projects={options}
			allowEmpty={entry !== null}
			disabled={saving}
			onchange={(next) => (projectId = next)}
		/>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<div class="space-y-1.5">
			<label for="entry-start" class="block text-sm font-medium">Start</label>
			<input id="entry-start" type="datetime-local" required bind:value={startLocal} class={inputClass} />
		</div>
		<div class="space-y-1.5">
			<label for="entry-end" class="block text-sm font-medium">End</label>
			<input
				id="entry-end"
				type="datetime-local"
				required={!running}
				bind:value={endLocal}
				placeholder={running ? 'Still running' : ''}
				class={inputClass}
			/>
		</div>
	</div>

	<div class="space-y-1.5">
		<label for="entry-notes" class="block text-sm font-medium">Notes</label>
		<textarea
			id="entry-notes"
			maxlength="5000"
			rows="3"
			bind:value={notes}
			class={inputClass}
		></textarea>
	</div>

	<label class="flex items-center gap-2 text-sm">
		<input type="checkbox" bind:checked={billable} />
		Billable
	</label>

	{#if errorMessage}
		<p class="text-sm text-red-700 dark:text-red-400" role="alert">{errorMessage}</p>
	{/if}

	<div class="flex flex-wrap gap-2">
		<button
			type="submit"
			disabled={saving || options.length === 0}
			class="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
		>
			{saving ? 'Saving…' : 'Save entry'}
		</button>
		<button
			type="button"
			class="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-900"
			onclick={oncancel}
		>
			Cancel
		</button>
		{#if ondelete}
			<button
				type="button"
				class="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
				onclick={ondelete}
			>
				Delete
			</button>
		{/if}
	</div>
</form>
