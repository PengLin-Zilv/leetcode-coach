import { z } from "zod";

const databaseEnvironmentSchema = z
  .object({
    TURSO_DATABASE_URL: z.string().min(1),
    TURSO_AUTH_TOKEN: z.string().min(1).optional(),
  })
  .superRefine((environment, context) => {
    if (
      !environment.TURSO_DATABASE_URL.startsWith("file:") &&
      !environment.TURSO_AUTH_TOKEN
    ) {
      context.addIssue({
        code: "custom",
        path: ["TURSO_AUTH_TOKEN"],
        message: "A remote database requires an auth token",
      });
    }
  });

export interface DatabaseConfig {
  url: string;
  authToken: string | undefined;
}

export class InvalidDatabaseConfigurationError extends Error {
  constructor(message = "Database configuration is invalid") {
    super(message);
    this.name = "InvalidDatabaseConfigurationError";
  }
}

export function parseDatabaseConfig(
  input: Record<string, string | undefined>,
): DatabaseConfig {
  const result = databaseEnvironmentSchema.safeParse(input);

  if (!result.success) {
    throw new InvalidDatabaseConfigurationError(
      "Database configuration is invalid",
    );
  }

  return {
    url: result.data.TURSO_DATABASE_URL,
    authToken: result.data.TURSO_AUTH_TOKEN,
  };
}
