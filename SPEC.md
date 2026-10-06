Build a time-tracking Progressive Web App (PWA) for a freelancer/consultant who tracks time across multiple clients and projects. Single user, syncing across phone and desktop through a self-hosted PocketBase backend.

## Tech stack
- SvelteKit (Svelte 5 with runes) + TypeScript, using adapter-static (client-side only, no SSR)
- Tailwind CSS for styling
- PocketBase (self-hosted on my VPS) for auth and as the source of truth, using the official PocketBase JS SDK
- IndexedDB via Dexie.js as a local offline cache
- @vite-pwa/sveltekit for service worker, manifest, and installability
- Must be installable on iOS, Android, and desktop
- PocketBase URL configured via environment variable (VITE_POCKETBASE_URL)

## PocketBase setup
Provide the collection schema as a PocketBase migration file (pb_migrations) so I can deploy it directly:
- clients: user (relation → users), name, color, hourly_rate (number, optional), archived (bool)
- projects: user, client (relation), name, hourly_rate (number, optional, overrides client rate), archived (bool)
- time_entries: user, project (relation), start_time (date), end_time (date, nullable — null means running), notes, billable (bool, default true), deleted (bool, for soft deletes)

API rules on every collection: list/view/create/update/delete only where user = @request.auth.id. Disable public signup on the users collection; I'll create my account in the PocketBase admin UI.

## Auth
- Email/password login screen using PocketBase auth
- Persist the auth session so I stay logged in; refresh the token automatically
- Logout option in settings
- If the session expires, prompt to log in again without losing unsynced local changes

## Sync model (offline-first)
- All reads in the UI come from Dexie, so the app is instant and works offline
- Writes go to Dexie immediately and are added to an outbox queue
- When online, the outbox flushes to PocketBase in order, retrying on failure
- On app launch, on reconnect, and on window focus, pull changes from PocketBase using the `updated` field since the last sync timestamp
- Subscribe to PocketBase realtime on time_entries, projects, and clients so changes from another device show up live
- Conflict resolution: last write wins based on `updated` timestamp
- Use soft deletes (deleted = true) so deletions sync correctly
- Generate record IDs on the client (15-char PocketBase-compatible IDs) so offline-created records don't need remapping
- Show a small sync status indicator (synced / syncing / offline / X changes pending)

## Critical: how timing works
Do NOT use setInterval or background workers to count time. When a timer starts, create a time_entry with start_time = now and end_time = null. Elapsed time is always computed as (now - start_time); the UI ticks every second only for display. The timer survives the app closing, the phone locking, or a device restart.

Only one timer can run at a time across ALL devices. Starting a new timer stops any running entry first. Because the running entry syncs, starting a timer on my phone must show it running on my desktop (via realtime), and I can stop it from either device. On sync, if two running entries are ever found, keep the most recent and set the older one's end_time to the newer one's start_time.

## Main screens
1. **Timer (home)**: Large running timer, current client/project, notes field. Below it, recent projects as one-tap "start" buttons. Today's total at top.
2. **Entries**: Time entries grouped by day with daily totals. Tap to edit start/end, project, notes, or billable flag, or to delete. Button to add a manual entry for forgotten time.
3. **Clients & Projects**: Simple CRUD. Archive instead of delete so past entries stay intact.
4. **Export / Reports**: Date range presets (this week, last week, this month, last month, custom), optional client and project filters. Summary of hours per client/project and billable totals where rates are set. Export as:
   - CSV (date, client, project, start, end, duration in decimal hours, notes, billable, rate, amount)
   - PDF timesheet formatted for sending to a client (client name, period, entries table, totals)
5. **Settings**: Rounding, forgot-to-stop threshold, JSON export, logout.

## UX requirements
- Mobile-first, but use a comfortable wider layout on desktop
- Starting/stopping a timer never takes more than 2 taps
- Running timer shown in the browser tab title (e.g. "1:23:45 – ProjectName")
- Dark and light mode following system preference
- Durations shown as h:mm; exports use decimal hours (1.75)

## Extras
- **Forgot-to-stop protection**: If a timer has run longer than a configurable threshold (default 10 hours), prompt on next open to keep it or set the actual end time.
- **Rounding setting** applied to exports only (none / 6 / 15 / 30 min), never altering stored data.
- **JSON export/import** of all data as a manual backup independent of the server.
- Desktop keyboard shortcut: Space starts/stops the timer when not typing in a field.

## Out of scope (do not build)
Multi-user/team features, public signup, invoicing/payments, analytics dashboards.

## Deliverables
- Clean structure: Svelte components, stores/runes state, a separate db layer (Dexie), and a separate sync service
- pb_migrations file for the schema and API rules
- README covering: local dev, building the static app, deploying PocketBase on a VPS behind a reverse proxy (Caddy or Nginx) with HTTPS, configuring CORS, creating the user account, and hosting the frontend (on the same VPS via PocketBase's pb_public folder, or separately)