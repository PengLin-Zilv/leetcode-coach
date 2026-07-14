import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";

import type { MigrationRequest } from "./migration-policy";

type ReadEnvironmentFile = (
  envFile: MigrationRequest["envFile"],
) => Promise<string>;

async function readUtf8EnvironmentFile(
  envFile: MigrationRequest["envFile"],
): Promise<string> {
  return readFile(envFile, "utf8");
}

export async function readMigrationEnvironment(
  envFile: MigrationRequest["envFile"],
  readEnvironmentFile: ReadEnvironmentFile = readUtf8EnvironmentFile,
): Promise<Record<string, string | undefined>> {
  const environment = parseEnv(await readEnvironmentFile(envFile));

  return {
    MIGRATION_TARGET: environment.MIGRATION_TARGET,
    TURSO_DATABASE_URL: environment.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: environment.TURSO_AUTH_TOKEN,
  };
}
