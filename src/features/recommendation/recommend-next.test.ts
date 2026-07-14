import { describe, expect, it } from "vitest";

import {
  recommendNext,
  type RecommendationAttempt,
  type RecommendationInput,
  type RecommendationPattern,
  type RecommendationProblem,
  type RecommendationResult,
  type RecommendationSkillState,
} from "./recommend-next";
import { formatRecommendationReason } from "./reason";

const now = new Date("2026-07-14T15:00:00.000Z");

const patterns = {
  arrays: {
    id: "pattern-arrays",
    name: "Arrays & Hashing",
    slug: "arrays-hashing",
  },
  twoPointers: {
    id: "pattern-two-pointers",
    name: "Two Pointers",
    slug: "two-pointers",
  },
  stack: {
    id: "pattern-stack",
    name: "Stack",
    slug: "stack",
  },
  binarySearch: {
    id: "pattern-binary-search",
    name: "Binary Search",
    slug: "binary-search",
  },
} as const satisfies Record<string, RecommendationPattern>;

const problems = {
  containsDuplicate: problem({
    id: "00000000-0000-7000-8000-000000000001",
    patternId: patterns.arrays.id,
    title: "Contains Duplicate",
    difficulty: "easy",
    estimatedMinutes: 15,
  }),
  groupAnagrams: problem({
    id: "00000000-0000-7000-8000-000000000002",
    patternId: patterns.arrays.id,
    title: "Group Anagrams",
    difficulty: "medium",
    estimatedMinutes: 30,
  }),
  hardArray: problem({
    id: "00000000-0000-7000-8000-000000000003",
    patternId: patterns.arrays.id,
    title: "Hard Array Exercise",
    difficulty: "hard",
    estimatedMinutes: 45,
  }),
  validPalindrome: problem({
    id: "00000000-0000-7000-8000-000000000004",
    patternId: patterns.twoPointers.id,
    title: "Valid Palindrome",
    difficulty: "easy",
    estimatedMinutes: 15,
  }),
  validParentheses: problem({
    id: "00000000-0000-7000-8000-000000000005",
    patternId: patterns.stack.id,
    title: "Valid Parentheses",
    difficulty: "easy",
    estimatedMinutes: 15,
  }),
  binarySearch: problem({
    id: "00000000-0000-7000-8000-000000000006",
    patternId: patterns.binarySearch.id,
    title: "Binary Search",
    difficulty: "easy",
    estimatedMinutes: 15,
  }),
} as const;

const prerequisites = [
  {
    patternId: patterns.twoPointers.id,
    prerequisitePatternId: patterns.arrays.id,
  },
  {
    patternId: patterns.stack.id,
    prerequisitePatternId: patterns.arrays.id,
  },
  {
    patternId: patterns.binarySearch.id,
    prerequisitePatternId: patterns.twoPointers.id,
  },
] as const;

const newUserInput: RecommendationInput = {
  profile: { minutesPerSession: 30, startingLevel: "new" },
  patterns: Object.values(patterns),
  prerequisites,
  problems: Object.values(problems),
  skillStates: Object.values(patterns).map(({ id }) => state(id)),
  attempts: [],
  now,
};

function problem(
  overrides: Pick<
    RecommendationProblem,
    "id" | "patternId" | "title" | "difficulty" | "estimatedMinutes"
  >,
): RecommendationProblem {
  return {
    ...overrides,
    url: `https://leetcode.com/problems/${overrides.title
      .toLowerCase()
      .replaceAll(" ", "-")}/`,
    source: "neetcode-150",
  };
}

function state(
  patternId: string,
  overrides: Partial<RecommendationSkillState> = {},
): RecommendationSkillState {
  return {
    patternId,
    mastery: "unseen",
    nextReviewDate: null,
    ...overrides,
  };
}

function attempt(
  problemId: string,
  occurredAt: string,
  id = `attempt-${problemId}`,
): RecommendationAttempt {
  return { id, problemId, occurredAt: new Date(occurredAt) };
}

