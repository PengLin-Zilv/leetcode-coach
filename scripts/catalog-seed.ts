import { inArray, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "../src/db/schema";
import {
  patternPrerequisites,
  patterns,
  problemPatterns,
  problems,
  skillStates,
} from "../src/db/schema";
import type { CatalogSeed } from "../src/features/catalog/seed-data";
import type { Clock } from "../src/lib/clock";
import type { IdGenerator } from "../src/lib/id";

type CatalogDatabase = LibSQLDatabase<typeof schema>;

function requiredId(
  idsByNaturalKey: ReadonlyMap<string, string>,
  naturalKey: string,
  entity: string,
): string {
  const id = idsByNaturalKey.get(naturalKey);

  if (!id) {
    throw new Error(`Seeded ${entity} could not be resolved`);
  }

  return id;
}

export async function seedCatalog(
  database: CatalogDatabase,
  seed: CatalogSeed,
  ids: IdGenerator,
  clock: Clock,
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction
      .insert(patterns)
      .values(
        seed.patterns.map(({ name, slug }) => ({ id: ids(), name, slug })),
      )
      .onConflictDoUpdate({
        target: patterns.slug,
        set: { name: sql.raw("excluded.name") },
      });

    const patternRows = await transaction
      .select({ id: patterns.id, slug: patterns.slug })
      .from(patterns)
      .where(
        inArray(
          patterns.slug,
          seed.patterns.map(({ slug }) => slug),
        ),
      );
    const patternIdsBySlug = new Map(
      patternRows.map(({ id, slug }) => [slug, id]),
    );

    await transaction
      .insert(patternPrerequisites)
      .values(
        seed.prerequisites.map(({ patternSlug, prerequisitePatternSlug }) => ({
          patternId: requiredId(patternIdsBySlug, patternSlug, "pattern"),
          prerequisitePatternId: requiredId(
            patternIdsBySlug,
            prerequisitePatternSlug,
            "prerequisite pattern",
          ),
        })),
      )
      .onConflictDoNothing();

    await transaction
      .insert(problems)
      .values(
        seed.problems.map((problem) => ({
          id: ids(),
          ...problem,
        })),
      )
      .onConflictDoUpdate({
        target: problems.url,
        set: {
          number: sql.raw("excluded.number"),
          title: sql.raw("excluded.title"),
          difficulty: sql.raw("excluded.difficulty"),
          estimatedMinutes: sql.raw("excluded.estimated_minutes"),
          source: sql.raw("excluded.source"),
        },
      });

    const problemRows = await transaction
      .select({ id: problems.id, url: problems.url })
      .from(problems)
      .where(
        inArray(
          problems.url,
          seed.problems.map(({ url }) => url),
        ),
      );
    const problemIdsByUrl = new Map(
      problemRows.map(({ id, url }) => [url, id]),
    );
    const seededProblemIds = problemRows.map(({ id }) => id);

    await transaction
      .delete(problemPatterns)
      .where(inArray(problemPatterns.problemId, seededProblemIds));
    await transaction.insert(problemPatterns).values(
      seed.problemPatterns.map(({ patternSlug, problemUrl }) => ({
        problemId: requiredId(problemIdsByUrl, problemUrl, "problem"),
        patternId: requiredId(patternIdsBySlug, patternSlug, "pattern"),
      })),
    );

    const lastComputedAt = clock.now();

    await transaction
      .insert(skillStates)
      .values(
        patternRows.map(({ id: patternId }) => ({
          id: ids(),
          patternId,
          mastery: "unseen" as const,
          recentSuccess: 0,
          nextReviewDate: null,
          lastComputedAt,
        })),
      )
      .onConflictDoNothing({ target: skillStates.patternId });
  });
}
