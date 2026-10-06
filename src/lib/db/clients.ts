import { auth } from '#lib/state/auth.svelte.ts';
import { pocketBaseNow } from '#lib/db/dates.ts';
import { db } from '#lib/db/db.ts';
import { createId } from '#lib/db/ids.ts';
import { enqueueDelete, enqueueUpsert } from '#lib/db/outbox.ts';
import { deleteProject } from '#lib/db/projects.ts';
import type { ClientInput, ClientRecord } from '#lib/types.ts';

function requireUserId(): string {
	const userId = auth.user?.id;
	if (!userId) throw new Error('Sign in before saving.');
	return userId;
}

export async function createClient(input: ClientInput): Promise<void> {
	const userId = requireUserId();
	const now = pocketBaseNow();
	const record: ClientRecord = {
		id: createId(),
		user: userId,
		name: input.name,
		color: input.color,
		hourlyRate: input.hourlyRate,
		archived: false,
		created: now,
		updated: now
	};

	await db.transaction('rw', db.clients, db.outbox, async () => {
		await db.clients.add(record);
		await enqueueUpsert('clients', record.id);
	});
}

export async function updateClient(id: string, input: ClientInput): Promise<void> {
	const userId = requireUserId();
	await db.transaction('rw', db.clients, db.outbox, async () => {
		const existing = await db.clients.get(id);
		if (!existing || existing.user !== userId) throw new Error('Client not found.');
		await db.clients.update(id, {
			name: input.name,
			color: input.color,
			hourlyRate: input.hourlyRate,
			updated: pocketBaseNow()
		});
		await enqueueUpsert('clients', id);
	});
}

export async function deleteClient(id: string): Promise<void> {
	const userId = requireUserId();
	await db.transaction('rw', db.clients, db.projects, db.timeEntries, db.outbox, async () => {
		const existing = await db.clients.get(id);
		if (!existing || existing.user !== userId) throw new Error('Client not found.');
		const projects = await db.projects.where('clientId').equals(id).toArray();
		for (const project of projects) {
			if (project.user === userId) await deleteProject(project.id);
		}
		await db.clients.delete(id);
		await enqueueDelete('clients', id);
	});
}

export async function setClientArchived(id: string, archived: boolean): Promise<void> {
	const userId = requireUserId();
	await db.transaction('rw', db.clients, db.outbox, async () => {
		const existing = await db.clients.get(id);
		if (!existing || existing.user !== userId) throw new Error('Client not found.');
		await db.clients.update(id, { archived, updated: pocketBaseNow() });
		await enqueueUpsert('clients', id);
	});
}