function withStates(
  input: RecommendationInput,
  masteries: Readonly<Record<string, RecommendationSkillState["mastery"]>>,
): RecommendationInput {
  const masteryByPatternId = new Map(
    input.patterns.map(({ id, slug }) => [id, masteries[slug]]),
  );

  return {
    ...input,
    skillStates: input.skillStates.map((skillState) => ({
      ...skillState,
      mastery: masteryByPatternId.get(skillState.patternId) ?? "unseen",
      nextReviewDate: null,
    })),
  };
}

function recommended(
  result: RecommendationResult,
): Extract<RecommendationResult, { status: "recommended" }> {
  expect(result.status).toBe("recommended");

  if (result.status !== "recommended") {
    throw new Error(`Expected a recommendation, received ${result.reason}`);
  }

  return result;
}

describe("recommendNext prerequisites and roadmap adaptation", () => {
  it("gives a new user the first fitting prerequisite-building task", () => {
    expect(recommendNext(newUserInput)).toMatchObject({
      status: "recommended",
      problem: {
        title: "Contains Duplicate",
        estimatedMinutes: 15,
      },
      pattern: { slug: "arrays-hashing" },
      factors: {
        kind: "prerequisite_building",
        patternName: "Arrays & Hashing",
        problemTitle: "Contains Duplicate",
        unlocksPatternNames: ["Two Pointers", "Stack"],
        sessionMinutes: 30,
      },
    });
  });

  it("keeps direct and transitive dependents locked until each prerequisite is reliable", () => {
    const prerequisiteChain: RecommendationInput = {
      ...newUserInput,
      patterns: [patterns.arrays, patterns.twoPointers, patterns.binarySearch],
      prerequisites: [prerequisites[0], prerequisites[2]],
      problems: [
        problems.containsDuplicate,
        problems.validPalindrome,
        problems.binarySearch,
      ],
      skillStates: [
        state(patterns.arrays.id),
        state(patterns.twoPointers.id),
        state(patterns.binarySearch.id),
      ],
    };

    expect(
      recommended(
        recommendNext(
          withStates(prerequisiteChain, {
            "arrays-hashing": "learning",
            "two-pointers": "unseen",
            "binary-search": "unseen",
          }),
        ),
      ).pattern.slug,
    ).toBe("arrays-hashing");

    expect(
      recommended(
        recommendNext(
          withStates(prerequisiteChain, {
            "arrays-hashing": "reliable",
            "two-pointers": "learning",
            "binary-search": "unseen",
          }),
        ),
      ).pattern.slug,
    ).toBe("two-pointers");

    expect(
      recommended(
        recommendNext(
          withStates(prerequisiteChain, {
            "arrays-hashing": "reliable",
            "two-pointers": "reliable",
            "binary-search": "unseen",
          }),
        ),
      ).pattern.slug,
    ).toBe("binary-search");
  });

  it("does not let reliable non-due Arrays crowd out newly unlocked Two Pointers", () => {
    const input = withStates(newUserInput, {
      "arrays-hashing": "reliable",
      "two-pointers": "unseen",
      stack: "unseen",
      "binary-search": "unseen",
    });

    const result = recommended(recommendNext(input));

    expect(result.pattern.slug).toBe("two-pointers");
    expect(result.factors.kind).toBe("next_pattern");
  });

  it("chooses Two Pointers before Stack by canonical roadmap order", () => {
    const input = withStates(
      {
        ...newUserInput,
        patterns: [...newUserInput.patterns].reverse(),
        problems: [...newUserInput.problems].reverse(),
      },
      {
        "arrays-hashing": "reliable",
        "two-pointers": "unseen",
        stack: "unseen",
        "binary-search": "unseen",
      },
    );

    expect(recommended(recommendNext(input)).pattern.slug).toBe("two-pointers");
  });
});

