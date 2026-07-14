import { PATTERN_DEFINITIONS } from "../catalog/roadmap";
import type { SkillMastery } from "../memory/project-skill-state";
import { toUtcDateKey } from "../../lib/utc-date";
import {
  formatRecommendationReason,
  type RecommendationFactors,
} from "./reason";

export type RecommendationStartingLevel = "new" | "some" | "reviewing";
export type RecommendationDifficulty = "easy" | "medium" | "hard";

export type RecommendationProfile = Readonly<{
  minutesPerSession: number;
  startingLevel: RecommendationStartingLevel;
}>;

export type RecommendationPattern = Readonly<{
  id: string;
  name: string;
  slug: string;
}>;

export type RecommendationPrerequisite = Readonly<{
  patternId: string;
  prerequisitePatternId: string;
}>;

export type RecommendationProblem = Readonly<{
  id: string;
  patternId: string;
  title: string;
  difficulty: RecommendationDifficulty;
  url: string;
  estimatedMinutes: number;
  source: string;
}>;

export type RecommendationSkillState = Readonly<{
  patternId: string;
  mastery: SkillMastery;
  nextReviewDate: string | null;
}>;

export type RecommendationAttempt = Readonly<{
  id: string;
  problemId: string;
  occurredAt: Date;
}>;

export type RecommendationInput = Readonly<{
  profile: RecommendationProfile;
  patterns: readonly RecommendationPattern[];
  prerequisites: readonly RecommendationPrerequisite[];
  problems: readonly RecommendationProblem[];
  skillStates: readonly RecommendationSkillState[];
  attempts: readonly RecommendationAttempt[];
  now: Date;
}>;

export type RecommendationResult =
  | Readonly<{
      status: "recommended";
      problem: RecommendationProblem;
      pattern: RecommendationPattern;
      factors: RecommendationFactors;
      reason: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "catalog_empty" | "no_session_fit";
    }>;

type Candidate = Readonly<{
  problem: RecommendationProblem;
  pattern: RecommendationPattern;
  mastery: SkillMastery;
  nextReviewDate: string | null;
}>;

const ROADMAP_INDEX: ReadonlyMap<string, number> = new Map(
  PATTERN_DEFINITIONS.map(({ slug }, index) => [slug, index]),
);

const DIFFICULTY_PREFERENCES = {
  new: ["easy", "medium", "hard"],
  some: ["medium", "easy", "hard"],
  reviewing: ["medium", "hard", "easy"],
  practicing: ["medium", "easy", "hard"],
} as const satisfies Record<
  RecommendationStartingLevel | "practicing",
  readonly RecommendationDifficulty[]
>;

function compareNumber(left: number, right: number): number {
  if (left < right) {
    return -1;
  }

  return left > right ? 1 : 0;
}

function compareString(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  return left > right ? 1 : 0;
}

function roadmapIndex(pattern: RecommendationPattern): number {
  return ROADMAP_INDEX.get(pattern.slug) ?? Number.MAX_SAFE_INTEGER;
}

function focusRank(mastery: SkillMastery): number {
  if (mastery === "learning" || mastery === "practicing") {
    return 0;
  }

  return mastery === "unseen" ? 1 : 2;
}

function difficultyRank(
  candidate: Candidate,
  startingLevel: RecommendationStartingLevel,
): number {
  const preference =
    candidate.mastery === "practicing"
      ? DIFFICULTY_PREFERENCES.practicing
      : DIFFICULTY_PREFERENCES[startingLevel];

  return preference.indexOf(candidate.problem.difficulty);
}

function isDue(candidate: Candidate, today: string): boolean {
  return (
    candidate.mastery !== "unseen" &&
    candidate.nextReviewDate !== null &&
    candidate.nextReviewDate <= today
  );
}

function createAttemptRecency(attempts: readonly RecommendationAttempt[]) {
  const lastAttemptByProblem = new Map<string, number>();
  let latestAttemptTime = Number.NEGATIVE_INFINITY;

  for (const attempt of attempts) {
    const occurredAt = attempt.occurredAt.getTime();

    if (!Number.isFinite(occurredAt)) {
      continue;
    }

    const previous = lastAttemptByProblem.get(attempt.problemId);
    if (previous === undefined || occurredAt > previous) {
      lastAttemptByProblem.set(attempt.problemId, occurredAt);
    }

    if (occurredAt > latestAttemptTime) {
      latestAttemptTime = occurredAt;
    }
  }

  const latestProblemIds = new Set<string>();
  for (const [problemId, occurredAt] of lastAttemptByProblem) {
    if (occurredAt === latestAttemptTime) {
      latestProblemIds.add(problemId);
    }
  }

  return { lastAttemptByProblem, latestProblemIds };
}

