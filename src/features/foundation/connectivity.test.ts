import { describe, expect, it, vi } from "vitest";

import { InvalidDatabaseConfigurationError } from "../../config/database-env";

import { checkFoundationConnectivity } from "./connectivity";

function createLogger() {
  return {
    error: vi.fn(),
  };
}

describe("checkFoundationConnectivity", () => {
  it("reports a successful database probe as connected", async () => {
    const logger = createLogger();

    await expect(
      checkFoundationConnectivity(async () => ({ connected: 1 }), logger),
    ).resolves.toEqual({
      status: "connected",
    });
  });

  it("reports an unexpected database response as unavailable", async () => {
    const logger = createLogger();

    await expect(
      checkFoundationConnectivity(async () => ({ connected: 0 }), logger),
    ).resolves.toEqual({
      status: "foundation_unavailable",
      reason: "unexpected_database_response",
    });
  });

  it("reports invalid database configuration as unavailable", async () => {
    const logger = createLogger();

    await expect(
      checkFoundationConnectivity(async () => {
        throw new InvalidDatabaseConfigurationError();
      }, logger),
    ).resolves.toEqual({
      status: "foundation_unavailable",
      reason: "invalid_configuration",
    });
  });

  it("reports an unreachable database without logging sensitive details", async () => {
    const logger = createLogger();
    const sensitiveMessage = "libsql://secret-host";

    await expect(
      checkFoundationConnectivity(async () => {
        throw new Error(sensitiveMessage);
      }, logger),
    ).resolves.toEqual({
      status: "foundation_unavailable",
      reason: "database_unreachable",
    });

    expect(logger.error).toHaveBeenCalledWith({
      code: "foundation_database_probe_failed",
      errorName: "Error",
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      sensitiveMessage,
    );
  });
});
