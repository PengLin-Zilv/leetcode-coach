# Phase 2 Adaptive Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one thin, persistent training loop in which setup produces a deterministic recommendation, an immutable attempt updates rebuildable Skill State, and the recorded evidence changes the next Today recommendation.

**Architecture:** Keep the Phase 1 Next.js modular monolith and its direction of dependency: App Router UI → application use cases → pure domain rules → server-only repositories → Drizzle/libSQL. Attempts and standalone Reflections are immutable source events; Skill State (“MEMORY”) is an atomically replaceable projection that is always recomputable from Attempts. MIND is a typed, Zod-validated seam with an honest unavailable production adapter and deterministic test fake; it never chooses a recommendation or writes Skill State.

**Tech Stack:** Node.js 24, npm, Next.js App Router, React, strict TypeScript, Zod, Drizzle ORM, `@libsql/client`, UUIDv7 via `uuid`, CSS Modules, Vitest, Playwright, ESLint, and Prettier.

## Global Constraints

- Product behavior remains governed by [`CONTEXT.md`](../../../CONTEXT.md), [`VISUAL_WORKFLOW_DESIGN.md`](../../../VISUAL_WORKFLOW_DESIGN.md), and [`AGENTS.md`](../../../AGENTS.md), with the final Phase 2 entity specification and seed addendum overriding their older Correction/blocker language.
- Remove the public Phase 1 connectivity probe before adding product routes. No permanent health or database-connectivity endpoint replaces it.
- Seed exactly 18 canonical patterns, the 21 prerequisite edges from the approved roadmap table, and all 150 problems from the user-provided NeetCode 150 JSON. Do not scrape, fetch, infer, or invent problem metadata.
- Commit the supplied JSON verbatim at `src/features/catalog/neetcode-150-list.json`. Its validated baseline is 18 groups, 150 unique titles, 150 unique LeetCode URLs, 28 Easy, 101 Medium, and 21 Hard.
- Map JSON groups `1-D Dynamic Programming` and `2-D Dynamic Programming` to canonical patterns `1-D DP` and `2-D DP`. Every other JSON group name matches its canonical pattern name.
- Problem `number` is nullable and every Phase 2 seed value is `null`. Ignore `nurl` after boundary validation. Persist `source = "neetcode-150"` and derive `estimated_minutes` only as `easy → 15`, `medium → 30`, `hard → 45`.
- Model Problem↔Pattern as many-to-many while inserting exactly one mapping per seeded problem in Phase 2.
- Use one mutable local-user Profile selected by a database-enforced singleton key. There is no authentication or account entity.
- There is no Correction entity or blocker field. Do not create a correction table, correction route, correction event, or blocker column.
- Attempt `highest_hint_level` is an integer from 0 through 4. Independent evidence is exactly `result = "solved"` and `highest_hint_level = 0`; `viewed_solution` or any hint level at least 1 is assisted.
- Presentation controls (`Simpler`, `Example`, `Trace it`) never change hint depth. Only a successfully returned next hint may increase it by one.
- Attempts and standalone Reflections expose insert-only repositories. Do not add application update/delete methods or SQLite-specific immutability triggers.
- Skill State has one row per pattern and persists `unseen | learning | practicing | reliable`. `review_due` is a derived display state, never stored mastery.
- `recent_success` is the count, from 0 through 3, of independent successes among the latest three attempts mapped to the pattern.
- `next_review_date` is nullable for unseen patterns. An assisted/failed latest attempt schedules +1 UTC day; an independent `practicing` result schedules +3 UTC days; an independent `reliable` result schedules +7 UTC days.
- `reliable` requires independent solves of at least two distinct problems. Repeating one problem does not produce reliable evidence.
- Define “today” as a UTC calendar date in Phase 2 because Profile has no timezone. Inject the clock into every rule or use case that reads time.
- Commit an Attempt before rebuilding Skill State. Projection failure returns a persisted-attempt result, never rolls back/replaces the event, and is retried by the next Today/Progress load or the Feedback retry action.
- The product Reflection screen is the structured Attempt submission. The standalone free-text Reflection entity remains domain/repository-only in Phase 2; no journal UI or Attempt foreign key is added.
- Recommendations are pure and deterministic. They enforce pattern prerequisites and session fit, prioritize due review, avoid immediate problem repetition when an alternative exists, and return structured factors plus display copy rendered from those exact factors.
- MIND has no live provider and no credential flag in Phase 2. Runtime always uses the honest unavailable adapter; Vitest injects the deterministic fake. Invalid or unavailable MIND writes no MIND Output and never blocks Attempt, Reflection, Skill State, or recommendation behavior.
- Every environment accessor, runtime database module, repository, and provider adapter imports `"server-only"`. A `.server.ts` suffix remains documentation only.
- Use CSS Modules and existing CSS custom properties only. Do not add Tailwind, a component framework, a client state library, an API service, authentication, background work, code execution, or analytics.
- Before each implementation commit run `npm run lint`, `npm run typecheck`, and `npm run build`. Commit schema and generated migration together. Use Conventional Commits in imperative mood and never force-push.

---

## File Map

```text
AGENTS.md                                             active engineering invariants aligned to Phase 2
CONTEXT.md                                            active product/data wording aligned to final entities
VISUAL_WORKFLOW_DESIGN.md                             workflow transitions aligned to no Correction/blocker
README.md                                             Phase 2 setup, seed, migration, architecture, and verification
package.json                                          UUID, seed, e2e, and MEMORY rebuild commands
package-lock.json                                     exact dependency graph
playwright.config.ts                                  isolated local libSQL browser target
vitest.config.ts                                      test-only server-only alias
.prettierignore                                       verbatim authoritative seed exclusion

drizzle/0000_adaptive_spine.sql                       reviewed first domain migration
drizzle/meta/0000_snapshot.json                       generated schema snapshot
drizzle/meta/_journal.json                            generated migration journal

scripts/catalog-seed.ts                               idempotent CLI database seed adapter
scripts/catalog-seed.test.ts                          real-libSQL seed count/idempotency proof
scripts/seed-catalog.ts                               protected local/production seed command
scripts/prepare-e2e.ts                                guarded migration/seed/reset for browser database
scripts/rebuild-memory.ts                             explicit projection repair command

src/app/layout.tsx                                    root metadata/global shell boundary
src/app/page.tsx                                      profile-aware redirect to Setup or Today
src/app/error.tsx                                     recoverable global error view
src/app/not-found.tsx                                 product not-found view
src/app/setup/page.tsx                                singleton Profile setup
src/app/setup/actions.server.ts                       validated Profile upsert
src/app/(primary)/layout.tsx                          Today/Progress navigation shell
src/app/(primary)/today/page.tsx                      primary recommendation screen
src/app/(primary)/today/loading.tsx                   stable recommendation loading state
src/app/(primary)/today/error.tsx                     deterministic retry state
src/app/(primary)/progress/page.tsx                   explainable evidence and due reviews
src/app/practice/actions.server.ts                    validated practice start
src/app/practice/[problemId]/page.tsx                 practice context and MIND panel
src/app/practice/[problemId]/actions.server.ts        typed hint request
src/app/practice/[problemId]/reflection/page.tsx      structured Attempt reflection screen
src/app/practice/[problemId]/reflection/actions.server.ts immutable Attempt submission
src/app/feedback/[attemptId]/page.tsx                 feedback, review cue, MEMORY delta
src/app/feedback/[attemptId]/actions.server.ts        explicit projection retry

src/components/app-shell.tsx                          shared primary navigation
src/components/primary-nav.tsx                        active-route aria-current navigation
src/components/submit-button.tsx                      pending accessible form action
src/components/app-shell.module.css                   shell/navigation styles

src/lib/id.ts                                         injectable UUIDv7 generator
src/lib/id.test.ts                                    UUID version/shape proof
src/lib/clock.ts                                      injectable system clock interface
src/lib/utc-date.ts                                   injected-clock UTC date arithmetic
src/lib/utc-date.test.ts                              date/review arithmetic proof
src/test/database.ts                                  isolated migrated libSQL test database
src/test/server-only.ts                               empty Vitest-only server guard alias

src/db/schema.ts                                      ten-table Drizzle domain schema
src/features/catalog/neetcode-150-list.json           verbatim authoritative seed input
src/features/catalog/roadmap.ts                       18 canonical patterns and 21 fixed edges
src/features/catalog/seed-data.ts                     Zod validation and deterministic mapping
src/features/catalog/seed-data.test.ts                authoritative seed-shape proof

src/features/training/contracts.ts                    Zod inputs and shared domain types
src/features/training/contracts.test.ts               form/event boundary validation
src/features/training/training-repository.ts          application persistence port
src/features/training/training-repository.server.ts   Drizzle implementation
src/features/training/training-repository.integration.test.ts real persistence proof
src/features/training/complete-attempt.ts             event-first completion use case
src/features/training/complete-attempt.test.ts        projection-failure isolation proof
src/features/training/adaptive-loop.integration.test.ts persisted two-Today proof

src/features/memory/project-skill-state.ts             pure Attempt→Skill State projection
src/features/memory/project-skill-state.test.ts        mastery/review/rebuild behavior
src/features/memory/rebuild-memory.server.ts           atomic 18-row projection replacement

src/features/recommendation/recommend-next.ts          deterministic eligibility/ranking
src/features/recommendation/recommend-next.test.ts     prerequisites/due/session/adaptation cases
src/features/recommendation/reason.ts                  factor-owned display templates
src/features/recommendation/reason.test.ts             exact factor/copy correspondence
src/features/recommendation/get-today.server.ts        read-model orchestration

src/features/mind/contracts.ts                         Zod schemas for hints and two output shapes
src/features/mind/contracts.test.ts                    raw-output rejection and shape proof
src/features/mind/gateway.ts                           provider-neutral typed port
src/features/mind/request-mind.ts                      parse/persist application seam
src/features/mind/request-mind.test.ts                 fake/invalid/unavailable behavior
src/features/mind/unavailable-gateway.server.ts        honest runtime adapter
src/features/mind/testing/fake-gateway.ts              deterministic test-only provider
src/features/mind/mind-output-repository.server.ts     validated MIND Output persistence
src/features/mind/mind-output-repository.integration.test.ts real shape/link persistence proof

src/features/setup/setup-form.tsx                      setup fields and validation display
src/features/setup/setup-form.module.css               setup styles
src/features/practice/active-practice.ts               untrusted cookie schema/state transitions
src/features/practice/active-practice.test.ts          start/hint/presentation invariants
src/features/practice/active-practice.server.ts        HTTP-only cookie adapter
src/features/practice/practice-session.tsx             timer/notes/mobile MIND client boundary
src/features/practice/practice-session.module.css      responsive 60/40 and sheet styles
src/features/attempt/attempt-reflection-form.tsx        short structured completion form
src/features/attempt/attempt-reflection-form.module.css reflection styles
src/features/feedback/get-feedback.server.ts           before/after MEMORY read model
src/features/feedback/feedback-summary.tsx             honest feedback rendering
src/features/feedback/feedback-summary.module.css      feedback styles
src/features/progress/get-progress.server.ts           explainable progress read model
src/features/progress/progress-summary.tsx             evidence rows and due reviews
src/features/progress/progress-summary.module.css      progress styles
src/features/today/today-recommendation.tsx            single-task Today view
src/features/today/today-recommendation.module.css     Today styles

tests/e2e/fixtures.ts                                  per-test isolated database reset
tests/e2e/support/database.ts                          guarded browser DB helpers
tests/e2e/support/scenarios.ts                         typed deterministic scenario builders
tests/e2e/setup-today.spec.ts                          setup persistence and first task
tests/e2e/practice.spec.ts                             notes/timer/hint-unavailable behavior
tests/e2e/adaptive-loop.spec.ts                        complete loop and changed next Today
tests/e2e/states.spec.ts                               loading/empty/error/long-text states
tests/e2e/responsive.spec.ts                           desktop/mobile/320px layout proof
tests/e2e/accessibility.spec.ts                        keyboard/focus/reduced-motion proof
```

