"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { rebuildMemory } from "../../../../features/memory/rebuild-memory.server";
import { getMindOutputRepository } from "../../../../features/mind/mind-output-repository.server";
import { requestAttemptFeedback } from "../../../../features/mind/request-mind";
import { UnavailableMindGateway } from "../../../../features/mind/unavailable-gateway.server";
import {
  clearActivePractice,
  issuePracticeDraftCleanupToken,
  readActivePractice,
} from "../../../../features/practice/active-practice.server";
import { completeAttempt } from "../../../../features/training/complete-attempt";
import { getTrainingRepository } from "../../../../features/training/training-repository.server";
import { systemClock, type Clock } from "../../../../lib/clock";
import { createId } from "../../../../lib/id";

const problemIdSchema = z.uuidv7();
const reflectionFormSchema = z
  .object({
    result: z.enum(["solved", "not_solved", "viewed_solution"]),
    confidence: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.enum(["1", "2", "3", "4", "5"]).optional(),
    ),
    note: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      z.string().trim().min(1).max(2_000).optional(),
    ),
  })
  .strict();

type ReflectionField = keyof z.infer<typeof reflectionFormSchema>;

export type AttemptReflectionActionState = Readonly<{
  fieldErrors?: Partial<Record<ReflectionField, readonly string[]>>;
  formError?: string;
}>;

export async function submitAttemptReflectionAction(
  untrustedProblemId: string,
  _state: AttemptReflectionActionState,
  formData: FormData,
): Promise<AttemptReflectionActionState> {
  const problemId = problemIdSchema.safeParse(untrustedProblemId);
  const parsed = reflectionFormSchema.safeParse({
    result: formData.get("result"),
    confidence: formData.get("confidence"),
    note: formData.get("note"),
  });

  if (!problemId.success || !parsed.success) {
    return {
      fieldErrors: parsed.success
        ? undefined
        : parsed.error.flatten().fieldErrors,
    };
  }

  const now = systemClock.now();
  const requestClock: Clock = { now: () => new Date(now.getTime()) };
  const active = await readActivePractice(problemId.data, requestClock);
  if (active === null || active.problemId !== problemId.data) {
    return {
      formError: "This practice session is no longer active. Start from Today.",
    };
  }

  const startedAt = Date.parse(active.startedAt);
  const durationMinutes = Math.min(
    180,
    Math.max(1, Math.ceil((now.getTime() - startedAt) / 60_000)),
  );
  const repository = getTrainingRepository();
  const attemptInput = {
    problemId: problemId.data,
    result: parsed.data.result,
    durationMinutes,
    confidence: parsed.data.confidence,
    note: parsed.data.note,
    highestHintLevel: active.highestHintLevel,
    occurredAt: now.toISOString(),
  } as const;

  let completion;
  try {
    completion = await completeAttempt(
      {
        repository,
        ids: createId,
        clock: requestClock,
        rebuildMemory: () =>
          rebuildMemory({ repository, ids: createId, clock: requestClock }),
      },
      attemptInput,
    );
  } catch {
    return { formError: "Your attempt could not be saved. Try again." };
  }

  const cleanupToken = issuePracticeDraftCleanupToken({
    attemptId: completion.attemptId,
    problemId: problemId.data,
    startedAt: active.startedAt,
  });

  try {
    const [problems, patterns, problemPatterns] = await Promise.all([
      repository.getProblems(),
      repository.getPatterns(),
      repository.getProblemPatterns(),
    ]);
    const problem = problems.find(({ id }) => id === problemId.data);
    const patternId = problemPatterns.find(
      ({ problemId: mappedProblemId }) => mappedProblemId === problemId.data,
    )?.patternId;
    const pattern = patterns.find(({ id }) => id === patternId);

    if (problem !== undefined && pattern !== undefined) {
      await requestAttemptFeedback(
        {
          gateway: new UnavailableMindGateway(),
          repository: getMindOutputRepository(),
          ids: createId,
          clock: requestClock,
        },
        {
          attemptId: completion.attemptId,
          patternId: pattern.id,
          problemTitle: problem.title,
          patternName: pattern.name,
          result: parsed.data.result,
          durationMinutes,
          confidence:
            parsed.data.confidence === undefined
              ? null
              : Number(parsed.data.confidence),
          highestHintLevel: active.highestHintLevel,
          note: parsed.data.note ?? null,
        },
      );
    }
  } catch {
    // Optional coaching cannot invalidate or hide a committed Attempt.
  }

  await clearActivePractice();
  revalidatePath("/today");
  revalidatePath("/progress");
  revalidatePath(`/feedback/${completion.attemptId}`);
  redirect(
    `/feedback/${completion.attemptId}?cleanup=${encodeURIComponent(cleanupToken)}`,
  );
}
