import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import {
  parseDatabaseConfig,
  type DatabaseConfig,
} from "../src/config/database-env";
import * as schema from "../src/db/schema";
import rawSeed from "../src/features/catalog/neetcode-150-list.json";
import {
  buildCatalogSeed,
  type CatalogSeed,
} from "../src/features/catalog/seed-data";
import { systemClock, type Clock } from "../src/lib/clock";
import { createId, type IdGenerator } from "../src/lib/id";
import { seedCatalog } from "./catalog-seed";
import { readMigrationEnvironment } from "./migration-environment";
import {
  resolveMigrationRequest,
  type MigrationRequest,
  type MigrationTarget,
} from "./migration-policy";

type CatalogDatabase = Parameters<typeof seedCatalog>[0];

interface CatalogSeedConnection {
  readonly database: CatalogDatabase;
  close(): void | Promise<void>;
}

export interface CatalogSeedCommandDependencies {
  readEnvironment(
    envFile: MigrationRequest["envFile"],
  ): Promise<Record<string, string | undefined>>;
  openConnection(config: DatabaseConfig): CatalogSeedConnection;
  seed(
    database: CatalogDatabase,
    seed: CatalogSeed,
    ids: IdGenerator,
    clock: Clock,
  ): Promise<void>;
  info(message: string): void;
  error(message: string): void;
}

function requireMatchingTarget(
  target: MigrationTarget,
  selectedTarget: string | undefined,
): void {
  if (selectedTarget !== target) {
    throw new Error(
      "Catalog seed target does not match the selected environment",
    );
  }
}

function requireTargetDatabase(
  target: MigrationTarget,
  config: DatabaseConfig,
): void {
  const isLocalDatabase = config.url.startsWith("file:");

  if (target === "local" && !isLocalDatabase) {
    throw new Error("Local catalog seed requires a file database");
  }

  if (target === "production" && (isLocalDatabase || !config.authToken)) {
    throw new Error(
      "Production catalog seed requires a remote database and token",
    );
  }
}

function openConnection(config: DatabaseConfig): CatalogSeedConnection {
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

const defaultDependencies: CatalogSeedCommandDependencies = {
  readEnvironment: readMigrationEnvironment,
  openConnection,
  seed: seedCatalog,
  info: (message) => console.info(message),
  error: (message) => console.error(message),
};

async function runCatalogSeed(
  args: string[],
  dependencies: CatalogSeedCommandDependencies,
): Promise<void> {
  const request = resolveMigrationRequest(args);

  dependencies.info(`Catalog seed target: ${request.target}`);
  const environment = await dependencies.readEnvironment(request.envFile);
  requireMatchingTarget(request.target, environment.MIGRATION_TARGET);

  const config = parseDatabaseConfig(environment);
  requireTargetDatabase(request.target, config);
  const seed = buildCatalogSeed(rawSeed as unknown);
  let connection: CatalogSeedConnection | undefined;

  try {
    connection = dependencies.openConnection(config);
    await dependencies.seed(connection.database, seed, createId, systemClock);
  } finally {
    await connection?.close();
  }

  dependencies.info(
    `Catalog seed completed: ${seed.patterns.length} patterns, ${seed.prerequisites.length} prerequisite edges, ${seed.problems.length} problems, ${seed.problemPatterns.length} problem mappings`,
  );
}

export async function runCatalogSeedCommand(
  args: string[],
  dependencies: CatalogSeedCommandDependencies = defaultDependencies,
): Promise<0 | 1> {
  try {
    await runCatalogSeed(args, dependencies);
    return 0;
  } catch {
    dependencies.error("Catalog seed failed");
    return 1;
  }
}

const entrypoint = process.argv[1];

if (
  entrypoint !== undefined &&
  import.meta.url === pathToFileURL(resolve(entrypoint)).href
) {
  void runCatalogSeedCommand(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
