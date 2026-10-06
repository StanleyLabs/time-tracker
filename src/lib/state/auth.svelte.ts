import { ClientResponseError, type AuthRecord } from 'pocketbase';
import { pb } from '#lib/pocketbase.ts';

let user = $state<AuthRecord>(pb.authStore.record);
let signedIn = $state(pb.authStore.isValid);
let ready = $state(false);
let initStarted = false;

pb.authStore.onChange((_token, record) => {
	user = record;
	signedIn = pb.authStore.isValid;
});

function isAuthRejection(error: unknown): boolean {
	return error instanceof ClientResponseError && (error.status === 401 || error.status === 403);
}

async function refreshSession(): Promise<void> {
	if (!pb.authStore.isValid) return;
	try {
		await pb.collection('users').authRefresh();
	} catch (error) {
		if (isAuthRejection(error)) pb.authStore.clear();
	}
}

export function initAuth(): void {
	if (initStarted) return;
	initStarted = true;
	void refreshSession().finally(() => {
		ready = true;
	});
}

export async function login(email: string, password: string): Promise<void> {
	await pb.collection('users').authWithPassword(email, password);
}

export function logout(): void {
	pb.authStore.clear();
}

export function accountEmail(): string {
	const email = user?.email;
	return typeof email === 'string' ? email : '';
}

export const auth = {
	get user(): AuthRecord {
		return user;
	},
	get ready(): boolean {
		return ready;
	},
	get isAuthenticated(): boolean {
		return signedIn;
	}
};
