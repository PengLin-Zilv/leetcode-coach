# Phase 1 Foundation Design

**Status:** Approved on 2026-07-14

**Product sources:** [`CONTEXT.md`](../../../CONTEXT.md), [`VISUAL_WORKFLOW_DESIGN.md`](../../../VISUAL_WORKFLOW_DESIGN.md), and [`AGENTS.md`](../../../AGENTS.md)

## Purpose

Phase 1 establishes the smallest production-shaped foundation for LeetCode Coach before domain modeling begins. It proves that the chosen application, database, validation, testing, and deployment boundaries work together without introducing any training-domain tables or behavior.

Phase 1 ends after the local checks and both test suites pass and a server-rendered database connectivity page has been verified on Vercel against Turso. Domain modeling begins only after a separate entity specification is provided.

## Scope

Phase 1 includes:

- A Next.js modular monolith using the App Router, strict TypeScript, and the Node.js runtime.
- A repository `.nvmrc` containing `24`; the Vercel project uses Node.js `24.x`, and `package.json` does not hard-pin `engines.node`.
- React with CSS Modules and shared CSS custom-property tokens.
- Zod validation for environment configuration and every external input introduced in this phase.
- Drizzle ORM over `@libsql/client`, using `file:./dev.db` locally and Turso remotely.
- A server-rendered foundation page that performs a trivial `select 1` connectivity probe and displays a non-sensitive connected or unavailable result.
- Vitest coverage for foundation services and failure mapping.
- A Playwright browser test for the locally running foundation page.
- ESLint, formatting, type-check, production-build, unit-test, and browser-test commands.
- One early Vercel deployment connected to Turso to prove environment variables, a Node.js serverless cold start, and the remote libSQL connection.
- Version-controlled Drizzle migration tooling and protected commands, without creating a domain migration in this phase.

Phase 1 excludes:

- Profile, problem, attempt, correction, skill-state, recommendation, review, or other domain entities.
- Setup, Today, Practice, Reflection, Feedback, Progress, or MIND product behavior.
- A live LLM provider.
- Authentication, account UI, background jobs, analytics, and production migration automation.
- Tailwind, a component framework, a separate API service, or a client-side state library.

## Architecture

```text
Browser
  -> Next.js App Router page (server rendered, Node.js runtime)
      -> foundation connectivity service
          -> server-only Drizzle client
              -> @libsql/client
                  -> local file URL in development
                  -> Turso URL + token on Vercel
```

The application is one process and one deployable unit. Server Components render read models returned by server-only application services. Client Components, when later introduced, receive serialized data and never import database, environment, repository, or provider modules.

The connectivity page is an infrastructure probe, not a product screen or permanent health dashboard. It executes a parameter-free query through the production database path. It must not render the connection URL, auth token, exception details, database location, or timing metadata. It is removed at the start of Phase 2, before product routes are introduced; this retirement condition is recorded in the foundation module and project handoff.

## Module Boundaries

The initial source tree uses these responsibilities:

```text
src/
  app/                         Next.js routes, layout, metadata, and global styles
  config/                      server-only validated environment configuration
  db/                          server-only libSQL/Drizzle construction; empty schema boundary
  features/foundation/         connectivity use case and its view model
  styles/                      global design tokens
tests/e2e/                     Playwright browser checks
drizzle/                       generated, reviewed, version-controlled SQL migrations
```

Every sensitive module imports `server-only`; that import is the enforced build-time boundary. The `.server.ts` suffix is documentation only and must never be treated as enforcement. No shared barrel may re-export a server-only module to browser code. Database construction is centralized; route files do not instantiate clients or read secrets directly.

The database probe depends on a minimal interface it can fake in Vitest. This interface is local to the foundation feature and is not a speculative repository abstraction for future domain entities.

## Configuration Boundary

`TURSO_DATABASE_URL` is required in every environment:

- Local development and tests use a `file:` URL.
- Preview and production deployments use the provisioned remote Turso URL.

`TURSO_AUTH_TOKEN` is optional only for local `file:` URLs and required for remote URLs. A Zod schema validates this relationship when the server configuration is first accessed. Configuration errors become a sanitized foundation-unavailable result in the page; detailed validation diagnostics remain server-side.

