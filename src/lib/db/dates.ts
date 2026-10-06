/** PocketBase datetime, `YYYY-MM-DD HH:mm:ss.sssZ`, which sorts as a string. */
export function pocketBaseNow(date = new Date()): string {
	return date.toISOString().replace('T', ' ');
}
