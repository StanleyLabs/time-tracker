import { pocketBaseNow } from '#lib/db/dates.ts';
import type { ClientRecord, ProjectRecord, TimeEntryRecord } from '#lib/types.ts';

export const FORGOT_TO_STOP_MS = 10 * 60 * 60 * 1000;

const localInput = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function parsePocketBase(value: string): Date {
	const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
	if (Number.isNaN(date.getTime())) throw new Error('Enter a valid time.');
	return date;
}

export function toDateTimeLocal(value: string): string {
	const date = parsePocketBase(value);
	const pad = (part: number) => String(part).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDateTimeLocal(value: string): string {
	return pocketBaseNow(dateFromLocalInput(value));
}

export function dateFromLocalInput(value: string): Date {
	const match = localInput.exec(value);
	if (!match) throw new Error('Enter a valid time.');
	const date = new Date(
		Number(match[1]),
		Number(match[2]) - 1,
		Number(match[3]),
		Number(match[4]),
		Number(match[5]),
		0,
		0
	);
	if (Number.isNaN(date.getTime())) throw new Error('Enter a valid time.');
	return date;
}

/** Keeps seconds when the minute shown in the form was not changed. */
export function resolveEditedTime(original: string | null, localValue: string): string | null {
	if (!localValue) return null;
	if (original && toDateTimeLocal(original) === localValue) return original;
	return fromDateTimeLocal(localValue);
}

export function localDayKey(date: Date): string {
	const pad = (part: number) => String(part).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function elapsedMs(entry: TimeEntryRecord, now: number): number {
	const start = parsePocketBase(entry.startTime).getTime();
	const end = entry.endTime ? parsePocketBase(entry.endTime).getTime() : now;
	return Math.max(0, end - start);
}

export function formatClock(ms: number): string {
	const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const pad = (part: number) => String(part).padStart(2, '0');
	return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatDuration(ms: number): string {
	const totalMinutes = Math.floor(Math.max(0, ms) / 60000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	const pad = (part: number) => String(part).padStart(2, '0');
	return `${hours}:${pad(minutes)}`;
}

export function formatTimeOfDay(value: string): string {
	return parsePocketBase(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDayLabel(dayKey: string, today: Date): string {
	const todayKey = localDayKey(today);
	if (dayKey === todayKey) return 'Today';
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);
	if (dayKey === localDayKey(yesterday)) return 'Yesterday';
	const [year, month, day] = dayKey.split('-').map(Number);
	return new Date(year, month - 1, day).toLocaleDateString(undefined, {
		weekday: 'short',
		month: 'short',
		day: 'numeric'
	});
}

export function runningEntry(entries: TimeEntryRecord[]): TimeEntryRecord | undefined {
	let latest: TimeEntryRecord | undefined;
	for (const entry of entries) {
		if (entry.deleted || entry.endTime !== null) continue;
		if (!latest || entry.startTime > latest.startTime) latest = entry;
	}
	return latest;
}

export function orderedActiveProjects(
	projects: ProjectRecord[],
	clients: ClientRecord[],
	entries: TimeEntryRecord[]
): ProjectRecord[] {
	const clientsById = new Map(clients.map((client) => [client.id, client]));
	const lastStart = new Map<string, string>();
	for (const entry of entries) {
		if (entry.deleted || !entry.projectId) continue;
		const previous = lastStart.get(entry.projectId);
		if (!previous || entry.startTime > previous) lastStart.set(entry.projectId, entry.startTime);
	}

	return projects
		.filter((project) => {
			const client = clientsById.get(project.clientId);
			return Boolean(client && !client.archived && !project.archived);
		})
		.sort((a, b) => {
			const byTime = (lastStart.get(b.id) ?? '').localeCompare(lastStart.get(a.id) ?? '');
			if (byTime !== 0) return byTime;
			const clientA = clientsById.get(a.clientId)?.name ?? '';
			const clientB = clientsById.get(b.clientId)?.name ?? '';
			return clientA.localeCompare(clientB) || a.name.localeCompare(b.name);
		});
}

export type DayGroup = {
	day: string;
	totalMs: number;
	entries: TimeEntryRecord[];
};

export function groupEntries(entries: TimeEntryRecord[], now: number): DayGroup[] {
	const groups = new Map<string, TimeEntryRecord[]>();
	for (const entry of entries) {
		if (entry.deleted) continue;
		const day = localDayKey(parsePocketBase(entry.startTime));
		const list = groups.get(day);
		if (list) list.push(entry);
		else groups.set(day, [entry]);
	}

	return [...groups.entries()]
		.sort(([a], [b]) => b.localeCompare(a))
		.map(([day, list]) => {
			const sorted = list.slice().sort((a, b) => b.startTime.localeCompare(a.startTime));
			const totalMs = sorted.reduce((sum, entry) => sum + elapsedMs(entry, now), 0);
			return { day, totalMs, entries: sorted };
		});
}

export function todayTotalMs(entries: TimeEntryRecord[], now: number): number {
	const today = localDayKey(new Date(now));
	let total = 0;
	for (const entry of entries) {
		if (entry.deleted) continue;
		if (localDayKey(parsePocketBase(entry.startTime)) !== today) continue;
		total += elapsedMs(entry, now);
	}
	return total;
}
