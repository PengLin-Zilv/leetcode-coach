import { z } from "zod";

const optionalFromForm = <Schema extends z.ZodType>(schema: Schema) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    schema.optional(),
  );

const DECIMAL_INTEGER_PATTERN = /^-?\d+$/;

const integerFromForm = (schema: z.ZodNumber) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim();

    return DECIMAL_INTEGER_PATTERN.test(normalized)
      ? Number(normalized)
      : value;
  }, schema.int());

export const profileInputSchema = z
  .object({
    deadline: z.iso.date(),
    sessionsPerWeek: integerFromForm(z.number().min(1).max(7)),
    minutesPerSession: integerFromForm(z.number()).pipe(
      z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
    ),
    startingLevel: z.enum(["new", "some", "reviewing"]),
  })
  .strict();

export const attemptInputSchema = z
  .object({
    problemId: z.uuidv7(),
    result: z.enum(["solved", "not_solved", "viewed_solution"]),
    durationMinutes: integerFromForm(z.number().min(0)),
    confidence: optionalFromForm(integerFromForm(z.number().min(1).max(5))),
    note: optionalFromForm(z.string().trim().min(1)),
    highestHintLevel: integerFromForm(z.number().min(0).max(4)),
    occurredAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const reflectionInputSchema = z
  .object({
    body: z.string().trim().min(1),
    occurredAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type ProfileInput = Readonly<z.infer<typeof profileInputSchema>>;
export type AttemptInput = Readonly<z.infer<typeof attemptInputSchema>>;
export type ReflectionInput = Readonly<z.infer<typeof reflectionInputSchema>>;
