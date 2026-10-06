import PocketBase from 'pocketbase';

/** Local PocketBase, unless VITE_POCKETBASE_URL overrides it. */
export const pocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(pocketBaseUrl);

pb.autoCancellation(false);
