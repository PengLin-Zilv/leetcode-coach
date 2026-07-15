import { mkdtemp, rm, stat, symlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openBrowserDatabase } from "../tests/e2e/support/database";
import { prepareE2eDatabase } from "./prepare-e2e";

describe("prepareE2eDatabase", () => {
  it("creates a missing database directory inside test-results", async () => {
    const relativeDirectory = join(
      "test-results",
      `prepare-e2e-${randomUUID()}`,
    );
    const databasePath = join(relativeDirectory, "browser.db");

    try {
      await prepareE2eDatabase(`file:./${databasePath}`);

      expect((await stat(databasePath)).isFile()).toBe(true);
    } finally {
      await rm(relativeDirectory, { force: true, recursive: true });
    }
  });

  it("refuses a database path that escapes test-results through a symlink", async () => {
    const linkPath = join("test-results", `prepare-e2e-link-${randomUUID()}`);
    const outsideDirectory = await mkdtemp(
      join(tmpdir(), "leetcode-coach-e2e-escape-"),
    );
    const escapedDatabasePath = join(outsideDirectory, "browser.db");

    try {
      await symlink(outsideDirectory, linkPath, "dir");

      await expect(
        prepareE2eDatabase(`file:./${join(linkPath, "browser.db")}`),
      ).rejects.toThrow("E2E database must be a local test-results file");
      await expect(stat(escapedDatabasePath)).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      await rm(linkPath, { force: true });
      await rm(outsideDirectory, { force: true, recursive: true });
    }
  });

  it("refuses to open a browser fixture database through a symlink", async () => {
    const linkPath = join(
      "test-results",
      `browser-database-link-${randomUUID()}`,
    );
    const outsideDirectory = await mkdtemp(
      join(tmpdir(), "leetcode-coach-browser-escape-"),
    );
    const escapedDatabasePath = join(outsideDirectory, "browser.db");
    let closeUnexpectedConnection: (() => void) | undefined;

    try {
      await symlink(outsideDirectory, linkPath, "dir");
      const result = await openBrowserDatabase(
        `file:./${join(linkPath, "browser.db")}`,
      ).then(
        (connection) => {
          closeUnexpectedConnection = connection.close;
          return { error: undefined };
        },
        (error: unknown) => ({ error }),
      );

      expect(result.error).toEqual(
        new Error("E2E database must be a local test-results file"),
      );
      await expect(stat(escapedDatabasePath)).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      closeUnexpectedConnection?.();
      await rm(linkPath, { force: true });
      await rm(outsideDirectory, { force: true, recursive: true });
    }
  });
});
