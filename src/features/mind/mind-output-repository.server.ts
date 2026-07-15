import "server-only";

import { and, desc, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { getDatabase } from "../../db/client.server";
import * as schema from "../../db/schema";
import { mindOutputSourceAttempts, mindOutputs } from "../../db/schema";
import type { MindOutputRepository, PersistedMindOutput } from "./request-mind";

type MindDatabase = LibSQLDatabase<typeof schema>;

export interface MindOutputStore extends MindOutputRepository {
  getSingleForAttempt(attemptId: string): Promise<PersistedMindOutput | null>;
}

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
): MindOutputStore {
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

    async getSingleForAttempt(attemptId) {
      const [output] = await database
        .select({
          id: mindOutputs.id,
          type: mindOutputs.type,
          body: mindOutputs.body,
          attemptId: mindOutputs.attemptId,
          patternId: mindOutputs.patternId,
          generatedAt: mindOutputs.generatedAt,
        })
        .from(mindOutputs)
        .where(
          and(
            eq(mindOutputs.type, "single"),
            eq(mindOutputs.attemptId, attemptId),
          ),
        )
        .orderBy(desc(mindOutputs.generatedAt), desc(mindOutputs.id))
        .limit(1);

      if (
        output === undefined ||
        output.type !== "single" ||
        output.attemptId === null
      ) {
        return null;
      }

      return {
        ...output,
        type: "single",
        attemptId: output.attemptId,
        patternId: null,
        sourceAttemptIds: [],
      };
    },
  };
}

let repository: MindOutputStore | undefined;

export function getMindOutputRepository(): MindOutputStore {
  repository ??= createMindOutputRepository(getDatabase());
  return repository;
}
