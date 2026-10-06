import type { RecordModel } from 'pocketbase';
import type { ClientRecord, OutboxCollection, ProjectRecord, TimeEntryRecord } from '#lib/types.ts';

export type RemoteRecord = RecordModel & {
	user?: string;
	name?: string;
	color?: string;
	hourly_rate?: number;
	archived?: boolean;
	client?: string;
	project?: string;
	start_time?: string;
	end_time?: string;
	notes?: string;
	billable?: boolean;
	deleted?: boolean;
	created?: string;
	updated?: string;
};

/** PocketBase datetimes sort as strings when they use a space instead of T. */
export function normalizeDate(value: unknown): string {
	if (typeof value !== 'string' || !value) return '';
	return value.includes('T') ? value.replace('T', ' ') : value;
}

function text(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function flag(value: unknown): boolean {
	return value === true;
}

function rateFromServer(value: unknown): number | null {
	return typeof value === 'number' && value > 0 ? value : null;
}

export function clientFromRemote(record: RemoteRecord): ClientRecord {
	return {
		id: record.id,
		user: text(record.user),
		name: text(record.name),
		color: text(record.color),
		hourlyRate: rateFromServer(record.hourly_rate),
		archived: flag(record.archived),
		created: normalizeDate(record.created),
		updated: normalizeDate(record.updated)
	};
}

export function projectFromRemote(record: RemoteRecord): ProjectRecord {
	const color = text(record.color);
	return {
		id: record.id,
		user: text(record.user),
		clientId: text(record.client),
		name: text(record.name),
		color: color ? color : null,
		hourlyRate: rateFromServer(record.hourly_rate),
		archived: flag(record.archived),
		created: normalizeDate(record.created),
		updated: normalizeDate(record.updated)
	};
}

export function entryFromRemote(record: RemoteRecord): TimeEntryRecord {
	const endTime = normalizeDate(record.end_time);
	return {
		id: record.id,
		user: text(record.user),
		projectId: text(record.project) || null,
		startTime: normalizeDate(record.start_time),
		endTime: endTime || null,
		notes: text(record.notes),
		billable: record.billable !== false,
		deleted: flag(record.deleted),
		created: normalizeDate(record.created),
		updated: normalizeDate(record.updated)
	};
}

export function fromRemote(collection: OutboxCollection, record: RemoteRecord) {
	if (collection === 'clients') return clientFromRemote(record);
	if (collection === 'projects') return projectFromRemote(record);
	return entryFromRemote(record);
}

export function clientToRemote(record: ClientRecord): Record<string, unknown> {
	return {
		user: record.user,
		name: record.name,
		color: record.color,
		hourly_rate: record.hourlyRate ?? 0,
		archived: record.archived,
		created: record.created,
		updated: record.updated
	};
}

export function projectToRemote(record: ProjectRecord): Record<string, unknown> {
	return {
		user: record.user,
		client: record.clientId,
		name: record.name,
		color: record.color ?? '',
		hourly_rate: record.hourlyRate ?? 0,
		archived: record.archived,
		created: record.created,
		updated: record.updated
	};
}

export function entryToRemote(record: TimeEntryRecord): Record<string, unknown> {
	return {
		user: record.user,
		project: record.projectId,
		start_time: record.startTime,
		end_time: record.endTime ?? '',
		notes: record.notes,
		billable: record.billable,
		deleted: record.deleted,
		created: record.created,
		updated: record.updated
	};
}
