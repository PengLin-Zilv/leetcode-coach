import type { SkillMastery } from "../memory/project-skill-state";

type DueReviewPattern = Readonly<{
  id: string;
  name: string;
}>;

type DueReviewProblem = Readonly<{
  id: string;
  title: string;
}>;

type DueReviewProblemPattern = Readonly<{
  problemId: string;
  patternId: string;
}>;

type DueReviewAttempt = Readonly<{
  problemId: string;
  occurredAt: Date;
}>;

type DueReviewSkillState = Readonly<{
  patternId: string;
  mastery: SkillMastery;
  nextReviewDate: string | null;
}>;

export interface DueReview {
  readonly patternId: string;
  readonly patternName: string;
  readonly problemId: string;
  readonly problemTitle: string;
  readonly reviewDate: string;
}

export type SelectDueReviewsInput = Readonly<{
  patterns: readonly DueReviewPattern[];
  problems: readonly DueReviewProblem[];
  problemPatterns: readonly DueReviewProblemPattern[];
  attempts: readonly DueReviewAttempt[];
  skillStates: readonly DueReviewSkillState[];
  today: string;
}>;

function compareString(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function selectDueReviews(
  input: SelectDueReviewsInput,
): readonly DueReview[] {
  const patternById = new Map(
    input.patterns.map((pattern) => [pattern.id, pattern]),
  );
  const problemById = new Map(
    input.problems.map((problem) => [problem.id, problem]),
  );
  const latestAttemptByProblemId = new Map<string, number>();

  for (const attempt of input.attempts) {
    const occurredAt = attempt.occurredAt.getTime();
    if (!Number.isFinite(occurredAt)) {
      continue;
    }

    const previous = latestAttemptByProblemId.get(attempt.problemId);
    if (previous === undefined || occurredAt > previous) {
      latestAttemptByProblemId.set(attempt.problemId, occurredAt);
    }
  }

  const problemIdsByPatternId = new Map<string, string[]>();
  for (const mapping of input.problemPatterns) {
    const problemIds = problemIdsByPatternId.get(mapping.patternId) ?? [];
    problemIds.push(mapping.problemId);
    problemIdsByPatternId.set(mapping.patternId, problemIds);
  }

  return input.skillStates
    .flatMap((skillState): DueReview[] => {
      if (
        skillState.mastery === "unseen" ||
        skillState.nextReviewDate === null ||
        skillState.nextReviewDate > input.today
      ) {
        return [];
      }

      const pattern = patternById.get(skillState.patternId);
      if (pattern === undefined) {
        return [];
      }

      const selectedProblem = (problemIdsByPatternId.get(pattern.id) ?? [])
        .flatMap((problemId) => {
          const problem = problemById.get(problemId);
          const latestAttempt = latestAttemptByProblemId.get(problemId);

          return problem === undefined || latestAttempt === undefined
            ? []
            : [{ problem, latestAttempt }];
        })
        .sort(
          (left, right) =>
            right.latestAttempt - left.latestAttempt ||
            compareString(left.problem.title, right.problem.title) ||
            compareString(left.problem.id, right.problem.id),
        )[0]?.problem;

      return selectedProblem === undefined
        ? []
        : [
            {
              patternId: pattern.id,
              patternName: pattern.name,
              problemId: selectedProblem.id,
              problemTitle: selectedProblem.title,
              reviewDate: skillState.nextReviewDate,
            },
          ];
    })
    .sort(
      (left, right) =>
        compareString(left.reviewDate, right.reviewDate) ||
        compareString(left.patternName, right.patternName) ||
        compareString(left.patternId, right.patternId),
    );
}
