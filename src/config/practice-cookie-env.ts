import { z } from "zod";

const NON_PRODUCTION_SECRET =
  "leetcode-coach-non-production-practice-cookie-secret-v1";

const practiceCookieEnvironmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PRACTICE_COOKIE_SECRET: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(32).optional(),
    ),
  })
  .superRefine((environment, context) => {
    if (
      environment.NODE_ENV === "production" &&
      environment.PRACTICE_COOKIE_SECRET === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["PRACTICE_COOKIE_SECRET"],
        message: "Production requires a practice cookie secret",
      });
    }
  });

export interface PracticeCookieConfig {
  readonly secret: string;
}

export class InvalidPracticeCookieConfigurationError extends Error {
  constructor(message = "Practice cookie configuration is invalid") {
    super(message);
    this.name = "InvalidPracticeCookieConfigurationError";
  }
}

export function parsePracticeCookieConfig(
  input: Record<string, string | undefined>,
): PracticeCookieConfig {
  const result = practiceCookieEnvironmentSchema.safeParse(input);

  if (!result.success) {
    throw new InvalidPracticeCookieConfigurationError();
  }

  return {
    secret: result.data.PRACTICE_COOKIE_SECRET ?? NON_PRODUCTION_SECRET,
  };
}
