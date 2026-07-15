import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPatterns: vi.fn(),
  getProblems: vi.fn(),
  getProblemPatterns: vi.fn(),
  readActivePractice: vi.fn(),
  requestPracticeHint: vi.fn(),
  writeActivePractice: vi.fn(),
}));

vi.mock("../../../features/mind/request-mind", () => ({
  requestPracticeHint: mocks.requestPracticeHint,
}));
vi.mock("../../../features/practice/active-practice.server", () => ({
  readActivePractice: mocks.readActivePractice,
  writeActivePractice: mocks.writeActivePractice,
}));
vi.mock("../../../features/training/training-repository.server", () => ({
  getTrainingRepository: () => ({
    getPatterns: mocks.getPatterns,
    getProblems: mocks.getProblems,
    getProblemPatterns: mocks.getProblemPatterns,
  }),
}));

import { requestHintAction } from "./actions.server";

const problemId = "0190f6f5-9b5a-7a22-8c44-123456789abd";
const patternId = "0190f6f5-9b5a-7a22-8c44-123456789abe";
const active = {
  problemId,
  startedAt: "2026-07-14T15:00:00.000Z",
  highestHintLevel: 1 as const,
};

function hintInput(kind: "next_hint" | "simpler" | "example" | "trace") {
  return {
    problemId,
    attemptSummary: "I tried a set.",
    kind,
  } as const;
}

describe("requestHintAction", () => {
  beforeEach(() => {
    mocks.getPatterns
      .mockReset()
      .mockResolvedValue([{ id: patternId, name: "Arrays & Hashing" }]);
    mocks.getProblems
      .mockReset()
      .mockResolvedValue([{ id: problemId, title: "Contains Duplicate" }]);
    mocks.getProblemPatterns
      .mockReset()
      .mockResolvedValue([{ problemId, patternId }]);
    mocks.readActivePractice.mockReset().mockResolvedValue(active);
    mocks.requestPracticeHint.mockReset();
    mocks.writeActivePractice.mockReset().mockResolvedValue(undefined);
  });

  it("rejects malformed action input before reading or writing the cookie", async () => {
    await expect(
      requestHintAction({
        ...hintInput("next_hint"),
        unexpected: "untrusted",
      }),
    ).resolves.toEqual({
      status: "unavailable",
      message: "Coaching is temporarily unavailable",
    });

    expect(mocks.readActivePractice).not.toHaveBeenCalled();
    expect(mocks.requestPracticeHint).not.toHaveBeenCalled();
    expect(mocks.writeActivePractice).not.toHaveBeenCalled();
  });

  it("leaves the cookie unchanged when signed state is missing or mismatched", async () => {
    mocks.readActivePractice.mockResolvedValue(null);

    await requestHintAction(hintInput("next_hint"));

    expect(mocks.requestPracticeHint).not.toHaveBeenCalled();
    expect(mocks.writeActivePractice).not.toHaveBeenCalled();
  });

  it.each([
    { status: "unavailable", reason: "not_configured" },
    { status: "unavailable", reason: "invalid_response" },
  ] as const)(
    "does not rewrite the cookie for $reason MIND output",
    async (result) => {
      mocks.requestPracticeHint.mockResolvedValue(result);

      await requestHintAction(hintInput("next_hint"));

      expect(mocks.writeActivePractice).not.toHaveBeenCalled();
    },
  );

  it("rejects a valid-shaped hint that skips the exact next level", async () => {
    mocks.requestPracticeHint.mockResolvedValue({
      status: "hint",
      body: "This skipped a layer.",
      hintLevel: 3,
    });

    await expect(
      requestHintAction(hintInput("next_hint")),
    ).resolves.toMatchObject({ status: "unavailable" });
    expect(mocks.writeActivePractice).not.toHaveBeenCalled();
  });

  it("writes only an exact next-level hint", async () => {
    mocks.requestPracticeHint.mockResolvedValue({
      status: "hint",
      body: "Ask what the set remembers.",
      hintLevel: 2,
    });

    await expect(requestHintAction(hintInput("next_hint"))).resolves.toEqual({
      status: "hint",
      body: "Ask what the set remembers.",
      hintLevel: 2,
    });
    expect(mocks.writeActivePractice).toHaveBeenCalledWith({
      ...active,
      highestHintLevel: 2,
    });
  });

  it.each(["simpler", "example", "trace"] as const)(
    "sends typed %s presentation at server-owned depth without rewriting the cookie",
    async (kind) => {
      const presentationActive = { ...active, highestHintLevel: 2 as const };
      mocks.readActivePractice.mockResolvedValue(presentationActive);
      mocks.requestPracticeHint.mockResolvedValue({
        status: "hint",
        body: "Same help, different presentation.",
        hintLevel: 2,
      });

      await expect(requestHintAction(hintInput(kind))).resolves.toEqual({
        status: "hint",
        body: "Same help, different presentation.",
        hintLevel: 2,
      });
      expect(mocks.requestPracticeHint).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          kind,
          currentHintLevel: 2,
        }),
      );
      expect(mocks.writeActivePractice).not.toHaveBeenCalled();
    },
  );

  it("does not send a presentation request before any hint exists", async () => {
    mocks.readActivePractice.mockResolvedValue({
      ...active,
      highestHintLevel: 0,
    });

    await requestHintAction(hintInput("simpler"));

    expect(mocks.requestPracticeHint).not.toHaveBeenCalled();
    expect(mocks.writeActivePractice).not.toHaveBeenCalled();
  });
});
