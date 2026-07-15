import "server-only";

import { systemClock, type Clock } from "../../lib/clock";
import { createId } from "../../lib/id";
import { toUtcDateKey } from "../../lib/utc-date";
import { PATTERN_DEFINITIONS } from "../catalog/roadmap";
import { rebuildMemory } from "../memory/rebuild-memory.server";
import {
  getSkillDisplayState,
  type SkillDisplayState,
} from "../memory/project-skill-state";
import { getTrainingRepository } from "../training/training-repository.server";
import type {
  Attempt,
  Pattern,
  PatternPrerequisite,
  SkillState,
  TrainingRepository,
} from "../training/training-repository";
import { selectDueReviews, type DueReview } from "./select-due-reviews";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000;

export interface ProgressViewModel {
  readonly profile: Readonly<{
    daysRemaining: number;
    sessionsCompleted: number;
    dueReviewCount: number;
  }>;
  readonly patterns: readonly Readonly<{
    id: string;
    name: string;
    displayState: SkillDisplayState;
    recentSuccess: number;
    evidenceSummary: string;
    nextReviewDate: string | null;
  }>[];
  readonly dueReviews: readonly DueReview[];
}

export type GetProgressDependencies = Readonly<{
  repository: TrainingRepository;
  clock: Clock;
  rebuildMemory(): Promise<readonly SkillState[]>;
}>;

function runtimeDependencies(): GetProgressDependencies {
  const repository = getTrainingRepository();

  return {
    repository,
    clock: systemClock,
    rebuildMemory: () =>
      rebuildMemory({ repository, ids: createId, clock: systemClock }),
  };
}

function compareString(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const roadmapRank: ReadonlyMap<string, number> = new Map(
  PATTERN_DEFINITIONS.map(({ slug }, index) => [slug, index]),
);

function comparePatterns(left: Pattern, right: Pattern): number {
  return (
    (roadmapRank.get(left.slug) ?? Number.MAX_SAFE_INTEGER) -
      (roadmapRank.get(right.slug) ?? Number.MAX_SAFE_INTEGER) ||
    compareString(left.name, right.name) ||
    compareString(left.id, right.id)
  );
}

function orderRoadmapPatterns(
  patterns: readonly Pattern[],
  prerequisites: readonly PatternPrerequisite[],
): readonly Pattern[] {
  const patternById = new Map(patterns.map((pattern) => [pattern.id, pattern]));
  const prerequisiteCount = new Map(patterns.map(({ id }) => [id, 0]));
  const dependentsByPattern = new Map<string, string[]>();

  for (const { patternId, prerequisitePatternId } of prerequisites) {
    if (
      !patternById.has(patternId) ||
      !patternById.has(prerequisitePatternId)
    ) {
      continue;
    }

    prerequisiteCount.set(
      patternId,
      (prerequisiteCount.get(patternId) ?? 0) + 1,
    );
    const dependents = dependentsByPattern.get(prerequisitePatternId) ?? [];
    dependents.push(patternId);
    dependentsByPattern.set(prerequisitePatternId, dependents);
  }

  const ready = patterns
    .filter(({ id }) => prerequisiteCount.get(id) === 0)
    .sort(comparePatterns);
  const ordered: Pattern[] = [];

  while (ready.length > 0) {
    const pattern = ready.shift();
    if (pattern === undefined) {
      break;
    }

    ordered.push(pattern);
    for (const dependentId of dependentsByPattern.get(pattern.id) ?? []) {
      const remaining = (prerequisiteCount.get(dependentId) ?? 0) - 1;
      prerequisiteCount.set(dependentId, remaining);
      if (remaining === 0) {
        const dependent = patternById.get(dependentId);
        if (dependent !== undefined) {
          ready.push(dependent);
          ready.sort(comparePatterns);
        }
      }
    }
  }

  if (ordered.length === patterns.length) {
    return ordered;
  }

  const orderedIds = new Set(ordered.map(({ id }) => id));
  return [
    ...ordered,
    ...patterns.filter(({ id }) => !orderedIds.has(id)).sort(comparePatterns),
  ];
}

function evidenceSummary(attempts: readonly Attempt[]): string {
  if (attempts.length === 0) {
    return "No attempts yet";
  }

  const independent = attempts.filter(
    ({ result, highestHintLevel }) =>
      result === "solved" && highestHintLevel === 0,
  );
  if (independent.length === 0) {
    return `${attempts.length} ${attempts.length === 1 ? "attempt" : "attempts"}; no independent solves yet`;
  }

  const problemCount = new Set(independent.map(({ problemId }) => problemId))
    .size;
  return `${independent.length} independent ${independent.length === 1 ? "solve" : "solves"} across ${problemCount} ${problemCount === 1 ? "problem" : "problems"}`;
}

function daysUntil(deadline: string, today: string): number {
  return Math.round(
    (Date.parse(`${deadline}T00:00:00.000Z`) -
      Date.parse(`${today}T00:00:00.000Z`)) /
      DAY_IN_MILLISECONDS,
  );
}

export async function getProgress(
  dependencies: GetProgressDependencies = runtimeDependencies(),
): Promise<ProgressViewModel | null> {
  const profile = await dependencies.repository.getProfile();
  if (profile === null) {
    return null;
  }

  const now = dependencies.clock.now();
  const today = toUtcDateKey(now);
  await dependencies.rebuildMemory();

  const [
    patterns,
    prerequisites,
    problems,
    problemPatterns,
    attempts,
    skillStates,
  ] = await Promise.all([
    dependencies.repository.getPatterns(),
    dependencies.repository.getPrerequisites(),
    dependencies.repository.getProblems(),
    dependencies.repository.getProblemPatterns(),
    dependencies.repository.getAttempts(),
    dependencies.repository.getSkillStates(),
  ]);
  const skillStateByPattern = new Map(
    skillStates.map((state) => [state.patternId, state]),
  );
  const patternIdsByProblem = new Map<string, string[]>();
  for (const { patternId, problemId } of problemPatterns) {
    const patternIds = patternIdsByProblem.get(problemId) ?? [];
    patternIds.push(patternId);
    patternIdsByProblem.set(problemId, patternIds);
  }
  const attemptsByPattern = new Map<string, Attempt[]>();
  for (const attempt of attempts) {
    for (const patternId of patternIdsByProblem.get(attempt.problemId) ?? []) {
      const patternAttempts = attemptsByPattern.get(patternId) ?? [];
      patternAttempts.push(attempt);
      attemptsByPattern.set(patternId, patternAttempts);
    }
  }
  const dueReviews = selectDueReviews({
    patterns,
    problems,
    problemPatterns,
    attempts,
    skillStates,
    today,
  });

  return {
    profile: {
      daysRemaining: daysUntil(profile.deadline, today),
      sessionsCompleted: attempts.length,
      dueReviewCount: dueReviews.length,
    },
    patterns: orderRoadmapPatterns(patterns, prerequisites).flatMap(
      (pattern) => {
        const state = skillStateByPattern.get(pattern.id);
        if (state === undefined) {
          return [];
        }

        return [
          {
            id: pattern.id,
            name: pattern.name,
            displayState: getSkillDisplayState(state, today),
            recentSuccess: state.recentSuccess,
            evidenceSummary: evidenceSummary(
              attemptsByPattern.get(pattern.id) ?? [],
            ),
            nextReviewDate: state.nextReviewDate,
          },
        ];
      },
    ),
    dueReviews,
  };
}