### Task 1: Retire the Foundation Probe and Align Active Sources

**Files:**

- Modify: `AGENTS.md`
- Modify: `CONTEXT.md`
- Modify: `VISUAL_WORKFLOW_DESIGN.md`
- Modify: `src/app/page.tsx`
- Delete: `src/app/page.module.css`
- Delete: `src/db/probe.server.ts`
- Delete: `src/features/foundation/connectivity.ts`
- Delete: `src/features/foundation/connectivity.test.ts`
- Delete: `src/features/foundation/README.md`
- Delete: `tests/e2e/foundation.spec.ts`

**Interfaces:**

- Consumes: the Phase 1 retirement requirement and final Phase 2 entity/addendum decisions.
- Produces: no public query-on-load endpoint; `/` redirects to `/setup` until the profile-aware redirect is added; active product documents no longer instruct future work to create Correction or blocker data.

- [ ] **Step 1: Record the green Phase 1 baseline**

Run:

```bash
npm run verify
```

Expected: format, lint, type-check, all existing Vitest/Playwright tests, and build exit 0 before any deletion.

- [ ] **Step 2: Update only active source-of-truth wording**

Make these exact semantic corrections without rewriting historical Phase 1 specs/plans:

- `AGENTS.md`: Attempt evidence is result, duration, confidence, optional note, and highest hint level; remove Correction and blocker requirements; projection failure rebuilds from Attempts.
- `CONTEXT.md`: remove Correction from MEMORY and Minimal Data Model; identify Skill State as MEMORY; replace blocker evidence with highest hint level and optional note; describe standalone Reflection separately.
- `VISUAL_WORKFLOW_DESIGN.md`: remove blocker/correction controls and the “Corrects feedback” transition; state that the product Reflection screen submits one immutable Attempt and standalone journal Reflection has no Phase 2 UI.

- [ ] **Step 3: Remove the probe and replace the root behavior**

Delete every listed foundation/probe file and replace `src/app/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/setup");
}
```

- [ ] **Step 4: Verify retirement and document consistency**

Run:

```bash
rg -n "probeDatabase|checkFoundationConnectivity|Database connected" src tests
rg -n "Correction|blocker" AGENTS.md CONTEXT.md VISUAL_WORKFLOW_DESIGN.md
```

Expected: both commands return no matches. Historical approved Phase 1 documents may retain their historical language.

- [ ] **Step 5: Verify the green retirement**

Run:

```bash
npm run format
npm run lint
npm run typecheck
npm run build
```

Expected: all exit 0; the build contains `/` and no foundation feature.

- [ ] **Step 6: Commit the retirement**

```bash
git add -A -- AGENTS.md CONTEXT.md VISUAL_WORKFLOW_DESIGN.md src/app src/db/probe.server.ts src/features/foundation tests/e2e/foundation.spec.ts
git commit -m "refactor(foundation): retire the public database probe"
```

### Task 2: Domain Schema, UUIDv7, and First Migration

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/db/schema.ts`
- Create: `src/lib/id.ts`
- Create: `src/lib/id.test.ts`
- Create: `src/lib/clock.ts`
- Create: `src/lib/utc-date.ts`
- Create: `src/lib/utc-date.test.ts`
- Create: `src/features/training/contracts.ts`
- Create: `src/features/training/contracts.test.ts`
- Create via `db:generate`: `drizzle/0000_adaptive_spine.sql`
- Create via `db:generate`: `drizzle/meta/0000_snapshot.json`
- Create via `db:generate`: `drizzle/meta/_journal.json`
- Modify: `drizzle/README.md`

**Interfaces:**

- Consumes: application-supplied UUIDv7 IDs, UTC `Date` values, and untrusted form/event input.
- Produces: `createId(): string`, `IdGenerator = () => string`,
  `Clock = { now(): Date }`, `systemClock`, UTC date helpers, Zod schemas, and
  Drizzle exports for `profiles`, `patterns`, `patternPrerequisites`,
  `problems`, `problemPatterns`, `attempts`, `reflections`, `mindOutputs`,
  `mindOutputSourceAttempts`, and `skillStates`.

- [ ] **Step 1: Write failing ID, date, and boundary tests**

Cover these exact contracts:

```ts
import { version as uuidVersion } from "uuid";

expect(uuidVersion(createId())).toBe(7);
expect(toUtcDateKey(new Date("2026-07-14T23:30:00-04:00"))).toBe("2026-07-15");
expect(addUtcDays("2026-07-14", 3)).toBe("2026-07-17");

expect(
  attemptInputSchema.parse({
    problemId: createId(),
    result: "solved",
    durationMinutes: 15,
    confidence: 4,
    note: "Binary search invariant was clear.",
    highestHintLevel: 0,
    occurredAt: "2026-07-14T15:00:00.000Z",
  }),
).toMatchObject({ result: "solved", highestHintLevel: 0 });

expect(() =>
  attemptInputSchema.parse({
    problemId: createId(),
    result: "solved",
    durationMinutes: 15,
    highestHintLevel: 5,
    occurredAt: "2026-07-14T15:00:00.000Z",
  }),
).toThrow();
```

Also reject confidence outside 1–5, negative duration, empty Reflection body, invalid date/timestamp strings, and any Profile outside `sessionsPerWeek 1–7`, `minutesPerSession 15|30|45|60`, or `startingLevel new|some|reviewing`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npm test -- src/lib/id.test.ts src/lib/utc-date.test.ts src/features/training/contracts.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Install UUID support and implement shared boundaries**

Run:

```bash
npm install uuid@latest
```

Implement:

```ts
import { v7 as uuidv7 } from "uuid";

export type IdGenerator = () => string;

