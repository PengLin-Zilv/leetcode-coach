import { lstat, mkdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import rawSeed from "../src/features/catalog/neetcode-150-list.json";
import { buildCatalogSeed } from "../src/features/catalog/seed-data";
import { systemClock } from "../src/lib/clock";
import { createId } from "../src/lib/id";
import * as schema from "../src/db/schema";
import {
  attempts,
  mindOutputSourceAttempts,
  mindOutputs,
  profiles,
  reflections,
  skillStates,
} from "../src/db/schema";
import { seedCatalog } from "./catalog-seed";

export type E2eDatabase = LibSQLDatabase<typeof schema>;

const E2E_DATABASE_PREFIX = "file:./test-results/";

export function requireE2eDatabaseUrl(url: string | undefined): string {
  if (
    !url ||
    url.includes("%") ||
    url === "file:./dev.db" ||
    !url.startsWith(E2E_DATABASE_PREFIX)
  ) {
    throw new Error("E2E database must be a local test-results file");
  }

  const databasePath = url.slice("file:".length);
  const testResultsDirectory = resolve("test-results");
  const resolvedDatabasePath = resolve(databasePath);
  const relativeDatabasePath = relative(
    testResultsDirectory,
    resolvedDatabasePath,
  );

  if (
    relativeDatabasePath === "" ||
    relativeDatabasePath.startsWith("..") ||
    relativeDatabasePath.includes("?") ||
    relativeDatabasePath.includes("#")
  ) {
    throw new Error("E2E database must be a local test-results file");
  }

  return url;
}

async function readPathKind(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function ensureSafeE2eDatabaseDirectory(url: string): Promise<void> {
  const testResultsDirectory = resolve("test-results");
  const resolvedDatabasePath = resolve(url.slice("file:".length));
  const relativeParentPath = relative(
    testResultsDirectory,
    dirname(resolvedDatabasePath),
  );
  const rootKind = await readPathKind(testResultsDirectory);

  if (rootKind?.isSymbolicLink() || (rootKind && !rootKind.isDirectory())) {
    throw new Error("E2E database must be a local test-results file");
  }

  if (rootKind === null) {
    await mkdir(testResultsDirectory);
  }

  let currentDirectory = testResultsDirectory;

  for (const segment of relativeParentPath.split(sep).filter(Boolean)) {
    currentDirectory = join(currentDirectory, segment);
    const pathKind = await readPathKind(currentDirectory);

    if (pathKind?.isSymbolicLink() || (pathKind && !pathKind.isDirectory())) {
      throw new Error("E2E database must be a local test-results file");
    }

    if (pathKind === null) {
      await mkdir(currentDirectory);
    }
  }

  for (const databaseFile of [
    resolvedDatabasePath,
    `${resolvedDatabasePath}-shm`,
    `${resolvedDatabasePath}-wal`,
  ]) {
    if ((await readPathKind(databaseFile))?.isSymbolicLink()) {
      throw new Error("E2E database must be a local test-results file");
    }
  }
}

export async function requireSafeE2eDatabaseUrl(
  url: string | undefined,
): Promise<string> {
  const safeUrl = requireE2eDatabaseUrl(url);
  await ensureSafeE2eDatabaseDirectory(safeUrl);

  return safeUrl;
}

export async function resetE2eDatabase(database: E2eDatabase): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.delete(mindOutputSourceAttempts);
    await transaction.delete(mindOutputs);
    await transaction.delete(attempts);
    await transaction.delete(reflections);
    await transaction.delete(skillStates);
    await transaction.delete(profiles);
  });

  await seedCatalog(
    database,
    buildCatalogSeed(rawSeed as unknown),
    createId,
    systemClock,
  );
}

export async function prepareE2eDatabase(
  databaseUrl: string | undefined,
): Promise<void> {
  const url = await requireSafeE2eDatabaseUrl(databaseUrl);
  let client: Client | undefined;

  try {
    client = createClient({ url });
    await client.execute("PRAGMA foreign_keys = ON");
    const database = drizzle(client, { schema });

    await migrate(database, { migrationsFolder: resolve("drizzle") });
    await resetE2eDatabase(database);
  } finally {
    client?.close();
  }
}

if (resolve(process.argv[1] ?? "") === resolve("scripts/prepare-e2e.ts")) {
  void prepareE2eDatabase(process.env.TURSO_DATABASE_URL).catch((error) => {
    console.error("E2E database preparation failed", error);
    process.exitCode = 1;
  });
}
