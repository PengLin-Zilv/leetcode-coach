# LeetCode Coach

LeetCode Coach is a single-user Next.js application that runs one persistent,
adaptive interview-practice loop:

```text
Setup -> Today -> Practice -> Reflection -> Feedback -> Progress -> next Today
```

Today selects one deterministic task and explains the factors behind it. A completed
Practice session writes one immutable Attempt, rebuilds explainable Skill State
(MEMORY), and uses that evidence in the next recommendation. Problems open on
LeetCode; this application does not copy statements or execute code.

## Local setup

Use Node.js 24. The checked-in `.nvmrc` is the local runtime source of truth.

```bash
nvm use
npm ci
cp .env.example .env.local
npm run db:migrate:local
npm run db:seed:local
npx playwright install chromium
npm run dev
```

Open `http://localhost:3000`. Setup, Attempts, MEMORY, and Progress persist in the
local libSQL database configured by `.env.local`; the checked-in template uses
`file:./dev.db` and `MIGRATION_TARGET=local`.

`PRACTICE_COOKIE_SECRET` signs transient HTTP-only Practice state. Development and
tests use a deterministic non-production fallback when it is blank. Production and
preview runtimes require a random server-only value of at least 32 characters; a
blank or shorter value is rejected. Generate one with, for example,
`openssl rand -hex 32`, and never prefix it with `NEXT_PUBLIC_`.

## Commands

| Command                                                     | Purpose                                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `npm run dev`                                               | Start the local application at `http://localhost:3000`.                          |
| `npm run build`                                             | Build the production application; it never migrates or seeds a database.         |
| `npm run start`                                             | Serve an existing production build.                                              |
| `npm run format`                                            | Format the repository with Prettier.                                             |
| `npm run format:check`                                      | Check formatting without changing files.                                         |
| `npm run lint`                                              | Run ESLint.                                                                      |
| `npm run typecheck`                                         | Generate Next.js route types, then run `tsc --noEmit`.                           |
| `npm run test`                                              | Run the Vitest unit and integration suites.                                      |
| `npm run test:watch`                                        | Run Vitest in watch mode.                                                        |
| `npm run test:e2e`                                          | Run Playwright's isolated browser database and complete workflow suites.         |
| `npm run db:generate`                                       | Generate migration files from `src/db/schema.ts` for manual SQL review.          |
| `npm run db:migrate:local`                                  | Apply committed migrations to the local database selected by `.env.local`.       |
| `npm run db:seed:local`                                     | Idempotently seed the local canonical roadmap and catalog.                       |
| `npm run memory:rebuild:local`                              | Rebuild all local Skill State rows from immutable Attempts.                      |
| `npm run db:migrate:production -- --confirm-production`     | Manually migrate the explicitly confirmed production target.                     |
| `npm run db:seed:production -- --confirm-production`        | Manually seed the explicitly confirmed production target.                        |
| `npm run memory:rebuild:production -- --confirm-production` | Manually rebuild production MEMORY from Attempts.                                |
| `npm run verify`                                            | Run format check, lint, types, unit/integration tests, browser tests, and build. |

Playwright owns a guarded database under `file:./test-results/`; its reset helpers
reject remote URLs, `file:./dev.db`, and paths outside `test-results`. On this host,
Chromium also needs the staged shared libraries:

```bash
LD_LIBRARY_PATH=/tmp/pwdeps-local-research-20260714/usr/lib/x86_64-linux-gnu npm run test:e2e
```

That `/tmp` path is machine-local, not a repository dependency. On a normally
provisioned host, install Playwright's system dependencies and run `npm run test:e2e`
without the override.

## Database change and operator policy

Schema changes follow one mandatory sequence:

```text
change src/db/schema.ts
  -> npm run db:generate
  -> review every generated SQL statement
  -> commit schema and migration together
  -> npm run db:migrate:<target>
```

