import "server-only";

import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { getDatabase } from "../../db/client.server";
import * as schema from "../../db/schema";
import { mindOutputSourceAttempts, mindOutputs } from "../../db/schema";
import type { MindOutputRepository, PersistedMindOutput } from "./request-mind";

type MindDatabase = LibSQLDatabase<typeof schema>;

function requireValidPersistenceShape(output: PersistedMindOutput): void {
  if (output.type === "single") {
    if (output.sourceAttemptIds.length > 0) {
      throw new Error("Single MIND output cannot have source Attempts");
    }

    if (output.attemptId === null || output.patternId !== null) {
      throw new Error("Single MIND output must reference exactly one Attempt");
    }

    return;
  }

  if (
    output.attemptId !== null ||
    output.patternId === null ||
    output.sourceAttemptIds.length === 0
  ) {
    throw new Error(
      "Pattern MIND output must reference a Pattern and source Attempts",
    );
  }
}

function outputRow(output: PersistedMindOutput) {
  return {
    id: output.id,
    type: output.type,
    body: output.body,
    attemptId: output.attemptId,
    patternId: output.patternId,
    generatedAt: output.generatedAt,
    modelMeta: null,
  };
}

export function createMindOutputRepository(
  database: MindDatabase,
): MindOutputRepository {
  return {
    async insert(output) {
      requireValidPersistenceShape(output);

      if (output.type === "single") {
        await database.insert(mindOutputs).values(outputRow(output));
        return;
      }

      await database.transaction(async (transaction) => {
        await transaction.insert(mindOutputs).values(outputRow(output));
        await transaction.insert(mindOutputSourceAttempts).values(
          output.sourceAttemptIds.map((attemptId) => ({
            mindOutputId: output.id,
            attemptId,
          })),
        );
      });
    },
  };
}

let repository: MindOutputRepository | undefined;

export function getMindOutputRepository(): MindOutputRepository {
  repository ??= createMindOutputRepository(getDatabase());
  return repository;
}