export const createId: IdGenerator = () => uuidv7();
```

Define `Clock`/`systemClock` in `src/lib/clock.ts` without reading time at module
load. Use Zod to export `profileInputSchema`, `attemptInputSchema`,
`reflectionInputSchema`, and their inferred immutable types. Use `z.iso.date()` and
`z.iso.datetime({ offset: true })`; normalize optional empty strings to `undefined`
before parsing.

- [ ] **Step 4: Define the exact ten-table schema**

Use text UUID primary keys without database defaults; integer `timestamp_ms` columns for timestamps; ISO `YYYY-MM-DD` text for dates; `ON DELETE RESTRICT` foreign keys; named checks and indexes.

| Table                         | Required columns and constraints                                                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                    | `id`; `singleton_key = 1` unique/check; `deadline`; `sessions_per_week 1..7`; `minutes_per_session IN (15,30,45,60)`; `starting_level IN ('new','some','reviewing')`                      |
| `patterns`                    | `id`; non-empty unique `name`; non-empty unique `slug`                                                                                                                                    |
| `pattern_prerequisites`       | composite PK (`pattern_id`, `prerequisite_pattern_id`); no-self check; prerequisite lookup index                                                                                          |
| `problems`                    | `id`; nullable positive/unique `number`; non-empty `title`; `difficulty`; unique `url`; `estimated_minutes`; non-empty `source`; check exact difficulty/minutes pairs                     |
| `problem_patterns`            | composite PK (`problem_id`, `pattern_id`); pattern lookup index                                                                                                                           |
| `attempts`                    | `id`; `problem_id`; result enum check; non-negative `duration_minutes`; nullable confidence 1..5; nullable `note`; hint 0..4; `occurred_at <= created_at`; problem/time index             |
| `reflections`                 | `id`; non-empty `body`; `occurred_at <= created_at`; occurred-time index; no Attempt FK                                                                                                   |
| `mind_outputs`                | `id`; `type`; non-empty `body`; nullable `attempt_id`/`pattern_id`; `generated_at`; nullable `model_meta`; shape check enforcing `single` has only Attempt and `pattern` has only Pattern |
| `mind_output_source_attempts` | composite PK (`mind_output_id`, `attempt_id`); attempt lookup index                                                                                                                       |
| `skill_states`                | `id`; unique `pattern_id`; mastery enum check; `recent_success 0..3`; nullable `next_review_date`; `last_computed_at`; unseen consistency check; due-date index                           |

Do not add Recommendation, Review, Correction, Session, AttemptDraft, source-tag, or projection-metadata tables. Keep `source` open to later non-empty tag values; enforce `neetcode-150` at the seed boundary instead of requiring a future schema migration.

- [ ] **Step 5: Run RED to GREEN before migration generation**

Run:

```bash
npm test -- src/lib/id.test.ts src/lib/utc-date.test.ts src/features/training/contracts.test.ts
npm run lint
npm run typecheck
```

Expected: all focused tests and checks exit 0.

- [ ] **Step 6: Generate and review the first domain migration**

Run:

```bash
npm run db:generate -- --name=adaptive_spine
```

Expected: Drizzle creates `drizzle/0000_adaptive_spine.sql` plus its journal/snapshot. Review every statement and confirm exactly ten tables, named PK/unique/check/FK/index objects, no dropped object, no seed data, no database URL/token, and no migration execution.

Update `drizzle/README.md` to identify `0000_adaptive_spine.sql` as the reviewed
first domain migration and retain the mandatory generate → human review → commit
schema plus SQL → explicit migrate sequence.

- [ ] **Step 7: Verify schema and migration together**

Run:

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all exit 0.

- [ ] **Step 8: Commit schema and generated SQL atomically**

```bash
git add package.json package-lock.json src/db/schema.ts src/lib src/features/training/contracts.ts src/features/training/contracts.test.ts drizzle
git commit -m "feat(database): add the adaptive spine schema"
```

### Task 3: Authoritative NeetCode 150 Catalog Seed

**Files:**

- Create: `src/features/catalog/neetcode-150-list.json`
- Create: `src/features/catalog/roadmap.ts`
- Create: `src/features/catalog/seed-data.ts`
- Create: `src/features/catalog/seed-data.test.ts`
- Create: `scripts/catalog-seed.ts`
- Create: `scripts/catalog-seed.test.ts`
- Create: `scripts/seed-catalog.ts`
- Create: `src/test/database.ts`
- Modify: `.prettierignore`
- Modify: `package.json`

**Interfaces:**

- Consumes: the supplied 18-group/150-problem JSON and `IdGenerator`.
- Produces: `buildCatalogSeed(raw: unknown): CatalogSeed`,
  `seedCatalog(database, seed, ids: IdGenerator, clock: Clock): Promise<void>`,
  and guarded `db:seed:local` / `db:seed:production` commands.

- [ ] **Step 1: Copy the authoritative file verbatim**

Create `src/features/catalog/neetcode-150-list.json` byte-for-byte from:

```text
/home/linpe/.codex/attachments/eff0a8cf-15f7-40eb-a2bb-2d0a9553faec/pasted-text.txt
```

Do not normalize, reorder, repair, or enrich the file.
Add its exact path to `.prettierignore` so repository-wide formatting does not
rewrite the authoritative input.

- [ ] **Step 2: Write failing seed-boundary tests**

Import the JSON as `unknown` and assert:

```ts
const seed = buildCatalogSeed(rawSeed);

expect(seed.patterns).toHaveLength(18);
expect(seed.prerequisites).toHaveLength(21);
expect(seed.problems).toHaveLength(150);
expect(seed.problemPatterns).toHaveLength(150);
expect(
  seed.problems.filter(({ difficulty }) => difficulty === "easy"),
).toHaveLength(28);
expect(
  seed.problems.filter(({ difficulty }) => difficulty === "medium"),
).toHaveLength(101);
expect(
  seed.problems.filter(({ difficulty }) => difficulty === "hard"),
).toHaveLength(21);
expect(new Set(seed.problems.map(({ title }) => title))).toHaveSize(150);
expect(new Set(seed.problems.map(({ url }) => url))).toHaveSize(150);
expect(
  seed.problems.find(({ title }) => title === "Contains Duplicate"),
).toMatchObject({
  number: null,
  difficulty: "easy",
  estimatedMinutes: 15,
  source: "neetcode-150",
});
expect(seed.groupAliases["1-D Dynamic Programming"]).toBe("1-d-dp");
expect(seed.groupAliases["2-D Dynamic Programming"]).toBe("2-d-dp");
```

Reject a missing URL, missing `nurl`, unknown group, duplicate title/URL, unknown difficulty, or count other than exactly 18/150.

- [ ] **Step 3: Run the boundary test and verify RED**

Run:

```bash
npm test -- src/features/catalog/seed-data.test.ts
```

Expected: FAIL because the roadmap and mapper do not exist.

- [ ] **Step 4: Implement canonical roadmap and deterministic mapping**

Export `PATTERN_DEFINITIONS` in this exact canonical order:

```text
arrays-hashing, two-pointers, stack, binary-search, sliding-window,
linked-list, trees, tries, heap-priority-queue, backtracking, intervals,
greedy, advanced-graphs, graphs, 1-d-dp, 2-d-dp,
bit-manipulation, math-geometry
```

Encode the approved 21 edges exactly. Parse the complete raw JSON with Zod before mapping. Preserve title and LeetCode URL, validate but discard `nurl`, lowercase difficulty, set number `null`, set source `neetcode-150`, and use:

```ts
export const PATTERN_DEFINITIONS = [
  { name: "Arrays & Hashing", slug: "arrays-hashing", prerequisites: [] },
  {
    name: "Two Pointers",
    slug: "two-pointers",
    prerequisites: ["arrays-hashing"],
  },
  { name: "Stack", slug: "stack", prerequisites: ["arrays-hashing"] },
  {
    name: "Binary Search",
    slug: "binary-search",
    prerequisites: ["two-pointers"],
  },
  {
    name: "Sliding Window",
    slug: "sliding-window",
    prerequisites: ["two-pointers"],
  },
  { name: "Linked List", slug: "linked-list", prerequisites: ["two-pointers"] },
  {
    name: "Trees",
    slug: "trees",
    prerequisites: ["binary-search", "linked-list"],
  },
  { name: "Tries", slug: "tries", prerequisites: ["trees"] },
  {
    name: "Heap / Priority Queue",
    slug: "heap-priority-queue",
    prerequisites: ["trees"],
  },
  { name: "Backtracking", slug: "backtracking", prerequisites: ["trees"] },
  {
    name: "Intervals",
    slug: "intervals",
    prerequisites: ["heap-priority-queue"],
  },
  { name: "Greedy", slug: "greedy", prerequisites: ["heap-priority-queue"] },
  {
    name: "Advanced Graphs",
    slug: "advanced-graphs",
    prerequisites: ["heap-priority-queue", "graphs"],
  },
  { name: "Graphs", slug: "graphs", prerequisites: ["backtracking"] },
  { name: "1-D DP", slug: "1-d-dp", prerequisites: ["backtracking"] },
  { name: "2-D DP", slug: "2-d-dp", prerequisites: ["graphs", "1-d-dp"] },
  {
    name: "Bit Manipulation",
    slug: "bit-manipulation",
    prerequisites: ["1-d-dp"],
  },
  {
    name: "Math & Geometry",
    slug: "math-geometry",
    prerequisites: ["2-d-dp", "bit-manipulation"],
  },
] as const;

