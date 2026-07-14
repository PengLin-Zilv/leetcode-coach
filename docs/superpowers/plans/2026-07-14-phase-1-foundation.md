# Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish and deploy a production-shaped Next.js/libSQL walking skeleton without introducing any training-domain model.

**Architecture:** A strict-TypeScript Next.js App Router monolith renders a server-side foundation page through a focused connectivity service. Every sensitive module imports `server-only`; Drizzle uses the same `@libsql/client` driver for a local file and remote Turso, with runtime configuration validated by Zod.

**Tech Stack:** Node.js 24, npm, Next.js App Router, React, TypeScript, Zod, Drizzle ORM, `@libsql/client`, CSS Modules, Vitest, Playwright, ESLint, and Prettier.

## Global Constraints

- Phase 1 creates no Profile, Problem, Attempt, Correction, Skill State, Recommendation, Review, or other training-domain table.
- `.nvmrc` contains exactly `24`; Vercel is configured for Node.js `24.x`; `package.json` leaves `engines.node` unset.
- Local database access uses `@libsql/client` with `TURSO_DATABASE_URL=file:./dev.db`; deployment uses the same client with a Turso URL and server-only token.
- Every database, environment accessor, repository, and provider module imports `server-only`; `.server.ts` is documentation only.
- Raw external configuration is parsed with Zod before use. No secret, URL, raw database error, or validation input is rendered or logged.
- The connectivity page runs `select 1`, adds no domain table, and is removed at the start of Phase 2.
- Playwright owns its running Next.js target through `webServer`.
- Migrations never run from `next build` or the Vercel build command.
- Production migration requires an explicit production target, production environment file, and confirmation flag.
- Tests never use a live network database or live LLM.
- CSS Modules and CSS custom properties are the only styling model; do not add Tailwind.
- Use Conventional Commits in imperative mood. Before every implementation commit, run `npm run lint`, `npm run typecheck`, and `npm run build` successfully.
- Do not begin domain modeling after Phase 1 verification.

---

## File Map

```text
.nvmrc                                      Node 24 local version selection
.env.example                                safe local configuration template
.env.production.example                     safe production migration template
package.json                                scripts and dependency manifest
package-lock.json                           exact npm resolution
next-env.d.ts                               generated Next.js type references; ignored by Git
next.config.ts                              Next.js configuration
tsconfig.json                               strict compiler configuration
eslint.config.mjs                           Next.js/TypeScript lint configuration
.prettierrc.json                            formatting policy
.prettierignore                             generated-file exclusions
vitest.config.ts                            unit-test configuration
playwright.config.ts                        browser runner and owned web server
drizzle.config.ts                           schema-to-migration generation config
drizzle/README.md                           migration directory policy until entities exist
scripts/migration-policy.ts                 pure production/local migration guard
scripts/migration-policy.test.ts            migration guard behavior
scripts/migrate.ts                          explicit manual migration runner
src/app/layout.tsx                          application shell and metadata
src/app/page.tsx                            temporary server-rendered probe page
src/app/page.module.css                     foundation-page styling
src/app/globals.css                         reset and global imports
src/styles/tokens.css                       visual tokens
src/config/database-env.ts                  pure Zod parser and typed config
src/config/database-env.test.ts             configuration boundary tests
src/config/env.server.ts                    guarded process-environment accessor
src/db/schema.ts                            intentionally empty Phase 1 schema boundary
src/db/client.server.ts                     guarded lazy Drizzle/libSQL client
src/db/probe.server.ts                      guarded `select 1` adapter
src/features/foundation/connectivity.ts     pure connectivity use case and result union
src/features/foundation/connectivity.test.ts connectivity behavior tests
src/features/foundation/README.md           Phase 2 probe-retirement instruction
tests/e2e/foundation.spec.ts                 real-browser walking-skeleton check
README.md                                    setup, verification, migration, and deployment runbook
```

### Task 1: Strict Next.js Toolchain

**Files:**

- Create: `.nvmrc`
- Create: `.env.example`
- Create: `package.json`
- Create: `package-lock.json` via npm
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `eslint.config.mjs`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `src/styles/tokens.css`
- Modify: `.gitignore`

**Interfaces:**

- Consumes: Node.js 24 and npm.
- Produces: standard `dev`, `build`, `start`, `lint`, `typecheck`, `format`, `format:check`, `test`, `test:e2e`, and `verify` commands; path alias `@/* -> ./src/*`.

