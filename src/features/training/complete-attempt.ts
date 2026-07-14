import type { Clock } from "../../lib/clock";
import type { IdGenerator } from "../../lib/id";
import { attemptInputSchema } from "./contracts";
import type { SkillState, TrainingRepository } from "./training-repository";

export type CompleteAttemptResult = Readonly<{
  status: "completed";
  attemptId: string;
  memory:
    | Readonly<{ status: "updated" }>
    | Readonly<{ status: "stale"; reason: "projection_failed" }>;
}>;

export type CompleteAttemptDependencies = Readonly<{
  repository: TrainingRepository;
  ids: IdGenerator;
  clock: Clock;
  rebuildMemory(): Promise<readonly SkillState[]>;
}>;

export async function completeAttempt(
  dependencies: CompleteAttemptDependencies,
  input: unknown,
): Promise<CompleteAttemptResult> {
  const parsed = attemptInputSchema.parse(input);
  const createdAt = dependencies.clock.now();
  const attempt = {
    id: dependencies.ids(),
    problemId: parsed.problemId,
    result: parsed.result,
    durationMinutes: parsed.durationMinutes,
    confidence: parsed.confidence ?? null,
    note: parsed.note ?? null,
    highestHintLevel: parsed.highestHintLevel,
    occurredAt: new Date(parsed.occurredAt),
    createdAt: new Date(createdAt.getTime()),
  } as const;

  await dependencies.repository.insertAttempt(attempt);

  try {
    await dependencies.rebuildMemory();

    return {
      status: "completed",
      attemptId: attempt.id,
      memory: { status: "updated" },
    };
  } catch {
    return {
      status: "completed",
      attemptId: attempt.id,
      memory: { status: "stale", reason: "projection_failed" },
    };
  }
}
