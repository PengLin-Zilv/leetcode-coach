# LeetCode Coach

This repository currently contains the Phase 1 walking skeleton: a strict Next.js
application that provides the probe needed to verify the server-only Drizzle/libSQL
path locally and on Vercel. It intentionally has no training-domain tables or product
workflow yet.

## Local setup

Use Node.js 24. The repository `.nvmrc` is the source for local runtime selection:

```bash
nvm use
npm ci
npx playwright install chromium
cp .env.example .env.local
npm run dev
```

The app is available at `http://localhost:3000`. The checked-in local template uses
`TURSO_DATABASE_URL=file:./dev.db` and `MIGRATION_TARGET=local`. `.env.local`, local
database files, and all production credentials are ignored by Git.

`PRACTICE_COOKIE_SECRET` signs transient practice-session state. Local development
and tests use a deterministic non-production fallback when it is empty. Every
production and preview deployment must set a random value of at least 32 characters
(for example, generated with `openssl rand -hex 32`) as a server-only variable. Never
prefix it with `NEXT_PUBLIC_`.

## Commands

| Command                                                 | Purpose                                                                    |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`                                           | Start the local Next.js development server.                                |
| `npm run build`                                         | Build the production Next.js application; it never runs migrations.        |
| `npm run start`                                         | Serve an existing production build.                                        |
| `npm run format`                                        | Format the repository with Prettier.                                       |
| `npm run format:check`                                  | Check formatting without changing files.                                   |
| `npm run lint`                                          | Run ESLint.                                                                |
| `npm run typecheck`                                     | Generate Next.js route types with `next typegen`, then run `tsc --noEmit`. |
| `npm run test`                                          | Run the Vitest unit suites.                                                |
| `npm run test:watch`                                    | Run Vitest in watch mode.                                                  |
| `npm run test:e2e`                                      | Run Playwright against its own local Next.js server.                       |
| `npm run db:generate`                                   | Generate migration files from the Drizzle schema for human review.         |
| `npm run db:migrate:local`                              | Apply committed migrations to the explicit local target.                   |
| `npm run db:migrate:production -- --confirm-production` | Apply committed migrations to the explicitly confirmed production target.  |
| `npm run verify`                                        | Run format check, lint, type-check, unit tests, browser tests, and build.  |

## Architecture and server-only boundary

The application is one Next.js App Router modular monolith:

```text
Server Component route
  -> feature application service
    -> server-only database adapter
      -> Drizzle
        -> @libsql/client
```

Code is grouped by responsibility under `src/app`, `src/config`, `src/db`, and
`src/features`. Runtime database adapters, secret-bearing environment accessors,
repositories, and provider modules must begin with `import "server-only"`. Pure
validators and declarative schema definitions stay free of secret access so tests and
generation tooling can import them. Client Components may receive serialized data,
but they must never import sensitive modules or a barrel that re-exports them. Route
files call application services; they do not create database clients or read secrets
directly.

## Reviewed migrations

`drizzle.config.ts` configures schema-to-SQL generation only. The installed Drizzle
Kit version requires database credentials in a Turso config, so generation uses the
non-secret local `file:./dev.db` URL. Production credentials are not read by
`npm run db:generate`.

There is intentionally no generated migration in Phase 1. Once a schema change is
approved:

1. Change `src/db/schema.ts`.
2. Run `npm run db:generate`.
3. Review every generated SQL statement manually.
4. Commit the schema and reviewed migration together.
5. Apply it with one of the explicit target commands below.

For a local migration, confirm `.env.local` contains a `file:` URL and
`MIGRATION_TARGET=local`, then run:

```bash
npm run db:migrate:local
```

For production, create the ignored target-specific file, replace both placeholders,
and keep the marker unchanged:

```bash
cp .env.production.example .env.production.local
npm run db:migrate:production -- --confirm-production
```

Remove `.env.production.local` from the repository directory immediately after the
operator action and retain credentials only in approved secret storage. Next.js
recognizes that filename during local production builds, so it must not be present
when running the normal `npm run build` path.

The runner reads and parses only `.env.local` for `local` or
`.env.production.local` for `production` into an isolated object. It does not consult
or mutate inherited migration variables. It rejects a mismatched `MIGRATION_TARGET`;
local requires a `file:` URL, while production requires a non-`file:` URL, a token,
and the confirmation flag. The client is always closed after an attempted migration.
The runner never prints a URL, token, environment value, or raw exception. Never
commit either target-specific env file.

Migrations are manual operator actions. `npm run build` and the Vercel build command
must never generate or apply them.

## Vercel and Turso deployment

1. Create the Turso database and a scoped token. No Phase 1 table is required; the
   temporary page probes the connection with `select 1`.
2. In the Vercel project UI, set **Project Settings -> Node.js Version** to `24.x`.
   Do not rely on an inferred default.
3. In Vercel, set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and a random
   `PRACTICE_COOKIE_SECRET` of at least 32 characters as server-only variables for
   each deployed environment. Never use a `NEXT_PUBLIC_` prefix.
   `MIGRATION_TARGET` belongs to the manual migration file, not the running application.
4. Set the Vercel build command to exactly `npm run build`. Do not add a migration
   command to the build, install, or deployment hooks.
5. Deploy, then make a fresh request after the deployment has been idle long enough to
   exercise a cold start. The page must render `Database connected`.
6. Inspect build and runtime logs. Confirm the build ran no migration, and that logs
   contain no connection errors, database URLs, tokens, or other environment values.

Before treating the walking skeleton as verified, confirm all of these facts: the
Turso database exists; the two Vercel variables exist; Node.js is set to `24.x`; the
production build succeeds without a migration; a cold request renders; the page says
`Database connected`; and the build/runtime logs contain neither connection errors nor
secrets.

## Mandatory Phase 2 probe retirement

The root database connectivity page is temporary infrastructure, not a product health
endpoint. At the start of Phase 2, before product routes are added, remove
`src/app/page.tsx`, `src/app/page.module.css`, and the entire foundation connectivity
feature (including its public per-request query). This retirement is mandatory even
if the probe remains convenient.
