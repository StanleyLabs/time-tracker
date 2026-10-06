<script lang="ts">
	import { resolvedProjectColor } from '#lib/db/projects.ts';
	import ProjectMenu from '#lib/components/ProjectMenu.svelte';
	import {
		clearNotesDraft,
		flushNotesDraft,
		setNotesDraft,
		setTimerProject,
		setTimerStart,
		startTimer,
		stopTimer,
		updateEntryNotes
	} from '#lib/db/timeEntries.ts';
	import { catalog } from '#lib/state/catalog.svelte.ts';
	import { clock } from '#lib/state/clock.svelte.ts';
	import {
		elapsedMs,
		formatClock,
		formatDuration,
		orderedActiveProjects,
		runningEntry,
		todayTotalMs,
		resolveEditedTime,
		toDateTimeLocal
	} from '#lib/time.ts';

	let showAll = $state(false);
	let busy = $state(false);
	let actionError = $state('');
	let notes = $state('');
	let boundId = $state('');
	let startLocal = $state('');

	const running = $derived(runningEntry(catalog.timeEntries));
	const activeProjects = $derived(
		orderedActiveProjects(catalog.projects, catalog.clients, catalog.timeEntries)
	);
	const recentProjects = $derived(activeProjects.slice(0, 8));
	const moreProjects = $derived(activeProjects.slice(8));
	const today = $derived(formatDuration(todayTotalMs(catalog.timeEntries, clock.now)));
	const elapsed = $derived(running ? formatClock(elapsedMs(running, clock.now)) : '0:00:00');

	const currentProject = $derived.by(() => {
		const current = running;
		if (!current?.projectId) return undefined;
		return catalog.projects.find((project) => project.id === current.projectId);
	});
	const timerProjects = $derived(
		currentProject && !activeProjects.some((project) => project.id === currentProject.id)
			? [currentProject, ...activeProjects]
			: activeProjects
	);

	$effect(() => {
		const current = running;
		if (!current) {
			boundId = '';
			clearNotesDraft();
			return;
		}
		if (current.id !== boundId) {
			boundId = current.id;
			notes = current.notes;
			startLocal = toDateTimeLocal(current.startTime);
			setNotesDraft(current.id, current.notes);
		}
	});

	$effect(() => {
		const id = boundId;
		const value = notes;
		if (!id) return;
		setNotesDraft(id, value);
		const current = catalog.timeEntries.find((entry) => entry.id === id);
		if (!current || current.deleted || current.notes === value) return;
		const handle = setTimeout(() => {
			void updateEntryNotes(id, value).catch((error: unknown) => {
				actionError = error instanceof Error ? error.message : 'Could not save notes.';
			});
		}, 400);
		return () => clearTimeout(handle);
	});

	async function run(action: () => Promise<void>) {
		if (busy) return;
		busy = true;
		actionError = '';
		try {
			await action();
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Could not update the timer.';
		} finally {
			busy = false;
		}
	}

	function chooseProject(projectId: string) {
		void run(async () => {
			await flushNotesDraft();
			if (!running) {
				await startTimer(projectId);
				return;
			}
			if (running.projectId === projectId) {
				await stopTimer(running.id);
				return;
			}
			if (!running.projectId) {
				await setTimerProject(running.id, projectId);
				return;
			}
			await startTimer(projectId);
		});
	}

	function changeStart() {
		const current = running;
		if (!current) return;
		const next = resolveEditedTime(current.startTime, startLocal);
		if (!next || next === current.startTime) return;
		void run(async () => {
			try {
				await setTimerStart(current.id, next);
			} catch (error) {
				startLocal = toDateTimeLocal(current.startTime);
				throw error;
			}
		});
	}
	function start() {
		void run(async () => {
			await startTimer(null);
		});
	}

	function assignProject(projectId: string) {
		const current = running;
		if (!current) return;
		void run(async () => {
			await setTimerProject(current.id, projectId || null);
		});
	}

	function stop() {
		const current = running;
		if (!current) return;
		void run(async () => {
			await flushNotesDraft();
			await stopTimer(current.id);
		});
	}

	function clientName(clientId: string): string {
		return catalog.clients.find((client) => client.id === clientId)?.name ?? 'Client';
	}

	function projectColor(clientId: string, color: string | null): string {
		const client = catalog.clients.find((item) => item.id === clientId);
		return resolvedProjectColor(color, client?.color ?? '#059669');
	}
</script>

