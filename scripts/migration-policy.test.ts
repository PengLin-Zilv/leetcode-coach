import { describe, expect, it } from "vitest";

import { resolveMigrationRequest } from "./migration-policy";

describe("resolveMigrationRequest", () => {
  it("selects the local environment file", () => {
    expect(resolveMigrationRequest(["local"])).toEqual({
      target: "local",
      envFile: ".env.local",
    });
  });

  it("requires explicit confirmation for production", () => {
    expect(() => resolveMigrationRequest(["production"])).toThrow(
      "Production migration requires --confirm-production",
    );
  });

  it("selects the production environment file after confirmation", () => {
    expect(
      resolveMigrationRequest(["production", "--confirm-production"]),
    ).toEqual({
      target: "production",
      envFile: ".env.production.local",
    });
  });

  it("rejects unsupported migration targets", () => {
    expect(() => resolveMigrationRequest(["preview"])).toThrow(
      "Migration target must be local or production",
    );
  });
});
