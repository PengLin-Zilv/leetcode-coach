import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import {
  requireSafeE2eDatabaseUrl,
  resetE2eDatabase,
  type E2eDatabase,
} from "../../../scripts/prepare-e2e";
import * as schema from "../../../src/db/schema";

export interface BrowserDatabase {
  readonly database: E2eDatabase;
  close(): void;
}

const DEFAULT_BROWSER_DATABASE_URL =
  "file:./test-results/leetcode-coach-e2e.db";

export async function openBrowserDatabase(
  databaseUrl: string | undefined = DEFAULT_BROWSER_DATABASE_URL,
): Promise<BrowserDatabase> {
  const url = await requireSafeE2eDatabaseUrl(databaseUrl);
  let client: Client | undefined;

  try {
    client = createClient({ url });
    const openedClient = client;
    await openedClient.execute("PRAGMA foreign_keys = ON");

    return {
      database: drizzle(openedClient, { schema }),
      close: () => openedClient.close(),
    };
  } catch (error) {
    client?.close();
    throw error;
  }
}

export async function resetBrowserDatabase(): Promise<void> {
  const connection = await openBrowserDatabase();

  try {
    await resetE2eDatabase(connection.database);
  } finally {
    connection.close();
  }
}
