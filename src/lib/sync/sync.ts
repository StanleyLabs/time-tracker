import { liveQuery } from 'dexie';
import { ClientResponseError, type RecordSubscription, type UnsubscribeFunc } from 'pocketbase';
import { pocketBaseNow } from '#lib/db/dates.ts';
import { db } from '#lib/db/db.ts';
import { enqueueUpsert } from '#lib/db/outbox.ts';
import { pb } from '#lib/pocketbase.ts';
import { syncState } from '#lib/state/sync.svelte.ts';
import {
	clientToRemote,
	entryToRemote,
	fromRemote,
	normalizeDate,
	projectToRemote,
	type RemoteRecord
} from '#lib/sync/map.ts';
import type {
	ClientRecord,
	OutboxCollection,
	OutboxRecord,
	ProjectRecord,
	TimeEntryRecord
} from '#lib/types.ts';

const collections: OutboxCollection[] = ['clients', 'projects', 'time_entries'];

let activeUserId = '';
let subscribedUserId = '';
let listenersBound = false;
let tail: Promise<void> = Promise.resolve();
let outboxWatch: { unsubscribe: () => void } | null = null;
let queuedSync = 0;
const unsubscribers: UnsubscribeFunc[] = [];

function locked(task: () => Promise<void>): Promise<void> {
	const run = tail.then(task, task);
	tail = run.then(
		() => undefined,
		() => undefined
	);
	return run;
}

function isAuthRejection(error: unknown): boolean {
	return error instanceof ClientResponseError && (error.status === 401 || error.status === 403);
}

function reachedServer(error: unknown): boolean {
	return error instanceof ClientResponseError && error.status !== 0;
}

function isMissing(error: unknown): boolean {
	return error instanceof ClientResponseError && error.status === 404;
}

function cursorKey(userId: string, collection: OutboxCollection): string {
	return `time-tracker-sync:${userId}:${collection}`;
}

function readCursor(userId: string, collection: OutboxCollection): { updated: string; id: string } | null {
	if (typeof localStorage === 'undefined') return null;
	const raw = localStorage.getItem(cursorKey(userId, collection));
	if (!raw) return null;
	const splitAt = raw.lastIndexOf('|');
	if (splitAt <= 0) return null;
	return { updated: raw.slice(0, splitAt), id: raw.slice(splitAt + 1) };
}

function writeCursor(userId: string, collection: OutboxCollection, updated: string, id: string): void {
	if (!updated || typeof localStorage === 'undefined') return;
	localStorage.setItem(cursorKey(userId, collection), `${updated}|${id}`);
}

function pullFilter(userId: string, collection: OutboxCollection): string {
	const user = `user = "${userId}"`;
	const cursor = readCursor(userId, collection);
	if (!cursor) return user;
	const updated = cursor.updated.replaceAll('"', '');
	const id = cursor.id.replaceAll('"', '');
	return `${user} && (updated > "${updated}" || (updated = "${updated}" && id > "${id}"))`;
}

async function readLocal(
	collection: OutboxCollection,
	id: string
): Promise<ClientRecord | ProjectRecord | TimeEntryRecord | undefined> {
	if (collection === 'clients') return db.clients.get(id);
	if (collection === 'projects') return db.projects.get(id);
	return db.timeEntries.get(id);
}

async function writeLocal(
	collection: OutboxCollection,
	record: ClientRecord | ProjectRecord | TimeEntryRecord,
	mode: 'add' | 'put'
): Promise<void> {
	if (collection === 'clients') {
		const row = record as ClientRecord;
		if (mode === 'add') await db.clients.add(row);
		else await db.clients.put(row);
		return;
	}
	if (collection === 'projects') {
		const row = record as ProjectRecord;
		if (mode === 'add') await db.projects.add(row);
		else await db.projects.put(row);
		return;
	}
	const row = record as TimeEntryRecord;
	if (mode === 'add') await db.timeEntries.add(row);
	else await db.timeEntries.put(row);
}

function tablesFor(collection: OutboxCollection) {
	if (collection === 'clients') return [db.clients, db.outbox] as const;
	if (collection === 'projects') return [db.projects, db.outbox] as const;
	return [db.timeEntries, db.outbox] as const;
}

function remoteBody(
	collection: OutboxCollection,
	record: ClientRecord | ProjectRecord | TimeEntryRecord
): Record<string, unknown> {
	if (collection === 'clients') return clientToRemote(record as ClientRecord);
	if (collection === 'projects') return projectToRemote(record as ProjectRecord);
	return entryToRemote(record as TimeEntryRecord);
}

async function dropOutbox(row: OutboxRecord): Promise<void> {
	await db.transaction('rw', db.outbox, async () => {
		const current = await db.outbox
			.where('[collection+recordId]')
			.equals([row.collection, row.recordId])
			.first();
		if (current && current.id === row.id && current.enqueuedAt === row.enqueuedAt) {
			await db.outbox.delete(current.id);
		}
	});
}

