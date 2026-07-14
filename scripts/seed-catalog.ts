import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import {
  parseDatabaseConfig,
  type DatabaseConfig,
} from "../src/config/database-env";
import * as schema from "../src/db/schema";
import rawSeed from "../src/features/catalog/neetcode-150-list.json";
import { buildCatalogSeed } from "../src/features/catalog/seed-data";
import { systemClock } from "../src/lib/clock";
import { createId } from "../src/lib/id";
import { seedCatalog } from "./catalog-seed";
import { readMigrationEnvironment } from "./migration-environment";
import {
  resolveMigrationRequest,
  type MigrationTarget,
} from "./migration-policy";

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

async function runCatalogSeed(): Promise<void> {
  const request = resolveMigrationRequest(process.argv.slice(2));

  console.info(`Catalog seed target: ${request.target}`);
  const environment = await readMigrationEnvironment(request.envFile);
  requireMatchingTarget(request.target, environment.MIGRATION_TARGET);

  const config = parseDatabaseConfig(environment);
  requireTargetDatabase(request.target, config);
  const seed = buildCatalogSeed(rawSeed as unknown);
  let client: Client | undefined;

  try {
    client = createClient(config);
    const database = drizzle(client, { schema });

    await seedCatalog(database, seed, createId, systemClock);
  } finally {
    client?.close();
  }

  console.info(
    `Catalog seed completed: ${seed.patterns.length} patterns, ${seed.prerequisites.length} prerequisite edges, ${seed.problems.length} problems, ${seed.problemPatterns.length} problem mappings`,
  );
}

void runCatalogSeed().catch(() => {
  console.error("Catalog seed failed");
  process.exitCode = 1;
});
