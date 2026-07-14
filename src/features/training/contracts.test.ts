import { describe, expect, it } from "vitest";

import { createId } from "../../lib/id";
import {
  attemptInputSchema,
  profileInputSchema,
  reflectionInputSchema,
} from "./contracts";

const timestamp = "2026-07-14T15:00:00.000Z";

describe("attemptInputSchema", () => {
  it("accepts a structured attempt at the no-hint boundary", () => {
    expect(
      attemptInputSchema.parse({
        problemId: createId(),
        result: "solved",
        durationMinutes: 15,
        confidence: 4,
        note: "Binary search invariant was clear.",
        highestHintLevel: 0,
        occurredAt: timestamp,
      }),
    ).toMatchObject({ result: "solved", highestHintLevel: 0 });
  });

  it("rejects hint depth above the progressive ladder", () => {
    expect(() =>
      attemptInputSchema.parse({
        problemId: createId(),
        result: "solved",
        durationMinutes: 15,
        highestHintLevel: 5,
        occurredAt: timestamp,
      }),
    ).toThrow();
  });

  it.each([0, 6])("rejects confidence %i outside 1 through 5", (confidence) => {
    expect(() =>
      attemptInputSchema.parse({
        problemId: createId(),
        result: "solved",
        durationMinutes: 15,
        confidence,
        highestHintLevel: 0,
        occurredAt: timestamp,
      }),
    ).toThrow();
  });

  it("rejects a negative duration", () => {
    expect(() =>
      attemptInputSchema.parse({
        problemId: createId(),
        result: "not_solved",
        durationMinutes: -1,
        highestHintLevel: 0,
        occurredAt: timestamp,
      }),
    ).toThrow();
  });

  it.each([
    { durationMinutes: "", highestHintLevel: 0 },
    { durationMinutes: 15, highestHintLevel: "" },
  ])("rejects an empty required numeric field", (numericFields) => {
    expect(() =>
      attemptInputSchema.parse({
        problemId: createId(),
        result: "solved",
        ...numericFields,
        occurredAt: timestamp,
      }),
    ).toThrow();
  });

  it("rejects an invalid timestamp", () => {
    expect(() =>
      attemptInputSchema.parse({
        problemId: createId(),
        result: "viewed_solution",
        durationMinutes: 15,
        highestHintLevel: 4,
        occurredAt: "2026-07-14 15:00:00",
      }),
    ).toThrow();
  });

  it("normalizes optional empty strings to undefined", () => {
    expect(
      attemptInputSchema.parse({
        problemId: createId(),
        result: "solved",
        durationMinutes: 15,
        confidence: "",
        note: "",
        highestHintLevel: 0,
        occurredAt: timestamp,
      }),
    ).toMatchObject({ confidence: undefined, note: undefined });
  });
});

describe("reflectionInputSchema", () => {
  it("accepts a non-empty standalone reflection", () => {
    expect(
      reflectionInputSchema.parse({
        body: "I should state the invariant before coding.",
        occurredAt: timestamp,
      }),
    ).toMatchObject({
      body: "I should state the invariant before coding.",
      occurredAt: timestamp,
    });
  });

  it("rejects an empty body", () => {
    expect(() =>
      reflectionInputSchema.parse({ body: "   ", occurredAt: timestamp }),
    ).toThrow();
  });

  it("rejects an invalid timestamp", () => {
    expect(() =>
      reflectionInputSchema.parse({ body: "Useful note", occurredAt: "later" }),
    ).toThrow();
  });
});

describe("profileInputSchema", () => {
  const validProfile = {
    deadline: "2026-08-31",
    sessionsPerWeek: 4,
    minutesPerSession: 30,
    startingLevel: "new",
  } as const;

  it("accepts the supported setup values", () => {
    expect(profileInputSchema.parse(validProfile)).toEqual(validProfile);
  });

  it.each([0, 8])(
    "rejects sessionsPerWeek %i outside 1 through 7",
    (sessionsPerWeek) => {
      expect(() =>
        profileInputSchema.parse({ ...validProfile, sessionsPerWeek }),
      ).toThrow();
    },
  );

  it.each([0, 20, 90])(
    "rejects unsupported minutesPerSession %i",
    (minutesPerSession) => {
      expect(() =>
        profileInputSchema.parse({ ...validProfile, minutesPerSession }),
      ).toThrow();
    },
  );

  it("rejects an unsupported starting level", () => {
    expect(() =>
      profileInputSchema.parse({ ...validProfile, startingLevel: "expert" }),
    ).toThrow();
  });

  it("rejects an invalid calendar date", () => {
    expect(() =>
      profileInputSchema.parse({ ...validProfile, deadline: "2026-02-30" }),
    ).toThrow();
  });
});