describe("recommendNext candidate pools", () => {
  it("lets a due reliable Arrays review outrank newly unlocked Two Pointers", () => {
    const input: RecommendationInput = {
      ...withStates(newUserInput, {
        "arrays-hashing": "reliable",
        "two-pointers": "unseen",
        stack: "unseen",
        "binary-search": "unseen",
      }),
      profile: { minutesPerSession: 15, startingLevel: "new" },
      skillStates: [
        state(patterns.arrays.id, {
          mastery: "reliable",
          nextReviewDate: "2026-07-14",
        }),
        state(patterns.twoPointers.id),
        state(patterns.stack.id),
        state(patterns.binarySearch.id),
      ],
    };

    const result = recommended(recommendNext(input));

    expect(result).toMatchObject({
      problem: { title: "Contains Duplicate" },
      pattern: { slug: "arrays-hashing" },
      factors: {
        kind: "due_review",
        reviewDate: "2026-07-14",
        sessionMinutes: 15,
      },
    });
    expect(result.reason).toBe(formatRecommendationReason(result.factors));
    expect(result.reason).toBe(
      "Arrays & Hashing is due for review, and Contains Duplicate fits your 15-minute session.",
    );
  });

  it("falls back to a reliable non-due pattern only when no non-reliable candidate exists", () => {
    const input: RecommendationInput = {
      ...newUserInput,
      patterns: [patterns.arrays],
      prerequisites: [],
      problems: [problems.containsDuplicate],
      skillStates: [
        state(patterns.arrays.id, {
          mastery: "reliable",
          nextReviewDate: "2026-07-21",
        }),
      ],
    };

    expect(recommended(recommendNext(input))).toMatchObject({
      pattern: { slug: "arrays-hashing" },
      problem: { title: "Contains Duplicate" },
    });
  });
});

describe("recommendNext session fit and difficulty", () => {
  it("never recommends a 30- or 45-minute problem in a 15-minute session", () => {
    const result = recommended(
      recommendNext({
        ...newUserInput,
        profile: { minutesPerSession: 15, startingLevel: "reviewing" },
        patterns: [patterns.arrays],
        prerequisites: [],
        problems: [
          problems.hardArray,
          problems.groupAnagrams,
          problems.containsDuplicate,
        ],
        skillStates: [state(patterns.arrays.id)],
      }),
    );

    expect(result.problem.title).toBe("Contains Duplicate");
    expect(result.problem.estimatedMinutes).toBeLessThanOrEqual(15);
  });

  it.each([
    ["new", [problems.containsDuplicate, problems.groupAnagrams], "easy"],
    ["some", [problems.containsDuplicate, problems.groupAnagrams], "medium"],
    ["some", [problems.containsDuplicate, problems.hardArray], "easy"],
    [
      "reviewing",
      [problems.containsDuplicate, problems.groupAnagrams],
      "medium",
    ],
    ["reviewing", [problems.containsDuplicate, problems.hardArray], "hard"],
  ] as const)(
    "%s ranks its deterministic difficulty preference",
    (startingLevel, availableProblems, expectedDifficulty) => {
      const result = recommended(
        recommendNext({
          ...newUserInput,
          profile: { minutesPerSession: 60, startingLevel },
          patterns: [patterns.arrays],
          prerequisites: [],
          problems: availableProblems,
          skillStates: [state(patterns.arrays.id)],
        }),
      );

      expect(result.problem.difficulty).toBe(expectedDifficulty);
    },
  );

  it("targets Medium while continuing a practicing pattern", () => {
    const result = recommended(
      recommendNext({
        ...newUserInput,
        profile: { minutesPerSession: 60, startingLevel: "new" },
        patterns: [patterns.arrays],
        prerequisites: [],
        problems: [
          problems.containsDuplicate,
          problems.groupAnagrams,
          problems.hardArray,
        ],
        skillStates: [state(patterns.arrays.id, { mastery: "practicing" })],
      }),
    );

    expect(result.problem.difficulty).toBe("medium");
    expect(result.factors).toMatchObject({
      kind: "continue_pattern",
      mastery: "practicing",
    });
  });
});

