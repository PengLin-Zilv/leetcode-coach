import { describe, expect, it } from "vitest";

import { selectDueReviews } from "./select-due-reviews";

const duePatternId = "0190f6f5-9b5a-7a22-8c44-123456789aa1";
const futurePatternId = "0190f6f5-9b5a-7a22-8c44-123456789aa2";
const olderProblemId = "0190f6f5-9b5a-7a22-8c44-123456789ab1";
const recentProblemId = "0190f6f5-9b5a-7a22-8c44-123456789ab2";
const titleTieProblemId = "0190f6f5-9b5a-7a22-8c44-123456789ab3";

const patterns = [
  { id: duePatternId, name: "Arrays & Hashing", slug: "arrays-hashing" },
  { id: futurePatternId, name: "Two Pointers", slug: "two-pointers" },
] as const;
const problems = [
  {
    id: olderProblemId,
    number: null,
    title: "Valid Anagram",
    difficulty: "easy" as const,
    url: "https://leetcode.com/problems/valid-anagram/",
    estimatedMinutes: 15,
    source: "neetcode-150",
  },
  {
    id: recentProblemId,
    number: null,
    title: "Contains Duplicate",
    difficulty: "easy" as const,
    url: "https://leetcode.com/problems/contains-duplicate/",
    estimatedMinutes: 15,
    source: "neetcode-150",
  },
  {
    id: titleTieProblemId,
    number: null,
    title: "Contains Duplicate",
    difficulty: "easy" as const,
    url: "https://leetcode.com/problems/contains-duplicate-ii/",
    estimatedMinutes: 15,
    source: "neetcode-150",
  },
] as const;
const problemPatterns = problems.map(({ id }) => ({
  problemId: id,
  patternId: duePatternId,
}));

function attempt(id: string, problemId: string, occurredAt: string) {
  return {
    id,
    problemId,
    occurredAt: new Date(occurredAt),
  };
}

describe("selectDueReviews", () => {
  it("selects only the most recently attempted Problem for each due Pattern", () => {
    const dueReviews = selectDueReviews({
      patterns,
      problems,
      problemPatterns,
      attempts: [
        attempt("attempt-old", olderProblemId, "2026-07-10T15:00:00.000Z"),
        attempt("attempt-new", recentProblemId, "2026-07-13T15:00:00.000Z"),
      ],
      skillStates: [
        {
          patternId: duePatternId,
          mastery: "practicing",
          nextReviewDate: "2026-07-14",
        },
        {
          patternId: futurePatternId,
          mastery: "practicing",
          nextReviewDate: "2026-07-15",
        },
      ],
      today: "2026-07-14",
    });

    expect(dueReviews).toEqual([
      {
        patternId: duePatternId,
        patternName: "Arrays & Hashing",
        problemId: recentProblemId,
        problemTitle: "Contains Duplicate",
        reviewDate: "2026-07-14",
      },
    ]);
  });

  it("uses title then UUID ascending when latest Attempt times tie", () => {
    const tiedAt = "2026-07-13T15:00:00.000Z";
    const dueReviews = selectDueReviews({
      patterns,
      problems,
      problemPatterns,
      attempts: [
        attempt("attempt-z", olderProblemId, tiedAt),
        attempt("attempt-b", recentProblemId, tiedAt),
        attempt("attempt-c", titleTieProblemId, tiedAt),
      ],
      skillStates: [
        {
          patternId: duePatternId,
          mastery: "learning",
          nextReviewDate: "2026-07-13",
        },
      ],
      today: "2026-07-14",
    });

    expect(dueReviews[0]?.problemId).toBe(recentProblemId);
  });

  it("omits unseen, not-yet-due, unmapped, and unattempted Patterns", () => {
    expect(
      selectDueReviews({
        patterns,
        problems,
        problemPatterns,
        attempts: [],
        skillStates: [
          {
            patternId: duePatternId,
            mastery: "unseen",
            nextReviewDate: "2026-07-14",
          },
          {
            patternId: futurePatternId,
            mastery: "practicing",
            nextReviewDate: "2026-07-15",
          },
        ],
        today: "2026-07-14",
      }),
    ).toEqual([]);
  });
});
