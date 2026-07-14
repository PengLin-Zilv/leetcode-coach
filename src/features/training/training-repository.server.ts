import "server-only";

import { asc, eq, notInArray, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { PATTERN_DEFINITIONS } from "../catalog/roadmap";
import { getDatabase } from "../../db/client.server";
import * as schema from "../../db/schema";
import {
  attempts,
  patternPrerequisites,
  patterns,
  problemPatterns,
  problems,
  profiles,
  reflections,
  skillStates,
} from "../../db/schema";
import type { TrainingRepository } from "./training-repository";

type TrainingDatabase = LibSQLDatabase<typeof schema>;

function requireCompleteSkillStateProjection(
  states: Parameters<TrainingRepository["replaceSkillStates"]>[0],
): void {
  const uniquePatternIds = new Set(states.map(({ patternId }) => patternId));

  if (
    states.length !== PATTERN_DEFINITIONS.length ||
    uniquePatternIds.size !== PATTERN_DEFINITIONS.length
  ) {
    throw new Error("MEMORY replacement requires one state per pattern");
  }
}

export function createTrainingRepository(
  database: TrainingDatabase,
): TrainingRepository {
  return {
    async getProfile() {
      const [profile] = await database
        .select({
          id: profiles.id,
          deadline: profiles.deadline,
          sessionsPerWeek: profiles.sessionsPerWeek,
          minutesPerSession: profiles.minutesPerSession,
          startingLevel: profiles.startingLevel,
        })
        .from(profiles)
        .limit(1);

      return profile ?? null;
    },

    async saveProfile(profile) {
      await database
        .insert(profiles)
        .values({ ...profile, singletonKey: 1 })
        .onConflictDoUpdate({
          target: profiles.singletonKey,
          set: {
            deadline: profile.deadline,
            sessionsPerWeek: profile.sessionsPerWeek,
            minutesPerSession: profile.minutesPerSession,
            startingLevel: profile.startingLevel,
          },
        });
    },

    getPatterns() {
      return database.select().from(patterns).orderBy(asc(patterns.slug));
    },

    getPrerequisites() {
      return database
        .select()
        .from(patternPrerequisites)
        .orderBy(
          asc(patternPrerequisites.patternId),
          asc(patternPrerequisites.prerequisitePatternId),
        );
    },

    getProblems() {
      return database
        .select()
        .from(problems)
        .orderBy(asc(problems.title), asc(problems.id));
    },

    getProblemPatterns() {
      return database
        .select()
        .from(problemPatterns)
        .orderBy(
          asc(problemPatterns.problemId),
          asc(problemPatterns.patternId),
        );
    },

    getAttempts() {
      return database
        .select()
        .from(attempts)
        .orderBy(asc(attempts.occurredAt), asc(attempts.id));
    },

    async getAttempt(id) {
      const [attempt] = await database
        .select()
        .from(attempts)
        .where(eq(attempts.id, id))
        .limit(1);

      return attempt ?? null;
    },

    async insertAttempt(attempt) {
      await database.insert(attempts).values(attempt);
    },

    async insertReflection(reflection) {
      await database.insert(reflections).values(reflection);
    },

    getSkillStates() {
      return database
        .select()
        .from(skillStates)
        .orderBy(asc(skillStates.patternId));
    },

    async replaceSkillStates(states) {
      requireCompleteSkillStateProjection(states);
      const patternIds = states.map(({ patternId }) => patternId);

      await database.transaction(async (transaction) => {
        await transaction
          .delete(skillStates)
          .where(notInArray(skillStates.patternId, patternIds));
        await transaction
          .insert(skillStates)
          .values([...states])
          .onConflictDoUpdate({
            target: skillStates.patternId,
            set: {
              mastery: sql.raw("excluded.mastery"),
              recentSuccess: sql.raw("excluded.recent_success"),
              nextReviewDate: sql.raw("excluded.next_review_date"),
              lastComputedAt: sql.raw("excluded.last_computed_at"),
            },
          });
      });
    },
  };
}

let repository: TrainingRepository | undefined;

export function getTrainingRepository(): TrainingRepository {
  repository ??= createTrainingRepository(getDatabase());

  return repository;
}