- [ ] **Step 1: Pin the runtime and create the dependency manifest**

Create `.nvmrc` containing:

```text
24
```

Create `package.json` without an `engines` field. Install current stable releases with npm so `package-lock.json` pins the exact graph:

```bash
npm install next@latest react@latest react-dom@latest @libsql/client@latest drizzle-orm@latest server-only@latest zod@latest
npm install --save-dev @playwright/test@latest @types/node@latest @types/react@latest @types/react-dom@latest drizzle-kit@latest eslint@9.39.5 eslint-config-next@latest prettier@latest tsx@latest typescript@6.0.3 vitest@latest
```

Next 16.2's current lint parser requires TypeScript below 6.1, and its lint
plugin graph supports ESLint through 9. Pin the newest compatible releases
instead of installing incompatible majors.

The scripts must be:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "next typegen && tsc --noEmit",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "db:generate": "drizzle-kit generate",
  "db:migrate:local": "tsx scripts/migrate.ts local",
  "db:migrate:production": "tsx scripts/migrate.ts production",
  "verify": "npm run format:check && npm run lint && npm run typecheck && npm run test && npm run test:e2e && npm run build"
}
```

- [ ] **Step 2: Create strict framework and quality configuration**

Use strict TypeScript with `noEmit`, `isolatedModules`, Next's plugin, and the `@/*` path alias. Configure ESLint with Next core-web-vitals and TypeScript presets. Configure Prettier with LF line endings and exclude `.next`, `node_modules`, `playwright-report`, `test-results`, `dev.db`, and generated Drizzle metadata.

Configure Vitest for Node, `src/**/*.test.ts` plus `scripts/**/*.test.ts`, restored mocks, and coverage-independent execution. Configure Playwright with:

```ts
webServer: {
  command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
  url: 'http://127.0.0.1:3100',
  reuseExistingServer: false,
  env: {
    ...process.env,
    TURSO_DATABASE_URL: 'file:./dev.db',
  },
},
use: { baseURL: 'http://127.0.0.1:3100' }
```

- [ ] **Step 3: Create the minimal static application shell**

Create a semantic root layout with metadata title `LeetCode Coach` and a temporary page containing only `LeetCode Coach foundation`. Import `tokens.css` through `globals.css`. Keep CSS limited to system typography, colors, box sizing, and body defaults.

- [ ] **Step 4: Protect local and generated files**

Extend `.gitignore` with:

```gitignore
node_modules/
.next/
next-env.d.ts
out/
dev.db
dev.db-*
.env*
!.env.example
!.env.production.example
playwright-report/
test-results/
coverage/
.vercel/
.superpowers/
*.tsbuildinfo
```

Create `.env.example`:

```dotenv
TURSO_DATABASE_URL=file:./dev.db
MIGRATION_TARGET=local
```

- [ ] **Step 5: Format and verify the scaffold**

Run:

```bash
npm run format
npm run lint
npm run typecheck
npm run build
```

Expected: all four exit 0; build identifies the root route successfully; `package.json` has no `engines` key.

- [ ] **Step 6: Commit the green scaffold**

```bash
git add .nvmrc .env.example package.json package-lock.json next.config.ts tsconfig.json eslint.config.mjs .prettierrc.json .prettierignore vitest.config.ts playwright.config.ts src .gitignore
git commit -m "build(app): establish the Node 24 foundation"
```

- [ ] **Step 7: Commit the already-reviewed execution plan from the same green tree**

```bash
git add docs/superpowers/plans/2026-07-14-phase-1-foundation.md
git commit -m "docs(plan): record phase 1 execution steps"
```

### Task 2: Zod-Validated Database Configuration

**Files:**

- Create: `src/config/database-env.test.ts`
- Create: `src/config/database-env.ts`
- Create: `src/config/env.server.ts`

**Interfaces:**

- Consumes: untrusted `Record<string, string | undefined>` environment values.
- Produces: `parseDatabaseConfig(input): DatabaseConfig`, `InvalidDatabaseConfigurationError`, and guarded `getDatabaseConfig(): DatabaseConfig`.

- [ ] **Step 1: Write failing configuration tests**

Cover these exact cases:

```ts
expect(parseDatabaseConfig({ TURSO_DATABASE_URL: "file:./dev.db" })).toEqual({
  url: "file:./dev.db",
  authToken: undefined,
});

expect(
  parseDatabaseConfig({
    TURSO_DATABASE_URL: "libsql://coach.example.turso.io",
    TURSO_AUTH_TOKEN: "secret",
  }),
).toEqual({
  url: "libsql://coach.example.turso.io",
  authToken: "secret",
});

