import { z } from "zod";

import { InvalidDatabaseConfigurationError } from "../../config/database-env";

const databaseProbeResponseSchema = z.object({
  connected: z.literal(1),
});

export type DatabaseProbe = () => Promise<unknown>;

export interface FoundationLogger {
  error(diagnostic: {
    readonly code: "foundation_database_probe_failed";
    readonly errorName: string;
  }): void;
}

export type FoundationConnectivityResult =
  | { readonly status: "connected" }
  | {
      readonly status: "foundation_unavailable";
      readonly reason:
        | "invalid_configuration"
        | "database_unreachable"
        | "unexpected_database_response";
    };

function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

export async function checkFoundationConnectivity(
  probe: DatabaseProbe,
  logger: FoundationLogger,
): Promise<FoundationConnectivityResult> {
  try {
    const response = await probe();

    if (!databaseProbeResponseSchema.safeParse(response).success) {
      return {
        status: "foundation_unavailable",
        reason: "unexpected_database_response",
      };
    }

    return { status: "connected" };
  } catch (error) {
    logger.error({
      code: "foundation_database_probe_failed",
      errorName: getErrorName(error),
    });

    return {
      status: "foundation_unavailable",
      reason:
        error instanceof InvalidDatabaseConfigurationError
          ? "invalid_configuration"
          : "database_unreachable",
    };
  }
}
