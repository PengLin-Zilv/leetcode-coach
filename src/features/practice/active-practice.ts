import { z } from "zod";

const problemIdSchema = z.uuidv7();
const hintLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

const activePracticeSchema = z
  .object({
    problemId: problemIdSchema,
    startedAt: z.iso.datetime({ offset: true }),
    highestHintLevel: hintLevelSchema,
  })
  .strict();

const practiceEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("presentation_changed"),
      mode: z.enum(["simpler", "example", "trace"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("hint_received"),
      hintLevel: z.union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
      ]),
    })
    .strict(),
]);

export interface ActivePractice {
  readonly problemId: string;
  readonly startedAt: string;
  readonly highestHintLevel: 0 | 1 | 2 | 3 | 4;
}

export type PracticeEvent = Readonly<z.infer<typeof practiceEventSchema>>;

export function startPractice(problemId: unknown, now: Date): ActivePractice {
  const parsedProblemId = problemIdSchema.parse(problemId);

  if (!Number.isFinite(now.getTime())) {
    throw new Error("Practice requires a valid start time");
  }

  return {
    problemId: parsedProblemId,
    startedAt: now.toISOString(),
    highestHintLevel: 0,
  };
}

export function applyPracticeEvent(
  active: ActivePractice,
  event: PracticeEvent,
): ActivePractice {
  const parsedActive = activePracticeSchema.parse(active);
  const parsedEvent = practiceEventSchema.parse(event);

  if (parsedEvent.type === "presentation_changed") {
    return parsedActive;
  }

  if (parsedEvent.hintLevel !== parsedActive.highestHintLevel + 1) {
    throw new Error("A received hint must advance by exactly one level");
  }

  return {
    ...parsedActive,
    highestHintLevel: parsedEvent.hintLevel,
  };
}

export function parseActivePracticeCookie(
  value: string | undefined,
  routeProblemId: unknown,
  now: Date,
): ActivePractice | null {
  const parsedRouteProblemId = problemIdSchema.safeParse(routeProblemId);

  if (
    !parsedRouteProblemId.success ||
    value === undefined ||
    !Number.isFinite(now.getTime())
  ) {
    return null;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(value);
  } catch {
    return null;
  }

  const parsedActive = activePracticeSchema.safeParse(decoded);
  if (
    !parsedActive.success ||
    parsedActive.data.problemId !== parsedRouteProblemId.data ||
    Date.parse(parsedActive.data.startedAt) > now.getTime()
  ) {
    return null;
  }

  return parsedActive.data;
}
