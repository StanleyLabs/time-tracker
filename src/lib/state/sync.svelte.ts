import { liveQuery } from 'dexie';
import { db } from '#lib/db/db.ts';

let syncing = $state(false);
let browserOnline = $state(typeof navigator === 'undefined' ? true : navigator.onLine);
let serverReachable = $state(true);
let pending = $state(0);

/** Time entries with no project cannot be uploaded yet, so they do not count as pending. */
async function sendableCount(): Promise<number> {
	const rows = await db.outbox.toArray();
	let waiting = 0;
	for (const row of rows) {
		if (row.collection === 'time_entries' && (row.op ?? 'upsert') === 'upsert') {
			const entry = await db.timeEntries.get(row.recordId);
			if (!entry?.projectId) continue;
		}
		waiting += 1;
	}
	return waiting;
}

if (typeof indexedDB !== 'undefined') {
	liveQuery(sendableCount).subscribe({
		next(count) {
			pending = count;
		},
		error() {
			pending = 0;
		}
	});
}

export const syncState = {
	get label(): string {
		if (!browserOnline) return 'Offline';
		if (syncing) return 'Syncing';
		if (!serverReachable) return 'Offline';
		if (pending > 0) return `${pending} pending`;
		return 'Synced';
	},
	get browserOnline(): boolean {
		return browserOnline;
	},
	setBrowserOnline(online: boolean): void {
		browserOnline = online;
	},
	markSyncing(): void {
		syncing = true;
	},
	markOffline(): void {
		syncing = false;
		serverReachable = false;
	},
	markSettled(): void {
		syncing = false;
		serverReachable = true;
	},
	markIdle(): void {
		syncing = false;
	}
};
