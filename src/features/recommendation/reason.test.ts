import { describe, expect, it } from "vitest";

import {
  formatRecommendationReason,
  type RecommendationFactors,
} from "./reason";

describe("formatRecommendationReason", () => {
  it("formats the exact due-review template from typed factors", () => {
    const factors = {
      kind: "due_review",
      patternName: "Arrays & Hashing",
      problemTitle: "Contains Duplicate",
      reviewDate: "2026-07-14",
      sessionMinutes: 15,
    } as const satisfies RecommendationFactors;

    expect(formatRecommendationReason(factors)).toBe(
      "Arrays & Hashing is due for review, and Contains Duplicate fits your 15-minute session.",
    );
  });

  it("snapshots the prerequisite-building template and its complete factor-owned copy", () => {
    const factors = {
      kind: "prerequisite_building",
      patternName: "Arrays & Hashing",
      problemTitle: "Contains Duplicate",
      unlocksPatternNames: ["Two Pointers", "Stack"],
      sessionMinutes: 30,
    } as const satisfies RecommendationFactors;

    expect(formatRecommendationReason(factors)).toMatchInlineSnapshot(
      `"Contains Duplicate builds Arrays & Hashing, unlocking Two Pointers and Stack, and fits your 30-minute session."`,
    );
  });

  it("snapshots the continue-pattern template and its complete factor-owned copy", () => {
    const factors = {
      kind: "continue_pattern",
      patternName: "Arrays & Hashing",
      problemTitle: "Valid Anagram",
      mastery: "learning",
      sessionMinutes: 30,
    } as const satisfies RecommendationFactors;

    expect(formatRecommendationReason(factors)).toMatchInlineSnapshot(
      `"Continue Arrays & Hashing with Valid Anagram while it is learning; it fits your 30-minute session."`,
    );
  });

  it("snapshots the next-pattern template and its complete factor-owned copy", () => {
    const factors = {
      kind: "next_pattern",
      patternName: "Two Pointers",
      problemTitle: "Valid Palindrome",
      sessionMinutes: 30,
    } as const satisfies RecommendationFactors;

    expect(formatRecommendationReason(factors)).toMatchInlineSnapshot(
      `"Valid Palindrome starts your next roadmap pattern, Two Pointers, and fits your 30-minute session."`,
    );
  });

  it("formats one and three unlock names without input-order ambiguity", () => {
    const base = {
      kind: "prerequisite_building",
      patternName: "Foundation",
      problemTitle: "Foundation Problem",
      sessionMinutes: 30,
    } as const;

    expect(
      formatRecommendationReason({
        ...base,
        unlocksPatternNames: ["Two Pointers"],
      }),
    ).toContain("unlocking Two Pointers,");
    expect(
      formatRecommendationReason({
        ...base,
        unlocksPatternNames: ["Trees", "Graphs", "Dynamic Programming"],
      }),
    ).toContain("unlocking Trees, Graphs, and Dynamic Programming,");
  });
});
