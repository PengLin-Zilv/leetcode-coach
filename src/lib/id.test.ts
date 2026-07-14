import { version as uuidVersion } from "uuid";
import { describe, expect, it } from "vitest";

import { createId } from "./id";

describe("createId", () => {
  it("creates an application-owned UUIDv7", () => {
    expect(uuidVersion(createId())).toBe(7);
  });
});