async function pendingOutbox(collection: OutboxCollection, recordId: string): Promise<OutboxRecord | undefined> {
	return db.outbox.where('[collection+recordId]').equals([collection, recordId]).first();
}

/** Applies a server record unless a newer local edit is still queued. */
async function mergeRemote(collection: OutboxCollection, remote: RemoteRecord): Promise<void> {
	const incoming = fromRemote(collection, remote);
	await db.transaction('rw', tablesFor(collection), async () => {
		const existing = await readLocal(collection, incoming.id);
		const pending = await db.outbox
			.where('[collection+recordId]')
			.equals([collection, incoming.id])
			.first();
		if (!existing) {
			await writeLocal(collection, incoming, 'add');
			return;
		}
		const remoteNewer = incoming.updated > existing.updated;
		if (pending && !remoteNewer) return;
		await writeLocal(collection, incoming, 'put');
		if (pending && remoteNewer && pending.id !== undefined) {
			await db.outbox.delete(pending.id);
		}
	});
}

async function removeLocal(collection: OutboxCollection, id: string): Promise<void> {
	await db.transaction('rw', tablesFor(collection), async () => {
		if (collection === 'clients') await db.clients.delete(id);
		else if (collection === 'projects') await db.projects.delete(id);
		else await db.timeEntries.delete(id);
		await db.outbox.where('[collection+recordId]').equals([collection, id]).delete();
	});
}

async function deferUpsert(row: OutboxRecord): Promise<boolean> {
	if (row.collection === 'time_entries') {
		const entry = await db.timeEntries.get(row.recordId);
		if (!entry) {
			await dropOutbox(row);
			return true;
		}
		if (!entry.projectId) return true;
		if (await pendingOutbox('projects', entry.projectId)) return true;
	}
	if (row.collection === 'projects') {
		const project = await db.projects.get(row.recordId);
		if (!project) {
			await dropOutbox(row);
			return true;
		}
		if (await pendingOutbox('clients', project.clientId)) return true;
	}
	if (row.collection === 'clients' && !(await db.clients.get(row.recordId))) {
		await dropOutbox(row);
		return true;
	}
	return false;
}

async function pushUpsert(row: OutboxRecord): Promise<void> {
	const record = await readLocal(row.collection, row.recordId);
	if (!record) {
		await dropOutbox(row);
		return;
	}
	const body = remoteBody(row.collection, record);
	const collection = pb.collection(row.collection);
	let remote: RemoteRecord | null = null;
	try {
		remote = await collection.getOne<RemoteRecord>(row.recordId);
	} catch (error) {
		if (!isMissing(error)) throw error;
	}
	if (remote && normalizeDate(remote.updated) > record.updated) {
		await mergeRemote(row.collection, remote);
		await dropOutbox(row);
		return;
	}
	const saved = remote
		? await collection.update<RemoteRecord>(row.recordId, body)
		: await collection.create<RemoteRecord>({ ...body, id: row.recordId });
	await db.transaction('rw', tablesFor(row.collection), async () => {
		const current = await db.outbox
			.where('[collection+recordId]')
			.equals([row.collection, row.recordId])
			.first();
		if (!current || current.id !== row.id || current.enqueuedAt !== row.enqueuedAt) return;
		await db.outbox.delete(current.id);
		const fresh = await readLocal(row.collection, row.recordId);
		if (fresh && fresh.updated === record.updated) {
			await writeLocal(row.collection, fromRemote(row.collection, saved), 'put');
		}
	});
}

async function pushDelete(row: OutboxRecord): Promise<void> {
	try {
		await pb.collection(row.collection).delete(row.recordId);
	} catch (error) {
		if (!isMissing(error)) throw error;
	}
	await dropOutbox(row);
}

async function flush(): Promise<void> {
	for (let pass = 0; pass < 5; pass += 1) {
		const rows = await db.outbox.orderBy('enqueuedAt').toArray();
		let sent = 0;
		for (const row of rows) {
			const op = row.op ?? 'upsert';
			if (op === 'upsert' && (await deferUpsert(row))) continue;
			if (op === 'delete') await pushDelete(row);
			else await pushUpsert(row);
			sent += 1;
		}
		if (sent === 0) return;
	}
}

async function pull(userId: string): Promise<void> {
	for (const collection of collections) {
		let page = 1;
		while (true) {
			const list = await pb.collection(collection).getList<RemoteRecord>(page, 200, {
				filter: pullFilter(userId, collection),
				sort: 'updated,id'
			});
			for (const record of list.items) {
				await mergeRemote(collection, record);
				writeCursor(userId, collection, normalizeDate(record.updated), record.id);
			}
			if (page >= list.totalPages) break;
			page += 1;
		}
	}
}

