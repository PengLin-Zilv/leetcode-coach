import { describe, expect, it } from "vitest";

import {
  applyPracticeEvent,
  parseActivePracticePayload,
  startPractice,
} from "./active-practice";

const problemId = "0190f6f5-9b5a-7a22-8c44-123456789abd";
const otherProblemId = "0190f6f5-9b5a-7a22-8c44-123456789abe";
const now = new Date("2026-07-14T15:00:00.000Z");

describe("active practice", () => {
  it("starts a fresh practice session using the injected clock", () => {
    expect(startPractice(problemId, now)).toEqual({
      problemId,
      startedAt: now.toISOString(),
      highestHintLevel: 0,
    });
  });

  it("rejects an invalid Problem ID at session start", () => {
    expect(() => startPractice("not-a-problem-id", now)).toThrow();
  });

  it("does not advance hint depth for presentation changes", () => {
    const active = startPractice(problemId, now);

    expect(
      applyPracticeEvent(active, {
        type: "presentation_changed",
        mode: "simpler",
      }),
    ).toEqual(active);
  });

  it("advances hint depth by exactly one received level", () => {
    const active = startPractice(problemId, now);

    expect(
      applyPracticeEvent(active, {
        type: "hint_received",
        hintLevel: 1,
      }).highestHintLevel,
    ).toBe(1);

    expect(() =>
      applyPracticeEvent(active, {
        type: "hint_received",
        hintLevel: 3,
      }),
    ).toThrow();
  });

  it.each([0, 5])(
    "rejects received hint level %i outside the next ladder step",
    (hintLevel) => {
      const active = startPractice(problemId, now);

      expect(() =>
        applyPracticeEvent(active, {
          type: "hint_received",
          hintLevel,
        } as Parameters<typeof applyPracticeEvent>[1]),
      ).toThrow();
    },
  );
});

describe("active practice cookie validation", () => {
  const validPayload = {
    problemId,
    startedAt: "2026-07-14T14:55:00.000Z",
    highestHintLevel: 0,
  };

  it("accepts strict state for the requested Problem", () => {
    expect(parseActivePracticePayload(validPayload, problemId, now)).toEqual({
      problemId,
      startedAt: "2026-07-14T14:55:00.000Z",
      highestHintLevel: 0,
    });
  });

  it.each([
    ["missing", undefined],
    ["a non-object value", "not-an-object"],
    [
      "an extra field",
      {
        problemId,
        startedAt: "2026-07-14T14:55:00.000Z",
        highestHintLevel: 0,
        note: "must stay local",
      },
    ],
    [
      "an invalid UUID",
      {
        problemId: "not-a-problem-id",
        startedAt: "2026-07-14T14:55:00.000Z",
        highestHintLevel: 0,
      },
    ],
    [
      "a future start time",
      {
        problemId,
        startedAt: "2026-07-14T15:00:00.001Z",
        highestHintLevel: 0,
      },
    ],
    [
      "a negative hint level",
      {
        problemId,
        startedAt: "2026-07-14T14:55:00.000Z",
        highestHintLevel: -1,
      },
    ],
    [
      "a hint level above four",
      {
        problemId,
        startedAt: "2026-07-14T14:55:00.000Z",
        highestHintLevel: 5,
      },
    ],
  ])("rejects %s", (_label, payload) => {
    expect(parseActivePracticePayload(payload, problemId, now)).toBeNull();
  });

  it("rejects a cookie for a different Problem route", () => {
    expect(
      parseActivePracticePayload(validPayload, otherProblemId, now),
    ).toBeNull();
  });

  it("rejects an invalid route Problem ID", () => {
    expect(
      parseActivePracticePayload(validPayload, "not-a-problem-id", now),
    ).toBeNull();
  });
});
