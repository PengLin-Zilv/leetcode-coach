import { z } from "zod";

import {
  ESTIMATED_MINUTES,
  PATTERN_DEFINITIONS,
  type PatternSlug,
} from "./roadmap";

const GROUP_ALIASES = {
  "Arrays & Hashing": "arrays-hashing",
  "Two Pointers": "two-pointers",
  Stack: "stack",
  "Binary Search": "binary-search",
  "Sliding Window": "sliding-window",
  "Linked List": "linked-list",
  Trees: "trees",
  Tries: "tries",
  "Heap / Priority Queue": "heap-priority-queue",
  Backtracking: "backtracking",
  Intervals: "intervals",
  Greedy: "greedy",
  "Advanced Graphs": "advanced-graphs",
  Graphs: "graphs",
  "1-D Dynamic Programming": "1-d-dp",
  "2-D Dynamic Programming": "2-d-dp",
  "Bit Manipulation": "bit-manipulation",
  "Math & Geometry": "math-geometry",
} as const satisfies Record<string, PatternSlug>;

const rawProblemSchema = z
  .object({
    nurl: z.string().url(),
    url: z.string().url().startsWith("https://leetcode.com/problems/"),
    difficulty: z.enum(["Easy", "Medium", "Hard"]),
  })
  .strict();

const rawGroupSchema = z.record(
  z.string().refine((title) => title.trim().length > 0),
  rawProblemSchema,
);

const rawCatalogSchema = z
  .object({
    "Arrays & Hashing": rawGroupSchema,
    "Two Pointers": rawGroupSchema,
    "Sliding Window": rawGroupSchema,
    Stack: rawGroupSchema,
    "Binary Search": rawGroupSchema,
    "Linked List": rawGroupSchema,
    Trees: rawGroupSchema,
    "Heap / Priority Queue": rawGroupSchema,
    Backtracking: rawGroupSchema,
    Tries: rawGroupSchema,
    Graphs: rawGroupSchema,
    "Advanced Graphs": rawGroupSchema,
    "1-D Dynamic Programming": rawGroupSchema,
    "2-D Dynamic Programming": rawGroupSchema,
    Greedy: rawGroupSchema,
    Intervals: rawGroupSchema,
    "Math & Geometry": rawGroupSchema,
    "Bit Manipulation": rawGroupSchema,
  })
  .strict();

type Difficulty = keyof typeof ESTIMATED_MINUTES;
type RawGroupName = keyof typeof GROUP_ALIASES;

export interface CatalogProblem {
  readonly number: null;
  readonly title: string;
  readonly difficulty: Difficulty;
  readonly url: string;
  readonly estimatedMinutes: (typeof ESTIMATED_MINUTES)[Difficulty];
  readonly source: "neetcode-150";
}

export interface CatalogPattern {
  readonly name: string;
  readonly slug: PatternSlug;
}

export interface CatalogPrerequisite {
  readonly patternSlug: PatternSlug;
  readonly prerequisitePatternSlug: PatternSlug;
}

export interface CatalogProblemPattern {
  readonly problemUrl: string;
  readonly patternSlug: PatternSlug;
}

export interface CatalogSeed {
  readonly patterns: readonly CatalogPattern[];
  readonly prerequisites: readonly CatalogPrerequisite[];
  readonly problems: readonly CatalogProblem[];
  readonly problemPatterns: readonly CatalogProblemPattern[];
  readonly groupAliases: typeof GROUP_ALIASES;
}

function requireExactCount(
  label: string,
  actual: number,
  expected: number,
): void {
  if (actual !== expected) {
    throw new Error(`Expected exactly ${expected} ${label}`);
  }
}

function requireUnique(label: string, values: readonly string[]): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`Expected unique ${label}`);
  }
}

export function buildCatalogSeed(raw: unknown): CatalogSeed {
  const parsed = rawCatalogSchema.parse(raw);
  const problems: CatalogProblem[] = [];
  const problemPatterns: CatalogProblemPattern[] = [];

  requireExactCount("catalog groups", Object.keys(parsed).length, 18);

  for (const [groupName, patternSlug] of Object.entries(GROUP_ALIASES) as [
    RawGroupName,
    PatternSlug,
  ][]) {
    for (const [title, problem] of Object.entries(parsed[groupName])) {
      const difficulty = problem.difficulty.toLowerCase() as Difficulty;

      problems.push({
        number: null,
        title,
        difficulty,
        url: problem.url,
        estimatedMinutes: ESTIMATED_MINUTES[difficulty],
        source: "neetcode-150",
      });
      problemPatterns.push({ problemUrl: problem.url, patternSlug });
    }
  }

  requireExactCount("catalog problems", problems.length, 150);
  requireUnique(
    "problem titles",
    problems.map(({ title }) => title),
  );
  requireUnique(
    "problem URLs",
    problems.map(({ url }) => url),
  );

  const patterns = PATTERN_DEFINITIONS.map(({ name, slug }) => ({
    name,
    slug,
  }));
  const prerequisites = PATTERN_DEFINITIONS.flatMap(
    ({ slug: patternSlug, prerequisites: prerequisiteSlugs }) =>
      prerequisiteSlugs.map((prerequisitePatternSlug) => ({
        patternSlug,
        prerequisitePatternSlug,
      })),
  );

  return {
    patterns,
    prerequisites,
    problems,
    problemPatterns,
    groupAliases: GROUP_ALIASES,
  };
}
