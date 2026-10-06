import { liveQuery } from 'dexie';
import { db } from '#lib/db/db.ts';
import type { ClientRecord, ProjectRecord } from '#lib/types.ts';

let clients = $state<ClientRecord[]>([]);
let projects = $state<ProjectRecord[]>([]);
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

	subscription = liveQuery(async () => {
		const [clientRows, projectRows] = await Promise.all([
			db.clients.where('user').equals(userId).toArray(),
			db.projects.where('user').equals(userId).toArray()
		]);
		return { clientRows, projectRows };
	}).subscribe({
		next(value) {
			clients = value.clientRows;
			projects = value.projectRows;
			ready = true;
		},
		error() {
			ready = true;
		}
	});
}

export const catalog = {
	get clients(): ClientRecord[] {
		return clients;
	},
	get projects(): ProjectRecord[] {
		return projects;
	},
	get ready(): boolean {
		return ready;
	}
};
