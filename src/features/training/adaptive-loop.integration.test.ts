import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { seedCatalog } from "../../../scripts/catalog-seed";
import rawSeed from "../catalog/neetcode-150-list.json";
import { buildCatalogSeed } from "../catalog/seed-data";
import { skillStates } from "../../db/schema";
import { rebuildMemory } from "../memory/rebuild-memory.server";
import {
  getTodayRecommendation,
  type GetTodayDependencies,
} from "../recommendation/get-today.server";
import type { Clock } from "../../lib/clock";
import { createId } from "../../lib/id";
import { createTestDatabase, type TestDatabase } from "../../test/database";
import { completeAttempt } from "./complete-attempt";
import { createTrainingRepository } from "./training-repository.server";
import type { TrainingRepository } from "./training-repository";

const currentTime = "2026-07-14T15:00:00.000Z";
const clock: Clock = { now: () => new Date(currentTime) };

function createServices(database: TestDatabase) {
  const repository = createTrainingRepository(database);
  const rebuild = () => rebuildMemory({ repository, ids: createId, clock });
  const todayDependencies: GetTodayDependencies = {
    repository,
    clock,
    rebuildMemory: rebuild,
  };

  return {
    repository,
    getToday: () => getTodayRecommendation(todayDependencies),
    complete: (input: unknown) =>
      completeAttempt(
        { repository, ids: createId, clock, rebuildMemory: rebuild },
        input,
      ),
  };
}

async function arraysMastery(repository: TrainingRepository) {
  const arraysPattern = (await repository.getPatterns()).find(
    ({ slug }) => slug === "arrays-hashing",
  );

  if (!arraysPattern) {
    throw new Error("Expected the Arrays & Hashing pattern");
  }

  return (await repository.getSkillStates()).find(
    ({ patternId }) => patternId === arraysPattern.id,
  )?.mastery;
}

function requireRecommendation(
  result: Awaited<ReturnType<typeof getTodayRecommendation>>,
) {
  expect(result.status).toBe("recommended");

  if (result.status !== "recommended") {
    throw new Error(`Expected a recommendation, received ${result.reason}`);
  }

  return result;
}

