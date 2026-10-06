import Dexie, { type EntityTable } from 'dexie';
import type { ClientRecord, OutboxRecord, ProjectRecord, TimeEntryRecord } from '#lib/types.ts';

export const db = new Dexie('time-tracker') as Dexie & {
	clients: EntityTable<ClientRecord, 'id'>;
	projects: EntityTable<ProjectRecord, 'id'>;
	timeEntries: EntityTable<TimeEntryRecord, 'id'>;
	outbox: EntityTable<OutboxRecord, 'id'>;
};

db.version(1).stores({
	clients: 'id, user, archived, updated',
	projects: 'id, user, clientId, archived, updated',
	timeEntries: 'id, user, projectId, deleted, updated',
	outbox: '++id, &[collection+recordId], enqueuedAt'
});
