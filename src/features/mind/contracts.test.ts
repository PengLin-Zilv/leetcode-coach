import { describe, expect, it } from "vitest";

import { mindOutputSchema, practiceHintRequestSchema } from "./contracts";

const attemptId = "0190f6f5-9b5a-7a22-8c44-123456789abc";
const attemptOne = "0190f6f5-9b5a-7a22-8c44-123456789abd";
const attemptTwo = "0190f6f5-9b5a-7a22-8c44-123456789abe";
const patternId = "0190f6f5-9b5a-7a22-8c44-123456789abf";
const problemId = "0190f6f5-9b5a-7a22-8c44-123456789ac0";

describe("mindOutputSchema", () => {
  it("accepts strict per-Attempt and Pattern coaching outputs", () => {
    const single = mindOutputSchema.parse({
      type: "single",
      body: "State the invariant before moving either boundary.",
      attemptId,
    });

    const pattern = mindOutputSchema.parse({
      type: "pattern",
      body: "Boundary updates are the repeated failure mode.",
      patternId,
      sourceAttemptIds: [attemptOne, attemptTwo],
    });

    expect(single.type).toBe("single");
    expect(pattern.type).toBe("pattern");
  });

  it.each([
    {
      name: "a single output with a Pattern ID",
      value: { type: "single", body: "Advice", attemptId, patternId },
    },
    {
      name: "a single output with source Attempt IDs",
      value: {
        type: "single",
        body: "Advice",
        attemptId,
        sourceAttemptIds: [attemptOne],
      },
    },
    {
      name: "a Pattern output with an Attempt ID",
      value: {
        type: "pattern",
        body: "Advice",
        attemptId,
        patternId,
        sourceAttemptIds: [attemptOne],
      },
    },
    {
      name: "an output with both Attempt and Pattern IDs",
      value: { type: "single", body: "Advice", attemptId, patternId },
    },
    {
      name: "an output with neither Attempt nor Pattern ID",
      value: { type: "single", body: "Advice" },
    },
    {
      name: "an empty body",
      value: { type: "single", body: "   ", attemptId },
    },
    {
      name: "a malformed UUID",
      value: { type: "single", body: "Advice", attemptId: "not-a-uuid" },
    },
    {
      name: "an unrecognized key",
      value: { type: "single", body: "Advice", attemptId, confidence: 0.9 },
    },
  ])("rejects $name", ({ value }) => {
    expect(mindOutputSchema.safeParse(value).success).toBe(false);
  });
});

describe("practiceHintRequestSchema", () => {
  it("rejects invalid hint depth and unrecognized input", () => {
    const base = {
      problemId,
      problemTitle: "Valid Palindrome",
      patternName: "Two Pointers",
      attemptSummary: "I compare the outer characters.",
      kind: "next_hint",
    } as const;

    expect(
      practiceHintRequestSchema.safeParse({
        ...base,
        currentHintLevel: 5,
      }).success,
    ).toBe(false);
    expect(
      practiceHintRequestSchema.safeParse({
        ...base,
        currentHintLevel: 1,
        extra: true,
      }).success,
    ).toBe(false);
  });
});
