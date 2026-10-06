# Time tracker

Offline-first time tracking for one freelancer, with a self-hosted PocketBase backend. This repo currently has the app shell, the database migration, and email/password sign-in.

## Local app

Requires Node.js.

```sh
npm install
npm run dev
```

The dev server prints a local URL, usually `http://localhost:5173`.

`VITE_POCKETBASE_URL` sets the PocketBase address. Copy `.env.example` to `.env` to override it. When the variable is unset, the app uses `http://127.0.0.1:8090`.

```sh
npm run build
npm run preview
```

`npm run build` writes a client-only static site to `build/`. Every route is served from `build/index.html`. PocketBase does that fallback when you put the build in `pb_public`. Another static host needs the same fallback for paths like `/login`.

## PocketBase

Requires PocketBase 0.23 or newer. From the directory where you run PocketBase:

```sh
pocketbase --migrationsDir /absolute/path/to/time-tracker/pb_migrations serve
```

Or copy `pb_migrations` next to the PocketBase binary and start it as usual. PocketBase applies pending migrations on startup.

The migrations create `clients`, `projects`, and `time_entries`, lock each one to `user = @request.auth.id`, and turn off public signup on `users`. A project can store its own color; an empty color means it uses the client color.

Clients and projects entered in the app are stored in this browser for now. They are not sent to PocketBase yet.

The first account created at `http://127.0.0.1:8090/_/` is an admin superuser. That account can open the dashboard and cannot sign in to the app. In the dashboard, open Collections → users → New record, set an email and password, and use that record on the app login screen.

If the browser blocks login, add the Vite origin (for example `http://localhost:5173`) under PocketBase Settings.

Theme choice is stored in this browser. It starts on System, which follows the operating system, and can be set to Light or Dark.
