import type { Clock } from "../../lib/clock";
import type { IdGenerator } from "../../lib/id";
import type {
  Attempt,
  Pattern,
  ProblemPattern,
  SkillState,
} from "../training/training-repository";
import { projectAllSkillStates } from "./project-skill-state";

export interface MemoryProjectionRepository {
  getPatterns(): Promise<readonly Pattern[]>;
  getProblemPatterns(): Promise<readonly ProblemPattern[]>;
  getAttempts(): Promise<readonly Attempt[]>;
  getSkillStates(): Promise<readonly SkillState[]>;
  replaceSkillStates(states: readonly SkillState[]): Promise<void>;
}

export type RebuildMemoryDependencies = Readonly<{
  repository: MemoryProjectionRepository;
  ids: IdGenerator;
  clock: Clock;
}>;

export async function rebuildMemoryProjection(
  dependencies: RebuildMemoryDependencies,
): Promise<readonly SkillState[]> {
  const [patterns, problemPatterns, attempts, existingStates] =
    await Promise.all([
      dependencies.repository.getPatterns(),
      dependencies.repository.getProblemPatterns(),
      dependencies.repository.getAttempts(),
      dependencies.repository.getSkillStates(),
    ]);
  const patternIdsByProblem = new Map<string, string[]>();

  for (const { patternId, problemId } of problemPatterns) {
    const patternIds = patternIdsByProblem.get(problemId) ?? [];
    patternIds.push(patternId);
    patternIdsByProblem.set(problemId, patternIds);
  }

  const evidence = attempts.flatMap((attempt) =>
    (patternIdsByProblem.get(attempt.problemId) ?? []).map((patternId) => ({
      id: attempt.id,
      patternId,
      problemId: attempt.problemId,
      result: attempt.result,
      highestHintLevel: attempt.highestHintLevel,
      occurredAt: attempt.occurredAt,
    })),
  );
  const projections = projectAllSkillStates({
    patternIds: patterns.map(({ id }) => id),
    attempts: evidence,
    now: dependencies.clock.now(),
  });
  const existingStateByPattern = new Map(
    existingStates.map((state) => [state.patternId, state]),
  );
  const states = projections.map((projection): SkillState => {
    const existing = existingStateByPattern.get(projection.patternId);

    return {
      id: existing?.id ?? dependencies.ids(),
      ...projection,
    };
  });

  await dependencies.repository.replaceSkillStates(states);

  return states;
}
