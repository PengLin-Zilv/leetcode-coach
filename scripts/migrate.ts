import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import {
  parseDatabaseConfig,
  type DatabaseConfig,
} from "../src/config/database-env";
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
    throw new Error("Migration target does not match the selected environment");
  }
}

function requireTargetDatabase(
  target: MigrationTarget,
  config: DatabaseConfig,
): void {
  const isLocalDatabase = config.url.startsWith("file:");

  if (target === "local" && !isLocalDatabase) {
    throw new Error("Local migration requires a file database");
  }

  if (target === "production" && (isLocalDatabase || !config.authToken)) {
    throw new Error(
      "Production migration requires a remote database and token",
    );
  }
}

async function runMigration(): Promise<void> {
  const request = resolveMigrationRequest(process.argv.slice(2));

  console.info(`Migration target: ${request.target}`);
  const environment = await readMigrationEnvironment(request.envFile);
  requireMatchingTarget(request.target, environment.MIGRATION_TARGET);

  const config = parseDatabaseConfig(environment);
  requireTargetDatabase(request.target, config);

  let client: Client | undefined;

  try {
    client = createClient(config);
    const database = drizzle(client);

    await migrate(database, { migrationsFolder: "./drizzle" });
  } finally {
    client?.close();
  }

  console.info("Migration completed");
}

void runMigration().catch((error) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
