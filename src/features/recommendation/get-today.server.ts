import "server-only";

import type { Clock } from "../../lib/clock";
import { systemClock } from "../../lib/clock";
import { createId } from "../../lib/id";
import { rebuildMemory } from "../memory/rebuild-memory.server";
import { getTrainingRepository } from "../training/training-repository.server";
import type {
  SkillState,
  TrainingRepository,
} from "../training/training-repository";
import { recommendNext, type RecommendationResult } from "./recommend-next";

export type GetTodayDependencies = Readonly<{
  repository: TrainingRepository;
  clock: Clock;
  rebuildMemory(): Promise<readonly SkillState[]>;
}>;

function runtimeDependencies(): GetTodayDependencies {
  const repository = getTrainingRepository();

  return {
    repository,
    clock: systemClock,
    rebuildMemory: () =>
      rebuildMemory({ repository, ids: createId, clock: systemClock }),
  };
}

export async function getTodayRecommendation(
  dependencies: GetTodayDependencies = runtimeDependencies(),
): Promise<RecommendationResult> {
  await dependencies.rebuildMemory();

  const [
    profile,
    patterns,
    prerequisites,
    problems,
    problemPatterns,
    attempts,
    skillStates,
  ] = await Promise.all([
    dependencies.repository.getProfile(),
    dependencies.repository.getPatterns(),
    dependencies.repository.getPrerequisites(),
    dependencies.repository.getProblems(),
    dependencies.repository.getProblemPatterns(),
    dependencies.repository.getAttempts(),
    dependencies.repository.getSkillStates(),
  ]);

  if (profile === null) {
    throw new Error("A Profile is required before requesting Today");
  }

  const problemById = new Map(problems.map((problem) => [problem.id, problem]));
  const recommendationProblems = problemPatterns.flatMap(
    ({ patternId, problemId }) => {
      const problem = problemById.get(problemId);

      return problem
        ? [
            {
              id: problem.id,
              patternId,
              title: problem.title,
              difficulty: problem.difficulty,
              url: problem.url,
              estimatedMinutes: problem.estimatedMinutes,
              source: problem.source,
            },
          ]
        : [];
    },
  );

  return recommendNext({
    profile,
    patterns,
    prerequisites,
    problems: recommendationProblems,
    skillStates,
    attempts,
    now: dependencies.clock.now(),
  });
}
