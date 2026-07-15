"use server";

import "server-only";

import { z } from "zod";

import { UnavailableMindGateway } from "../../../features/mind/unavailable-gateway.server";
import { requestPracticeHint } from "../../../features/mind/request-mind";
import { applyPracticeEvent } from "../../../features/practice/active-practice";
import {
  readActivePractice,
  writeActivePractice,
} from "../../../features/practice/active-practice.server";
import { getTrainingRepository } from "../../../features/training/training-repository.server";

const hintActionInputSchema = z
  .object({
    problemId: z.uuidv7(),
    attemptSummary: z.string().trim().min(1).max(2_000),
    kind: z.enum(["next_hint", "simpler", "example", "trace"]),
  })
  .strict();

export type HintActionResult =
  | Readonly<{
      status: "hint";
      body: string;
      hintLevel: 1 | 2 | 3 | 4;
    }>
  | Readonly<{
      status: "unavailable";
      message: "Coaching is temporarily unavailable";
    }>;

const unavailable = (): HintActionResult => ({
  status: "unavailable",
  message: "Coaching is temporarily unavailable",
});

export async function requestHintAction(
  untrustedInput: unknown,
): Promise<HintActionResult> {
  const parsedInput = hintActionInputSchema.safeParse(untrustedInput);
  if (!parsedInput.success) {
    return unavailable();
  }

  const active = await readActivePractice(parsedInput.data.problemId);
  if (
    active === null ||
    (parsedInput.data.kind === "next_hint" && active.highestHintLevel === 4) ||
    (parsedInput.data.kind !== "next_hint" && active.highestHintLevel === 0)
  ) {
    return unavailable();
  }

  const repository = getTrainingRepository();
  const [problems, patterns, problemPatterns] = await Promise.all([
    repository.getProblems(),
    repository.getPatterns(),
    repository.getProblemPatterns(),
  ]);
  const problem = problems.find(({ id }) => id === parsedInput.data.problemId);
  const patternId = problemPatterns.find(
    ({ problemId }) => problemId === parsedInput.data.problemId,
  )?.patternId;
  const pattern = patterns.find(({ id }) => id === patternId);

  if (problem === undefined || pattern === undefined) {
    return unavailable();
  }

  const context = {
    problemId: problem.id,
    problemTitle: problem.title,
    patternName: pattern.name,
    attemptSummary: parsedInput.data.attemptSummary,
  };
  const result =
    parsedInput.data.kind === "next_hint"
      ? await requestPracticeHint(
          { gateway: new UnavailableMindGateway() },
          {
            ...context,
            kind: "next_hint",
            currentHintLevel: active.highestHintLevel as 0 | 1 | 2 | 3,
          },
        )
      : await requestPracticeHint(
          { gateway: new UnavailableMindGateway() },
          {
            ...context,
            kind: parsedInput.data.kind,
            currentHintLevel: active.highestHintLevel as 1 | 2 | 3 | 4,
          },
        );

  if (result.status === "unavailable") {
    return unavailable();
  }

  if (parsedInput.data.kind !== "next_hint") {
    return result.hintLevel === active.highestHintLevel
      ? result
      : unavailable();
  }

  let updatedActive;
  try {
    updatedActive = applyPracticeEvent(active, {
      type: "hint_received",
      hintLevel: result.hintLevel,
    });
  } catch {
    return unavailable();
  }

  await writeActivePractice(updatedActive);

  return result;
}
