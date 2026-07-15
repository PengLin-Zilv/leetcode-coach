import { describe, expect, it } from "vitest";

import {
  InvalidPracticeCookieConfigurationError,
  parsePracticeCookieConfig,
} from "./practice-cookie-env";

const productionSecret = "p".repeat(64);

describe("parsePracticeCookieConfig", () => {
  it("requires a sufficiently long secret in production", () => {
    expect(
      parsePracticeCookieConfig({
        NODE_ENV: "production",
        PRACTICE_COOKIE_SECRET: productionSecret,
      }),
    ).toEqual({ secret: productionSecret });

    expect(() => parsePracticeCookieConfig({ NODE_ENV: "production" })).toThrow(
      InvalidPracticeCookieConfigurationError,
    );
    expect(() =>
      parsePracticeCookieConfig({
        NODE_ENV: "production",
        PRACTICE_COOKIE_SECRET: "too-short",
      }),
    ).toThrow(InvalidPracticeCookieConfigurationError);
  });

  it.each(["development", "test"] as const)(
    "uses one deterministic non-production secret in %s",
    (nodeEnvironment) => {
      const first = parsePracticeCookieConfig({ NODE_ENV: nodeEnvironment });
      const second = parsePracticeCookieConfig({ NODE_ENV: nodeEnvironment });

      expect(first).toEqual(second);
      expect(first.secret.length).toBeGreaterThanOrEqual(32);
      expect(first.secret).not.toBe(productionSecret);
    },
  );

  it("accepts an explicit non-production secret", () => {
    expect(
      parsePracticeCookieConfig({
        NODE_ENV: "test",
        PRACTICE_COOKIE_SECRET: productionSecret,
      }),
    ).toEqual({ secret: productionSecret });
  });

  it("never exposes a supplied secret in its public error", () => {
    const suppliedSecret = "private-but-short";

    try {
      parsePracticeCookieConfig({
        NODE_ENV: "production",
        PRACTICE_COOKIE_SECRET: suppliedSecret,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidPracticeCookieConfigurationError);
      expect((error as Error).message).not.toContain(suppliedSecret);
      return;
    }

    throw new Error("Expected practice cookie configuration to fail");
  });
});