function compareCandidates(
  left: Candidate,
  right: Candidate,
  input: RecommendationInput,
  today: string,
  recency: ReturnType<typeof createAttemptRecency>,
): number {
  const comparisons = [
    compareNumber(Number(!isDue(left, today)), Number(!isDue(right, today))),
    compareNumber(roadmapIndex(left.pattern), roadmapIndex(right.pattern)),
    compareNumber(focusRank(left.mastery), focusRank(right.mastery)),
    compareNumber(
      difficultyRank(left, input.profile.startingLevel),
      difficultyRank(right, input.profile.startingLevel),
    ),
    compareNumber(
      Number(recency.latestProblemIds.has(left.problem.id)),
      Number(recency.latestProblemIds.has(right.problem.id)),
    ),
    compareNumber(
      recency.lastAttemptByProblem.get(left.problem.id) ??
        Number.NEGATIVE_INFINITY,
      recency.lastAttemptByProblem.get(right.problem.id) ??
        Number.NEGATIVE_INFINITY,
    ),
    compareString(left.problem.title, right.problem.title),
    compareString(left.problem.id, right.problem.id),
  ];

  return comparisons.find((comparison) => comparison !== 0) ?? 0;
}

function createFactors(
  candidate: Candidate,
  input: RecommendationInput,
  today: string,
): RecommendationFactors {
  const shared = {
    patternName: candidate.pattern.name,
    problemTitle: candidate.problem.title,
    sessionMinutes: input.profile.minutesPerSession,
  } as const;

  if (isDue(candidate, today) && candidate.nextReviewDate !== null) {
    return {
      kind: "due_review",
      ...shared,
      reviewDate: candidate.nextReviewDate,
    };
  }

  if (candidate.mastery === "learning" || candidate.mastery === "practicing") {
    return {
      kind: "continue_pattern",
      ...shared,
      mastery: candidate.mastery,
    };
  }

  const hasPrerequisites = input.prerequisites.some(
    ({ patternId }) => patternId === candidate.pattern.id,
  );
  const patternById = new Map(
    input.patterns.map((pattern) => [pattern.id, pattern]),
  );
  const unlocks = input.prerequisites
    .filter(
      ({ prerequisitePatternId }) =>
        prerequisitePatternId === candidate.pattern.id,
    )
    .map(({ patternId }) => patternById.get(patternId))
    .filter(
      (pattern): pattern is RecommendationPattern => pattern !== undefined,
    )
    .sort(
      (left, right) =>
        compareNumber(roadmapIndex(left), roadmapIndex(right)) ||
        compareString(left.name, right.name) ||
        compareString(left.id, right.id),
    );

  if (
    candidate.mastery === "unseen" &&
    !hasPrerequisites &&
    unlocks.length > 0
  ) {
    return {
      kind: "prerequisite_building",
      ...shared,
      unlocksPatternNames: unlocks.map(({ name }) => name),
    };
  }

  return { kind: "next_pattern", ...shared };
}

export function recommendNext(
  input: RecommendationInput,
): RecommendationResult {
  if (input.problems.length === 0) {
    return { status: "unavailable", reason: "catalog_empty" };
  }

  const patternById = new Map(
    input.patterns.map((pattern) => [pattern.id, pattern]),
  );
  const stateByPatternId = new Map(
    input.skillStates.map((skillState) => [skillState.patternId, skillState]),
  );
  const prerequisitesByPatternId = new Map<string, string[]>();

  for (const prerequisite of input.prerequisites) {
    const patternPrerequisites =
      prerequisitesByPatternId.get(prerequisite.patternId) ?? [];
    patternPrerequisites.push(prerequisite.prerequisitePatternId);
    prerequisitesByPatternId.set(prerequisite.patternId, patternPrerequisites);
  }

  const candidates = input.problems.flatMap((problem): Candidate[] => {
    const pattern = patternById.get(problem.patternId);
    if (
      pattern === undefined ||
      problem.estimatedMinutes > input.profile.minutesPerSession
    ) {
      return [];
    }

    const prerequisiteIds = prerequisitesByPatternId.get(pattern.id) ?? [];
    const isEligible = prerequisiteIds.every(
      (prerequisiteId) =>
        stateByPatternId.get(prerequisiteId)?.mastery === "reliable",
    );
    if (!isEligible) {
      return [];
    }

    const skillState = stateByPatternId.get(pattern.id);
    return [
      {
        problem,
        pattern,
        mastery: skillState?.mastery ?? "unseen",
        nextReviewDate: skillState?.nextReviewDate ?? null,
      },
    ];
  });

  if (candidates.length === 0) {
    return { status: "unavailable", reason: "no_session_fit" };
  }

  const today = toUtcDateKey(input.now);
  const dueCandidates = candidates.filter((candidate) =>
    isDue(candidate, today),
  );
  const nonReliableCandidates = candidates.filter(
    ({ mastery }) => mastery !== "reliable",
  );
  const candidatePool =
    dueCandidates.length > 0
      ? dueCandidates
      : nonReliableCandidates.length > 0
        ? nonReliableCandidates
        : candidates;
  const recency = createAttemptRecency(input.attempts);
  const selected = [...candidatePool].sort((left, right) =>
    compareCandidates(left, right, input, today, recency),
  )[0];

  if (selected === undefined) {
    return { status: "unavailable", reason: "no_session_fit" };
  }

  const factors = createFactors(selected, input, today);

  return {
    status: "recommended",
    problem: selected.problem,
    pattern: selected.pattern,
    factors,
    reason: formatRecommendationReason(factors),
  };
}