export const ESTIMATED_MINUTES = {
  easy: 15,
  medium: 30,
  hard: 45,
} as const;
```

- [ ] **Step 5: Run the pure seed test GREEN**

Run:

```bash
npm test -- src/features/catalog/seed-data.test.ts
```

Expected: PASS with the exact counts and mappings above.

- [ ] **Step 6: Write the failing real-database idempotency test**

Use `createTestDatabase()` to migrate a unique temporary libSQL file, invoke
`seedCatalog` twice with the fixed clock
`2026-07-14T15:00:00.000Z`, and assert after both calls:

`createTestDatabase()` uses
`mkdtemp(join(tmpdir(), "leetcode-coach-test-"))`, opens only
`file:<temp-directory>/test.db`, enables/checks foreign keys, applies the committed
`drizzle` migrations, and returns `{ database, close }`. `close()` closes the
libSQL client and removes only that unique temporary directory.

```ts
expect(await rowCount(database, patterns)).toBe(18);
expect(await rowCount(database, patternPrerequisites)).toBe(21);
expect(await rowCount(database, problems)).toBe(150);
expect(await rowCount(database, problemPatterns)).toBe(150);
expect(await rowCount(database, skillStates)).toBe(18);
```

Also assert every initial Skill State is `unseen` with `recentSuccess = 0` and `nextReviewDate = null`.

- [ ] **Step 7: Run the integration test and verify RED**

Run:

```bash
npm test -- scripts/catalog-seed.test.ts
```

Expected: FAIL because the database seeder does not exist.

- [ ] **Step 8: Implement transactional, idempotent seeding**

In one transaction:

1. Upsert patterns by slug without replacing existing UUIDs.
2. Insert the 21 prerequisite edges with conflict-ignore.
3. Upsert problems by URL with authoritative title/difficulty/time/source and nullable number.
4. Synchronize each seeded problem to exactly its one Phase 2 pattern row while retaining the many-to-many schema.
5. Insert missing unseen Skill State rows by pattern ID without overwriting computed rows.

The CLI must reuse the existing explicit target/confirmation policy, parse only the selected environment file, close the client in `finally`, and log only stable counts/target—never URL, token, environment, or raw exception.

Add:

```json
{
  "db:seed:local": "tsx scripts/seed-catalog.ts local",
  "db:seed:production": "tsx scripts/seed-catalog.ts production"
}
```

- [ ] **Step 9: Run RED to GREEN and seed the local database**

Run:

```bash
npm test -- src/features/catalog/seed-data.test.ts scripts/catalog-seed.test.ts
npm run db:migrate:local
npm run db:seed:local
npm run db:seed:local
npm run lint
npm run typecheck
npm run build
```

Expected: tests pass; both seed runs report 18 patterns/21 edges/150 problems/150 mappings without duplication; all checks exit 0.

- [ ] **Step 10: Commit the source and seed path**

```bash
git add .prettierignore src/features/catalog src/test scripts/catalog-seed.ts scripts/catalog-seed.test.ts scripts/seed-catalog.ts package.json
git commit -m "feat(catalog): seed the authoritative NeetCode 150"
```

### Task 4: Pure Skill State Projection

**Files:**

- Create: `src/features/memory/project-skill-state.ts`
- Create: `src/features/memory/project-skill-state.test.ts`

**Interfaces:**

- Consumes: `PatternAttemptEvidence[]` plus an injected `now: Date`.
- Produces: `isIndependentSuccess(attempt): boolean`, `projectSkillState(input): ProjectedSkillState`, `projectAllSkillStates(input): ProjectedSkillState[]`, and `getSkillDisplayState(state, today): SkillDisplayState`.

- [ ] **Step 1: Write the failing mastery tests**

Cover these exact behaviors:

```ts
expect(project([])).toMatchObject({
  mastery: "unseen",
  recentSuccess: 0,
  nextReviewDate: null,
});

expect(project([solved({ highestHintLevel: 1 })])).toMatchObject({
  mastery: "learning",
  recentSuccess: 0,
  nextReviewDate: "2026-07-15",
});

expect(project([viewedSolution()])).toMatchObject({
  mastery: "learning",
  recentSuccess: 0,
});

expect(
  project([solved({ problemId: "one", highestHintLevel: 0 })]),
).toMatchObject({
  mastery: "practicing",
  recentSuccess: 1,
  nextReviewDate: "2026-07-17",
});

expect(
  project([
    solved({ problemId: "one", highestHintLevel: 0 }),
    solved({ problemId: "two", highestHintLevel: 0 }),
  ]),
).toMatchObject({
  mastery: "reliable",
  recentSuccess: 2,
  nextReviewDate: "2026-07-21",
});
```

Also prove two independent solves of the same problem remain `practicing`, a later failure pulls review to +1 day without erasing prior reliable evidence, only the latest three attempts contribute to `recentSuccess`, backdated events sort by `occurredAt` then ID, and `nextReviewDate <= today` derives `review_due`.

- [ ] **Step 2: Run the projection test and verify RED**

Run:

```bash
npm test -- src/features/memory/project-skill-state.test.ts
```

Expected: FAIL because the projection does not exist.

- [ ] **Step 3: Implement the minimal pure projection**

Use this classification:

```ts
const independent = attempts.filter(isIndependentSuccess);
const distinctIndependentProblems = new Set(
  independent.map(({ problemId }) => problemId),
).size;

const mastery =
  attempts.length === 0
    ? "unseen"
    : distinctIndependentProblems >= 2
      ? "reliable"
      : distinctIndependentProblems === 1
        ? "practicing"
        : "learning";
```

Compute the review date from the latest chronological attempt: +1 for non-independent, +3 for an independent practicing state, +7 for an independent reliable state. Do not read system time or mutate input arrays.
Set `lastComputedAt` from the injected `now` in every projected row.

- [ ] **Step 4: Run RED to GREEN and all current unit checks**

Run:

```bash
npm test -- src/features/memory/project-skill-state.test.ts
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all exit 0.

- [ ] **Step 5: Commit the projection rule**

```bash
git add src/features/memory
git commit -m "feat(memory): derive explainable skill state from attempts"
```

### Task 5: Deterministic Recommendation and Factor-Owned Copy

**Files:**

- Create: `src/features/recommendation/recommend-next.ts`
- Create: `src/features/recommendation/recommend-next.test.ts`
- Create: `src/features/recommendation/reason.ts`
- Create: `src/features/recommendation/reason.test.ts`

**Interfaces:**

- Consumes: `RecommendationInput = { profile, patterns, prerequisites, problems, skillStates, attempts, now }`.
- Produces: `recommendNext(input): RecommendationResult` and `formatRecommendationReason(factors): string`, where success contains exactly one Problem, one Pattern, structured `RecommendationFactors`, and copy generated from those factors.

- [ ] **Step 1: Write failing prerequisite and first-task tests**

Construct small fixtures with the approved roadmap semantics and assert:

```ts
const result = recommendNext(newUserInput);

expect(result).toMatchObject({
  status: "recommended",
  problem: {
    title: "Contains Duplicate",
    estimatedMinutes: 15,
  },
  pattern: { slug: "arrays-hashing" },
  factors: {
    kind: "prerequisite_building",
    sessionMinutes: 30,
  },
});

expect(
  recommendNext(
    withStates(newUserInput, {
      "arrays-hashing": "learning",
      "two-pointers": "unseen",
      "binary-search": "unseen",
    }),
  ),
).toMatchObject({
  status: "recommended",
  pattern: { slug: "arrays-hashing" },
});
```

The custom matcher may be replaced by direct discriminated-union assertions. Prove Binary Search remains ineligible until Two Pointers is reliable and Two Pointers remains ineligible until Arrays & Hashing is reliable.

- [ ] **Step 2: Write failing due-review, session-fit, and adaptation tests**

Assert:

1. A due reliable Arrays & Hashing review outranks a newly unlocked Two Pointers task.
2. A 15-minute profile never receives a 30/45-minute problem.
3. A just-attempted problem loses a tie when another fitting problem exists.
4. When Arrays & Hashing becomes reliable, the next roadmap pattern is Two Pointers before Stack.
5. `new` prefers Easy for unseen/learning; `some` prefers Medium then Easy; `reviewing` prefers Medium then Hard then Easy; `practicing` targets Medium.
6. Identical input and clock always return a byte-equivalent result.
7. Empty catalog returns `{ status: "unavailable", reason: "catalog_empty" }`; no fitting candidate returns `no_session_fit`.

- [ ] **Step 3: Write the failing reason-correspondence tests**

Use exact factors, not free-form recommendation text:

```ts
const recommendation = recommendNext(dueReviewInput);

expect(recommendation.status).toBe("recommended");
if (recommendation.status === "recommended") {
  expect(recommendation.reason).toBe(
    formatRecommendationReason(recommendation.factors),
  );
  expect(recommendation.reason).toBe(
    "Arrays & Hashing is due for review, and Contains Duplicate fits your 15-minute session.",
  );
}
```

Also snapshot exact `prerequisite_building`, `continue_pattern`, and `next_pattern` templates. Every noun/date/time in copy must be present in the factors object.

- [ ] **Step 4: Run the focused tests and verify RED**

Run:

```bash
npm test -- src/features/recommendation/recommend-next.test.ts src/features/recommendation/reason.test.ts
```

Expected: FAIL because the recommendation modules do not exist.

- [ ] **Step 5: Implement eligibility and the stable ranking tuple**

Build eligible patterns only when every direct prerequisite is `reliable`. Filter problems to `estimatedMinutes <= profile.minutesPerSession`. Rank remaining candidates lexicographically by:

```text
1. due review first
2. approved canonical roadmap index
3. learning/practicing focus before unseen, reliable-not-due last
4. distance from the deterministic target difficulty
5. not attempted in the latest session before attempted
6. earlier last-attempt time before later last-attempt time
7. problem title ascending
8. problem UUID ascending
```

The ID is only the final impossible-tie breaker; no random value or database row order may affect selection.

- [ ] **Step 6: Implement factor-owned reason templates**

Use a discriminated union:

```ts
export type RecommendationFactors =
  | {
      kind: "due_review";
      patternName: string;
      problemTitle: string;
      reviewDate: string;
      sessionMinutes: number;
    }
  | {
      kind: "prerequisite_building";
      patternName: string;
      problemTitle: string;
      unlocksPatternNames: readonly string[];
      sessionMinutes: number;
    }
  | {
      kind: "continue_pattern";
      patternName: string;
      problemTitle: string;
      mastery: "learning" | "practicing";
      sessionMinutes: number;
    }
  | {
      kind: "next_pattern";
      patternName: string;
      problemTitle: string;
      sessionMinutes: number;
    };
```

Do not accept an arbitrary reason string as input and do not call MIND.

- [ ] **Step 7: Run RED to GREEN and the current suite**

