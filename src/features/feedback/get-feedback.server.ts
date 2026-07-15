import "server-only";

import { z } from "zod";

import { toUtcDateKey } from "../../lib/utc-date";
import { mindOutputSchema } from "../mind/contracts";
import {
  getMindOutputRepository,
  type MindOutputStore,
} from "../mind/mind-output-repository.server";
import {
  projectSkillState,
  type SkillMastery,
} from "../memory/project-skill-state";
import { getTrainingRepository } from "../training/training-repository.server";
import type {
  Attempt,
  Pattern,
  Problem,
  ProblemPattern,
  SkillState,
} from "../training/training-repository";

const attemptIdSchema = z.uuidv7();
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000;

export interface FeedbackRepository {
  getAttempt(id: string): Promise<Attempt | null>;
  getAttempts(): Promise<readonly Attempt[]>;
  getPatterns(): Promise<readonly Pattern[]>;
  getProblems(): Promise<readonly Problem[]>;
  getProblemPatterns(): Promise<readonly ProblemPattern[]>;
  getSkillStates(): Promise<readonly SkillState[]>;
  getSingleForAttempt: MindOutputStore["getSingleForAttempt"];
}

export type FeedbackMemoryChange = Readonly<{
  patternId: string;
  patternName: string;
  before: SkillMastery;
  after: SkillMastery;
  nextReviewDate: string;
  reviewCue: string;
}>;

export type FeedbackView = Readonly<{
  attempt: Attempt;
  problemTitle: string;
  observation: string;
  mindFeedback: string | null;
  memory: Readonly<{
    status: "updated" | "stale";
    changes: readonly FeedbackMemoryChange[];
  }>;
}>;

export type GetFeedbackDependencies = Readonly<{
  repository: FeedbackRepository;
}>;

function runtimeRepository(): FeedbackRepository {
  const training = getTrainingRepository();
  const mind = getMindOutputRepository();

  return {
    getAttempt: (id) => training.getAttempt(id),
    getAttempts: () => training.getAttempts(),
    getPatterns: () => training.getPatterns(),
    getProblems: () => training.getProblems(),
    getProblemPatterns: () => training.getProblemPatterns(),
    getSkillStates: () => training.getSkillStates(),
    getSingleForAttempt: (id) => mind.getSingleForAttempt(id),
  };
}

function patternEvidence(
  patternId: string,
  attempts: readonly Attempt[],
  patternIdsByProblem: ReadonlyMap<string, readonly string[]>,
  excludedAttemptId?: string,
) {
  return attempts.flatMap((attempt) =>
    attempt.id !== excludedAttemptId &&
    (patternIdsByProblem.get(attempt.problemId) ?? []).includes(patternId)
      ? [
          {
            id: attempt.id,
            patternId,
            problemId: attempt.problemId,
            result: attempt.result,
            highestHintLevel: attempt.highestHintLevel,
            occurredAt: attempt.occurredAt,
          },
        ]
      : [],
  );
}

function reviewCue(
  patternName: string,
  nextReviewDate: string,
  occurredAt: Date,
): string {
  const occurredDate = toUtcDateKey(occurredAt);
  const days = Math.round(
    (Date.parse(`${nextReviewDate}T00:00:00.000Z`) -
      Date.parse(`${occurredDate}T00:00:00.000Z`)) /
      DAY_IN_MILLISECONDS,
  );

  if (days > 0) {
    return `Review ${patternName} in ${days} ${days === 1 ? "day" : "days"}.`;
  }

  return `Review ${patternName} on ${nextReviewDate}.`;
}

function attemptObservation(attempt: Attempt): string {
  if (attempt.result === "solved" && attempt.highestHintLevel === 0) {
    return `Solved independently in ${attempt.durationMinutes} ${attempt.durationMinutes === 1 ? "minute" : "minutes"}.`;
  }

  if (attempt.result === "solved") {
    return `Solved in ${attempt.durationMinutes} ${attempt.durationMinutes === 1 ? "minute" : "minutes"} after using hint level ${attempt.highestHintLevel}.`;
  }

  if (attempt.result === "viewed_solution") {
    return `Worked for ${attempt.durationMinutes} ${attempt.durationMinutes === 1 ? "minute" : "minutes"} before viewing the solution.`;
  }

  return `Recorded ${attempt.durationMinutes} ${attempt.durationMinutes === 1 ? "minute" : "minutes"} of focused work without claiming a solve.`;
}

