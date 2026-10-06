import { auth } from '#lib/state/auth.svelte.ts';
import { pocketBaseNow } from '#lib/db/dates.ts';
import { db } from '#lib/db/db.ts';
import { createId } from '#lib/db/ids.ts';
import { enqueueUpsert } from '#lib/db/outbox.ts';
import type { ClientRecord, ProjectRecord, TimeEntryRecord } from '#lib/types.ts';

const NOTES_MAX = 5000;

let notesDraft: { id: string; notes: string } | null = null;

export function setNotesDraft(id: string, notes: string): void {
	notesDraft = { id, notes };
}

export function clearNotesDraft(): void {
	notesDraft = null;
}

export async function flushNotesDraft(): Promise<void> {
	if (!notesDraft) return;
	await updateEntryNotes(notesDraft.id, notesDraft.notes);
}

export type TimeEntryInput = {
	projectId: string | null;
	startTime: string;
	/** Null only while this entry is the running timer. */
	endTime: string | null;
	notes: string;
	billable: boolean;
};

function requireUserId(): string {
	const userId = auth.user?.id;
	if (!userId) throw new Error('Sign in before saving.');
	return userId;
}

function parseNotes(notes: string): string {
	if (notes.length > NOTES_MAX) throw new Error('Notes must be 5000 characters or fewer.');
	return notes;
}

function assertRange(startTime: string, endTime: string): void {
	if (endTime <= startTime) throw new Error('End time must be after the start time.');
}

async function ownedProject(
	projectId: string,
	userId: string
): Promise<{ project: ProjectRecord; client: ClientRecord }> {
	const project = await db.projects.get(projectId);
	if (!project || project.user !== userId) throw new Error('Project not found.');
	const client = await db.clients.get(project.clientId);
	if (!client || client.user !== userId) throw new Error('Client not found.');
	return { project, client };
}

function assertActive(project: ProjectRecord, client: ClientRecord): void {
	if (client.archived) throw new Error('Restore the client before tracking time.');
	if (project.archived) throw new Error('Restore the project before tracking time.');
}

async function stopOpenEntries(userId: string, endTime: string, exceptId?: string): Promise<void> {
	const rows = await db.timeEntries.where('user').equals(userId).toArray();
	for (const entry of rows) {
		if (entry.deleted || entry.endTime !== null || entry.id === exceptId) continue;
		if (endTime <= entry.startTime) throw new Error('End time must be after the start time.');
		await db.timeEntries.update(entry.id, { endTime, updated: endTime });
		await enqueueUpsert('time_entries', entry.id);
	}
}

export async function startTimer(projectId: string | null): Promise<void> {
	const userId = requireUserId();
	const now = pocketBaseNow();
	await db.transaction('rw', db.clients, db.projects, db.timeEntries, db.outbox, async () => {
		if (projectId) {
			const { project, client } = await ownedProject(projectId, userId);
			assertActive(project, client);
		}
		await stopOpenEntries(userId, now);
		const record: TimeEntryRecord = {
			id: createId(),
			user: userId,
			projectId,
			startTime: now,
			endTime: null,
			notes: '',
			billable: true,
			deleted: false,
			created: now,
			updated: now
		};
		await db.timeEntries.add(record);
		await enqueueUpsert('time_entries', record.id);
	});
}

export async function setTimerProject(id: string, projectId: string | null): Promise<void> {
	const userId = requireUserId();
	await db.transaction('rw', db.clients, db.projects, db.timeEntries, db.outbox, async () => {
		const existing = await db.timeEntries.get(id);
		if (!existing || existing.user !== userId || existing.deleted) throw new Error('Time entry not found.');
		if (existing.endTime !== null) throw new Error('This timer has already stopped.');
		if (existing.projectId === projectId) return;
		if (projectId) {
			const { project, client } = await ownedProject(projectId, userId);
			assertActive(project, client);
		}
		await db.timeEntries.update(id, { projectId, updated: pocketBaseNow() });
		await enqueueUpsert('time_entries', id);
	});
}

