const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** 15-character id matching PocketBase's default `[a-z0-9]{15}` pattern. */
export function createId(): string {
	const bytes = new Uint8Array(15);
	crypto.getRandomValues(bytes);
	let id = '';
	for (const byte of bytes) {
		id += alphabet[byte % alphabet.length];
	}
	return id;
}
