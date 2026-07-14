import { asc, count } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import rawSeed from "../src/features/catalog/neetcode-150-list.json";
import { buildCatalogSeed } from "../src/features/catalog/seed-data";
import {
  patternPrerequisites,
  patterns,
  problemPatterns,
  problems,
  skillStates,
} from "../src/db/schema";
import type { Clock } from "../src/lib/clock";
import type { IdGenerator } from "../src/lib/id";
import { createTestDatabase, type TestDatabase } from "../src/test/database";
import { seedCatalog } from "./catalog-seed";

const fixedClock: Clock = {
  now: () => new Date("2026-07-14T15:00:00.000Z"),
};

function sequentialIds(): IdGenerator {
  let sequence = 0;

  return () => {
    sequence += 1;
    return `00000000-0000-7000-8000-${String(sequence).padStart(12, "0")}`;
  };
}

async function rowCount(
  database: TestDatabase,
  table: SQLiteTable,
): Promise<number> {
  const [row] = await database.select({ value: count() }).from(table);
  return row?.value ?? 0;
}

describe("seedCatalog", () => {
  it("seeds the authoritative catalog idempotently without replacing IDs", async () => {
    const { close, database } = await createTestDatabase();
    const seed = buildCatalogSeed(rawSeed as unknown);
    const ids = sequentialIds();
    let firstPatternIds: string[] | undefined;
    let firstProblemIds: string[] | undefined;

    try {
      for (const run of [1, 2]) {
        await seedCatalog(database, seed, ids, fixedClock);

        expect(
          await rowCount(database, patterns),
          `patterns after run ${run}`,
        ).toBe(18);
        expect(
          await rowCount(database, patternPrerequisites),
          `prerequisites after run ${run}`,
        ).toBe(21);
        expect(
          await rowCount(database, problems),
          `problems after run ${run}`,
        ).toBe(150);
        expect(
          await rowCount(database, problemPatterns),
          `problem mappings after run ${run}`,
        ).toBe(150);
        expect(
          await rowCount(database, skillStates),
          `skill states after run ${run}`,
        ).toBe(18);

        const states = await database
          .select({
            mastery: skillStates.mastery,
            recentSuccess: skillStates.recentSuccess,
            nextReviewDate: skillStates.nextReviewDate,
            lastComputedAt: skillStates.lastComputedAt,
          })
          .from(skillStates);

        expect(states).toHaveLength(18);
        expect(
          states.every(
            ({ mastery, nextReviewDate, recentSuccess }) =>
              mastery === "unseen" &&
              recentSuccess === 0 &&
              nextReviewDate === null,
          ),
        ).toBe(true);
        expect(
          states.every(
            ({ lastComputedAt }) =>
              lastComputedAt.getTime() === fixedClock.now().getTime(),
          ),
        ).toBe(true);

        const patternIds = (
          await database
            .select({ id: patterns.id })
            .from(patterns)
            .orderBy(asc(patterns.slug))
        ).map(({ id }) => id);
        const problemIds = (
          await database
            .select({ id: problems.id })
            .from(problems)
            .orderBy(asc(problems.url))
        ).map(({ id }) => id);

        if (run === 1) {
          firstPatternIds = patternIds;
          firstProblemIds = problemIds;
        } else {
          expect(patternIds).toEqual(firstPatternIds);
          expect(problemIds).toEqual(firstProblemIds);
        }
      }
    } finally {
      await close();
    }
  });
});
