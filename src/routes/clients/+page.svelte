<script lang="ts">
	import ClientForm from '#lib/components/ClientForm.svelte';
	import ProjectForm from '#lib/components/ProjectForm.svelte';
	import { createClient, deleteClient, setClientArchived, updateClient } from '#lib/db/clients.ts';
	import { formatRate } from '#lib/db/fields.ts';
	import { createProject, deleteProject, resolvedProjectColor, setProjectArchived, updateProject } from '#lib/db/projects.ts';
	import { auth } from '#lib/state/auth.svelte.ts';
	import { catalog, watchCatalog } from '#lib/state/catalog.svelte.ts';
	import type { ClientInput, ClientRecord, ProjectInput, ProjectRecord } from '#lib/types.ts';

	type Editor =
		| { kind: 'client'; client: ClientRecord | null }
		| { kind: 'project'; client: ClientRecord; project: ProjectRecord | null };

	type PendingDelete =
		| { kind: 'client'; client: ClientRecord }
		| { kind: 'project'; project: ProjectRecord };

	let showArchived = $state(false);
	let editor = $state<Editor | null>(null);
	let pendingDelete = $state<PendingDelete | null>(null);
	let deleting = $state(false);
	let actionError = $state('');

	$effect(() => {
		const userId = auth.user?.id;
		if (userId) watchCatalog(userId);
	});

	const visibleClients = $derived(
		catalog.clients
			.filter((client) => showArchived || !client.archived)
			.slice()
			.sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name))
	);

	function visibleProjects(clientId: string): ProjectRecord[] {
		return catalog.projects
			.filter((project) => project.clientId === clientId && (showArchived || !project.archived))
			.slice()
			.sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name));
	}

	function projectRateLabel(rate: number | null): string {
		return rate === null ? 'Client rate' : formatRate(rate);
	}

	function editClient(client: ClientRecord) {
		editor = { kind: 'client', client };
	}

	function editProject(projectRecord: ProjectRecord) {
		const clientRecord = catalog.clients.find((item) => item.id === projectRecord.clientId);
		if (!clientRecord) return;
		editor = { kind: 'project', client: clientRecord, project: projectRecord };
	}

	function startProject(clientRecord: ClientRecord) {
		editor = { kind: 'project', client: clientRecord, project: null };
	}

	async function saveClient(client: ClientRecord | null, input: ClientInput) {
		actionError = '';
		if (client) await updateClient(client.id, input);
		else await createClient(input);
		editor = null;
	}

	async function saveProject(project: ProjectRecord | null, input: ProjectInput) {
		actionError = '';
		if (project) await updateProject(project.id, input);
		else await createProject(input);
		editor = null;
	}

	async function toggleClient(client: ClientRecord) {
		actionError = '';
		try {
			await setClientArchived(client.id, !client.archived);
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Could not update the client.';
		}
	}

	async function toggleProject(project: ProjectRecord) {
		actionError = '';
		try {
			await setProjectArchived(project.id, !project.archived);
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Could not update the project.';
		}
	}

	function closeEditorFor(target: PendingDelete) {
		if (!editor) return;
		if (target.kind === 'client') {
			const removedClient =
				(editor.kind === 'client' && editor.client?.id === target.client.id) ||
				(editor.kind === 'project' && editor.client.id === target.client.id);
			if (removedClient) editor = null;
			return;
		}
		if (editor.kind === 'project' && editor.project?.id === target.project.id) editor = null;
	}

	async function confirmDelete() {
		const target = pendingDelete;
		if (!target || deleting) return;
		deleting = true;
		actionError = '';
		try {
			if (target.kind === 'client') await deleteClient(target.client.id);
			else await deleteProject(target.project.id);
			closeEditorFor(target);
			pendingDelete = null;
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Could not delete.';
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
		<h1 class="text-2xl font-semibold tracking-tight">Clients and projects</h1>
		<button
			type="button"
			class="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500"
			onclick={() => (editor = { kind: 'client', client: null })}
		>
			New client
		</button>
	</div>

	<label class="mt-4 flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
		<input type="checkbox" bind:checked={showArchived} />
		Show archived
	</label>

	{#if actionError}
		<p class="mt-4 text-sm text-red-700 dark:text-red-400" role="alert">{actionError}</p>
	{/if}

	{#if editor?.kind === 'client'}
		{@const editing = editor.client}
		<section class="mt-6 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
			<h2 class="text-lg font-medium">{editing ? 'Edit client' : 'New client'}</h2>
			<div class="mt-4">
				{#key editing?.id ?? 'new-client'}
					<ClientForm
						client={editing}
						onsave={(input) => saveClient(editing, input)}
						oncancel={() => (editor = null)}
					/>
				{/key}
			</div>
		</section>
	{:else if editor?.kind === 'project'}
		{@const editingClient = editor.client}
		{@const editingProject = editor.project}
		<section class="mt-6 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
			<h2 class="text-lg font-medium">{editingProject ? 'Edit project' : 'New project'}</h2>
			<p class="mt-1 text-sm text-stone-500 dark:text-stone-400">{editingClient.name}</p>
			<div class="mt-4">
				{#key editingProject?.id ?? `new-project-${editingClient.id}`}
					<ProjectForm
						clientId={editingClient.id}
						clientColor={editingClient.color}
						project={editingProject}
						onsave={(input) => saveProject(editingProject, input)}
						oncancel={() => (editor = null)}
					/>
				{/key}
			</div>
		</section>
	{/if}

	{#if !catalog.ready}
		<p class="mt-8 text-sm text-stone-500 dark:text-stone-400">Loading…</p>
	{:else if visibleClients.length === 0}
		<p class="mt-8 text-sm text-stone-500 dark:text-stone-400">
			{showArchived ? 'No clients yet.' : 'No active clients.'}
		</p>
	{:else}
		<ul class="mt-6 space-y-4">
			{#each visibleClients as client (client.id)}
				<li class="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="flex min-w-0 items-center gap-3">
							<span
								class="size-4 shrink-0 rounded-full border border-black/10"
								style:background-color={client.color}
							></span>
							<div class="min-w-0">
								<p class="truncate font-medium">
									{client.name}
									{#if client.archived}
										<span class="ml-2 text-xs font-normal text-stone-500">Archived</span>
									{/if}
								</p>
								<p class="text-sm text-stone-500 dark:text-stone-400">{formatRate(client.hourlyRate)}</p>
							</div>
						</div>
						<div class="flex flex-wrap gap-2">
							<button
								type="button"
								class="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
								onclick={() => editClient(client)}
							>
								Edit
							</button>
							<button
								type="button"
								class="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
								onclick={() => toggleClient(client)}
							>
								{client.archived ? 'Restore' : 'Archive'}
							</button>
							<button
								type="button"
								class="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
								onclick={() => (pendingDelete = { kind: 'client', client })}
							>
								Delete
							</button>
						</div>
					</div>

					<ul class="mt-4 space-y-2 border-t border-stone-200 pt-3 dark:border-stone-800">
						{#each visibleProjects(client.id) as project (project.id)}
							<li class="flex flex-wrap items-center justify-between gap-3">
								<div class="flex min-w-0 items-center gap-3">
									<span
										class="size-3 shrink-0 rounded-full border border-black/10"
										style:background-color={resolvedProjectColor(project.color, client.color)}
									></span>
									<div class="min-w-0">
										<p class="truncate text-sm">
											{project.name}
											{#if project.archived}
												<span class="ml-2 text-xs text-stone-500">Archived</span>
											{/if}
										</p>
										<p class="text-xs text-stone-500 dark:text-stone-400">{projectRateLabel(project.hourlyRate)}</p>
									</div>
								</div>
								<div class="flex gap-2">
									<button
										type="button"
										class="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
										onclick={() => editProject(project)}
									>
										Edit
									</button>
									<button
										type="button"
										class="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
										onclick={() => toggleProject(project)}
									>
										{project.archived ? 'Restore' : 'Archive'}
									</button>
									<button
										type="button"
										class="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
										onclick={() => (pendingDelete = { kind: 'project', project })}
									>
										Delete
									</button>
								</div>
							</li>
						{:else}
							<li class="text-sm text-stone-500 dark:text-stone-400">
								{showArchived ? 'No projects yet.' : 'No active projects.'}
							</li>
						{/each}
					</ul>

					{#if !client.archived}
						<button
							type="button"
							class="mt-3 text-sm font-medium text-teal-800 hover:underline dark:text-teal-400"
							onclick={() => startProject(client)}
						>
							Add project
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if pendingDelete}
		<div class="fixed inset-0 z-20 flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
			<div
				class="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-lg dark:border-stone-800 dark:bg-stone-900"
				role="dialog"
				aria-modal="true"
				aria-labelledby="delete-title"
			>
				<h2 id="delete-title" class="text-lg font-medium">
					Delete {pendingDelete.kind === 'client' ? pendingDelete.client.name : pendingDelete.project.name}?
				</h2>
				<p class="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-400">
					{#if pendingDelete.kind === 'client'}
						This removes the client, its projects, and every time entry under them.
					{:else}
						This removes the project and every time entry under it.
					{/if}
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
