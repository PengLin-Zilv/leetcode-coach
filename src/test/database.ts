import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "../db/schema";

export type TestDatabase = LibSQLDatabase<typeof schema>;

export interface TestDatabaseHandle {
  readonly database: TestDatabase;
  close(): Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabaseHandle> {
  const directory = await mkdtemp(join(tmpdir(), "leetcode-coach-test-"));
  const client = createClient({ url: `file:${join(directory, "test.db")}` });

  try {
    await client.execute("PRAGMA foreign_keys = ON");
    const foreignKeys = await client.execute("PRAGMA foreign_keys");

    if (Number(foreignKeys.rows[0]?.foreign_keys) !== 1) {
      throw new Error("Test database foreign keys are not enabled");
    }

    const database = drizzle(client, { schema });
    await migrate(database, {
      migrationsFolder: join(process.cwd(), "drizzle"),
    });

    let closed = false;

    return {
      database,
      close: async () => {
        if (closed) {
          return;
        }

        closed = true;

        try {
          client.close();
        } finally {
          await rm(directory, { force: true, recursive: true });
        }
      },
    };
  } catch (error) {
    try {
      client.close();
    } finally {
      await rm(directory, { force: true, recursive: true });
    }

    throw error;
  }
}
