import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createClient as createLibsqlClient,
  type Client,
} from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "../db/schema";

export type TestDatabase = LibSQLDatabase<typeof schema>;

export interface TestDatabaseHandle {
  readonly database: TestDatabase;
  close(): Promise<void>;
}

export interface TestDatabaseDependencies {
  createClient(url: string): Client;
  createTemporaryDirectory(prefix: string): Promise<string>;
  removeTemporaryDirectory(directory: string): Promise<void>;
}

const defaultDependencies: TestDatabaseDependencies = {
  createClient: (url) => createLibsqlClient({ url }),
  createTemporaryDirectory: (prefix) => mkdtemp(prefix),
  removeTemporaryDirectory: (directory) =>
    rm(directory, { force: true, recursive: true }),
};

export async function createTestDatabase(
  dependencyOverrides: Partial<TestDatabaseDependencies> = {},
): Promise<TestDatabaseHandle> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const directory = await dependencies.createTemporaryDirectory(
    join(tmpdir(), "leetcode-coach-test-"),
  );
  let client: Client | undefined;

  try {
    client = dependencies.createClient(`file:${join(directory, "test.db")}`);
    const openedClient = client;
    await openedClient.execute("PRAGMA foreign_keys = ON");
    const foreignKeys = await openedClient.execute("PRAGMA foreign_keys");

    if (Number(foreignKeys.rows[0]?.foreign_keys) !== 1) {
      throw new Error("Test database foreign keys are not enabled");
    }

    const database = drizzle(openedClient, { schema });
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
          openedClient.close();
        } finally {
          await dependencies.removeTemporaryDirectory(directory);
        }
      },
    };
  } catch (error) {
    try {
      client?.close();
    } finally {
      await dependencies.removeTemporaryDirectory(directory);
    }

    throw error;
  }
}
