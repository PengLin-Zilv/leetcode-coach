import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient, type Client } from "@libsql/client";
import { asc, notInArray, sql } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import {
  parseDatabaseConfig,
  type DatabaseConfig,
} from "../src/config/database-env";
import * as schema from "../src/db/schema";
import {
  attempts,
  patterns,
  problemPatterns,
  skillStates,
} from "../src/db/schema";
import { PATTERN_DEFINITIONS } from "../src/features/catalog/roadmap";
import {
  rebuildMemoryProjection,
  type MemoryProjectionRepository,
} from "../src/features/memory/rebuild-memory";
import { systemClock } from "../src/lib/clock";
import { createId } from "../src/lib/id";
import { readMigrationEnvironment } from "./migration-environment";
import {
  resolveMigrationRequest,
  type MigrationRequest,
  type MigrationTarget,
} from "./migration-policy";

export type MemoryRebuildDatabase = LibSQLDatabase<typeof schema>;

interface MemoryRebuildConnection {
  readonly database: MemoryRebuildDatabase;
  close(): void | Promise<void>;
}

export interface MemoryRebuildCommandDependencies {
  readEnvironment(
    envFile: MigrationRequest["envFile"],
  ): Promise<Record<string, string | undefined>>;
  openConnection(config: DatabaseConfig): MemoryRebuildConnection;
  rebuild(database: MemoryRebuildDatabase): Promise<number>;
  info(message: string): void;
  error(message: string): void;
}

function requireMatchingTarget(
  target: MigrationTarget,
  selectedTarget: string | undefined,
): void {
  if (selectedTarget !== target) {
    throw new Error("MEMORY target does not match the selected environment");
  }
}

function requireTargetDatabase(
  target: MigrationTarget,
  config: DatabaseConfig,
): void {
  const isLocalDatabase = config.url.startsWith("file:");

  if (target === "local" && !isLocalDatabase) {
    throw new Error("Local MEMORY rebuild requires a file database");
  }

  if (target === "production" && (isLocalDatabase || !config.authToken)) {
    throw new Error(
      "Production MEMORY rebuild requires a remote database and token",
    );
  }
}

function createMemoryRepository(
  database: MemoryRebuildDatabase,
): MemoryProjectionRepository {
  return {
    getPatterns: () =>
      database.select().from(patterns).orderBy(asc(patterns.slug)),
    getProblemPatterns: () =>
      database
        .select()
        .from(problemPatterns)
        .orderBy(
          asc(problemPatterns.problemId),
          asc(problemPatterns.patternId),
        ),
    getAttempts: () =>
      database
        .select()
        .from(attempts)
        .orderBy(asc(attempts.occurredAt), asc(attempts.id)),
    getSkillStates: () =>
      database.select().from(skillStates).orderBy(asc(skillStates.patternId)),
    replaceSkillStates: async (states) => {
      if (
        states.length !== PATTERN_DEFINITIONS.length ||
        new Set(states.map(({ patternId }) => patternId)).size !==
          PATTERN_DEFINITIONS.length
      ) {
        throw new Error("MEMORY replacement requires one state per pattern");
      }

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

function openConnection(config: DatabaseConfig): MemoryRebuildConnection {
  let client: Client | undefined;

  try {
    client = createClient(config);

    return {
      database: drizzle(client, { schema }),
      close: () => client?.close(),
    };
  } catch (error) {
    client?.close();
    throw error;
  }
}

async function rebuild(database: MemoryRebuildDatabase): Promise<number> {
  const states = await rebuildMemoryProjection({
    repository: createMemoryRepository(database),
    ids: createId,
    clock: systemClock,
  });

  return states.length;
}

const defaultDependencies: MemoryRebuildCommandDependencies = {
  readEnvironment: readMigrationEnvironment,
  openConnection,
  rebuild,
  info: (message) => console.info(message),
  error: (message) => console.error(message),
};

async function runMemoryRebuild(
  args: string[],
  dependencies: MemoryRebuildCommandDependencies,
): Promise<void> {
  const request = resolveMigrationRequest(args);

  dependencies.info(`MEMORY rebuild target: ${request.target}`);
  const environment = await dependencies.readEnvironment(request.envFile);
  requireMatchingTarget(request.target, environment.MIGRATION_TARGET);

  const config = parseDatabaseConfig(environment);
  requireTargetDatabase(request.target, config);
  let connection: MemoryRebuildConnection | undefined;
  let stateCount: number;

  try {
    connection = dependencies.openConnection(config);
    stateCount = await dependencies.rebuild(connection.database);
  } finally {
    await connection?.close();
  }

  dependencies.info(`MEMORY rebuild completed: ${stateCount} Skill States`);
}

export async function runMemoryRebuildCommand(
  args: string[],
  dependencies: MemoryRebuildCommandDependencies = defaultDependencies,
): Promise<0 | 1> {
  try {
    await runMemoryRebuild(args, dependencies);
    return 0;
  } catch {
    dependencies.error("MEMORY rebuild failed");
    return 1;
  }
}

const entrypoint = process.argv[1];

if (
  entrypoint !== undefined &&
  import.meta.url === pathToFileURL(resolve(entrypoint)).href
) {
  void runMemoryRebuildCommand(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