Run:

```bash
npm test -- src/features/recommendation/recommend-next.test.ts src/features/recommendation/reason.test.ts
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all exit 0 and all four reason shapes are exact.

- [ ] **Step 8: Commit deterministic selection**

```bash
git add src/features/recommendation
git commit -m "feat(recommendation): select one explainable next problem"
```

### Task 6: Server-Only Persistence and the Persisted Adaptation Loop

**Files:**

- Create: `src/features/training/training-repository.ts`
- Create: `src/features/training/training-repository.server.ts`
- Create: `src/features/training/training-repository.integration.test.ts`
- Create: `src/features/training/complete-attempt.ts`
- Create: `src/features/training/complete-attempt.test.ts`
- Create: `src/features/training/adaptive-loop.integration.test.ts`
- Create: `src/features/memory/rebuild-memory.server.ts`
- Create: `src/features/recommendation/get-today.server.ts`
- Create: `src/test/server-only.ts`
- Create: `scripts/rebuild-memory.ts`
- Modify: `vitest.config.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: parsed Profile/Attempt/Reflection input, `IdGenerator`, injected clock, pure projection, and pure recommendation.
- Produces: insert-only event methods, Profile upsert/read, catalog/read models,
  `rebuildMemory(): Promise<readonly SkillState[]>`,
  `completeAttempt(dependencies, input): Promise<CompleteAttemptResult>`, and
  `getTodayRecommendation(): Promise<RecommendationResult>`. The server adapter
  exports `createTrainingRepository(database): TrainingRepository` for injected
  integration tests and `getTrainingRepository(): TrainingRepository` for runtime.

- [ ] **Step 1: Define the application persistence port**

The pure port must expose no Drizzle/libSQL types:

```ts
export interface TrainingRepository {
  getProfile(): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;
  getPatterns(): Promise<readonly Pattern[]>;
  getPrerequisites(): Promise<readonly PatternPrerequisite[]>;
  getProblems(): Promise<readonly Problem[]>;
  getProblemPatterns(): Promise<readonly ProblemPattern[]>;
  getAttempts(): Promise<readonly Attempt[]>;
  getAttempt(id: string): Promise<Attempt | null>;
  insertAttempt(attempt: Attempt): Promise<void>;
  insertReflection(reflection: Reflection): Promise<void>;
  getSkillStates(): Promise<readonly SkillState[]>;
  replaceSkillStates(states: readonly SkillState[]): Promise<void>;
}
```

`insertAttempt` and `insertReflection` are the only event write methods. Do not expose update/delete/upsert for either event.

- [ ] **Step 2: Write the failing event-first use-case test**

Inject fakes and force projection replacement to fail:

```ts
const result = await completeAttempt(
  {
    repository,
    ids: deterministicIds(),
    clock: fixedClock("2026-07-14T15:00:00.000Z"),
    rebuildMemory: async () => {
      throw new Error("projection failed");
    },
  },
  validAttemptInput,
);

expect(result).toEqual({
  status: "completed",
  attemptId: "0190f6f5-9b5a-7a22-8c44-123456789abc",
  memory: { status: "stale", reason: "projection_failed" },
});
expect(repository.attempts).toHaveLength(1);
expect(repository.attempts[0]?.result).toBe("solved");
```

Also assert validation failure writes nothing and successful completion returns
`memory: { status: "updated" }`.

- [ ] **Step 3: Run the use-case test and verify RED**

Run:

```bash
npm test -- src/features/training/complete-attempt.test.ts
```

Expected: FAIL because the port/use case do not exist.

- [ ] **Step 4: Implement the event-first use case**

The order is mandatory:

```ts
await dependencies.repository.insertAttempt(attempt);

try {
  await dependencies.rebuildMemory();
  return {
    status: "completed",
    attemptId: attempt.id,
    memory: { status: "updated" },
  };
} catch {
  return {
    status: "completed",
    attemptId: attempt.id,
    memory: { status: "stale", reason: "projection_failed" },
  };
}
```

Never read or derive Skill State before the Attempt commit, and never wrap Attempt
insertion and projection replacement in the same transaction. Feedback derives its
before/after delta later by excluding/including the persisted Attempt.

- [ ] **Step 5: Write failing real-repository tests**

Against `createTestDatabase()`, prove:

- Profile upsert leaves exactly one row and retains its UUID on update.
- Attempt and Reflection rows reload with all optional/null values intact.
- Backdated `occurredAt` is retained while `createdAt` uses the injected current time.
- No repository update/delete event method exists (enforced by TypeScript port plus runtime row assertions).
- `replaceSkillStates` atomically upserts exactly 18 rows and preserves existing Skill State IDs.
- Foreign keys reject an Attempt for a missing Problem.

- [ ] **Step 6: Run the repository test and verify RED**

Run:

```bash
npm test -- src/features/training/training-repository.integration.test.ts
```

Expected: FAIL because the server-only Drizzle adapter does not exist.

- [ ] **Step 7: Implement the server-only repositories and rebuild**

Every runtime repository file starts with:

```ts
import "server-only";
```

Because Vitest runs in Node rather than Next's React-server condition, alias only the
`server-only` package to the empty `src/test/server-only.ts` module in
`vitest.config.ts`. Production/build resolution must continue using the real package,
so client-bundle imports still fail at build time.

```ts
// src/test/server-only.ts
export {};

// vitest.config.ts
resolve: {
  alias: {
    "server-only": fileURLToPath(
      new URL("./src/test/server-only.ts", import.meta.url),
    ),
  },
},
```

`rebuildMemory` must read all patterns, problem mappings, and Attempts; run `projectAllSkillStates`; then replace/upsert the complete 18-row projection in one database transaction. Preserve an existing row ID by Pattern and generate UUIDv7 only for a missing row. Today and Progress call this rebuild before reading state, making a stale projection self-healing without a worker/outbox.

Add exact operator scripts:

```json
{
  "memory:rebuild:local": "tsx scripts/rebuild-memory.ts local",
  "memory:rebuild:production": "tsx scripts/rebuild-memory.ts production"
}
```

Production invocation requires `--confirm-production` through the existing protected
target policy.

- [ ] **Step 8: Write the failing persisted adaptive-loop integration test**

Using the real migrated/seeded temporary database:

1. Save a `new` Profile with a 30-minute session.
2. Assert first Today recommends `Contains Duplicate` for `arrays-hashing`.
3. Persist an independent solve for that recommendation and rebuild.
4. Recreate repositories/services as a reload would.
5. Assert MEMORY is `practicing` and second Today recommends a different Arrays & Hashing problem/reason.
6. Persist an independent solve for that distinct problem.
7. Assert Arrays & Hashing becomes `reliable` and the third Today selects `Valid Palindrome` from Two Pointers.

- [ ] **Step 9: Run the persisted proof RED to GREEN**

Run:

```bash
npm test -- src/features/training/complete-attempt.test.ts src/features/training/training-repository.integration.test.ts src/features/training/adaptive-loop.integration.test.ts
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all exit 0; the second recommendation differs after one persisted event, and the third crosses the legitimate prerequisite boundary after two distinct independent solves.

- [ ] **Step 10: Commit the persisted adaptive spine**

```bash
git add src/features/training src/features/memory/rebuild-memory.server.ts src/features/recommendation/get-today.server.ts src/test/server-only.ts scripts/rebuild-memory.ts vitest.config.ts package.json
git commit -m "feat(training): persist attempts before rebuilding memory"
```

#### Scope-fallback checkpoint

At this point the schema/migration, authoritative seed, deterministic rules, Attempts, standalone Reflections, Skill State, and two changed Today cycles are proven with real libSQL. If the execution budget requires the approved fallback, stop only after this commit, tick Tasks 1–6 accurately, and report: `Resume at Task 7: typed MIND boundary.`

### Task 7: Typed MIND Boundary, Test Fake, and Honest Unavailability

**Files:**

- Create: `src/features/mind/contracts.ts`
- Create: `src/features/mind/contracts.test.ts`
- Create: `src/features/mind/gateway.ts`
- Create: `src/features/mind/request-mind.ts`
- Create: `src/features/mind/request-mind.test.ts`
- Create: `src/features/mind/unavailable-gateway.server.ts`
- Create: `src/features/mind/testing/fake-gateway.ts`
- Create: `src/features/mind/mind-output-repository.server.ts`
- Create: `src/features/mind/mind-output-repository.integration.test.ts`

**Interfaces:**

- Consumes: compact typed hint/feedback requests and raw `unknown` provider responses.
- Produces: `MindGateway`,
  `requestPracticeHint(dependencies, input): Promise<PracticeHintResult>`,
  `requestAttemptFeedback(dependencies, input): Promise<MindOutputResult>`,
  validated `single | pattern` outputs, deterministic test fake, and runtime
  unavailable results.

- [ ] **Step 1: Write failing contract tests**

Define and test:

```ts
const single = mindOutputSchema.parse({
  type: "single",
  body: "State the invariant before moving either boundary.",
  attemptId,
});

const pattern = mindOutputSchema.parse({
  type: "pattern",
  body: "Boundary updates are the repeated failure mode.",
  patternId,
  sourceAttemptIds: [attemptOne, attemptTwo],
});

