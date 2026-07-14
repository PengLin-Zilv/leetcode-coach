# LeetCode Coach Context

This file is the product source of truth. Keep it short. Change it only when the product direction changes.

## North Star

Help an interview candidate use limited prep time on the practice that most improves their interview readiness.

The product's promise is simple:

> Open the app, know exactly what to practice next, understand why, and improve the next recommendation by completing the session.

## Target User

The first user:

- Has coding interviews approaching.
- Has weak foundations or incomplete pattern coverage.
- Has tried lists, videos, or random problems but lacks a reliable system.
- Wants direction, clear explanations, honest encouragement, and visible progress.

They are not trying to become an algorithms expert. They are trying to become interview-ready before a real deadline.

## Core Problem

Problems and explanations are abundant. The scarce things are:

1. Choosing the highest-value practice now.
2. Getting useful help without skipping the thinking.
3. Turning each attempt into evidence about what to do next.
4. Staying consistent when progress feels unclear.

Popular lists answer "what is generally worth practicing?" They do not answer "what should this person do today?"

## First Principles

1. **The deadline matters.** A useful plan must fit the user's remaining time and weekly capacity.
2. **Attempts create evidence.** Self-ratings and solved counts are weak signals; how the user solved matters more.
3. **Productive struggle matters.** Giving the full solution too early can complete a problem while preventing learning.
4. **Patterns transfer.** The roadmap should build recognition and reasoning patterns, not maximize problem count.
5. **Memory must change behavior.** Stored data that never changes a recommendation is clutter.
6. **Personalization must be earned.** Start with a reasonable plan, then adapt from observed attempts.
7. **Clarity creates momentum.** One achievable next action is more useful than a large dashboard.
8. **Learning preferences are controls, not identities.** Offer simpler language, examples, traces, or diagrams when useful. Do not permanently label someone a "visual learner."

## The Product Loop

```text
Goal and available time
        -> one recommended task
        -> focused attempt
        -> targeted coaching
        -> short reflection
        -> structured evidence
        -> better next task
```

If the final step does not change from the evidence collected, the loop is broken.

## The Product

LeetCode Coach has three responsibilities:

### Recommend

Choose one useful task that fits the user's deadline, prerequisites, weak areas, review schedule, and available session time. Explain the choice in one sentence.

### Coach (MIND)

Help during and after an attempt:

- Ask what the user has tried.
- Give progressive hints instead of immediate solutions.
- Explain the pattern in plain language.
- Switch format on request: simpler English, concrete example, trace table, diagram, or pseudocode.
- Diagnose the main failure after the attempt.
- End with one lesson and one next action.

MIND is context-bound. It coaches the current task and roadmap; it is not a general chat homepage.

### Remember (MEMORY)

Store training evidence, not a vague transcript:

- Goal, deadline, and available practice time.
- Attempt outcome: independent, helped, or not solved.
- Highest hint level used.
- Time spent and confidence.
- Main blocker or mistake.
- Explicit corrections to inferred blockers or mistakes.
- Pattern exposure and review due date.
- Explanation formats the user explicitly found helpful.

Derived strength must remain explainable. The user can inspect and correct inferred mistakes.

## Smallest Useful MVP

The MVP is one complete training loop:

1. **Setup:** deadline, sessions per week, minutes per session, and rough starting level. Under two minutes.
2. **Today:** one recommended problem or review with a timebox and a plain-language reason.
3. **Session:** external problem link, lightweight timer, notes, and progressive MIND hints. No code runner.
4. **Reflection:** outcome, main blocker, confidence, and an optional note. Under 30 seconds.
5. **Feedback:** one thing done well, one correction, and one review cue.
6. **Adaptation:** update MEMORY and choose the next task.
7. **Progress:** show the current pattern, reliable patterns, weak patterns, and due reviews without fake precision.

Start with one active plan and a small catalog of representative problems across core interview patterns. Tag each problem by pattern, difficulty, prerequisite, estimated time, and source list.

Use NeetCode 75, NeetCode 150, and Grind 75 as references and source tags. They seed the catalog; they do not dictate the user's sequence.

## Recommendation Rule

Do not begin with machine learning or an unconstrained AI planner.

Build candidates from:

- Reviews that are due.
- Missing prerequisite patterns.
- The next roadmap pattern.
- Weaknesses supported by recent attempts.

Reject tasks that do not fit the session time or are clearly beyond the user's prerequisites. Rank the rest by interview value, weakness, review urgency, difficulty fit, and recent repetition. Return one primary task.

The LLM may explain and diagnose. Structured application rules own the training state and final recommendation.

## Minimal Data Model

- **Profile:** deadline, availability, starting level, explicit explanation preferences.
- **Problem:** link and curated metadata.
- **Attempt:** immutable observed outcome, time, hints, blocker, confidence, and optional note.
- **Correction:** an immutable user correction to an inferred blocker or mistake.
- **Skill state:** a rebuildable projection with pattern status, supporting evidence, last practiced, and next review.
- **Recommendation:** chosen task and human-readable reason.

Do not add a data object until a visible workflow needs it.

## Honest Progress

Avoid unsupported mastery percentages. Use evidence-based states:

- **Unseen:** no attempt yet.
- **Learning:** attempted but not independently reliable.
- **Practicing:** at least one independent solve; needs spaced confirmation.
- **Reliable:** repeated independent performance across time or variants.
- **Review due:** prior learning should be tested again.

One lucky solve is not mastery. One failed attempt is not permanent weakness.

## Success Criteria

The first version succeeds when:

- Setup produces a credible first task in under two minutes.
- A returning user can start today's task in under ten seconds.
- Every completed session records evidence or schedules a review.
- Every recommendation includes a reason grounded in the user's plan or history.
- A failed, helped, or successful attempt can visibly change a future recommendation.
- Over time, independent solves rise and repeated blockers fall.

The critical product test:

> After the user completes two meaningfully different attempts, does the coach make a better third choice than a static list would?

## Non-Goals

- A LeetCode clone, embedded judge, or code execution platform.
- A generic AI chatbot.
- Automatic LeetCode history import in the first version.
- A fixed eight-week plan for everyone.
- A perfect diagnostic before the user can begin.
- Rigid learner-type labels.
- Social feeds, leaderboards, streak pressure, badges, or gamification.
- Company-specific optimization before the core loop works.
- Complex analytics, mastery formulas, background agents, or ML ranking.
- Supporting every roadmap, language, or interview format at launch.

## Working Assumptions

- The first product is a web app.
- Problems open on LeetCode in a separate tab; the app stores links and metadata, not copied statements.
- Users report outcomes honestly enough for an MVP; behavior can later provide stronger signals.
- English is the initial interface language, with MIND able to use simpler English when asked.
- The plan length comes from the user's deadline and capacity, not a fixed template.
- One strong daily recommendation is the primary experience. Everything else supports it.

## One-Sentence Positioning

LeetCode Coach is a personal training loop for coding interviews: it chooses the next useful problem, coaches the attempt without stealing the thinking, and uses the result to make the next choice better.
