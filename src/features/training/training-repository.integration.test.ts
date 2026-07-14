import { count } from "drizzle-orm";
import { describe, expect, expectTypeOf, it } from "vitest";

import { seedCatalog } from "../../../scripts/catalog-seed";
import rawSeed from "../catalog/neetcode-150-list.json";
import { buildCatalogSeed } from "../catalog/seed-data";
import { attempts, profiles, reflections } from "../../db/schema";
import type { Clock } from "../../lib/clock";
import { createId } from "../../lib/id";
import { createTestDatabase, type TestDatabase } from "../../test/database";
import { createTrainingRepository } from "./training-repository.server";
import type {
  Attempt,
  Profile,
  Reflection,
  SkillState,
  TrainingRepository,
} from "./training-repository";

const now = new Date("2026-07-14T15:00:00.000Z");
const fixedClock: Clock = { now: () => new Date(now.getTime()) };

async function rowCount(
  database: TestDatabase,
  table: typeof attempts | typeof profiles | typeof reflections,
): Promise<number> {
  const [row] = await database.select({ value: count() }).from(table);
  return row?.value ?? 0;
}

async function withSeededRepository(
  run: (
    repository: TrainingRepository,
    database: TestDatabase,
  ) => Promise<void>,
): Promise<void> {
  const { close, database } = await createTestDatabase();

  try {
    await seedCatalog(
      database,
      buildCatalogSeed(rawSeed as unknown),
      createId,
      fixedClock,
    );
    await run(createTrainingRepository(database), database);
  } finally {
    await close();
  }
}

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: createId(),
    deadline: "2026-08-31",
    sessionsPerWeek: 4,
    minutesPerSession: 30,
    startingLevel: "new",
    ...overrides,
  };
}

