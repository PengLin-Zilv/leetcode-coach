import { describe, expect, it, vi } from "vitest";

import type { seedCatalog } from "./catalog-seed";
import {
  runCatalogSeedCommand,
  type CatalogSeedCommandDependencies,
} from "./seed-catalog";

const successMessage =
  "Catalog seed completed: 18 patterns, 21 prerequisite edges, 150 problems, 150 problem mappings";

function createHarness(
  overrides: Partial<CatalogSeedCommandDependencies> = {},
) {
  const info = vi.fn();
  const error = vi.fn();
  const close = vi.fn();
  const database = {} as Parameters<typeof seedCatalog>[0];
  const readEnvironment = vi.fn(async (envFile: string) => {
    const production = envFile === ".env.production.local";

    return {
      MIGRATION_TARGET: production ? "production" : "local",
      TURSO_DATABASE_URL: production
        ? "libsql://private.example.turso.io"
        : "file:./test.db",
      TURSO_AUTH_TOKEN: production ? "private-auth-token" : undefined,
    };
  });
  const openConnection = vi.fn(() => ({
    database,
    close,
  }));
  const seed = vi.fn(async () => undefined);
  const dependencies: CatalogSeedCommandDependencies = {
    readEnvironment,
    openConnection,
    seed,
    info,
    error,
    ...overrides,
  };

  return {
    close,
    database,
    dependencies,
    error,
    info,
    openConnection,
    readEnvironment,
    seed,
  };
}

describe("runCatalogSeedCommand", () => {
  it("selects the local environment and logs only stable success output", async () => {
    const harness = createHarness();

    await expect(
      runCatalogSeedCommand(["local"], harness.dependencies),
    ).resolves.toBe(0);

    expect(harness.readEnvironment).toHaveBeenCalledWith(".env.local");
    expect(harness.openConnection).toHaveBeenCalledWith({
      url: "file:./test.db",
      authToken: undefined,
    });
    expect(harness.seed).toHaveBeenCalledOnce();
    expect(harness.close).toHaveBeenCalledOnce();
    expect(harness.info.mock.calls.flat()).toEqual([
      "Catalog seed target: local",
      successMessage,
    ]);
    expect(harness.error).not.toHaveBeenCalled();
  });

  it("requires confirmation before selecting the production environment", async () => {
    const rejected = createHarness();

    await expect(
      runCatalogSeedCommand(["production"], rejected.dependencies),
    ).resolves.toBe(1);
    expect(rejected.readEnvironment).not.toHaveBeenCalled();
    expect(rejected.openConnection).not.toHaveBeenCalled();
    expect(rejected.error).toHaveBeenCalledWith("Catalog seed failed");

    const confirmed = createHarness();

    await expect(
      runCatalogSeedCommand(
        ["production", "--confirm-production"],
        confirmed.dependencies,
      ),
    ).resolves.toBe(0);
    expect(confirmed.readEnvironment).toHaveBeenCalledWith(
      ".env.production.local",
    );
    expect(confirmed.openConnection).toHaveBeenCalledWith({
      url: "libsql://private.example.turso.io",
      authToken: "private-auth-token",
    });
    expect(confirmed.close).toHaveBeenCalledOnce();
  });

  it("rejects an environment whose selected target does not match", async () => {
    const readEnvironment = vi.fn(async () => ({
      MIGRATION_TARGET: "production",
      TURSO_DATABASE_URL: "file:./test.db",
      TURSO_AUTH_TOKEN: undefined,
    }));
    const harness = createHarness({ readEnvironment });

    await expect(
      runCatalogSeedCommand(["local"], harness.dependencies),
    ).resolves.toBe(1);
    expect(harness.openConnection).not.toHaveBeenCalled();
    expect(harness.error).toHaveBeenCalledWith("Catalog seed failed");
  });

  it.each([
    {
      label: "a remote database for local",
      args: ["local"],
      environment: {
        MIGRATION_TARGET: "local",
        TURSO_DATABASE_URL: "libsql://private.example.turso.io",
        TURSO_AUTH_TOKEN: "private-auth-token",
      },
    },
    {
      label: "a file database for production",
      args: ["production", "--confirm-production"],
      environment: {
        MIGRATION_TARGET: "production",
        TURSO_DATABASE_URL: "file:./test.db",
        TURSO_AUTH_TOKEN: undefined,
      },
    },
  ])("rejects $label", async ({ args, environment }) => {
    const readEnvironment = vi.fn(async () => environment);
    const harness = createHarness({ readEnvironment });

    await expect(
      runCatalogSeedCommand(args, harness.dependencies),
    ).resolves.toBe(1);
    expect(harness.openConnection).not.toHaveBeenCalled();
    expect(harness.error).toHaveBeenCalledWith("Catalog seed failed");
  });

  it("closes after failure and never logs secrets or raw exceptions", async () => {
    const privateUrl = "libsql://private.example.turso.io";
    const privateToken = "private-auth-token";
    const rawMessage = "raw provider exception from .env.production.local";
    const seed = vi.fn(async () => {
      throw new Error(`${rawMessage}: ${privateUrl} ${privateToken}`);
    });
    const harness = createHarness({ seed });

    await expect(
      runCatalogSeedCommand(["local"], harness.dependencies),
    ).resolves.toBe(1);

    expect(harness.close).toHaveBeenCalledOnce();
    expect(harness.error.mock.calls.flat()).toEqual(["Catalog seed failed"]);
    expect(harness.info.mock.calls.flat()).toEqual([
      "Catalog seed target: local",
    ]);

    const loggedOutput = [
      ...harness.info.mock.calls.flat(),
      ...harness.error.mock.calls.flat(),
    ].join("\n");
    expect(loggedOutput).not.toContain(privateUrl);
    expect(loggedOutput).not.toContain(privateToken);
    expect(loggedOutput).not.toContain(rawMessage);
    expect(loggedOutput).not.toContain(".env");
  });
});