expect(() =>
  parseDatabaseConfig({
    TURSO_DATABASE_URL: "libsql://coach.example.turso.io",
  }),
).toThrow(InvalidDatabaseConfigurationError);

expect(() => parseDatabaseConfig({})).toThrow(
  InvalidDatabaseConfigurationError,
);
```

Also assert that the public error message does not contain the supplied URL or token.

- [ ] **Step 2: Run the test and verify RED**

```bash
npm test -- src/config/database-env.test.ts
```

Expected: FAIL because `database-env` does not exist.

- [ ] **Step 3: Implement the minimal parser**

Use a Zod object with a `superRefine` rule: `file:` URLs do not require a token; every other non-empty URL does. Convert validation failure to `InvalidDatabaseConfigurationError('Database configuration is invalid')` without attaching raw input or Zod issues to the public error.

Create `env.server.ts` with `import 'server-only'` as its first import and:

```ts
export function getDatabaseConfig(): DatabaseConfig {
  return parseDatabaseConfig(process.env);
}
```

- [ ] **Step 4: Run RED to GREEN and all current checks**

```bash
npm test -- src/config/database-env.test.ts
npm run lint
npm run typecheck
npm run build
```

Expected: all exit 0; four configuration cases plus the redaction assertion pass.

- [ ] **Step 5: Commit the validated boundary**

```bash
git add src/config
git commit -m "chore(config): validate database settings at the server seam"
```

### Task 3: Deterministic Connectivity Service and Server Adapter

**Files:**

- Create: `src/features/foundation/connectivity.test.ts`
- Create: `src/features/foundation/connectivity.ts`
- Create: `src/db/schema.ts`
- Create: `src/db/client.server.ts`
- Create: `src/db/probe.server.ts`

**Interfaces:**

- Consumes: `DatabaseProbe = () => Promise<unknown>`, `FoundationLogger`, and `getDatabaseConfig()`.
- Produces: `checkFoundationConnectivity(probe, logger): Promise<FoundationConnectivityResult>` and guarded `probeDatabase(): Promise<unknown>`.

- [ ] **Step 1: Write failing connectivity tests**

Define desired results through tests:

```ts
await expect(
  checkFoundationConnectivity(async () => ({ connected: 1 }), logger),
).resolves.toEqual({
  status: "connected",
});

await expect(
  checkFoundationConnectivity(async () => ({ connected: 0 }), logger),
).resolves.toEqual({
  status: "foundation_unavailable",
  reason: "unexpected_database_response",
});

await expect(
  checkFoundationConnectivity(async () => {
    throw new InvalidDatabaseConfigurationError();
  }, logger),
).resolves.toEqual({
  status: "foundation_unavailable",
  reason: "invalid_configuration",
});

await expect(
  checkFoundationConnectivity(async () => {
    throw new Error("libsql://secret-host");
  }, logger),
).resolves.toEqual({
  status: "foundation_unavailable",
  reason: "database_unreachable",
});
```

Assert the logger receives only a stable diagnostic code and error class/name, never the thrown message.

- [ ] **Step 2: Run the test and verify RED**

```bash
npm test -- src/features/foundation/connectivity.test.ts
```

Expected: FAIL because the connectivity service does not exist.

- [ ] **Step 3: Implement the pure service**

Use a Zod schema for `{ connected: z.literal(1) }`. Return this discriminated union:

```ts
type FoundationConnectivityResult =
  | { readonly status: "connected" }
  | {
      readonly status: "foundation_unavailable";
      readonly reason:
        | "invalid_configuration"
        | "database_unreachable"
        | "unexpected_database_response";
    };
