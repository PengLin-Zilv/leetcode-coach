import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createTestDatabase } from "./database";

describe("createTestDatabase", () => {
  it("removes its unique directory when client creation throws synchronously", async () => {
    const directory = join(
      "/tmp",
      "leetcode-coach-test-synchronous-client-failure",
    );
    const creationFailure = new Error("Injected synchronous client failure");
    const removeTemporaryDirectory = vi.fn(async () => undefined);

    const result = await createTestDatabase({
      createClient: () => {
        throw creationFailure;
      },
      createTemporaryDirectory: vi.fn(async () => directory),
      removeTemporaryDirectory,
    }).then(
      (handle) => ({ error: undefined, handle }),
      (error: unknown) => ({ error, handle: undefined }),
    );

    await result.handle?.close();

    expect(result.error).toBe(creationFailure);
    expect(removeTemporaryDirectory).toHaveBeenCalledOnce();
    expect(removeTemporaryDirectory).toHaveBeenCalledWith(directory);
  });
});
