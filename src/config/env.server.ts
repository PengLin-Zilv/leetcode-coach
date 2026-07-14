import "server-only";

import {
  parseDatabaseConfig,
  type DatabaseConfig,
} from "./database-env";

export function getDatabaseConfig(): DatabaseConfig {
  return parseDatabaseConfig(process.env);
}
