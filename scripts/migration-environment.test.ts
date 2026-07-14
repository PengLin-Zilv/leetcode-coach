import { afterEach, describe, expect, it, vi } from "vitest";

import { readMigrationEnvironment } from "./migration-environment";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readMigrationEnvironment", () => {
  it("uses only the selected file when inherited migration values conflict", async () => {
    vi.stubEnv("MIGRATION_TARGET", "production");
    vi.stubEnv("TURSO_DATABASE_URL", "libsql://inherited.example.turso.io");
    vi.stubEnv("TURSO_AUTH_TOKEN", "inherited-token");

    const readEnvironmentFile = vi.fn(async () =>
      ["MIGRATION_TARGET=local", "TURSO_DATABASE_URL=file:./selected.db"].join(
        "\n",
      ),
    );

    await expect(
      readMigrationEnvironment(".env.local", readEnvironmentFile),
    ).resolves.toEqual({
      MIGRATION_TARGET: "local",
      TURSO_DATABASE_URL: "file:./selected.db",
      TURSO_AUTH_TOKEN: undefined,
    });

    expect(readEnvironmentFile).toHaveBeenCalledWith(".env.local");
    expect(process.env.MIGRATION_TARGET).toBe("production");
    expect(process.env.TURSO_DATABASE_URL).toBe(
      "libsql://inherited.example.turso.io",
    );
    expect(process.env.TURSO_AUTH_TOKEN).toBe("inherited-token");
  });
});