expect(single.type).toBe("single");
expect(pattern.type).toBe("pattern");
```

Reject `single` with Pattern/source IDs, `pattern` with Attempt ID, both IDs, neither ID, empty body, malformed UUID, invalid hint depth, or additional unrecognized keys.

- [ ] **Step 2: Write failing gateway behavior tests**

Using only `FakeMindGateway` and an in-memory output repository, prove:

1. A valid per-Attempt response is Zod-parsed before persistence.
2. A valid Pattern response persists source Attempt links atomically.
3. Invalid raw output returns `{ status: "unavailable", reason: "invalid_response" }` and writes nothing.
4. Unavailable provider returns its honest reason and writes nothing.
5. Either failure leaves Attempt count and Skill State byte-equivalent.
6. A practice presentation request does not increase hint depth; a successful next-hint response increases it by exactly one.
7. The real repository inserts a `single` row only with an Attempt, inserts a
   `pattern` row plus source links in one transaction, and rejects source links for a
   `single` output.

- [ ] **Step 3: Run the MIND tests and verify RED**

Run:

```bash
npm test -- src/features/mind/contracts.test.ts src/features/mind/request-mind.test.ts src/features/mind/mind-output-repository.integration.test.ts
```

Expected: FAIL because no MIND boundary exists.

- [ ] **Step 4: Implement the narrow gateway and parse seam**

Use:

```ts
export interface MindGateway {
  requestHint(input: PracticeHintRequest): Promise<MindGatewayResult>;
  requestAttemptFeedback(
    input: AttemptFeedbackRequest,
  ): Promise<MindGatewayResult>;
}

export type MindGatewayResult =
  | { readonly status: "received"; readonly raw: unknown }
  | {
      readonly status: "unavailable";
      readonly reason: "not_configured" | "timeout" | "rate_limited";
    };

export type MindOutputResult =
  | { readonly status: "stored"; readonly outputId: string }
  | {
      readonly status: "unavailable";
      readonly reason:
        "not_configured" | "timeout" | "rate_limited" | "invalid_response";
    };

export type PracticeHintResult =
  | {
      readonly status: "hint";
      readonly body: string;
      readonly hintLevel: 1 | 2 | 3 | 4;
    }
  | {
      readonly status: "unavailable";
      readonly reason:
        "not_configured" | "timeout" | "rate_limited" | "invalid_response";
    };
```

`request-mind.ts` owns Zod parsing and is the only code allowed to pass parsed output to persistence. Do not implement credentials, provider SDKs, schema repair, retries, or network calls; those begin with the future live-provider task.

- [ ] **Step 5: Implement runtime/fake separation**

`UnavailableMindGateway` always returns `not_configured` and begins with `import "server-only"`. `FakeMindGateway` lives under `testing/`, accepts explicit raw fixtures, and is imported only from tests. No environment flag may select it at runtime.

- [ ] **Step 6: Run RED to GREEN and all current checks**

Run:

```bash
npm test -- src/features/mind/contracts.test.ts src/features/mind/request-mind.test.ts src/features/mind/mind-output-repository.integration.test.ts
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all exit 0; no test makes a network request.

- [ ] **Step 7: Commit the trustworthy MIND seam**

```bash
git add src/features/mind
git commit -m "feat(mind): add a validated unavailable coaching seam"
```

### Task 8: Isolated Browser Database, Setup, and Today

**Files:**

- Modify: `package.json`
- Modify: `playwright.config.ts`
- Modify: `src/app/page.tsx`
- Create: `src/app/error.tsx`
- Create: `src/app/not-found.tsx`
- Create: `src/app/setup/page.tsx`
- Create: `src/app/setup/actions.server.ts`
- Create: `src/app/(primary)/layout.tsx`
- Create: `src/app/(primary)/today/page.tsx`
- Create: `src/app/(primary)/today/loading.tsx`
- Create: `src/app/(primary)/today/error.tsx`
- Create: `src/components/app-shell.tsx`
- Create: `src/components/primary-nav.tsx`
- Create: `src/components/app-shell.module.css`
- Create: `src/components/submit-button.tsx`
- Create: `src/features/setup/setup-form.tsx`
- Create: `src/features/setup/setup-form.module.css`
- Create: `src/features/today/today-recommendation.tsx`
- Create: `src/features/today/today-recommendation.module.css`
- Create: `scripts/prepare-e2e.ts`
- Create: `tests/e2e/support/database.ts`
- Create: `tests/e2e/support/scenarios.ts`
- Create: `tests/e2e/fixtures.ts`
- Create: `tests/e2e/setup-today.spec.ts`

**Interfaces:**

- Consumes: the server-only `TrainingRepository` and `getTodayRecommendation()`.
- Produces: profile-aware root routing, validated Setup action, one-primary-task Today screen, and a fresh migrated/seeded local browser database for every spec.

- [ ] **Step 1: Guard and configure the browser database**

`scripts/prepare-e2e.ts` and `tests/e2e/support/database.ts` must refuse any URL that is remote, equals `file:./dev.db`, or is outside `file:./test-results/`. They migrate, clear rows in FK-safe order, and reuse `seedCatalog`; they never expose a reset HTTP route.

Update Playwright to:

```ts
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev:e2e",
    url: "http://127.0.0.1:3100/setup",
    reuseExistingServer: false,
    env: {
      ...process.env,
      TURSO_DATABASE_URL: "file:./test-results/leetcode-coach-e2e.db",
    },
  },
});
```

Add exact package scripts:

```json
{
  "e2e:prepare": "tsx scripts/prepare-e2e.ts",
  "dev:e2e": "npm run e2e:prepare && next dev --hostname 127.0.0.1 --port 3100"
}
```

The automatic fixture resets Profile, Attempts, Reflections, MIND Outputs, and
Skill State before each test, then reseeds 18/150.

- [ ] **Step 2: Write the failing Setup→Today browser test**

Assert a blank profile routes `/` to `/setup`, then:

```ts
await page.getByLabel("Interview date").fill("2099-08-31");
await page.getByLabel("Sessions each week").selectOption("4");
await page.getByLabel("Minutes per session").selectOption("30");
await page.getByLabel("Starting point").selectOption("new");
await page.getByRole("button", { name: "Build my first session" }).click();

await expect(page).toHaveURL(/\/today$/);
await expect(
  page.getByRole("heading", { name: "Contains Duplicate" }),
).toBeVisible();
await expect(page.getByText(/fits your 30-minute session/i)).toBeVisible();
```

Reload and assert Setup does not reappear and the same recommendation/reason persists.

- [ ] **Step 3: Run the browser test and verify RED**

Run:

```bash
npm run test:e2e -- tests/e2e/setup-today.spec.ts
```

Expected: FAIL because Setup/Today routes do not exist.

- [ ] **Step 4: Implement validated Setup and profile-aware routing**

`saveProfileAction(formData)` parses plain values with `profileInputSchema`, returns field-level errors without echoing unexpected input, creates a UUIDv7 only when no singleton Profile exists, upserts by `singleton_key`, revalidates `/`/`/today`/`/progress`, then redirects `/today`.

`/` checks Profile and redirects `/setup` or `/today`. The primary route-group layout redirects a missing profile to Setup and renders only `Today | Progress` navigation.
Every action module begins with `"use server";` followed by
`import "server-only";`. `PrimaryNav` is the narrow Client Component that reads the
current pathname and supplies `aria-current="page"`.

- [ ] **Step 5: Implement the thin Today read model**

Call `getTodayRecommendation` from a dynamic Node.js Server Component. Render one heading/problem, Pattern, difficulty, target time, exact reason, external-free Start form, deadline context, and optional due-review count. Render no task grid, Account/avatar, fake metrics, or MIND copy.

`loading.tsx` preserves the same main dimensions with an inline status. `error.tsx` is a Client Component with a Retry button and no exception details. Deadline passed routes back to Setup with an actionable message.
An expected `catalog_empty` or `no_session_fit` result renders the stable Today
layout with concise deterministic copy and a Retry action; it must not throw merely
to reach `error.tsx`.

- [ ] **Step 6: Run RED to GREEN and current checks**

Run:

```bash
npm run test:e2e -- tests/e2e/setup-today.spec.ts
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all exit 0; browser data lives only under ignored `test-results`.

- [ ] **Step 7: Commit Setup and one-task Today**

```bash
git add package.json playwright.config.ts scripts/prepare-e2e.ts src/app src/components src/features/setup src/features/today tests/e2e
git commit -m "feat(workflow): turn setup into one recommended task"
```

### Task 9: Practice Session, Local Draft, and Progressive-Hint State

**Files:**

- Create: `src/app/practice/actions.server.ts`
- Create: `src/app/practice/[problemId]/page.tsx`
- Create: `src/app/practice/[problemId]/actions.server.ts`
- Create: `src/features/practice/active-practice.ts`
- Create: `src/features/practice/active-practice.test.ts`
- Create: `src/features/practice/active-practice.server.ts`
- Create: `src/features/practice/practice-session.tsx`
- Create: `src/features/practice/practice-session.module.css`
- Create: `tests/e2e/practice.spec.ts`
- Modify: `src/features/today/today-recommendation.tsx`

**Interfaces:**

- Consumes: current recommendation, catalog Problem, typed `MindGateway`, and untrusted active-practice cookie/local draft state.
- Produces: `startPracticeAction`, `requestHintAction`, `ActivePractice` cookie state, locally autosaved notes, quiet timer, external LeetCode link, and honest MIND-unavailable behavior.

- [ ] **Step 1: Write failing active-practice reducer tests**

Use an injected clock and assert:

```ts
expect(startPractice(problemId, now)).toEqual({
  problemId,
  startedAt: now.toISOString(),
  highestHintLevel: 0,
});

expect(
  applyPracticeEvent(active, { type: "presentation_changed", mode: "simpler" }),
).toEqual(active);

