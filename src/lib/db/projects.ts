import { auth } from '#lib/state/auth.svelte.ts';
import { pocketBaseNow } from '#lib/db/dates.ts';
import { db } from '#lib/db/db.ts';
import { createId } from '#lib/db/ids.ts';
import { enqueueDelete, enqueueUpsert } from '#lib/db/outbox.ts';
import type { ProjectInput, ProjectRecord } from '#lib/types.ts';

function requireUserId(): string {
	const userId = auth.user?.id;
	if (!userId) throw new Error('Sign in before saving.');
	return userId;
}

export function resolvedProjectColor(projectColor: string | null, clientColor: string): string {
	return projectColor ?? clientColor;
}

export async function createProject(input: ProjectInput): Promise<void> {
	const userId = requireUserId();
	const now = pocketBaseNow();
	const record: ProjectRecord = {
		id: createId(),
		user: userId,
		clientId: input.clientId,
		name: input.name,
		color: input.color,
		hourlyRate: input.hourlyRate,
		archived: false,
		created: now,
		updated: now
	};

	await db.transaction('rw', db.clients, db.projects, db.outbox, async () => {
		const client = await db.clients.get(input.clientId);
		if (!client || client.user !== userId) throw new Error('Client not found.');
		if (client.archived) throw new Error('Restore the client before adding a project.');
		await db.projects.add(record);
		await enqueueUpsert('projects', record.id);
	});
}

export async function updateProject(id: string, input: ProjectInput): Promise<void> {
	const userId = requireUserId();
	await db.transaction('rw', db.clients, db.projects, db.outbox, async () => {
		const existing = await db.projects.get(id);
		if (!existing || existing.user !== userId) throw new Error('Project not found.');
		const client = await db.clients.get(input.clientId);
		if (!client || client.user !== userId) throw new Error('Client not found.');
		await db.projects.update(id, {
			clientId: input.clientId,
			name: input.name,
			color: input.color,
			hourlyRate: input.hourlyRate,
			updated: pocketBaseNow()
		});
		await enqueueUpsert('projects', id);
	});
}

export async function deleteProject(id: string): Promise<void> {
	const userId = requireUserId();
	await db.transaction('rw', db.projects, db.timeEntries, db.outbox, async () => {
		const existing = await db.projects.get(id);
		if (!existing || existing.user !== userId) throw new Error('Project not found.');
		const entries = await db.timeEntries.where('projectId').equals(id).toArray();
		for (const entry of entries) {
			if (entry.user !== userId) continue;
			await db.timeEntries.delete(entry.id);
			await enqueueDelete('time_entries', entry.id);
		}
		await db.projects.delete(id);
		await enqueueDelete('projects', id);
	});
}

export async function setProjectArchived(id: string, archived: boolean): Promise<void> {
	const userId = requireUserId();
	await db.transaction('rw', db.projects, db.outbox, async () => {
		const existing = await db.projects.get(id);
		if (!existing || existing.user !== userId) throw new Error('Project not found.');
		await db.projects.update(id, { archived, updated: pocketBaseNow() });
		await enqueueUpsert('projects', id);
	});
}