<main class="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-8">
	<p class="text-sm text-stone-500 dark:text-stone-400">Today</p>
	<p class="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{today}</p>

	{#if !catalog.ready}
		<p class="mt-10 text-sm text-stone-500 dark:text-stone-400">Loading…</p>
	{:else}
		<section class="mt-8" aria-live="polite">
			<p class="text-6xl font-semibold tabular-nums tracking-tight sm:text-7xl">{elapsed}</p>
			{#if running}
				<div class="mt-5 space-y-1.5">
					<label for="timer-start" class="block text-sm font-medium">Started</label>
					<input
						id="timer-start"
						type="datetime-local"
						required
						bind:value={startLocal}
						disabled={busy}
						onchange={changeStart}
						class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-teal-700 dark:border-stone-700 dark:bg-stone-950 dark:focus:border-teal-500"
					/>
				</div>
				<div class="mt-5">
					<ProjectMenu
						id="timer-project"
						projectId={running.projectId ?? ''}
						clients={catalog.clients}
						projects={timerProjects}
						allowEmpty
						disabled={busy}
						onchange={assignProject}
					/>
				</div>
				<div class="mt-5 space-y-1.5">
					<label for="timer-notes" class="block text-sm font-medium">Notes</label>
					<textarea
						id="timer-notes"
						maxlength="5000"
						rows="3"
						bind:value={notes}
						placeholder="What are you working on?"
						class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-teal-700 dark:border-stone-700 dark:bg-stone-950 dark:focus:border-teal-500"
					></textarea>
				</div>
				<button
					type="button"
					class="mt-4 w-full rounded-2xl bg-stone-900 px-4 py-3 text-base font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
					disabled={busy}
					onclick={stop}
				>
					Stop
				</button>
			{:else}
				<p class="mt-3 text-stone-500 dark:text-stone-400">No timer running</p>
				<button
					type="button"
					class="mt-4 w-full rounded-2xl bg-teal-800 px-4 py-3 text-base font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
					disabled={busy}
					onclick={start}
				>
					Start
				</button>
			{/if}
		</section>

		{#if actionError}
			<p class="mt-4 text-sm text-red-700 dark:text-red-400" role="alert">{actionError}</p>
		{/if}

		<section class="mt-10">
			<h2 class="text-sm font-medium text-stone-500 dark:text-stone-400">Projects</h2>
			{#if activeProjects.length === 0}
				<p class="mt-3 text-sm leading-6 text-stone-500 dark:text-stone-400">No projects yet.</p>
				<a
					href="/clients"
					class="mt-4 inline-flex rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 dark:bg-teal-600 dark:hover:bg-teal-500"
				>
					Clients and projects
				</a>
			{:else}
				<ul class="mt-3 flex flex-wrap gap-2">
					{#each recentProjects as project (project.id)}
						<li>
							<button
								type="button"
								class="flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-left text-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-stone-900 {running?.projectId === project.id
									? 'border-teal-700 ring-2 ring-teal-700 dark:border-teal-400 dark:ring-teal-400'
									: 'border-stone-300 dark:border-stone-700'}"
								aria-pressed={running?.projectId === project.id}
								disabled={busy}
								onclick={() => chooseProject(project.id)}
							>
								<span
									class="size-3 shrink-0 rounded-full border border-black/10"
									style:background-color={projectColor(project.clientId, project.color)}
								></span>
								<span class="min-w-0">
									<span class="block truncate font-medium">{project.name}</span>
									<span class="block truncate text-xs text-stone-500 dark:text-stone-400">
										{clientName(project.clientId)}
									</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
				{#if moreProjects.length > 0}
					<button
						type="button"
						class="mt-4 text-sm font-medium text-teal-800 hover:underline dark:text-teal-400"
						aria-expanded={showAll}
						onclick={() => (showAll = !showAll)}
					>
						{showAll ? 'Hide projects' : 'All projects'}
					</button>
					{#if showAll}
						<ul class="mt-3 flex flex-wrap gap-2">
							{#each moreProjects as project (project.id)}
								<li>
									<button
										type="button"
										class="flex max-w-full items-center gap-2 rounded-full border border-stone-300 px-3 py-2 text-left text-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-stone-700 dark:hover:bg-stone-900"
										disabled={busy}
										onclick={() => chooseProject(project.id)}
									>
										<span
											class="size-3 shrink-0 rounded-full border border-black/10"
											style:background-color={projectColor(project.clientId, project.color)}
										></span>
										<span class="min-w-0">
											<span class="block truncate font-medium">{project.name}</span>
											<span class="block truncate text-xs text-stone-500 dark:text-stone-400">
												{clientName(project.clientId)}
											</span>
										</span>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
			{/if}
		</section>
	{/if}
</main>
