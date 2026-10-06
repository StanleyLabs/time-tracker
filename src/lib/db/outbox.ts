import { pocketBaseNow } from '#lib/db/dates.ts';
import { db } from '#lib/db/db.ts';
import type { OutboxCollection } from '#lib/types.ts';

let queueTick = 0;

/** Keeps queued operations ordered even when several are written in the same millisecond. */
function queuedAt(): string {
	const stamp = pocketBaseNow(new Date(Date.now() + queueTick));
	queueTick = (queueTick + 1) % 1000;
	return stamp;
}

async function replaceQueued(collection: OutboxCollection, recordId: string): Promise<void> {
	await db.outbox.where('[collection+recordId]').equals([collection, recordId]).delete();
}

/** Replaces any pending change for the same record. Call inside a read-write transaction. */
export async function enqueueUpsert(collection: OutboxCollection, recordId: string): Promise<void> {
	await replaceQueued(collection, recordId);
	await db.outbox.add({
		collection,
		recordId,
		op: 'upsert',
		enqueuedAt: queuedAt()
	});
}

/** Replaces any pending change with a delete. Call inside a read-write transaction. */
export async function enqueueDelete(collection: OutboxCollection, recordId: string): Promise<void> {
	await replaceQueued(collection, recordId);
	await db.outbox.add({
		collection,
		recordId,
		op: 'delete',
		enqueuedAt: queuedAt()
	});
}
