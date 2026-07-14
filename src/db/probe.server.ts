import "server-only";

import { sql } from "drizzle-orm";

import { getDatabase } from "./client.server";

export async function probeDatabase(): Promise<unknown> {
  const rows = await getDatabase().all<unknown>(sql`select 1 as connected`);

  return rows[0];
}
