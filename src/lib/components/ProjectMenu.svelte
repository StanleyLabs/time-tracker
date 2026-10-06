<script lang="ts">
	import { resolvedProjectColor } from '#lib/db/projects.ts';
	import type { ClientRecord, ProjectRecord } from '#lib/types.ts';

	type Props = {
		id?: string;
		projectId: string;
		clients: ClientRecord[];
		projects: ProjectRecord[];
		allowEmpty?: boolean;
		disabled?: boolean;
		onchange: (projectId: string) => void;
	};

	let {
		id = 'project-menu',
		projectId,
		clients,
		projects,
		allowEmpty = false,
		disabled = false,
		onchange
	}: Props = $props();

	let open = $state(false);

	const groups = $derived.by(() => {
		const clientsById = new Map(clients.map((client) => [client.id, client]));
		const grouped = new Map<string, { id: string; name: string; projects: ProjectRecord[] }>();
		for (const project of projects) {
			const client = clientsById.get(project.clientId);
			if (!client) continue;
			const group = grouped.get(client.id);
			if (group) group.projects.push(project);
			else grouped.set(client.id, { id: client.id, name: client.name, projects: [project] });
		}
		return [...grouped.values()]
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((group) => ({
				...group,
				projects: group.projects.slice().sort((a, b) => a.name.localeCompare(b.name))
			}));
	});

	const selected = $derived(projects.find((project) => project.id === projectId));
	const selectedClient = $derived(
		selected ? clients.find((client) => client.id === selected.clientId) : undefined
	);

	function colorFor(project: ProjectRecord): string {
		const client = clients.find((item) => item.id === project.clientId);
		return resolvedProjectColor(project.color, client?.color ?? '#059669');
	}

	function choose(next: string) {
		open = false;
		onchange(next);
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape' && open) open = false;
	}}
/>

<div class="relative">
	<p class="text-sm font-medium" id="{id}-label">Project</p>
	<button
		type="button"
		class="mt-1.5 flex w-full items-center gap-3 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-left hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-stone-700 dark:bg-stone-950 dark:hover:bg-stone-900"
		aria-haspopup="menu"
		aria-expanded={open}
		aria-labelledby="{id}-label"
		{disabled}
		onclick={() => (open = !open)}
	>
		<span
			class="size-3.5 shrink-0 rounded-full border border-black/10"
			style:background-color={selected ? colorFor(selected) : '#a8a29e'}
		></span>
		<span class="min-w-0 flex-1">
			<span class="block truncate font-medium">
				{selected?.name ?? (allowEmpty ? 'No project' : 'Choose a project')}
			</span>
			{#if selectedClient}
				<span class="block truncate text-xs text-stone-500 dark:text-stone-400">{selectedClient.name}</span>
			{/if}
		</span>
		<svg class="size-4 shrink-0 text-stone-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path
				fill-rule="evenodd"
				d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
				clip-rule="evenodd"
			/>
		</svg>
	</button>
	{#if open}
		<button
			type="button"
			class="fixed inset-0 z-20 cursor-default"
			aria-label="Close project menu"
			onclick={() => (open = false)}
		></button>
		<div
			class="absolute top-full right-0 left-0 z-30 mt-2 max-h-80 overflow-y-auto rounded-lg border border-stone-200 bg-white p-2 shadow-xl dark:border-stone-700 dark:bg-stone-900"
			role="menu"
			aria-labelledby="{id}-label"
		>
			{#if allowEmpty}
				<button
					type="button"
					role="menuitem"
					class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800 {!selected
						? 'bg-stone-100 dark:bg-stone-800'
						: ''}"
					onclick={() => choose('')}
				>
					<span class="size-3 shrink-0 rounded-full border border-black/10 bg-stone-400"></span>
					<span class="font-medium">No project</span>
				</button>
			{/if}
			{#each groups as group (group.id)}
				<div class="mt-2 border-t border-stone-200 pt-2 first:mt-0 first:border-t-0 first:pt-0 dark:border-stone-800">
					<p class="px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.14em] text-stone-400 uppercase dark:text-stone-500">
						{group.name}
					</p>
					{#each group.projects as project (project.id)}
						<button
							type="button"
							role="menuitem"
							class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800 {project.id === projectId
								? 'bg-teal-50 text-teal-900 dark:bg-teal-950 dark:text-teal-100'
								: ''}"
							onclick={() => choose(project.id)}
						>
							<span
								class="size-3 shrink-0 rounded-full border border-black/10"
								style:background-color={colorFor(project)}
							></span>
							<span class="min-w-0 flex-1 truncate font-medium">{project.name}</span>
							{#if project.id === projectId}
								<svg class="size-4 shrink-0 text-teal-700 dark:text-teal-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
									<path
										fill-rule="evenodd"
										d="M16.7 5.3a1 1 0 010 1.4l-7.2 7.2a1 1 0 01-1.4 0L3.3 9.1a1 1 0 011.4-1.4l3.1 3.1 6.5-6.5a1 1 0 011.4 0z"
										clip-rule="evenodd"
									/>
								</svg>
							{/if}
						</button>
					{/each}
				</div>
			{/each}
			{#if groups.length === 0}
				<p class="px-3 py-2 text-sm text-stone-500 dark:text-stone-400">No projects yet.</p>
			{/if}
		</div>
	{/if}
</div>
