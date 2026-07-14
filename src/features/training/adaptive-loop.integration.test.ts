import { describe, expect, it } from "vitest";

import { seedCatalog } from "../../../scripts/catalog-seed";
import rawSeed from "../catalog/neetcode-150-list.json";
import { buildCatalogSeed } from "../catalog/seed-data";
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
