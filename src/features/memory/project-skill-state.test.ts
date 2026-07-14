import { describe, expect, it } from "vitest";

import {
  getSkillDisplayState,
  isIndependentSuccess,
  projectAllSkillStates,
  projectSkillState,
  type PatternAttemptEvidence,
} from "./project-skill-state";

const now = new Date("2026-07-14T15:00:00.000Z");
const patternId = "arrays-hashing";

function attempt(
  overrides: Partial<PatternAttemptEvidence> = {},
): PatternAttemptEvidence {
  return {
    id: "attempt-one",
    patternId,
    problemId: "problem-one",
    result: "solved",
    highestHintLevel: 0,
    occurredAt: new Date("2026-07-14T12:00:00.000Z"),
    ...overrides,
  };
}

function project(attempts: readonly PatternAttemptEvidence[]) {
  return projectSkillState({ patternId, attempts, now });
}

describe("isIndependentSuccess", () => {
  it("requires both a solved result and no hint", () => {
    expect(isIndependentSuccess(attempt())).toBe(true);
    expect(isIndependentSuccess(attempt({ highestHintLevel: 1 }))).toBe(false);
    expect(isIndependentSuccess(attempt({ result: "not_solved" }))).toBe(false);
  });
});

describe("projectSkillState", () => {
  it("projects an unseen pattern without a review", () => {
    expect(project([])).toMatchObject({
      patternId,
      mastery: "unseen",
      recentSuccess: 0,
      nextReviewDate: null,
      lastComputedAt: now,
    });
  });

  it("keeps a solve with help in learning and reviews it in one day", () => {
    expect(project([attempt({ highestHintLevel: 1 })])).toMatchObject({
      mastery: "learning",
      recentSuccess: 0,
      nextReviewDate: "2026-07-15",
    });
  });

  it("keeps a viewed solution in learning", () => {
    expect(project([attempt({ result: "viewed_solution" })])).toMatchObject({
      mastery: "learning",
      recentSuccess: 0,
    });
  });

  it("moves one independent solve to practicing with a three-day review", () => {
    expect(project([attempt()])).toMatchObject({
      mastery: "practicing",
      recentSuccess: 1,
      nextReviewDate: "2026-07-17",
    });
  });

  it("requires independent solves of two problems for reliable", () => {
    expect(
      project([
        attempt(),
        attempt({
          id: "attempt-two",
          problemId: "problem-two",
          occurredAt: new Date("2026-07-14T13:00:00.000Z"),
        }),
      ]),
    ).toMatchObject({
      mastery: "reliable",
      recentSuccess: 2,
      nextReviewDate: "2026-07-21",
    });
  });

  it("keeps repeated independent solves of one problem in practicing", () => {
    expect(
      project([
        attempt(),
        attempt({
          id: "attempt-two",
          occurredAt: new Date("2026-07-14T13:00:00.000Z"),
        }),
      ]),
    ).toMatchObject({
      mastery: "practicing",
      recentSuccess: 2,
      nextReviewDate: "2026-07-17",
    });
  });

  it("pulls review to one day after a later failure without erasing reliable evidence", () => {
    expect(
      project([
        attempt(),
        attempt({
          id: "attempt-two",
          problemId: "problem-two",
          occurredAt: new Date("2026-07-14T13:00:00.000Z"),
        }),
        attempt({
          id: "attempt-three",
          problemId: "problem-three",
          result: "not_solved",
          occurredAt: new Date("2026-07-14T14:00:00.000Z"),
        }),
      ]),
    ).toMatchObject({
      mastery: "reliable",
      recentSuccess: 2,
      nextReviewDate: "2026-07-15",
    });
  });

  it("counts independent successes only in the latest three attempts", () => {
    expect(
      project([
        attempt({ occurredAt: new Date("2026-07-10T12:00:00.000Z") }),
        attempt({
          id: "attempt-two",
          result: "not_solved",
          occurredAt: new Date("2026-07-11T12:00:00.000Z"),
        }),
        attempt({
          id: "attempt-three",
          problemId: "problem-two",
          occurredAt: new Date("2026-07-12T12:00:00.000Z"),
        }),
        attempt({
          id: "attempt-four",
          problemId: "problem-three",
          result: "viewed_solution",
          occurredAt: new Date("2026-07-13T12:00:00.000Z"),
        }),
      ]),
    ).toMatchObject({
      mastery: "reliable",
      recentSuccess: 1,
      nextReviewDate: "2026-07-14",
    });
  });

  it("orders backdated attempts by occurrence and then by ID", () => {
    expect(
      project([
        attempt({
          id: "attempt-b",
          occurredAt: new Date("2026-07-14T12:00:00.000Z"),
        }),
        attempt({
          id: "attempt-c",
          result: "not_solved",
          occurredAt: new Date("2026-07-13T12:00:00.000Z"),
        }),
        attempt({
          id: "attempt-a",
          result: "not_solved",
          occurredAt: new Date("2026-07-14T12:00:00.000Z"),
        }),
      ]),
    ).toMatchObject({
      mastery: "practicing",
      recentSuccess: 1,
      nextReviewDate: "2026-07-17",
    });
  });
});

describe("projectAllSkillStates", () => {
  it("projects every requested pattern without mutating its inputs", () => {
    const patternIds = Object.freeze([patternId, "two-pointers"]);
    const attempts = Object.freeze([
      attempt({
        id: "attempt-later",
        occurredAt: new Date("2026-07-14T14:00:00.000Z"),
      }),
      attempt({
        id: "attempt-earlier",
        occurredAt: new Date("2026-07-13T14:00:00.000Z"),
      }),
    ]);
    const originalAttemptOrder = attempts.map(({ id }) => id);
    const originalNow = now.getTime();

    const states = projectAllSkillStates({ patternIds, attempts, now });

    expect(states).toMatchObject([
      {
        patternId,
        mastery: "practicing",
        recentSuccess: 2,
        lastComputedAt: now,
      },
      {
        patternId: "two-pointers",
        mastery: "unseen",
        recentSuccess: 0,
        lastComputedAt: now,
      },
    ]);
    expect(attempts.map(({ id }) => id)).toEqual(originalAttemptOrder);
    expect(patternIds).toEqual([patternId, "two-pointers"]);
    expect(now.getTime()).toBe(originalNow);
  });
});

describe("getSkillDisplayState", () => {
  it("derives review_due when the review date is today or earlier", () => {
    const state = projectSkillState({
      patternId,
      attempts: [attempt({ occurredAt: new Date("2026-07-11T12:00:00.000Z") })],
      now,
    });

    expect(getSkillDisplayState(state, "2026-07-13")).toBe("practicing");
    expect(getSkillDisplayState(state, "2026-07-14")).toBe("review_due");
    expect(getSkillDisplayState(state, "2026-07-15")).toBe("review_due");
  });

  it("never overlays review_due on unseen", () => {
    expect(getSkillDisplayState(project([]), "2026-07-14")).toBe("unseen");
  });
});