/** Keeps one running timer. The older entry ends when the newer one starts. */
async function reconcileRunningTimers(userId: string): Promise<void> {
	const rows = await db.timeEntries.where('user').equals(userId).toArray();
	const running = rows.filter((entry) => !entry.deleted && entry.endTime === null);
	if (running.length < 2) return;
	running.sort((a, b) => {
		if (a.startTime === b.startTime) return b.id.localeCompare(a.id);
		return b.startTime.localeCompare(a.startTime);
	});
	const keeper = running[0];
	await db.transaction('rw', db.timeEntries, db.outbox, async () => {
		for (const older of running.slice(1)) {
			const current = await db.timeEntries.get(older.id);
			if (!current || current.deleted || current.endTime !== null) continue;
			const endTime =
				keeper.startTime > current.startTime ? keeper.startTime : endAfter(current.startTime);
			await db.timeEntries.update(current.id, { endTime, updated: pocketBaseNow() });
			await enqueueUpsert('time_entries', current.id);
		}
	});
}

function endAfter(startTime: string): string {
	const now = pocketBaseNow();
	if (now > startTime) return now;
	const parsed = Date.parse(startTime.replace(' ', 'T'));
	return pocketBaseNow(new Date((Number.isNaN(parsed) ? Date.now() : parsed) + 1));
}

async function clearSubscriptions(): Promise<void> {
	const pending = unsubscribers.splice(0);
	subscribedUserId = '';
	await Promise.all(pending.map((unsubscribe) => unsubscribe()));
}

async function ensureSubscribed(userId: string): Promise<void> {
	if (subscribedUserId === userId && unsubscribers.length === collections.length) return;
	await clearSubscriptions();
	for (const collection of collections) {
		const unsubscribe = await pb.collection(collection).subscribe(
			'*',
			(event: RecordSubscription<RemoteRecord>) => {
				void locked(async () => {
					if (activeUserId !== userId) return;
					if (event.action === 'delete') {
						await removeLocal(collection, event.record.id);
					} else {
						await mergeRemote(collection, event.record);
					}
					const before = await db.outbox.count();
					await reconcileRunningTimers(userId);
					const after = await db.outbox.count();
					if (after > before) void syncNow();
				});
			},
			{ filter: `user = "${userId}"` }
		);
		unsubscribers.push(unsubscribe);
	}
	subscribedUserId = userId;
}

async function runCycle(userId: string): Promise<void> {
	if (activeUserId !== userId) return;
	if (!syncState.browserOnline) {
		syncState.markOffline();
		return;
	}
	syncState.markSyncing();
	try {
		await flush();
		if (activeUserId !== userId) {
			syncState.markIdle();
			return;
		}
		await pull(userId);
		if (activeUserId !== userId) {
			syncState.markIdle();
			return;
		}
		await reconcileRunningTimers(userId);
		await flush();
		if (activeUserId !== userId) {
			syncState.markIdle();
			return;
		}
		await ensureSubscribed(userId);
		if (activeUserId !== userId) {
			syncState.markIdle();
			return;
		}
		syncState.markSettled();
	} catch (error) {
		if (isAuthRejection(error)) {
			syncState.markIdle();
			pb.authStore.clear();
			return;
		}
		if (reachedServer(error)) syncState.markSettled();
		else syncState.markOffline();
	}
}

export function syncNow(): void {
	const userId = activeUserId;
	if (!userId) return;
	void locked(() => runCycle(userId));
}

function watchOutbox(): void {
	if (outboxWatch || typeof window === 'undefined') return;
	outboxWatch = liveQuery(async () => {
		const rows = await db.outbox.orderBy('enqueuedAt').toArray();
		return rows.map((row) => `${row.id}:${row.enqueuedAt}:${row.op ?? 'upsert'}`).join(',');
	}).subscribe({
		next() {
			if (!activeUserId) return;
			window.clearTimeout(queuedSync);
			queuedSync = window.setTimeout(() => syncNow(), 300);
		}
	});
}

function ensureListeners(): void {
	if (listenersBound || typeof window === 'undefined') return;
	listenersBound = true;
	window.addEventListener('online', () => {
		syncState.setBrowserOnline(true);
		syncNow();
	});
	window.addEventListener('offline', () => {
		syncState.setBrowserOnline(false);
		syncState.markOffline();
	});
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') syncNow();
	});
}

export function startSync(userId: string): void {
	const changed = activeUserId !== userId;
	activeUserId = userId;
	ensureListeners();
	watchOutbox();
	if (!changed) {
		syncNow();
		return;
	}
	void locked(async () => {
		await clearSubscriptions();
		await runCycle(userId);
	});
}

export function stopSync(): void {
	activeUserId = '';
	void locked(() => clearSubscriptions());
}