Neither variable uses the `NEXT_PUBLIC_` prefix. Tests supply isolated configuration explicitly and do not inherit production credentials.

## Error Model

Expected failures use discriminated results rather than uncaught exceptions crossing into rendering code:

```text
connected
foundation_unavailable: invalid_configuration | database_unreachable | unexpected_database_response
```

The database adapter may throw library-specific errors. The foundation service catches them, records a sanitized server-side diagnostic, and returns `foundation_unavailable`. The browser sees actionable but non-sensitive copy. The page remains renderable when Turso is unavailable.

This Phase 1 error model is intentionally local. The later product error vocabulary will be defined with the domain and MIND specifications rather than inferred from the connectivity probe.

## Persistence and Migration Policy

Drizzle's TypeScript schema and generated SQL migrations are version controlled. Schema changes follow this sequence:

1. Change the schema deliberately.
2. Run `db:generate`.
3. Review the generated SQL as a required human gate.
4. Commit the schema and migration together.
5. Run `db:migrate` against the explicitly selected environment.

Production migration credentials are never loaded by the normal build or development commands. A production migration command requires an explicit production environment file or equivalent protected environment selection. Migrations do not run in `next build` or the Vercel build step.

Phase 1 creates the configuration and commands but no domain tables. The walking skeleton uses `select 1`, so deployment verification does not pre-empt the later entity specification.

## Trust Boundaries

All form, route, environment, and future provider payloads are untrusted until parsed by Zod at their server-side seam. TypeScript types do not substitute for runtime parsing.

The later MIND adapter will request provider-native structured output or JSON Schema when available, validate the raw response with Zod, make at most one bounded repair attempt using sanitized validation feedback, and otherwise return an honest unavailable result. Raw model output never reaches domain services or persistence. Tests always use a deterministic fake provider and never call a live LLM.

Recommendations remain deterministic application output. Their display reason will be templated from the same structured factors that selected the task; an LLM will not select or explain recommendations.

## Event and Identifier Policies for Later Phases

When the entity specification arrives, observed attempt and correction events will be immutable ground truth. MEMORY will be a rebuildable projection derived from those events. Attempt persistence must commit independently of downstream projection success; failed derivation cannot discard or overwrite the raw event.

Application-generated UUIDv7 text identifiers will be used for future persisted entities. IDs will be created before insertion, remain portable across SQLite and PostgreSQL, and preserve time locality better than UUIDv4. Phase 1 does not add an identifier package because it creates no entities.

## Styling Boundary

The project uses CSS Modules plus CSS custom properties and does not install Tailwind. Global CSS owns reset, typography defaults, accessibility defaults, and design tokens. Route- or feature-specific rules remain in colocated modules. The detailed product visuals remain governed by `VISUAL_WORKFLOW_DESIGN.md`; the foundation page uses only enough styling to prove the pipeline.

## Verification

Local completion requires fresh successful runs of:

- Formatting check
- ESLint
- TypeScript type-check
- Vitest
- Playwright against the real local application
- Next.js production build

The Vitest suite must cover a successful probe, invalid configuration, an unreachable database, and an unexpected query result without using the network. The Playwright suite must assert that the real page renders the connected state through the local libSQL file path. Playwright configuration owns a `webServer` that starts the application, so the suite never relies on an undocumented manually running process.

Walking-skeleton completion additionally requires:

1. A Turso database provisioned for the deployment.
2. Server-only database variables configured in Vercel.
3. A production deployment built without running migrations.
4. The deployed page loaded successfully after a cold start.
5. The page visibly reporting a successful remote database connection.
6. Deployment logs checked for secret leakage and connection errors.

If account access or credentials prevent deployment, all local work continues to completion, but Phase 1 remains explicitly incomplete until the deployed probe is observed.

## Source-Document Corrections

Before domain implementation, the product workflow documents should be aligned with the approved decisions:

- MVP navigation is `Today | Progress`; Account and avatar UI remain absent until accounts exist.
- Reflection submission atomically records the attempt event.
- Corrections are separate source events.
- MEMORY and review state are rebuildable projections of attempt and correction events, not model-authored state.

These corrections clarify existing intent and do not expand product scope.
