import "server-only";

import { parseDatabaseConfig, type DatabaseConfig } from "./database-env";
import {
  parsePracticeCookieConfig,
  type PracticeCookieConfig,
} from "./practice-cookie-env";

export function getDatabaseConfig(): DatabaseConfig {
  return parseDatabaseConfig(process.env);
}

export function getPracticeCookieConfig(): PracticeCookieConfig {
  return parsePracticeCookieConfig(process.env);
}