describe("persisted adaptation loop", () => {
  it("self-heals stale MEMORY from a durable Attempt on the next Today load", async () => {
    const { close, database } = await createTestDatabase();

    try {
      await seedCatalog(
        database,
        buildCatalogSeed(rawSeed as unknown),
        createId,
        clock,
      );

      let services = createServices(database);
      await services.repository.saveProfile({
        id: createId(),
        deadline: "2026-08-31",
        sessionsPerWeek: 4,
        minutesPerSession: 30,
        startingLevel: "new",
      });
      const first = requireRecommendation(await services.getToday());
      expect(first.problem.title).toBe("Contains Duplicate");

      const completion = await completeAttempt(
        {
          repository: services.repository,
          ids: createId,
          clock,
          rebuildMemory: async () => {
            throw new Error("forced projection failure");
          },
        },
        {
          problemId: first.problem.id,
          result: "solved",
          durationMinutes: 15,
          highestHintLevel: 0,
          occurredAt: "2026-07-14T14:30:00.000Z",
        },
      );

      expect(completion).toMatchObject({
        status: "completed",
        memory: { status: "stale", reason: "projection_failed" },
      });
      await expect(
        services.repository.getAttempt(completion.attemptId),
      ).resolves.toMatchObject({
        id: completion.attemptId,
        problemId: first.problem.id,
        result: "solved",
        highestHintLevel: 0,
      });
      await expect(services.repository.getAttempts()).resolves.toHaveLength(1);

      services = createServices(database);
      await expect(arraysMastery(services.repository)).resolves.toBe("unseen");

      const recoveredToday = requireRecommendation(await services.getToday());

      await expect(arraysMastery(services.repository)).resolves.toBe(
        "practicing",
      );
      expect(recoveredToday.pattern.slug).toBe("arrays-hashing");
      expect(recoveredToday.problem.id).not.toBe(first.problem.id);
      expect(recoveredToday.problem.title).not.toBe("Contains Duplicate");
      expect(recoveredToday.factors).toMatchObject({
        kind: "continue_pattern",
        mastery: "practicing",
      });
    } finally {
      await close();
    }
  });

  it("generates one ID for one missing state and preserves the other 17", async () => {
    const { close, database } = await createTestDatabase();

    try {
      await seedCatalog(
        database,
        buildCatalogSeed(rawSeed as unknown),
        createId,
        clock,
      );
      const repository = createTrainingRepository(database);
      const initial = await repository.getSkillStates();
      const [missing, ...preserved] = initial;

      if (!missing) {
        throw new Error("Expected seeded Skill States");
      }

      await database.delete(skillStates).where(eq(skillStates.id, missing.id));

      const generatedId = "0190f6f5-9b5a-7a22-8c44-123456789abe";
      const ids = vi.fn(() => generatedId);
      const rebuilt = await rebuildMemory({ repository, ids, clock });
      const persisted = await repository.getSkillStates();
      const persistedByPattern = new Map(
        persisted.map((state) => [state.patternId, state]),
      );

      expect(ids).toHaveBeenCalledOnce();
      expect(rebuilt).toHaveLength(18);
      expect(persisted).toHaveLength(18);
      expect(persistedByPattern.get(missing.patternId)?.id).toBe(generatedId);
      expect(
        preserved.every(
          ({ id, patternId }) => persistedByPattern.get(patternId)?.id === id,
        ),
      ).toBe(true);
    } finally {
      await close();
    }
  });

  it("changes two Today cycles from persisted evidence across service reloads", async () => {
    const { close, database } = await createTestDatabase();

    try {
      await seedCatalog(
        database,
        buildCatalogSeed(rawSeed as unknown),
        createId,
        clock,
      );

      let services = createServices(database);
      await services.repository.saveProfile({
        id: createId(),
        deadline: "2026-08-31",
        sessionsPerWeek: 4,
        minutesPerSession: 30,
        startingLevel: "new",
      });

      const first = requireRecommendation(await services.getToday());
      expect(first).toMatchObject({
        problem: { title: "Contains Duplicate" },
        pattern: { slug: "arrays-hashing" },
        factors: {
          kind: "prerequisite_building",
          patternName: "Arrays & Hashing",
          problemTitle: "Contains Duplicate",
        },
      });
      expect(first.reason).toBe(
        "Contains Duplicate builds Arrays & Hashing, unlocking Two Pointers and Stack, and fits your 30-minute session.",
      );

      await expect(
        services.complete({
          problemId: first.problem.id,
          result: "solved",
          durationMinutes: 15,
          confidence: 4,
          note: "Used a set invariant.",
          highestHintLevel: 0,
          occurredAt: "2026-07-14T14:15:00.000Z",
        }),
      ).resolves.toMatchObject({
        status: "completed",
        memory: { status: "updated" },
      });

      services = createServices(database);
      await expect(arraysMastery(services.repository)).resolves.toBe(
        "practicing",
      );

      const second = requireRecommendation(await services.getToday());
      expect(second.pattern.slug).toBe("arrays-hashing");
      expect(second.problem.id).not.toBe(first.problem.id);
      expect(second.problem.title).not.toBe("Contains Duplicate");
      expect(second.factors).toMatchObject({
        kind: "continue_pattern",
        mastery: "practicing",
        patternName: "Arrays & Hashing",
        problemTitle: second.problem.title,
      });
      expect(second.reason).toBe(
        `Continue Arrays & Hashing with ${second.problem.title} while it is practicing; it fits your 30-minute session.`,
      );

      await expect(
        services.complete({
          problemId: second.problem.id,
          result: "solved",
          durationMinutes: 30,
          highestHintLevel: 0,
          occurredAt: "2026-07-14T14:45:00.000Z",
        }),
      ).resolves.toMatchObject({
        status: "completed",
        memory: { status: "updated" },
      });

      services = createServices(database);
      await expect(arraysMastery(services.repository)).resolves.toBe(
        "reliable",
      );

      const third = requireRecommendation(await services.getToday());
      expect(third).toMatchObject({
        problem: { title: "Valid Palindrome" },
        pattern: { slug: "two-pointers" },
        factors: {
          kind: "next_pattern",
          patternName: "Two Pointers",
          problemTitle: "Valid Palindrome",
        },
      });
      expect(third.reason).toBe(
        "Valid Palindrome starts your next roadmap pattern, Two Pointers, and fits your 30-minute session.",
      );
    } finally {
      await close();
    }
  });
});
