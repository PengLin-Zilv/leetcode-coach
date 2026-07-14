import { count, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import rawSeed from "../src/features/catalog/neetcode-150-list.json";
import { buildCatalogSeed } from "../src/features/catalog/seed-data";
import { attempts, patterns, problems, skillStates } from "../src/db/schema";
import type { Clock } from "../src/lib/clock";
import { createId } from "../src/lib/id";
import { createTestDatabase } from "../src/test/database";
import { seedCatalog } from "./catalog-seed";
import {
  rebuildOperatorMemory,
  runMemoryRebuildCommand,
  type MemoryRebuildCommandDependencies,
} from "./rebuild-memory";

const now = new Date("2026-07-14T15:00:00.000Z");
const fixedClock: Clock = { now: () => new Date(now.getTime()) };

function createHarness(
  overrides: Partial<MemoryRebuildCommandDependencies> = {},
) {
  const info = vi.fn();
  const error = vi.fn();
  const close = vi.fn();
  const database = {} as never;
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
  const openConnection = vi.fn(() => ({ database, close }));
  const rebuild = vi.fn(async () => 18);
  const dependencies: MemoryRebuildCommandDependencies = {
    readEnvironment,
    openConnection,
    rebuild,
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
    rebuild,
  };
}

describe("runMemoryRebuildCommand", () => {
  it("rebuilds the protected local target with stable output", async () => {
    const harness = createHarness();

    await expect(
      runMemoryRebuildCommand(["local"], harness.dependencies),
    ).resolves.toBe(0);

    expect(harness.readEnvironment).toHaveBeenCalledWith(".env.local");
    expect(harness.openConnection).toHaveBeenCalledWith({
      url: "file:./test.db",
      authToken: undefined,
    });
    expect(harness.rebuild).toHaveBeenCalledWith(harness.database);
    expect(harness.close).toHaveBeenCalledOnce();
    expect(harness.info.mock.calls.flat()).toEqual([
      "MEMORY rebuild target: local",
      "MEMORY rebuild completed: 18 Skill States",
    ]);
    expect(harness.error).not.toHaveBeenCalled();
  });

  it("requires the existing production confirmation policy", async () => {
    const rejected = createHarness();

    await expect(
      runMemoryRebuildCommand(["production"], rejected.dependencies),
    ).resolves.toBe(1);
    expect(rejected.readEnvironment).not.toHaveBeenCalled();
    expect(rejected.openConnection).not.toHaveBeenCalled();

    const confirmed = createHarness();

    await expect(
      runMemoryRebuildCommand(
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
  });

  it("rejects mismatched target configuration before connecting", async () => {
    const readEnvironment = vi.fn(async () => ({
      MIGRATION_TARGET: "production",
      TURSO_DATABASE_URL: "file:./test.db",
      TURSO_AUTH_TOKEN: undefined,
    }));
    const harness = createHarness({ readEnvironment });

    await expect(
      runMemoryRebuildCommand(["local"], harness.dependencies),
    ).resolves.toBe(1);
    expect(harness.openConnection).not.toHaveBeenCalled();
    expect(harness.error).toHaveBeenCalledWith("MEMORY rebuild failed");
  });

  it("closes on failure without logging secrets or raw errors", async () => {
    const privateUrl = "libsql://private.example.turso.io";
    const privateToken = "private-auth-token";
    const rawMessage = "raw provider exception from .env.production.local";
    const rebuild = vi.fn(async () => {
      throw new Error(`${rawMessage}: ${privateUrl} ${privateToken}`);
    });
    const harness = createHarness({ rebuild });

    await expect(
      runMemoryRebuildCommand(["local"], harness.dependencies),
    ).resolves.toBe(1);

    expect(harness.close).toHaveBeenCalledOnce();
    expect(harness.error.mock.calls.flat()).toEqual(["MEMORY rebuild failed"]);
    expect(harness.info.mock.calls.flat()).toEqual([
      "MEMORY rebuild target: local",
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

describe("rebuildOperatorMemory", () => {
  it("rebuilds persisted Attempt evidence through the script-local adapter", async () => {
    const { close, database } = await createTestDatabase();

    try {
      await seedCatalog(
        database,
        buildCatalogSeed(rawSeed as unknown),
        createId,
        fixedClock,
      );
      const [problem] = await database
        .select({ id: problems.id })
        .from(problems)
        .where(eq(problems.title, "Contains Duplicate"));
      const [pattern] = await database
        .select({ id: patterns.id })
        .from(patterns)
        .where(eq(patterns.slug, "arrays-hashing"));

      if (!problem || !pattern) {
        throw new Error("Expected the seeded Arrays problem and Pattern");
      }

      await database.insert(attempts).values({
        id: createId(),
        problemId: problem.id,
        result: "solved",
        durationMinutes: 15,
        confidence: null,
        note: null,
        highestHintLevel: 0,
        occurredAt: new Date("2026-07-14T14:30:00.000Z"),
        createdAt: fixedClock.now(),
      });

      await expect(
        rebuildOperatorMemory(database, createId, fixedClock),
      ).resolves.toBe(18);

      const [arraysState] = await database
        .select()
        .from(skillStates)
        .where(eq(skillStates.patternId, pattern.id));
      const [stateCount] = await database
        .select({ value: count() })
        .from(skillStates);

      expect(stateCount?.value).toBe(18);
      expect(arraysState).toMatchObject({
        mastery: "practicing",
        recentSuccess: 1,
        nextReviewDate: "2026-07-17",
        lastComputedAt: now,
      });
    } finally {
      await close();
    }
  });
});