describe("recommendNext stable tie breakers", () => {
  const validAnagram = problem({
    id: "00000000-0000-7000-8000-000000000010",
    patternId: patterns.arrays.id,
    title: "Valid Anagram",
    difficulty: "easy",
    estimatedMinutes: 15,
  });

  it("avoids the problem attempted in the latest session when a tie exists", () => {
    const result = recommended(
      recommendNext({
        ...newUserInput,
        patterns: [patterns.arrays],
        prerequisites: [],
        problems: [problems.containsDuplicate, validAnagram],
        skillStates: [state(patterns.arrays.id, { mastery: "learning" })],
        attempts: [
          attempt(problems.containsDuplicate.id, "2026-07-14T14:00:00.000Z"),
        ],
      }),
    );

    expect(result.problem.title).toBe("Valid Anagram");
  });

  it("prefers the earlier last attempt before problem title", () => {
    const result = recommended(
      recommendNext({
        ...newUserInput,
        patterns: [patterns.arrays],
        prerequisites: [],
        problems: [problems.containsDuplicate, validAnagram],
        skillStates: [state(patterns.arrays.id, { mastery: "learning" })],
        attempts: [
          attempt(validAnagram.id, "2026-07-10T12:00:00.000Z", "attempt-older"),
          attempt(
            problems.containsDuplicate.id,
            "2026-07-11T12:00:00.000Z",
            "attempt-newer",
          ),
        ],
      }),
    );

    expect(result.problem.title).toBe("Valid Anagram");
  });

  it("uses ascending title and then UUID as the final tie breakers", () => {
    const laterUuid = problem({
      id: "00000000-0000-7000-8000-000000000099",
      patternId: patterns.arrays.id,
      title: "Same Title",
      difficulty: "easy",
      estimatedMinutes: 15,
    });
    const earlierUuid = {
      ...laterUuid,
      id: "00000000-0000-7000-8000-000000000011",
    };

    const titleWinner = recommended(
      recommendNext({
        ...newUserInput,
        patterns: [patterns.arrays],
        prerequisites: [],
        problems: [validAnagram, problems.containsDuplicate],
        skillStates: [state(patterns.arrays.id)],
      }),
    );
    const idWinner = recommended(
      recommendNext({
        ...newUserInput,
        patterns: [patterns.arrays],
        prerequisites: [],
        problems: [laterUuid, earlierUuid],
        skillStates: [state(patterns.arrays.id)],
      }),
    );

    expect(titleWinner.problem.title).toBe("Contains Duplicate");
    expect(idWinner.problem.id).toBe(earlierUuid.id);
  });

  it("returns byte-equivalent output without mutating or depending on input order", () => {
    const input = Object.freeze({
      ...newUserInput,
      patterns: Object.freeze([...newUserInput.patterns].reverse()),
      prerequisites: Object.freeze([...newUserInput.prerequisites].reverse()),
      problems: Object.freeze([...newUserInput.problems].reverse()),
      skillStates: Object.freeze([...newUserInput.skillStates].reverse()),
      attempts: Object.freeze([]),
    });
    const first = recommendNext(input);
    const second = recommendNext(input);
    const reordered = recommendNext({
      ...input,
      patterns: [...input.patterns].reverse(),
      prerequisites: [...input.prerequisites].reverse(),
      problems: [...input.problems].reverse(),
      skillStates: [...input.skillStates].reverse(),
    });

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(first)).toBe(JSON.stringify(reordered));
    expect(input.problems.map(({ id }) => id)).toEqual(
      [...newUserInput.problems].reverse().map(({ id }) => id),
    );
  });
});

describe("recommendNext unavailable results", () => {
  it("distinguishes an empty catalog from a catalog with no session fit", () => {
    expect(recommendNext({ ...newUserInput, problems: [] })).toEqual({
      status: "unavailable",
      reason: "catalog_empty",
    });

    expect(
      recommendNext({
        ...newUserInput,
        profile: { minutesPerSession: 15, startingLevel: "new" },
        patterns: [patterns.arrays],
        prerequisites: [],
        problems: [problems.groupAnagrams, problems.hardArray],
        skillStates: [state(patterns.arrays.id)],
      }),
    ).toEqual({ status: "unavailable", reason: "no_session_fit" });
  });
});