expect(
  applyPracticeEvent(active, {
    type: "hint_received",
    hintLevel: 1,
  }).highestHintLevel,
).toBe(1);

expect(() =>
  applyPracticeEvent(active, { type: "hint_received", hintLevel: 3 }),
).toThrow();
```

Also reject malformed/extra cookie fields, invalid UUIDs, route/cookie Problem mismatch, start times in the future, and levels outside 0–4.

- [ ] **Step 2: Run the reducer test and verify RED**

Run:

```bash
npm test -- src/features/practice/active-practice.test.ts
```

Expected: FAIL because active-practice state does not exist.

- [ ] **Step 3: Implement validated transient practice state**

Store only:

```ts
export interface ActivePractice {
  readonly problemId: string;
  readonly startedAt: string;
  readonly highestHintLevel: 0 | 1 | 2 | 3 | 4;
}
```

The `lc_active_practice` cookie is `httpOnly`, `sameSite: "lax"`, `path: "/"`, and `secure` only in production. Parse it with Zod on every read. It is transient navigation state, not training truth.

`startPracticeAction` must parse Problem ID and authorize it as either the current
deterministic Today recommendation or one of Progress's currently due-review
Problems. It then sets a fresh cookie at server time and redirects to
`/practice/[problemId]`. It creates no Attempt.

- [ ] **Step 4: Write the failing Practice browser test**

After Setup, start the recommended task and assert:

- Practice heading/Pattern/time are visible.
- “Open problem on LeetCode” uses the seeded URL, `target="_blank"`, and `rel` containing `noopener`.
- Notes survive a full Practice-page reload from localStorage.
- “Give me a hint” returns visible “Coaching is temporarily unavailable” without blocking “End attempt.”
- `Simpler`, `Example`, and `Trace it` remain usable presentation controls but never claim a deeper hint.
- The timer is visible, has no assertive live region, and does not disable completion.

- [ ] **Step 5: Run the browser test and verify RED**

Run:

```bash
npm run test:e2e -- tests/e2e/practice.spec.ts
```

Expected: FAIL because Practice routes/components do not exist.

- [ ] **Step 6: Implement Practice and honest MIND failure**

`requestHintAction` validates the route ID and active cookie, calls only `UnavailableMindGateway` at runtime, and returns:

```ts
type HintActionResult =
  | { status: "hint"; body: string; hintLevel: 1 | 2 | 3 | 4 }
  | { status: "unavailable"; message: "Coaching is temporarily unavailable" };
```

Only the `hint` branch may advance and rewrite the HTTP-only cookie, and only by one level. Invalid/unavailable output writes no cookie level, Attempt, MIND Output, or Skill State.

The Client Component stores notes at `leetcode-coach:practice:<problemId>:<startedAt>` and restores them after reload. Use a stable desktop 60/40 layout; below the mobile breakpoint, open MIND as a full-height labelled sheet while keeping End attempt reachable.

- [ ] **Step 7: Run RED to GREEN and current checks**

Run:

```bash
npm test -- src/features/practice/active-practice.test.ts
npm run test:e2e -- tests/e2e/practice.spec.ts
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all exit 0; browser completion works while MIND is unavailable.

- [ ] **Step 8: Commit the focused Practice experience**

```bash
git add src/app/practice src/features/practice src/features/today/today-recommendation.tsx tests/e2e/practice.spec.ts
git commit -m "feat(practice): preserve work while coaching is unavailable"
```

### Task 10: Attempt Reflection and Feedback

**Files:**

- Create: `src/app/practice/[problemId]/reflection/page.tsx`
- Create: `src/app/practice/[problemId]/reflection/actions.server.ts`
- Create: `src/app/feedback/[attemptId]/page.tsx`
- Create: `src/app/feedback/[attemptId]/actions.server.ts`
- Create: `src/features/attempt/attempt-reflection-form.tsx`
- Create: `src/features/attempt/attempt-reflection-form.module.css`
- Create: `src/features/feedback/get-feedback.server.ts`
- Create: `src/features/feedback/feedback-summary.tsx`
- Create: `src/features/feedback/feedback-summary.module.css`
- Create: `src/features/practice/clear-practice-draft.tsx`
- Create: `tests/e2e/adaptive-loop.spec.ts`

**Interfaces:**

- Consumes: active-practice cookie, local note draft, `completeAttempt`, optional validated per-Attempt MIND feedback, and current/recomputed Skill State.
- Produces: a sub-30-second structured Attempt form, persisted event, honest feedback, review cue, before/after MEMORY delta, and Finish→Today.

- [ ] **Step 1: Write the failing complete-loop browser test**

Execute:

```text
Setup → Today → Start session → Practice → End attempt
→ Reflection → Feedback → reload Feedback → Progress (later task)
→ Finish → next Today
```

For this task assert through Feedback/next Today:

```ts
await page.getByLabel("Solved").check();
await page.getByLabel("Confidence").selectOption("4");
await page.getByLabel("Optional note").fill("Used the set invariant.");
await page.getByRole("button", { name: "Review this attempt" }).click();

await expect(page).toHaveURL(/\/feedback\//);
await expect(page.getByText("Memory updated")).toBeVisible();
await expect(page.getByText(/Unseen → Practicing/)).toBeVisible();
await expect(page.getByText(/Review .* in 3 days/)).toBeVisible();
await expect(
  page.getByText(/Coaching is temporarily unavailable/),
).toBeVisible();
```

Reload Feedback and assert the Attempt/MEMORY delta remains identical. Finish and assert next Today shows a different problem and a reason matching its displayed factors.

- [ ] **Step 2: Run the loop test and verify RED**

Run:

```bash
npm run test:e2e -- tests/e2e/adaptive-loop.spec.ts
```

Expected: FAIL because Reflection/Feedback routes do not exist.

- [ ] **Step 3: Implement the structured Attempt Reflection screen**

Render only:

- `Solved` → `solved`
- `Not solved yet` → `not_solved`
- `Viewed solution` → `viewed_solution`
- optional confidence 1–5
- optional note restored from the local draft

Do not render blocker, Correction, mastery self-rating, or standalone Reflection
body. Explain that `solved` is independent only when the server-owned
`highestHintLevel` is zero.

`submitAttemptReflectionAction` must:

1. Parse form data and active cookie.
2. Require route/cookie Problem match.
3. Compute
   `durationMinutes = min(180, max(1, ceil((now - startedAt) / 60_000)))`.
4. Set `occurredAt`/`createdAt` from the injected server clock.
5. Call `completeAttempt`, which commits the Attempt before projection.
6. Request optional MIND single feedback only after the Attempt exists; runtime unavailable writes nothing.
7. Clear the HTTP-only cookie only after Attempt commit.
8. Redirect to `/feedback/[attemptId]` even when MEMORY is stale or MIND is unavailable.

- [ ] **Step 4: Implement reload-safe Feedback**

`getFeedback` loads the persisted Attempt and derives:

- before Skill State by projecting all mapped Attempts except this Attempt;
- after/current Skill State from all Attempts;
- exact MEMORY transition;
- review date/cue from after state;
- validated MIND single output when one exists, otherwise honest unavailable copy.

Do not invent a correction. Deterministic text may state observed facts (“Solved independently in 15 minutes”) and the review cue; coaching advice appears only from a validated MIND Output.

When MEMORY is stale, render the persisted Attempt, an explicit “Memory update pending” status, and `retryMemoryProjectionAction`. Retry rebuilds from Attempts, revalidates Today/Progress/Feedback, and never modifies the Attempt.

Determine staleness without transient redirect state: for every Pattern mapped to the
Attempt, MEMORY is stale when its row is missing or
`skillState.lastComputedAt < attempt.createdAt`.

`ClearPracticeDraft` removes the matching localStorage note only after the persisted Feedback page mounts.
Feedback renders primary `Finish` → Today and secondary `View progress` links so the
required browser sequence does not depend on back navigation.

- [ ] **Step 5: Run RED to GREEN and current checks**

Run:

```bash
npm run test:e2e -- tests/e2e/adaptive-loop.spec.ts
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all exit 0; reload retains Attempt/Feedback/MEMORY and next Today changes.

- [ ] **Step 6: Commit event completion and Feedback**

```bash
git add src/app/practice src/app/feedback src/features/attempt src/features/feedback src/features/practice/clear-practice-draft.tsx tests/e2e/adaptive-loop.spec.ts
git commit -m "feat(feedback): show the persisted memory change"
```

### Task 11: Explainable Progress and Due Reviews

**Files:**

- Create: `src/app/(primary)/progress/page.tsx`
- Create: `src/features/progress/get-progress.server.ts`
- Create: `src/features/progress/progress-summary.tsx`
- Create: `src/features/progress/progress-summary.module.css`
- Modify: `src/components/app-shell.tsx`
- Modify: `tests/e2e/adaptive-loop.spec.ts`

**Interfaces:**

- Consumes: Profile, all Patterns/prerequisites, Attempts, refreshed Skill States, and injected current UTC date.
- Produces: Profile/session summary, roadmap path, full-width evidence rows, reliable/learning/practicing/unseen labels, and due-review actions without percentages.

- [ ] **Step 1: Extend the failing browser loop through Progress**

After Feedback:

```ts
await page.getByRole("link", { name: "View progress" }).click();
await expect(page).toHaveURL(/\/progress$/);
await expect(
  page.getByRole("row", { name: /Arrays & Hashing Practicing/ }),
).toBeVisible();
await expect(page.getByText(/1 session completed/)).toBeVisible();