```

Catch errors inside the service. Map only `InvalidDatabaseConfigurationError` specially. Log a stable code and `error.name`; never log `error.message`, raw configuration, or the thrown object.

- [ ] **Step 4: Add the guarded Drizzle/libSQL adapter**

`client.server.ts` and `probe.server.ts` both begin with:

```ts
import "server-only";
```

Construct one lazy libSQL client per warm server instance from `getDatabaseConfig()`, wrap it with `drizzle`, and expose no client to browser code. `probeDatabase()` executes through Drizzle:

```sql
select 1 as connected
```

Return only the first row to the service. `schema.ts` exports no tables and states that Phase 1 intentionally has no domain schema.

- [ ] **Step 5: Run RED to GREEN and all current checks**

```bash
npm test -- src/features/foundation/connectivity.test.ts
npm run lint
npm run typecheck
npm run build
```

Expected: all exit 0; the four result paths and log-redaction assertion pass.

- [ ] **Step 6: Commit the server-only connectivity path**

```bash
git add src/features/foundation src/db
git commit -m "feat(foundation): add the server-only database probe"
```

### Task 4: Real Browser Walking Skeleton

**Files:**

- Create: `tests/e2e/foundation.spec.ts`
- Modify: `src/app/page.tsx`
- Create: `src/app/page.module.css`
- Modify: `src/app/globals.css`
- Modify: `src/styles/tokens.css`
- Create: `src/features/foundation/README.md`

**Interfaces:**

- Consumes: `checkFoundationConnectivity(probeDatabase, console)`.
- Produces: a dynamic Node.js server-rendered page with accessible connected/unavailable output and an explicit Phase 2 retirement note.

- [ ] **Step 1: Install the Playwright browser**

```bash
npx playwright install chromium
```

Expected: Chromium is available to the local test runner.

- [ ] **Step 2: Write the failing browser test**

Create a test that loads `/` and asserts:

```ts
await expect(
  page.getByRole("heading", { name: "LeetCode Coach foundation" }),
).toBeVisible();
await expect(
  page.getByText("Database connected", { exact: true }),
).toBeVisible();
await expect(
  page.locator('[data-foundation-status="connected"]'),
).toBeVisible();
```

Also assert that the page body does not contain `file:./dev.db`, `TURSO_AUTH_TOKEN`, or `libsql://`.

- [ ] **Step 3: Run the browser test and verify RED**

```bash
npm run test:e2e -- tests/e2e/foundation.spec.ts
```

Expected: FAIL because the static scaffold does not render `Database connected`.

- [ ] **Step 4: Implement the temporary server page**

Set:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

Call the service with `probeDatabase`. Render the heading in both states. Connected copy is `Database connected`; unavailable copy is `Foundation unavailable`. Put `data-foundation-status` on the status container. Do not render the result reason or any exception detail.

Style one calm, responsive, centered content region with CSS Modules and existing tokens. Do not add navigation, cards grids, gradients, or product controls.

- [ ] **Step 5: Document mandatory retirement**

Create `src/features/foundation/README.md` stating:

```markdown
# Foundation probe retirement

The root connectivity probe exists only for the Phase 1 Vercel/Turso walking skeleton.
Remove `src/app/page.tsx`, `src/app/page.module.css`, and the foundation connectivity
feature at the start of Phase 2, before adding product routes. A public route that runs
a database query on every request must not survive into the product workflow.
```

- [ ] **Step 6: Run RED to GREEN and all current checks**

```bash
npm run test:e2e -- tests/e2e/foundation.spec.ts
npm run lint
npm run typecheck
npm run build
```

Expected: all exit 0; Playwright starts and stops its own Next.js server and observes the connected local file path without leaking configuration.

- [ ] **Step 7: Commit the browser-visible skeleton**

```bash
git add tests/e2e src/app src/styles src/features/foundation/README.md
git commit -m "feat(foundation): render the temporary connectivity page"
```

### Task 5: Migration Guard and Operator Runbook

**Files:**

- Create: `scripts/migration-policy.test.ts`
- Create: `scripts/migration-policy.ts`
- Create: `scripts/migrate.ts`
- Create: `drizzle.config.ts`
- Create: `drizzle/README.md`
- Create: `.env.production.example`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `package-lock.json` only if scripts require a dependency change

**Interfaces:**

- Consumes: CLI target `local | production`, production confirmation flag, and target-specific environment file.
- Produces: `resolveMigrationRequest(args): MigrationRequest`, reviewed migration generation, protected local/production migration commands, and the complete Phase 1 operator runbook.

- [ ] **Step 1: Write failing migration-policy tests**

Cover:

```ts
expect(resolveMigrationRequest(["local"])).toEqual({
  target: "local",
  envFile: ".env.local",
});

expect(() => resolveMigrationRequest(["production"])).toThrow(
  "Production migration requires --confirm-production",
);

expect(resolveMigrationRequest(["production", "--confirm-production"])).toEqual(
  {
    target: "production",
    envFile: ".env.production.local",
  },
);

expect(() => resolveMigrationRequest(["preview"])).toThrow(
  "Migration target must be local or production",
);
```

- [ ] **Step 2: Run the policy test and verify RED**

