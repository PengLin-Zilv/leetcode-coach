import { describe, expect, it } from "vitest";

import { addUtcDays, toUtcDateKey } from "./utc-date";

describe("UTC calendar dates", () => {
  it("derives the date key from the represented UTC instant", () => {
    expect(toUtcDateKey(new Date("2026-07-14T23:30:00-04:00"))).toBe(
      "2026-07-15",
    );
  });

  it("adds whole UTC calendar days", () => {
    expect(addUtcDays("2026-07-14", 3)).toBe("2026-07-17");
  });

  it("rejects an invalid date key", () => {
    expect(() => addUtcDays("2026-02-30", 1)).toThrow();
  });
});