describe("createTrainingRepository", () => {
  it("upserts the singleton Profile without replacing its UUID", async () => {
    await withSeededRepository(async (repository, database) => {
      const initial = profile();

      await repository.saveProfile(initial);
      await repository.saveProfile(
        profile({
          id: createId(),
          deadline: "2026-09-30",
          sessionsPerWeek: 6,
          minutesPerSession: 45,
          startingLevel: "some",
        }),
      );

      await expect(repository.getProfile()).resolves.toEqual({
        ...initial,
        deadline: "2026-09-30",
        sessionsPerWeek: 6,
        minutesPerSession: 45,
        startingLevel: "some",
      });
      expect(await rowCount(database, profiles)).toBe(1);
    });
  });

  it("round-trips immutable Attempts and Reflections with nulls and event time intact", async () => {
    await withSeededRepository(async (repository, database) => {
      const problem = repository
        .getProblems()
        .then((problems) =>
          problems.find(({ title }) => title === "Contains Duplicate"),
        );
      const storedProblem = await problem;

      if (!storedProblem) {
        throw new Error("Expected the seeded Contains Duplicate problem");
      }

      const attempt: Attempt = {
        id: createId(),
        problemId: storedProblem.id,
        result: "not_solved",
        durationMinutes: 30,
        confidence: null,
        note: null,
        highestHintLevel: 2,
        occurredAt: new Date("2026-07-10T12:00:00.000Z"),
        createdAt: fixedClock.now(),
      };
      const reflection: Reflection = {
        id: createId(),
        body: "State the invariant before coding.",
        occurredAt: new Date("2026-07-09T18:00:00.000Z"),
        createdAt: fixedClock.now(),
      };

      await repository.insertAttempt(attempt);
      await repository.insertReflection(reflection);

      await expect(repository.getAttempt(attempt.id)).resolves.toEqual(attempt);
      await expect(repository.getAttempts()).resolves.toEqual([attempt]);

      const [storedReflection] = await database.select().from(reflections);
      expect(storedReflection).toEqual(reflection);
      expect(storedReflection?.occurredAt).toEqual(
        new Date("2026-07-09T18:00:00.000Z"),
      );
      expect(storedReflection?.createdAt).toEqual(now);
    });
  });

  it("exposes insert-only event writes and cannot rewrite a duplicate event", async () => {
    type ForbiddenEventMutation = Extract<
      keyof TrainingRepository,
      | "updateAttempt"
      | "deleteAttempt"
      | "upsertAttempt"
      | "updateReflection"
      | "deleteReflection"
      | "upsertReflection"
    >;

    expectTypeOf<ForbiddenEventMutation>().toEqualTypeOf<never>();

    await withSeededRepository(async (repository, database) => {
      expect(repository).not.toHaveProperty("updateAttempt");
      expect(repository).not.toHaveProperty("deleteAttempt");
      expect(repository).not.toHaveProperty("upsertAttempt");
      expect(repository).not.toHaveProperty("updateReflection");
      expect(repository).not.toHaveProperty("deleteReflection");
      expect(repository).not.toHaveProperty("upsertReflection");

      const [problem] = await repository.getProblems();

      if (!problem) {
        throw new Error("Expected a seeded Problem");
      }

      const attempt: Attempt = {
        id: createId(),
        problemId: problem.id,
        result: "solved",
        durationMinutes: 15,
        confidence: 5,
        note: "Independent solve.",
        highestHintLevel: 0,
        occurredAt: now,
        createdAt: now,
      };

      await repository.insertAttempt(attempt);
      await expect(
        repository.insertAttempt({ ...attempt, result: "not_solved" }),
      ).rejects.toThrow();

      expect(await rowCount(database, attempts)).toBe(1);
      await expect(repository.getAttempt(attempt.id)).resolves.toEqual(attempt);
    });
  });

  it("atomically replaces exactly 18 Skill States while preserving row IDs", async () => {
    await withSeededRepository(async (repository) => {
      const initial = await repository.getSkillStates();
      const replacementTime = new Date("2026-07-14T16:00:00.000Z");
      const replacements: SkillState[] = initial.map(({ patternId }) => ({
        id: createId(),
        patternId,
        mastery: "learning",
        recentSuccess: 0,
        nextReviewDate: "2026-07-15",
        lastComputedAt: replacementTime,
      }));

      expect(initial).toHaveLength(18);
      await repository.replaceSkillStates(replacements);

      const replaced = await repository.getSkillStates();
      const initialIdByPattern = new Map(
        initial.map(({ id, patternId }) => [patternId, id]),
      );

      expect(replaced).toHaveLength(18);
      expect(
        replaced.every(
          ({ id, patternId, mastery, lastComputedAt }) =>
            id === initialIdByPattern.get(patternId) &&
            mastery === "learning" &&
            lastComputedAt.getTime() === replacementTime.getTime(),
        ),
      ).toBe(true);

      await expect(
        repository.replaceSkillStates(replacements.slice(1)),
      ).rejects.toThrow();
      await expect(repository.getSkillStates()).resolves.toEqual(replaced);

      const duplicatePatternReplacement = replacements.map((state, index) =>
        index === replacements.length - 1
          ? { ...state, patternId: replacements[0]!.patternId }
          : state,
      );

      await expect(
        repository.replaceSkillStates(duplicatePatternReplacement),
      ).rejects.toThrow();
      const afterDuplicateRejection = await repository.getSkillStates();
      expect(afterDuplicateRejection).toEqual(replaced);
      expect(JSON.stringify(afterDuplicateRejection)).toBe(
        JSON.stringify(replaced),
      );

      const invalidPatternId = createId();
      const invalidReplacement = replacements.map((state, index) =>
        index === 0 ? { ...state, patternId: invalidPatternId } : state,
      );

      await expect(
        repository.replaceSkillStates(invalidReplacement),
      ).rejects.toThrow();
      await expect(repository.getSkillStates()).resolves.toEqual(replaced);
    });
  });

  it("lets the database reject an Attempt for a missing Problem", async () => {
    await withSeededRepository(async (repository, database) => {
      await expect(
        repository.insertAttempt({
          id: createId(),
          problemId: createId(),
          result: "solved",
          durationMinutes: 15,
          confidence: null,
          note: null,
          highestHintLevel: 0,
          occurredAt: now,
          createdAt: now,
        }),
      ).rejects.toThrow();

      expect(await rowCount(database, attempts)).toBe(0);
    });
  });
});