```bash
npm test -- scripts/migration-policy.test.ts
```

Expected: FAIL because the migration policy does not exist.

- [ ] **Step 3: Implement policy and runner**

Implement only the tested argument policy. In `migrate.ts`:

1. Resolve the target.
2. Load exactly its environment file with `process.loadEnvFile`.
3. Require `MIGRATION_TARGET` to equal the selected target.
4. Parse database values with `parseDatabaseConfig`.
5. Require a `file:` URL for local and a non-`file:` URL plus token for production.
6. Run Drizzle's libSQL migrator against the committed `drizzle` directory.
7. Close the client in `finally`.

The script may print the selected target and success/failure category, but never URL, token, raw exception message, or environment values.

- [ ] **Step 4: Configure generation without a domain migration**

Configure Drizzle with:

```ts
defineConfig({
  dialect: "turso",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
```

Do not generate a migration because `schema.ts` intentionally contains no tables. `drizzle/README.md` records the required flow: schema change, `npm run db:generate`, human SQL review, commit schema and migration together, then explicit migration.

Create `.env.production.example` with placeholders only:

```dotenv
TURSO_DATABASE_URL=libsql://database-name.turso.io
TURSO_AUTH_TOKEN=replace-with-a-scoped-token
MIGRATION_TARGET=production
```

- [ ] **Step 5: Write the operator runbook**

README must document Node 24 via `.nvmrc`, install, local configuration, commands, architecture/module pattern, server-only rule, local migration, protected production migration invocation, Vercel Node `24.x` setting, Turso/Vercel environment variables, deploy verification, and Phase 2 probe retirement. State that the Vercel build command is only `npm run build` and never migrates.

- [ ] **Step 6: Run RED to GREEN and the complete local suite**

```bash
npm test -- scripts/migration-policy.test.ts
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Expected: every command exits 0. Do not commit if any warning indicates leaked configuration, an unhandled server error, or a browser-server lifecycle problem.

- [ ] **Step 7: Commit migration policy and operations documentation**

```bash
git add scripts drizzle.config.ts drizzle .env.production.example README.md package.json package-lock.json
git commit -m "chore(database): protect manual migration operations"
```

### Task 6: Vercel and Turso Walking-Skeleton Verification

**Files:**

- Modify only if reality differs: `README.md`
- No application or domain files should change merely to make deployment pass without first reproducing the issue locally.

**Interfaces:**

- Consumes: authenticated Vercel and Turso accounts, a Turso database, scoped auth token, and Vercel project settings.
- Produces: one verified production URL running Node.js `24.x` and displaying `Database connected` after a cold start.

- [ ] **Step 1: Verify deployment prerequisites without printing secrets**

Check Vercel authentication, Turso authentication, project linkage, and whether required token variables are present. Never echo token values. If authentication or account access is unavailable, record the exact missing prerequisite and stop only after all local tasks are green.

- [ ] **Step 2: Provision the walking-skeleton database**

Create one Turso database for the Phase 1 deployment and one scoped token. Record identifiers but never commit or print the token. No domain schema or table is created; connectivity uses `select 1`.

- [ ] **Step 3: Configure Vercel**

Link the repository to one Vercel project, set the Project Settings Node.js version to `24.x`, and configure `TURSO_DATABASE_URL` plus `TURSO_AUTH_TOKEN` as server-only environment variables for Production. Do not configure either with a `NEXT_PUBLIC_` prefix.

- [ ] **Step 4: Deploy without migrations**

Deploy using the normal Vercel Next.js build. Verify build logs contain no migration command and no secret values.

- [ ] **Step 5: Verify all six walking-skeleton checks**

Confirm:

1. Turso database exists.
2. Vercel server-only variables exist.
3. Production build completes without migrations.
4. A fresh request after an idle/cold start returns the page.
5. The page visibly says `Database connected`.
6. Build and runtime logs contain neither connection errors nor secret values.

Use the deployed URL in a Playwright assertion or direct HTTP plus rendered-page inspection. Do not add a permanent production-only test endpoint.

- [ ] **Step 6: Run fresh local verification after deployment**

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Expected: every command exits 0 on the exact deployed commit.

- [ ] **Step 7: Record deployment facts only if documentation changed**

If the runbook required a correction, verify lint, type-check, and build again, then commit:

```bash
git add README.md
git commit -m "docs(deploy): record the verified walking-skeleton flow"
```

Do not commit credentials, `.vercel` state containing secrets, database files, or generated reports.
