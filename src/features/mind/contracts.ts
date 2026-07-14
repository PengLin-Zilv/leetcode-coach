import { z } from "zod";

const uuidV7Schema = z.uuidv7();
const nonEmptyBodySchema = z.string().trim().min(1);

const singleMindOutputSchema = z
  .object({
    type: z.literal("single"),
    body: nonEmptyBodySchema,
    attemptId: uuidV7Schema,
  })
  .strict();

const patternMindOutputSchema = z
  .object({
    type: z.literal("pattern"),
    body: nonEmptyBodySchema,
    patternId: uuidV7Schema,
    sourceAttemptIds: z
      .array(uuidV7Schema)
      .min(1)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict();

export const mindOutputSchema = z.discriminatedUnion("type", [
  singleMindOutputSchema,
  patternMindOutputSchema,
]);

const practiceHintContextShape = {
  problemId: uuidV7Schema,
  problemTitle: z.string().trim().min(1),
  patternName: z.string().trim().min(1),
  attemptSummary: z.string().trim().min(1),
};

const nextHintRequestSchema = z
  .object({
    ...practiceHintContextShape,
    kind: z.literal("next_hint"),
    currentHintLevel: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(3),
    ]),
  })
  .strict();

const presentationHintRequestSchema = z
  .object({
    ...practiceHintContextShape,
    kind: z.enum(["simpler", "example", "trace"]),
    currentHintLevel: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
    ]),
  })
  .strict();

export const practiceHintRequestSchema = z.discriminatedUnion("kind", [
  nextHintRequestSchema,
  presentationHintRequestSchema,
]);

export const practiceHintResponseSchema = z
  .object({ body: nonEmptyBodySchema })
  .strict();

export const attemptFeedbackRequestSchema = z
  .object({
    attemptId: uuidV7Schema,
    patternId: uuidV7Schema,
    problemTitle: z.string().trim().min(1),
    patternName: z.string().trim().min(1),
    result: z.enum(["solved", "not_solved", "viewed_solution"]),
    durationMinutes: z.number().int().min(0),
    confidence: z.number().int().min(1).max(5).nullable(),
    highestHintLevel: z.number().int().min(0).max(4),
    note: z.string().trim().min(1).nullable(),
  })
  .strict();

export type MindOutput = Readonly<z.infer<typeof mindOutputSchema>>;
export type PracticeHintRequest = Readonly<
  z.infer<typeof practiceHintRequestSchema>
>;
export type AttemptFeedbackRequest = Readonly<
  z.infer<typeof attemptFeedbackRequestSchema>
>;
