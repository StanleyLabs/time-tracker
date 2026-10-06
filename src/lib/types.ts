export type ClientRecord = {
	id: string;
	user: string;
	name: string;
	color: string;
	hourlyRate: number | null;
	archived: boolean;
	created: string;
	updated: string;
};

export type ProjectRecord = {
	id: string;
	user: string;
	clientId: string;
	name: string;
	/** Null uses the client color. */
	color: string | null;
	/** Null uses the client rate. */
	hourlyRate: number | null;
	archived: boolean;
	created: string;
	updated: string;
};

export type TimeEntryRecord = {
	id: string;
	user: string;
	projectId: string;
	startTime: string;
	/** Null while the timer is running. */
	endTime: string | null;
	notes: string;
	billable: boolean;
	deleted: boolean;
	created: string;
	updated: string;
};

export type OutboxCollection = 'clients' | 'projects' | 'time_entries';

export type OutboxOp = 'upsert' | 'delete';

export type OutboxRecord = {
	id?: number;
	collection: OutboxCollection;
	recordId: string;
	/** Missing on rows queued before deletes existed; treat those as upserts. */
	op?: OutboxOp;
	enqueuedAt: string;
};

export type ClientInput = {
	name: string;
	color: string;
	hourlyRate: number | null;
};

export type ProjectInput = {
	clientId: string;
	name: string;
	color: string | null;
	hourlyRate: number | null;
};