export async function setTimerStart(id: string, startTime: string): Promise<void> {
	const userId = requireUserId();
	if (startTime >= pocketBaseNow()) throw new Error('Start time must be before now.');
	await db.transaction('rw', db.timeEntries, db.outbox, async () => {
		const existing = await db.timeEntries.get(id);
		if (!existing || existing.user !== userId || existing.deleted) throw new Error('Time entry not found.');
		if (existing.endTime !== null) throw new Error('This timer has already stopped.');
		if (existing.startTime === startTime) return;
		await db.timeEntries.update(id, { startTime, updated: pocketBaseNow() });
		await enqueueUpsert('time_entries', id);
	});
}

export async function stopTimer(id: string, end = new Date()): Promise<void> {
	const userId = requireUserId();
	const endTime = pocketBaseNow(end);
	await db.transaction('rw', db.timeEntries, db.outbox, async () => {
		const existing = await db.timeEntries.get(id);
		if (!existing || existing.user !== userId || existing.deleted) throw new Error('Time entry not found.');
		if (existing.endTime !== null) return;
		assertRange(existing.startTime, endTime);
		await db.timeEntries.update(id, { endTime, updated: endTime });
		await enqueueUpsert('time_entries', id);
	});
}

export async function updateEntryNotes(id: string, notes: string): Promise<void> {
	const userId = requireUserId();
	const parsed = parseNotes(notes);
	await db.transaction('rw', db.timeEntries, db.outbox, async () => {
		const existing = await db.timeEntries.get(id);
		if (!existing || existing.user !== userId || existing.deleted) throw new Error('Time entry not found.');
		if (existing.notes === parsed) return;
		await db.timeEntries.update(id, { notes: parsed, updated: pocketBaseNow() });
		await enqueueUpsert('time_entries', id);
	});
}

export async function createManualEntry(input: TimeEntryInput): Promise<void> {
	const userId = requireUserId();
	if (!input.projectId) throw new Error('Choose a project.');
	if (!input.endTime) throw new Error('Add an end time.');
	const projectId = input.projectId;
	const endTime = input.endTime;
	const notes = parseNotes(input.notes);
	assertRange(input.startTime, endTime);
	const now = pocketBaseNow();
	const record: TimeEntryRecord = {
		id: createId(),
		user: userId,
		projectId,
		startTime: input.startTime,
		endTime,
		notes,
		billable: input.billable,
		deleted: false,
		created: now,
		updated: now
	};

	await db.transaction('rw', db.clients, db.projects, db.timeEntries, db.outbox, async () => {
		const { project, client } = await ownedProject(projectId, userId);
		assertActive(project, client);
		await db.timeEntries.add(record);
		await enqueueUpsert('time_entries', record.id);
	});
}

export async function updateEntry(id: string, input: TimeEntryInput): Promise<void> {
	const userId = requireUserId();
	const notes = parseNotes(input.notes);
	await db.transaction('rw', db.clients, db.projects, db.timeEntries, db.outbox, async () => {
		const existing = await db.timeEntries.get(id);
		if (!existing || existing.user !== userId || existing.deleted) throw new Error('Time entry not found.');
		if (input.projectId) {
			const { project, client } = await ownedProject(input.projectId, userId);
			if (input.projectId !== existing.projectId) assertActive(project, client);
		}
		if (!input.endTime) {
			if (existing.endTime !== null) throw new Error('Add an end time.');
		} else {
			assertRange(input.startTime, input.endTime);
		}
		const updated = pocketBaseNow();
		await db.timeEntries.update(id, {
			projectId: input.projectId,
			startTime: input.startTime,
			endTime: input.endTime,
			notes,
			billable: input.billable,
			updated
		});
		await enqueueUpsert('time_entries', id);
	});
}

export async function softDeleteEntry(id: string): Promise<void> {
	const userId = requireUserId();
	await db.transaction('rw', db.timeEntries, db.outbox, async () => {
		const existing = await db.timeEntries.get(id);
		if (!existing || existing.user !== userId) throw new Error('Time entry not found.');
		if (existing.deleted) return;
		await db.timeEntries.update(id, { deleted: true, updated: pocketBaseNow() });
		await enqueueUpsert('time_entries', id);
	});
}
