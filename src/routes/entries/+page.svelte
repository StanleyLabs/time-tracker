<script lang="ts">
	import EntryForm from '#lib/components/EntryForm.svelte';
	import { resolvedProjectColor } from '#lib/db/projects.ts';
	import { createManualEntry, softDeleteEntry, updateEntry } from '#lib/db/timeEntries.ts';
	import type { TimeEntryInput } from '#lib/db/timeEntries.ts';
	import { catalog } from '#lib/state/catalog.svelte.ts';
	import { clock } from '#lib/state/clock.svelte.ts';
	import {
		elapsedMs,
		formatDayLabel,
		formatDuration,
		formatTimeOfDay,
		groupEntries,
		orderedActiveProjects
	} from '#lib/time.ts';
	import type { TimeEntryRecord } from '#lib/types.ts';

	type Editor = { kind: 'new' } | { kind: 'edit'; entry: TimeEntryRecord };

	let editor = $state<Editor | null>(null);
	let pendingDelete = $state<TimeEntryRecord | null>(null);
	let deleting = $state(false);
	let actionError = $state('');

	const groups = $derived(groupEntries(catalog.timeEntries, clock.now));
	const activeProjects = $derived(
		orderedActiveProjects(catalog.projects, catalog.clients, catalog.timeEntries)
	);

	function projectFor(projectId: string | null) {
		if (!projectId) return undefined;
		return catalog.projects.find((project) => project.id === projectId);
	}

	function clientFor(clientId: string) {
		return catalog.clients.find((client) => client.id === clientId);
	}

	async function saveEntry(entry: TimeEntryRecord | null, input: TimeEntryInput) {
		actionError = '';
		if (entry) await updateEntry(entry.id, input);
		else await createManualEntry(input);
		editor = null;
	}

	async function confirmDelete() {
		const entry = pendingDelete;
		if (!entry || deleting) return;
		deleting = true;
		actionError = '';
		try {
			await softDeleteEntry(entry.id);
			if (editor?.kind === 'edit' && editor.entry.id === entry.id) editor = null;
			pendingDelete = null;
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Could not delete the entry.';
			pendingDelete = null;
		} finally {
			deleting = false;
		}
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape' && pendingDelete && !deleting) pendingDelete = null;
	}}
/>

<main class="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-2xl font-semibold tracking-tight">Entries</h1>
		<button
			type="button"
			class="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500"
			onclick={() => (editor = { kind: 'new' })}
		>
			Add entry
		</button>
	</div>

	{#if actionError}
		<p class="mt-4 text-sm text-red-700 dark:text-red-400" role="alert">{actionError}</p>
	{/if}

	{#if editor}
		{@const editing = editor.kind === 'edit' ? editor.entry : null}
		<section class="mt-6 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
			<h2 class="text-lg font-medium">{editing ? 'Edit entry' : 'New entry'}</h2>
			<div class="mt-4">
				{#key editing?.id ?? 'new-entry'}
					<EntryForm
						entry={editing}
						clients={catalog.clients}
						projects={catalog.projects}
						defaultProjectId={activeProjects[0]?.id ?? ''}
						onsave={(input) => saveEntry(editing, input)}
						oncancel={() => (editor = null)}
						ondelete={editing ? () => (pendingDelete = editing) : undefined}
					/>
				{/key}
			</div>
		</section>
	{/if}

	{#if !catalog.ready}
		<p class="mt-8 text-sm text-stone-500 dark:text-stone-400">Loading…</p>
	{:else if groups.length === 0}
		<p class="mt-8 text-sm text-stone-500 dark:text-stone-400">No time entries yet.</p>
	{:else}
		<div class="mt-8 space-y-8">
			{#each groups as group (group.day)}
				<section>
					<div class="flex items-baseline justify-between gap-3">
						<h2 class="font-medium">{formatDayLabel(group.day, new Date(clock.now))}</h2>
						<p class="tabular-nums text-sm text-stone-500 dark:text-stone-400">
							{formatDuration(group.totalMs)}
						</p>
					</div>
					<ul class="mt-3 space-y-2">
						{#each group.entries as entry (entry.id)}
							{@const project = projectFor(entry.projectId)}
							{@const client = project ? clientFor(project.clientId) : undefined}
							<li>
								<button
									type="button"
									class="flex w-full items-start gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-left hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
									onclick={() => (editor = { kind: 'edit', entry })}
								>
									<span
										class="mt-1 size-3 shrink-0 rounded-full border border-black/10"
										style:background-color={project
											? resolvedProjectColor(project.color, client?.color ?? '#059669')
											: '#a8a29e'}
									></span>
									<span class="min-w-0 flex-1">
										<span class="block truncate font-medium">{project?.name ?? 'No project'}</span>
										<span class="mt-0.5 block truncate text-sm text-stone-500 dark:text-stone-400">
											{#if client}{client.name} · {/if}
											{formatTimeOfDay(entry.startTime)}
											–
											{entry.endTime ? formatTimeOfDay(entry.endTime) : 'Running'}
											·
											<span class="tabular-nums">{formatDuration(elapsedMs(entry, clock.now))}</span>
										</span>
										{#if entry.notes}
											<span class="mt-1 block truncate text-sm text-stone-600 dark:text-stone-300">
												{entry.notes}
											</span>
										{/if}
									</span>
									<span
										class="shrink-0 text-xs {entry.billable
											? 'text-teal-800 dark:text-teal-400'
											: 'text-stone-400'}"
									>
										{entry.billable ? 'Billable' : 'Not billable'}
									</span>
								</button>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{/if}

	{#if pendingDelete}
		<div class="fixed inset-0 z-20 flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
			<div
				class="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-lg dark:border-stone-800 dark:bg-stone-900"
				role="dialog"
				aria-modal="true"
				aria-labelledby="delete-entry-title"
			>
				<h2 id="delete-entry-title" class="text-lg font-medium">Delete this time entry?</h2>
				<p class="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-400">
					This removes the entry from your list.
				</p>
				<div class="mt-5 flex flex-wrap gap-2">
					<button
						type="button"
						class="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
						disabled={deleting}
						onclick={confirmDelete}
					>
						{deleting ? 'Deleting…' : 'Delete'}
					</button>
					<button
						type="button"
						class="rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50 disabled:cursor-not-allowed dark:border-stone-700 dark:hover:bg-stone-800"
						disabled={deleting}
						onclick={() => (pendingDelete = null)}
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}
</main>
