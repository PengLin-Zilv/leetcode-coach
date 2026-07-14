import type { AttemptInput } from "../training/contracts";
import { addUtcDays, toUtcDateKey } from "../../lib/utc-date";

export type PatternAttemptEvidence = Readonly<{
  id: string;
  patternId: string;
  problemId: string;
  result: AttemptInput["result"];
  highestHintLevel: number;
  occurredAt: Date;
}>;

export type SkillMastery = "unseen" | "learning" | "practicing" | "reliable";

export type SkillDisplayState = SkillMastery | "review_due";

export type ProjectedSkillState = Readonly<{
  patternId: string;
  mastery: SkillMastery;
  recentSuccess: number;
  nextReviewDate: string | null;
  lastComputedAt: Date;
}>;

export type ProjectSkillStateInput = Readonly<{
  patternId: string;
  attempts: readonly PatternAttemptEvidence[];
  now: Date;
}>;

export type ProjectAllSkillStatesInput = Readonly<{
  patternIds: readonly string[];
  attempts: readonly PatternAttemptEvidence[];
  now: Date;
}>;

export function isIndependentSuccess(attempt: PatternAttemptEvidence): boolean {
  return attempt.result === "solved" && attempt.highestHintLevel === 0;
}

function compareAttempts(
  left: PatternAttemptEvidence,
  right: PatternAttemptEvidence,
): number {
  const occurredAtDifference =
    left.occurredAt.getTime() - right.occurredAt.getTime();

  if (occurredAtDifference !== 0) {
    return occurredAtDifference;
  }

  if (left.id < right.id) {
    return -1;
  }

  return left.id > right.id ? 1 : 0;
}

export function projectSkillState({
  patternId,
  attempts: inputAttempts,
  now,
}: ProjectSkillStateInput): ProjectedSkillState {
  const attempts = inputAttempts
    .filter((attempt) => attempt.patternId === patternId)
    .sort(compareAttempts);
  const independent = attempts.filter(isIndependentSuccess);
  const distinctIndependentProblems = new Set(
    independent.map(({ problemId }) => problemId),
  ).size;

  const mastery: SkillMastery =
    attempts.length === 0
      ? "unseen"
      : distinctIndependentProblems >= 2
        ? "reliable"
        : distinctIndependentProblems === 1
          ? "practicing"
          : "learning";

  const recentSuccess = attempts.slice(-3).filter(isIndependentSuccess).length;
  const latestAttempt = attempts.at(-1);
  const nextReviewDate = latestAttempt
    ? addUtcDays(
        toUtcDateKey(latestAttempt.occurredAt),
        !isIndependentSuccess(latestAttempt)
          ? 1
          : mastery === "reliable"
            ? 7
            : 3,
      )
    : null;

  return {
    patternId,
    mastery,
    recentSuccess,
    nextReviewDate,
    lastComputedAt: new Date(now.getTime()),
  };
}

export function projectAllSkillStates({
  patternIds,
  attempts,
  now,
}: ProjectAllSkillStatesInput): ProjectedSkillState[] {
  return patternIds.map((patternId) =>
    projectSkillState({ patternId, attempts, now }),
  );
}

export function getSkillDisplayState(
  state: ProjectedSkillState,
  today: string,
): SkillDisplayState {
  if (
    state.mastery !== "unseen" &&
    state.nextReviewDate !== null &&
    state.nextReviewDate <= today
  ) {
    return "review_due";
  }

  return state.mastery;
}
