import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { seedCatalog } from "../../../scripts/catalog-seed";
import {
  attempts,
  mindOutputSourceAttempts,
  mindOutputs,
} from "../../db/schema";
import type { Clock } from "../../lib/clock";
import { createId } from "../../lib/id";
import { createTestDatabase, type TestDatabase } from "../../test/database";
import rawSeed from "../catalog/neetcode-150-list.json";
import { buildCatalogSeed } from "../catalog/seed-data";
import { createTrainingRepository } from "../training/training-repository.server";
import type { Attempt } from "../training/training-repository";
import { createMindOutputRepository } from "./mind-output-repository.server";
import type { PersistedMindOutput } from "./request-mind";

const now = new Date("2026-07-14T15:00:00.000Z");
const clock: Clock = { now: () => new Date(now.getTime()) };

async function withSeededDatabase(
  run: (database: TestDatabase) => Promise<void>,
): Promise<void> {
  const { close, database } = await createTestDatabase();

  try {
    await seedCatalog(
      database,
      buildCatalogSeed(rawSeed as unknown),
      createId,
      clock,
    );
    await run(database);
  } finally {
    await close();
  }
}

async function insertAttempts(database: TestDatabase): Promise<{
  readonly attemptOne: Attempt;
  readonly attemptTwo: Attempt;
  readonly patternId: string;
}> {
  const training = createTrainingRepository(database);
  const [problemOne, problemTwo] = await training.getProblems();
  const [pattern] = await training.getPatterns();

  if (!problemOne || !problemTwo || !pattern) {
    throw new Error("Expected seeded Problems and Patterns");
  }

  const attemptOne: Attempt = {
    id: createId(),
    problemId: problemOne.id,
    result: "not_solved",
    durationMinutes: 15,
    confidence: 2,
    note: null,
    highestHintLevel: 2,
    occurredAt: new Date("2026-07-14T13:00:00.000Z"),
    createdAt: now,
  };
  const attemptTwo: Attempt = {
    ...attemptOne,
    id: createId(),
    problemId: problemTwo.id,
    occurredAt: new Date("2026-07-14T14:00:00.000Z"),
  };

  await training.insertAttempt(attemptOne);
  await training.insertAttempt(attemptTwo);

  return { attemptOne, attemptTwo, patternId: pattern.id };
}

describe("createMindOutputRepository", () => {
  it("inserts a single output only when its Attempt exists", async () => {
    await withSeededDatabase(async (database) => {
      const { attemptOne } = await insertAttempts(database);
      const repository = createMindOutputRepository(database);
      const outputId = createId();

      await repository.insert({
        id: outputId,
        type: "single",
        body: "State the invariant before moving either boundary.",
        attemptId: attemptOne.id,
        patternId: null,
        sourceAttemptIds: [],
        generatedAt: now,
      });

      await expect(
        database.select().from(mindOutputs).where(eq(mindOutputs.id, outputId)),
      ).resolves.toEqual([
        {
          id: outputId,
          type: "single",
          body: "State the invariant before moving either boundary.",
          attemptId: attemptOne.id,
          patternId: null,
          generatedAt: now,
          modelMeta: null,
        },
      ]);

      const missingAttemptOutputId = createId();
      await expect(
        repository.insert({
          id: missingAttemptOutputId,
          type: "single",
          body: "Advice",
          attemptId: createId(),
          patternId: null,
          sourceAttemptIds: [],
          generatedAt: now,
        }),
      ).rejects.toThrow();
      await expect(
        database
          .select()
          .from(mindOutputs)
          .where(eq(mindOutputs.id, missingAttemptOutputId)),
      ).resolves.toEqual([]);
    });
  });

  it("inserts a Pattern output and its source Attempt links atomically", async () => {
    await withSeededDatabase(async (database) => {
      const { attemptOne, attemptTwo, patternId } =
        await insertAttempts(database);
      const repository = createMindOutputRepository(database);
      const outputId = createId();

      await repository.insert({
        id: outputId,
        type: "pattern",
        body: "Boundary updates are the repeated failure mode.",
        attemptId: null,
        patternId,
        sourceAttemptIds: [attemptOne.id, attemptTwo.id],
        generatedAt: now,
      });

      await expect(
        database.select().from(mindOutputs).where(eq(mindOutputs.id, outputId)),
      ).resolves.toHaveLength(1);
      await expect(
        database
          .select()
          .from(mindOutputSourceAttempts)
          .where(eq(mindOutputSourceAttempts.mindOutputId, outputId)),
      ).resolves.toEqual([
        { mindOutputId: outputId, attemptId: attemptOne.id },
        { mindOutputId: outputId, attemptId: attemptTwo.id },
      ]);
    });
  });

  it("rolls back the Pattern row when any source Attempt link fails", async () => {
    await withSeededDatabase(async (database) => {
      const { attemptOne, patternId } = await insertAttempts(database);
      const repository = createMindOutputRepository(database);
      const outputId = createId();

      await expect(
        repository.insert({
          id: outputId,
          type: "pattern",
          body: "Boundary updates are the repeated failure mode.",
          attemptId: null,
          patternId,
          sourceAttemptIds: [attemptOne.id, createId()],
          generatedAt: now,
        }),
      ).rejects.toThrow();

      await expect(
        database.select().from(mindOutputs).where(eq(mindOutputs.id, outputId)),
      ).resolves.toEqual([]);
      await expect(
        database
          .select()
          .from(mindOutputSourceAttempts)
          .where(eq(mindOutputSourceAttempts.mindOutputId, outputId)),
      ).resolves.toEqual([]);
    });
  });

  it("rejects source Attempt links for a single output", async () => {
    await withSeededDatabase(async (database) => {
      const { attemptOne } = await insertAttempts(database);
      const repository = createMindOutputRepository(database);
      const outputId = createId();
      const malformed = {
        id: outputId,
        type: "single",
        body: "Advice",
        attemptId: attemptOne.id,
        patternId: null,
        sourceAttemptIds: [attemptOne.id],
        generatedAt: now,
      } as unknown as PersistedMindOutput;

      await expect(repository.insert(malformed)).rejects.toThrow(
        "Single MIND output cannot have source Attempts",
      );
      await expect(
        database.select().from(mindOutputs).where(eq(mindOutputs.id, outputId)),
      ).resolves.toEqual([]);
      await expect(database.select().from(attempts)).resolves.toHaveLength(2);
    });
  });
});
