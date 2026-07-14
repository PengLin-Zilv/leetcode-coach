# AGENTS.md

## Mission

Build the smallest working LeetCode Coach that can choose a better next practice task for one interview candidate than a static problem list.

The product loop is the unit of value:

```text
recommend -> attempt -> coach -> reflect -> remember -> adapt
```

A collection of polished screens without a working adaptation loop is not the product.

## Read First

Before planning or editing code, read:

1. `CONTEXT.md` for the user, product rules, MVP, and non-goals.
2. `VISUAL_WORKFLOW_DESIGN.md` for screens, states, hierarchy, and responsive behavior.
3. The existing code and tests for local conventions.

Priority when instructions conflict:

1. Latest explicit user instruction
2. `CONTEXT.md`
3. `VISUAL_WORKFLOW_DESIGN.md`
4. This file

Do not silently change product intent to fit an implementation. Ask only when a contradiction materially changes the outcome.

## Fundamental Invariants

Every implementation must preserve these truths:

1. Today presents one primary task and explains why it was chosen.
2. Every completed session records structured evidence about the attempt.
3. That evidence changes a later recommendation, review, or visible skill state.
4. MIND reveals help progressively and never writes training state directly.
5. Application rules own recommendations and MEMORY; the model explains and proposes.
6. Progress uses explainable evidence states, not invented mastery percentages.
7. Practice, reflection, persistence, and recommendation still work when MIND is unavailable.

If a feature does not strengthen this loop, it is not first-milestone work.

## How To Work

- State consequential assumptions and tradeoffs before coding.
- Define observable success and a short verification plan.
- Inspect before editing; follow sound existing patterns.
- Choose the simplest reversible implementation that satisfies the invariants.
- Keep changes surgical. Do not refactor, reformat, or delete unrelated user work.
- Add abstractions and dependencies only when they remove current complexity or risk.
- Prefer direct data flow and testable functions over speculative flexibility.
- For recommendation and MEMORY behavior, write the failing behavioral test first.
- Scale test coverage to risk; shared domain rules need broader coverage than isolated presentation changes.
- When implementation is requested, carry it through running code and fresh verification. Do not stop at a proposal.

For substantial work, use a brief live plan:

```text
1. Step -> verify: observable check
2. Step -> verify: observable check
3. Step -> verify: observable check
```

## First Shippable Slice

Build one persistent single-user flow before expanding the product:

1. Setup captures deadline, weekly capacity, session length, and starting level.
2. Today selects one suitable problem and gives a grounded reason.
3. Practice opens the external problem and supports notes, timing, and progressive hints.
4. Reflection records outcome, blocker, confidence, hint depth, and elapsed time.
5. Feedback shows one useful positive, one correction, one review cue, and the MEMORY change.
6. Progress shows evidence states and due reviews.
7. The completed attempt changes a later recommendation in a tested case.

Use only enough seeded problems to prove prerequisite ordering, difficulty fit, review scheduling, and adaptation. Keep source tags for NeetCode 75, NeetCode 150, and Grind 75.

Use one local development user unless the user requests accounts. Do not let authentication, deployment, imports, billing, or administration block proof of the loop.

## Design Boundaries

| Concern | Required boundary |
|---|---|
| Recommendation | Deterministic, inspectable application logic returns one task, structured factors, and a matching reason. Inject the current time for testing. |
| MEMORY | Store attempts and user corrections as source-of-truth events. Derive explainable, rebuildable states from those events. Raw chat is not training truth. |
| MIND | Receives compact typed context and returns validated typed output. It may propose feedback or a diagnosis; application code validates and writes. |
| Catalog | Store curated metadata and external links only. Do not copy proprietary problem statements. |
| Persistence | Setup and progress survive reloads. Use the simplest persistent store compatible with the existing stack. |
| UI | Follow `VISUAL_WORKFLOW_DESIGN.md`; Today is primary, MIND stays inside Practice, and there is no embedded judge or global chat. |

For a greenfield repository, choose one mainstream full-stack web application with strict types and local relational persistence. State the choice and why it is the smallest fit before installing dependencies. Keep secrets and model calls server-side. Do not introduce multiple services, queues, caches, provider frameworks, or background workers for the first slice.

MIND must fail honestly. Invalid output, missing credentials, timeouts, and rate limits cannot mutate MEMORY or block reflection. Test doubles are allowed in tests and development but must never masquerade as production AI.

## Scope Control

The non-goals in `CONTEXT.md` are binding. In particular, do not add authentication, code execution, submission imports, social features, gamification, company modes, a global chatbot, elaborate analytics, ML ranking, or admin tooling unless the user explicitly expands scope.

Do not duplicate product or visual requirements in new planning documents. Link to the source of truth and document only the implementation decision being made.

## Required Proof

At minimum, automated tests must demonstrate:

- A new user receives a prerequisite-appropriate task that fits the session.
- The visible recommendation reason matches the factors that selected it.
- A due review can affect selection.
- Solving with help does not produce a reliable state.
- Repeated independent evidence can produce a reliable state.
- A reflection event persists atomically, and a successful MEMORY projection affects the next recommendation.
- A projection failure never loses or rewrites the attempt event; MEMORY can be rebuilt from attempts and corrections.
- Presentation controls do not increase hint depth.
- Invalid or unavailable MIND cannot write MEMORY or break the core flow.
- Reloading preserves setup and progress.

Automate the browser path:

```text
Setup -> Today -> Practice -> Hint -> Reflection -> Feedback -> Progress -> next Today
```

Assert the recommendation reason and MEMORY change, not only navigation.

For UI changes, run the app in a real browser and inspect desktop, mobile, and 320px width. Exercise loading, empty, error, long-text, and MIND-unavailable states. Verify no overlap, clipping, horizontal scroll, hidden action, or unstable layout; also verify keyboard focus and reduced-motion behavior.

## Completion Gate

Before claiming completion, run fresh checks appropriate to the change:

- Tests
- Type checking
- Linting
- Production build
- Browser flow
- Visual inspection for UI work

Read the complete output. Report exact results and any check that could not run.

The first slice is complete only when the full loop works in the browser, state survives reload, an attempt visibly updates MEMORY, updated MEMORY changes a later recommendation in a tested case, MIND follows progressive disclosure or fails honestly, and clean setup instructions are accurate.

Static mockups, disconnected screens, fake persistence, or a generic chat demo do not pass.

## Handoff

Report only what the user needs:

- User-visible behavior delivered
- Consequential assumptions or decisions
- Verification commands and outcomes
- Remaining limitation affecting the core loop
- Local URL when the server is running
