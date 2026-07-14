import { asc, count, eq, ne } from "drizzle-orm";
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

async function expectCatalogCounts(database: TestDatabase): Promise<void> {
  expect(await rowCount(database, patterns)).toBe(18);
  expect(await rowCount(database, patternPrerequisites)).toBe(21);
  expect(await rowCount(database, problems)).toBe(150);
  expect(await rowCount(database, problemPatterns)).toBe(150);
  expect(await rowCount(database, skillStates)).toBe(18);
}

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Expected ${label}`);
  }

  return value;
}

describe("seedCatalog", () => {
  it("repairs catalog data without replacing IDs or computed Skill State", async () => {
    const { close, database } = await createTestDatabase();
    const seed = buildCatalogSeed(rawSeed as unknown);
    const ids = sequentialIds();

    try {
      await seedCatalog(database, seed, ids, fixedClock);
      await expectCatalogCounts(database);

      const initialStates = await database.select().from(skillStates);
      expect(initialStates).toHaveLength(18);
      expect(
        initialStates.every(
          ({ lastComputedAt, mastery, nextReviewDate, recentSuccess }) =>
            mastery === "unseen" &&
            recentSuccess === 0 &&
            nextReviewDate === null &&
            lastComputedAt.getTime() === fixedClock.now().getTime(),
        ),
      ).toBe(true);

      const firstPatternIds = (
        await database
          .select({ id: patterns.id })
          .from(patterns)
          .orderBy(asc(patterns.slug))
      ).map(({ id }) => id);
      const firstProblemIds = (
        await database
          .select({ id: problems.id })
          .from(problems)
          .orderBy(asc(problems.url))
      ).map(({ id }) => id);
      const authoritativeProblem = required(
        seed.problems.find(({ title }) => title === "Group Anagrams"),
        "the Group Anagrams seed problem",
      );
      const authoritativeMapping = required(
        seed.problemPatterns.find(
          ({ problemUrl }) => problemUrl === authoritativeProblem.url,
        ),
        "the Group Anagrams seed mapping",
      );
      const [storedProblem] = await database
        .select()
        .from(problems)
        .where(eq(problems.url, authoritativeProblem.url));
      const [correctPattern] = await database
        .select()
        .from(patterns)
        .where(eq(patterns.slug, authoritativeMapping.patternSlug));
      const [incorrectPattern] = await database
        .select()
        .from(patterns)
        .where(ne(patterns.slug, authoritativeMapping.patternSlug))
        .limit(1);
      const problem = required(storedProblem, "the stored Group Anagrams row");
      const expectedPattern = required(
        correctPattern,
        "the authoritative Group Anagrams pattern",
      );
      const secondaryPattern = required(
        incorrectPattern,
        "an incorrect secondary pattern",
      );
      const [stateToCompute] = await database
        .select()
        .from(skillStates)
        .where(eq(skillStates.patternId, expectedPattern.id));
      const initialState = required(
        stateToCompute,
        "the Skill State for the authoritative pattern",
      );

      await database
        .update(skillStates)
        .set({
          mastery: "practicing",
          recentSuccess: 2,
          nextReviewDate: "2026-07-21",
          lastComputedAt: new Date("2026-07-15T18:30:00.000Z"),
        })
        .where(eq(skillStates.id, initialState.id));
      const [computedState] = await database
        .select()
        .from(skillStates)
        .where(eq(skillStates.id, initialState.id));
      const expectedComputedState = required(
        computedState,
        "the computed Skill State",
      );

      await database
        .update(problems)
        .set({
          number: 999_999,
          title: "Corrupted Group Anagrams",
          difficulty: "easy",
          estimatedMinutes: 15,
          source: "corrupted-source",
        })
        .where(eq(problems.id, problem.id));
      await database.insert(problemPatterns).values({
        problemId: problem.id,
        patternId: secondaryPattern.id,
      });
      expect(await rowCount(database, problemPatterns)).toBe(151);

      await seedCatalog(database, seed, ids, fixedClock);
      await expectCatalogCounts(database);

      const [preservedState] = await database
        .select()
        .from(skillStates)
        .where(eq(skillStates.id, initialState.id));
      expect(preservedState).toEqual(expectedComputedState);
      expect(preservedState?.id).toBe(initialState.id);
      expect(preservedState?.lastComputedAt).toEqual(
        new Date("2026-07-15T18:30:00.000Z"),
      );

      const [restoredProblem] = await database
        .select()
        .from(problems)
        .where(eq(problems.url, authoritativeProblem.url));
      expect(restoredProblem).toEqual({
        id: problem.id,
        ...authoritativeProblem,
      });

      const actualMappings = await database
        .select({
          problemUrl: problems.url,
          patternSlug: patterns.slug,
        })
        .from(problemPatterns)
        .innerJoin(problems, eq(problemPatterns.problemId, problems.id))
        .innerJoin(patterns, eq(problemPatterns.patternId, patterns.id));
      const actualMappingKeys = actualMappings
        .map(({ patternSlug, problemUrl }) => `${problemUrl}|${patternSlug}`)
        .sort();
      const expectedMappingKeys = seed.problemPatterns
        .map(({ patternSlug, problemUrl }) => `${problemUrl}|${patternSlug}`)
        .sort();
      const mappingsPerProblem = new Map<string, number>();

      for (const { problemUrl } of actualMappings) {
        mappingsPerProblem.set(
          problemUrl,
          (mappingsPerProblem.get(problemUrl) ?? 0) + 1,
        );
      }

      expect(actualMappings).toHaveLength(150);
      expect(actualMappingKeys).toEqual(expectedMappingKeys);
      expect(mappingsPerProblem.size).toBe(150);
      expect(
        [...mappingsPerProblem.values()].every((count) => count === 1),
      ).toBe(true);

      const secondPatternIds = (
        await database
          .select({ id: patterns.id })
          .from(patterns)
          .orderBy(asc(patterns.slug))
      ).map(({ id }) => id);
      const secondProblemIds = (
        await database
          .select({ id: problems.id })
          .from(problems)
          .orderBy(asc(problems.url))
      ).map(({ id }) => id);

      expect(secondPatternIds).toEqual(firstPatternIds);
      expect(secondProblemIds).toEqual(firstProblemIds);
    } finally {
      await close();
    }
  });

  it("rolls back every catalog write when a late injected failure occurs", async () => {
    const { close, database } = await createTestDatabase();
    const seed = buildCatalogSeed(rawSeed as unknown);
    let idCalls = 0;
    const failingIds: IdGenerator = () => {
      idCalls += 1;

      if (idCalls === 180) {
        throw new Error("Injected late catalog seed failure");
      }

      return `00000000-0000-7000-8000-${String(idCalls).padStart(12, "0")}`;
    };

    try {
      await expect(
        seedCatalog(database, seed, failingIds, fixedClock),
      ).rejects.toThrow("Injected late catalog seed failure");
      expect(idCalls).toBe(180);
      expect(await rowCount(database, patterns)).toBe(0);
      expect(await rowCount(database, patternPrerequisites)).toBe(0);
      expect(await rowCount(database, problems)).toBe(0);
      expect(await rowCount(database, problemPatterns)).toBe(0);
      expect(await rowCount(database, skillStates)).toBe(0);
    } finally {
      await close();
    }
  });
});
