import { liveQuery } from 'dexie';
import { db } from '#lib/db/db.ts';
import type { ClientRecord, ProjectRecord, TimeEntryRecord } from '#lib/types.ts';

let clients = $state<ClientRecord[]>([]);
let projects = $state<ProjectRecord[]>([]);
let timeEntries = $state<TimeEntryRecord[]>([]);
let ready = $state(false);
let watchedUserId = '';
let subscription: { unsubscribe: () => void } | null = null;

export function watchCatalog(userId: string): void {
	if (subscription && watchedUserId === userId) return;
	subscription?.unsubscribe();
	watchedUserId = userId;
	ready = false;
	clients = [];
	projects = [];
	timeEntries = [];

	subscription = liveQuery(async () => {
		const [clientRows, projectRows, entryRows] = await Promise.all([
			db.clients.where('user').equals(userId).toArray(),
			db.projects.where('user').equals(userId).toArray(),
			db.timeEntries.where('user').equals(userId).toArray()
		]);
		return { clientRows, projectRows, entryRows };
	}).subscribe({
		next(value) {
			clients = value.clientRows;
			projects = value.projectRows;
			timeEntries = value.entryRows;
			ready = true;
		},
		error() {
			ready = true;
		}
	});
}

export function stopCatalog(): void {
	subscription?.unsubscribe();
	subscription = null;
	watchedUserId = '';
	clients = [];
	projects = [];
	timeEntries = [];
	ready = false;
}

export const catalog = {
	get clients(): ClientRecord[] {
		return clients;
	},
	get projects(): ProjectRecord[] {
		return projects;
	},
	get timeEntries(): TimeEntryRecord[] {
		return timeEntries;
	},
	get ready(): boolean {
		return ready;
	}
};
