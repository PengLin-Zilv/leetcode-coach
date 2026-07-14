import "server-only";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { getDatabaseConfig } from "../config/env.server";
import * as schema from "./schema";

function createDatabase() {
  const { authToken, url } = getDatabaseConfig();
  const client = createClient({ authToken, url });

  return drizzle(client, { schema });
}

let database: ReturnType<typeof createDatabase> | undefined;

export function getDatabase(): ReturnType<typeof createDatabase> {
  database ??= createDatabase();

  return database;
}