Generation is not approval and never applies SQL. The reviewed first migration is
`drizzle/0000_adaptive_spine.sql`; see `drizzle/README.md` for the review boundary.

For local development, migrate before seeding:

```bash
npm run db:migrate:local
npm run db:seed:local
```

The idempotent seed produces exactly:

- 18 canonical Patterns;
- 21 prerequisite edges;
- 150 Problems;
- 150 Problem-to-Pattern mappings, one per Phase 2 Problem;
- 18 initial unseen Skill State rows.

Estimated time is derived only from difficulty: Easy is 15 minutes, Medium is 30
minutes, and Hard is 45 minutes.

Production database operations are manual and protected. Copy the ignored template,
replace the database placeholders, keep `MIGRATION_TARGET=production`, and run only
the intended operation with the confirmation flag:

```bash
cp .env.production.example .env.production.local
npm run db:migrate:production -- --confirm-production
npm run db:seed:production -- --confirm-production
npm run memory:rebuild:production -- --confirm-production
```

Each production command reads only `.env.production.local`, requires a remote URL and
token, rejects an unconfirmed invocation or mismatched target, closes its client, and
logs no credential values or raw exceptions. Remove `.env.production.local` after
the operator action. It is a temporary operations file and must not be present during
normal production builds.

Never add migration, seed, or MEMORY rebuild commands to `npm run build`, Vercel's
build/install command, or a deployment hook. Provision and update the database as an
explicit operator action before serving code that depends on it.

## Architecture and persistence semantics

The application remains one strict Next.js App Router modular monolith:

```text
Server Component or Server Action
  -> feature application service
    -> pure domain rule
    -> server-only repository/provider adapter
      -> Drizzle
        -> @libsql/client
```

Runtime environment accessors, database modules, repositories, and provider adapters
under `src` begin with `import "server-only"`. Client Components receive serialized
data and invoke narrow Server Actions; they never import database clients, secret
accessors, repositories, or secret-bearing barrel exports. The `.server.ts` suffix is
descriptive—the import marker enforces the boundary.

Attempt completion has an intentional failure boundary:

```text
validate -> persist immutable Attempt -> rebuild all Skill State rows
```

The Attempt commit happens first and is never included in the projection replacement
transaction. If projection fails, Feedback reports MEMORY as pending while retaining
the Attempt. The next Today or Progress load self-heals from source Attempts, Feedback
can retry, and operators can run `npm run memory:rebuild:local` or the protected
production equivalent. MIND output and raw chat are never training truth.

Recommendations are deterministic application logic. They enforce prerequisites and
session fit, prioritize due reviews, avoid immediate repetition when an alternative
fits, and render the visible reason from the same structured factors used to select
the task.

## MIND and Phase 2 scope

Phase 2 contains a typed, Zod-validated MIND seam, but no live provider, provider
credentials, or network call. Runtime uses an honest unavailable adapter; the
deterministic `FakeMindGateway` is test-only and cannot be selected in production.
Unavailable or invalid coaching never changes hint depth, writes MEMORY, or blocks
Practice, Reflection, Feedback, or the next recommendation.

This phase intentionally has no Correction entity, blocker field, authentication or
account model, embedded judge/code runner, submission import, global chatbot, or live
MIND provider. It uses one local singleton Profile and the curated NeetCode 150
metadata needed to prove the adaptive loop.

## Vercel deployment

1. Create the Turso database and a scoped token.
2. Run the protected production migration and seed commands manually.
3. Set Vercel's Node.js Version to `24.x`.
4. Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and a random
   `PRACTICE_COOKIE_SECRET` of at least 32 characters as server-only variables for
   every deployed environment. Do not set `MIGRATION_TARGET` in the application
   runtime and do not expose any value with `NEXT_PUBLIC_`.
5. Set the Vercel build command to exactly `npm run build` and deploy.
6. Exercise Setup through the next Today recommendation and inspect logs for errors
   or leaked environment values.