function validatedMindFeedback(
  output: Awaited<ReturnType<FeedbackRepository["getSingleForAttempt"]>>,
  attemptId: string,
): string | null {
  if (output === null || output.type !== "single") {
    return null;
  }

  const parsed = mindOutputSchema.safeParse({
    type: output.type,
    body: output.body,
    attemptId: output.attemptId,
  });

  if (
    !parsed.success ||
    parsed.data.type !== "single" ||
    parsed.data.attemptId !== attemptId
  ) {
    return null;
  }

  return parsed.data.body;
}

export function getFeedback(
  dependencies: GetFeedbackDependencies,
  untrustedAttemptId: unknown,
): Promise<FeedbackView | null>;
export function getFeedback(
  untrustedAttemptId: unknown,
): Promise<FeedbackView | null>;
export async function getFeedback(
  dependenciesOrAttemptId: GetFeedbackDependencies | unknown,
  maybeAttemptId?: unknown,
): Promise<FeedbackView | null> {
  const dependencies =
    maybeAttemptId === undefined
      ? { repository: runtimeRepository() }
      : (dependenciesOrAttemptId as GetFeedbackDependencies);
  const untrustedAttemptId =
    maybeAttemptId === undefined ? dependenciesOrAttemptId : maybeAttemptId;
  const parsedAttemptId = attemptIdSchema.safeParse(untrustedAttemptId);
  if (!parsedAttemptId.success) {
    return null;
  }

  const repository = dependencies.repository;
  const attempt = await repository.getAttempt(parsedAttemptId.data);
  if (attempt === null) {
    return null;
  }

  const [
    attempts,
    patterns,
    problems,
    problemPatterns,
    skillStates,
    mindOutput,
  ] = await Promise.all([
    repository.getAttempts(),
    repository.getPatterns(),
    repository.getProblems(),
    repository.getProblemPatterns(),
    repository.getSkillStates(),
    repository.getSingleForAttempt(attempt.id),
  ]);
  const problem = problems.find(({ id }) => id === attempt.problemId);
  if (problem === undefined) {
    return null;
  }

  const patternIdsByProblem = new Map<string, string[]>();
  for (const mapping of problemPatterns) {
    const patternIds = patternIdsByProblem.get(mapping.problemId) ?? [];
    patternIds.push(mapping.patternId);
    patternIdsByProblem.set(mapping.problemId, patternIds);
  }

  const patternById = new Map(patterns.map((pattern) => [pattern.id, pattern]));
  const persistedStateByPattern = new Map(
    skillStates.map((state) => [state.patternId, state]),
  );
  const mappedPatternIds = [
    ...new Set(patternIdsByProblem.get(attempt.problemId) ?? []),
  ];
  const changes = mappedPatternIds.flatMap((patternId) => {
    const pattern = patternById.get(patternId);
    if (pattern === undefined) {
      return [];
    }

    const before = projectSkillState({
      patternId,
      attempts: patternEvidence(
        patternId,
        attempts,
        patternIdsByProblem,
        attempt.id,
      ),
      now: attempt.createdAt,
    });
    const after = projectSkillState({
      patternId,
      attempts: patternEvidence(patternId, attempts, patternIdsByProblem),
      now: attempt.createdAt,
    });

    return after.nextReviewDate === null
      ? []
      : [
          {
            patternId,
            patternName: pattern.name,
            before: before.mastery,
            after: after.mastery,
            nextReviewDate: after.nextReviewDate,
            reviewCue: reviewCue(
              pattern.name,
              after.nextReviewDate,
              attempt.occurredAt,
            ),
          },
        ];
  });

  if (changes.length === 0) {
    return null;
  }

  const memoryIsStale = mappedPatternIds.some((patternId) => {
    const persisted = persistedStateByPattern.get(patternId);
    return (
      persisted === undefined ||
      persisted.lastComputedAt.getTime() < attempt.createdAt.getTime()
    );
  });

  return {
    attempt,
    problemTitle: problem.title,
    observation: attemptObservation(attempt),
    mindFeedback: validatedMindFeedback(mindOutput, attempt.id),
    memory: {
      status: memoryIsStale ? "stale" : "updated",
      changes,
    },
  };
}