await page.reload();
await expect(
  page.getByRole("row", { name: /Arrays & Hashing Practicing/ }),
).toBeVisible();

await page.getByRole("link", { name: "Today" }).click();
await expect(page.getByText(/Contains Duplicate/)).not.toBeVisible();
```

Also use a seeded due-review scenario to assert the due section and its Practice action appear; omit the entire section when nothing is due.

- [ ] **Step 2: Run the extended browser test and verify RED**

Run:

```bash
npm run test:e2e -- tests/e2e/adaptive-loop.spec.ts
```

Expected: FAIL because Progress does not exist.

- [ ] **Step 3: Implement the Progress read model and view**

Refresh MEMORY from Attempts before reading. Return:

```ts
interface ProgressViewModel {
  profile: {
    daysRemaining: number;
    sessionsCompleted: number;
    dueReviewCount: number;
  };
  patterns: readonly {
    id: string;
    name: string;
    displayState:
      "unseen" | "learning" | "practicing" | "reliable" | "review_due";
    recentSuccess: number;
    evidenceSummary: string;
    nextReviewDate: string | null;
  }[];
  dueReviews: readonly DueReview[];
}
```

Evidence copy must be generated from real Attempt counts (“1 independent solve across 1 problem”), never percentages. Render full-width semantic rows/table, include text with every status color, and keep Today as the first navigation item. The standalone Reflection entity remains intentionally absent from UI.

`DueReview` contains `patternId`, `patternName`, `problemId`, `problemTitle`, and
`reviewDate`. Select the most recently attempted Problem for that due Pattern, then
title/UUID for deterministic ties. The same due list authorizes Progress's Practice
actions on the server.

- [ ] **Step 4: Run RED to GREEN and current checks**

Run:

```bash
npm run test:e2e -- tests/e2e/adaptive-loop.spec.ts
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all exit 0; reload preserves Profile, Attempt, and Progress.

- [ ] **Step 5: Commit explainable Progress**

```bash
git add src/app/\(primary\)/progress src/features/progress src/components/app-shell.tsx tests/e2e/adaptive-loop.spec.ts
git commit -m "feat(progress): expose evidence and due reviews"
```

### Task 12: Required Browser States, Responsive Layout, and Accessibility

**Files:**

- Create: `tests/e2e/states.spec.ts`
- Create: `tests/e2e/responsive.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`
- Modify: `tests/e2e/support/scenarios.ts`
- Modify: `src/app/globals.css`
- Modify: `src/styles/tokens.css`
- Modify: `src/components/app-shell.module.css`
- Modify: `src/features/setup/setup-form.module.css`
- Modify: `src/features/today/today-recommendation.module.css`
- Modify: `src/features/practice/practice-session.module.css`
- Modify: `src/features/attempt/attempt-reflection-form.module.css`
- Modify: `src/features/feedback/feedback-summary.module.css`
- Modify: `src/features/progress/progress-summary.module.css`

**Interfaces:**

- Consumes: isolated database scenarios and the complete browser workflow.
- Produces: observable proof for required non-happy states, desktop/mobile/320px layout, keyboard focus, and reduced motion.

- [ ] **Step 1: Write failing state coverage**

`states.spec.ts` must prepare scenarios through direct guarded test-database helpers—not production routes—and cover:

- no Profile redirects to Setup;
- expired deadline asks for a new target;
- no due reviews omits that section;
- empty catalog produces a stable recommendation error with Retry;
- persisted Attempt with missing Skill State self-heals on Today/Progress;
- MIND unavailable never hides End attempt or Reflection;
- a 100-character title, long recommendation reason, and long note do not clip actions;
- unknown Problem/Attempt IDs render the product not-found state without raw errors.

- [ ] **Step 2: Write failing responsive coverage**

At viewports 1440×900, 768×1024, 390×844, and 320×700:

```ts
const overflow = await page.evaluate(
  () =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
expect(overflow).toBeLessThanOrEqual(0);
```

Assert the Practice desktop layout is approximately 60/40, mobile MIND is a full-height sheet, all primary actions are visible, no bounding boxes overlap, and every interactive target is at least 44×44 CSS pixels. Complete the primary flow at 320px.

- [ ] **Step 3: Write failing keyboard/reduced-motion coverage**

Prove:

- one logical page heading and labelled `Today | Progress` navigation with `aria-current`;
- native labels/fieldsets/legends for Setup and Reflection;
- keyboard-only Setup→Today→Practice→Reflection→Feedback→Progress→Today;
- visible `:focus-visible` on every interactive control;
- validation error uses an alert/status and moves focus to the summary/first invalid field;
- timer is quiet, unavailable MIND uses `role="status"`, and external-link copy announces a new tab;
- mobile sheet Escape closes and returns focus;
- `prefers-reduced-motion: reduce` disables nonessential transitions/animation.

- [ ] **Step 4: Run the browser suites and verify RED**

Run:

```bash
npm run test:e2e -- tests/e2e/states.spec.ts tests/e2e/responsive.spec.ts tests/e2e/accessibility.spec.ts
```

Expected: at least one assertion fails before the state/accessibility/layout hardening.

- [ ] **Step 5: Implement only fixes demanded by the tests**

Extend shared tokens for focus ring, borders, muted/review surfaces, stable control heights, and spacing. Add no gradients, decorative art, nested cards, radius above 8px, or new styling dependency. Keep mobile content order Practice first, MIND second/sheet.

Use `min-height: 44px` for controls, `overflow-wrap: anywhere` for untrusted/long
copy, `min-width: 0` on grid children, a desktop 3fr/2fr Practice grid, a single
column at the mobile breakpoint, and an explicit
`@media (prefers-reduced-motion: reduce)` rule that removes nonessential
transitions/animations.

- [ ] **Step 6: Inspect real screenshots**

Run the app through Playwright and capture Today, Practice, Reflection, Feedback, and Progress at 1440px, 390px, and 320px. Inspect every image for overlap, clipping, horizontal scrolling, hidden actions, unstable height, weak focus/status contrast, and long-text breakage. Record only actionable findings and correct them before proceeding.

- [ ] **Step 7: Run RED to GREEN and the entire browser suite**

Run:

```bash
npm run test:e2e
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all browser cases and current checks exit 0.

- [ ] **Step 8: Commit UI hardening**

```bash
git add tests/e2e src/app/globals.css src/styles/tokens.css src/features
git commit -m "test(workflow): harden the adaptive loop in real browsers"
```

### Task 13: Runbook, Full Verification, and Phase 2 Handoff

**Files:**

- Modify: `README.md`
- Modify: `drizzle/README.md`
- Modify: `docs/superpowers/plans/2026-07-14-phase-2-adaptive-spine.md` (checkboxes only)

**Interfaces:**

- Consumes: the complete local Phase 2 implementation.
- Produces: accurate operator commands, clean setup instructions, final proof output, and an exact next-phase handoff without beginning live MIND or broader catalog work.

- [ ] **Step 1: Update the operator runbook**

Document:

1. Node 24, `npm ci`, local env, browser install.
2. `db:generate → SQL review → commit schema+migration → db:migrate` policy.
3. Local `db:migrate:local` then `db:seed:local`; protected production migrate/seed commands remain manual and never run in Vercel builds.
4. The 18/21/150 seed counts and exact difficulty→minutes mapping.
5. The server-only repository/module pattern.
6. Attempt-first/Skill-State-second failure semantics and
   `memory:rebuild:local` / protected `memory:rebuild:production`.
7. MIND’s honest unavailable Phase 2 state and test-only fake.
8. Local `dev`, unit, browser, build, and `verify` commands.
9. No Correction/blocker/auth/code-runner/live-provider scope.

- [ ] **Step 2: Verify no forbidden or stale implementation survived**

Run:

```bash
rg -n "checkFoundationConnectivity|probeDatabase|Database connected" src tests
rg -n "correction|blocker" src tests
rg -n "NEXT_PUBLIC_.*TURSO|TURSO_AUTH_TOKEN" src/app src/components src/features
rg -n "FakeMindGateway" src --glob '!**/*.test.ts' --glob '!**/testing/**'
```

Expected: no foundation, Correction/blocker, browser secret, or production fake-MIND import. Documentation/examples may mention forbidden items only to state that they do not exist.

- [ ] **Step 3: Run fresh complete verification**

Run:

```bash
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Expected: every command exits 0 on the exact handoff tree. Read complete output; do not infer success from truncated logs.

- [ ] **Step 4: Recheck database invariants**

Against a fresh temporary database, run migration and seed twice, then assert/report:

```text
18 patterns
21 prerequisite edges
150 problems
150 problem-pattern mappings
18 Skill State rows
0 Attempts before browser scenario
```

Run the persisted adaptation integration once more and record the exact first, second, and third recommended titles plus MEMORY transitions.

- [ ] **Step 5: Commit documentation and accurate checkboxes**

Run lint, type-check, and build once more after the documentation edit, then:

```bash
git add README.md drizzle/README.md docs/superpowers/plans/2026-07-14-phase-2-adaptive-spine.md
git commit -m "docs(runbook): document the adaptive spine workflow"
```

- [ ] **Step 6: Stop at the approved boundary**

Report only:

- user-visible loop delivered;
- consequential deterministic policies;
- exact verification commands/results;
- seed/migration counts;
- any limitation affecting the core loop;
- local URL only if a server remains running;
- one-line next input needed for Phase 3.

Do not begin a live MIND provider, multi-pattern enrichment, accounts, imports, or additional product scope.
