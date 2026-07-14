import { describe, expect, it } from "vitest";

import {
  InvalidDatabaseConfigurationError,
  parseDatabaseConfig,
} from "./database-env";

function captureConfigurationError(
  input: Record<string, string | undefined>,
): InvalidDatabaseConfigurationError {
  try {
    parseDatabaseConfig(input);
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidDatabaseConfigurationError);
    return error as InvalidDatabaseConfigurationError;
  }

  throw new Error("Expected database configuration parsing to fail");
}

describe("parseDatabaseConfig", () => {
  it("accepts a local file URL without an auth token", () => {
    expect(
      parseDatabaseConfig({ TURSO_DATABASE_URL: "file:./dev.db" }),
    ).toEqual({
      url: "file:./dev.db",
      authToken: undefined,
    });
  });

  it("accepts a remote URL with an auth token", () => {
    expect(
      parseDatabaseConfig({
        TURSO_DATABASE_URL: "libsql://coach.example.turso.io",
        TURSO_AUTH_TOKEN: "secret",
      }),
    ).toEqual({
      url: "libsql://coach.example.turso.io",
      authToken: "secret",
    });
  });

  it("rejects a remote URL without an auth token", () => {
    expect(() =>
      parseDatabaseConfig({
        TURSO_DATABASE_URL: "libsql://coach.example.turso.io",
      }),
    ).toThrow(InvalidDatabaseConfigurationError);
  });

  it("rejects a missing database URL", () => {
    expect(() => parseDatabaseConfig({})).toThrow(
      InvalidDatabaseConfigurationError,
    );
  });

  it("does not expose supplied database values in its public error", () => {
    const suppliedUrl = "libsql://private.example.turso.io";
    const suppliedToken = "private-auth-token";

    const urlError = captureConfigurationError({
      TURSO_DATABASE_URL: suppliedUrl,
    });
    const tokenError = captureConfigurationError({
      TURSO_AUTH_TOKEN: suppliedToken,
    });

    expect(urlError.message).toBe("Database configuration is invalid");
    expect(urlError.message).not.toContain(suppliedUrl);
    expect(tokenError.message).toBe("Database configuration is invalid");
    expect(tokenError.message).not.toContain(suppliedToken);
  });
});
