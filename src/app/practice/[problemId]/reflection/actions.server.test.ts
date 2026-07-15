import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearActivePractice: vi.fn(),
  clockNow: vi.fn(() => new Date("2026-07-14T15:00:01.000Z")),
  completeAttempt: vi.fn(),
  createId: vi.fn(() => "0198b8e8-63b6-7000-8000-000000000099"),
  getPatterns: vi.fn(),
  getProblems: vi.fn(),
  getProblemPatterns: vi.fn(),
  issuePracticeDraftCleanupToken: vi.fn(),
  readActivePractice: vi.fn(),
  redirect: vi.fn(),
  requestAttemptFeedback: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../../../features/memory/rebuild-memory.server", () => ({
  rebuildMemory: vi.fn(),
}));
vi.mock("../../../../features/mind/mind-output-repository.server", () => ({
  getMindOutputRepository: () => ({ insert: vi.fn() }),
}));
vi.mock("../../../../features/mind/request-mind", () => ({
  requestAttemptFeedback: mocks.requestAttemptFeedback,
}));
vi.mock("../../../../features/practice/active-practice.server", () => ({
  clearActivePractice: mocks.clearActivePractice,
  issuePracticeDraftCleanupToken: mocks.issuePracticeDraftCleanupToken,
  readActivePractice: mocks.readActivePractice,
}));
vi.mock("../../../../features/training/complete-attempt", () => ({
  completeAttempt: mocks.completeAttempt,
}));
vi.mock("../../../../features/training/training-repository.server", () => ({
  getTrainingRepository: () => ({
    getPatterns: mocks.getPatterns,
    getProblems: mocks.getProblems,
    getProblemPatterns: mocks.getProblemPatterns,
  }),
}));
vi.mock("../../../../lib/clock", () => ({
  systemClock: { now: mocks.clockNow },
}));
vi.mock("../../../../lib/id", () => ({ createId: mocks.createId }));

import { submitAttemptReflectionAction } from "./actions.server";

const problemId = "0190f6f5-9b5a-7a22-8c44-123456789abd";
const patternId = "0190f6f5-9b5a-7a22-8c44-123456789abe";
const attemptId = "0190f6f5-9b5a-7a22-8c44-123456789abf";

function reflectionForm(): FormData {
  const formData = new FormData();
  formData.set("result", "solved");
  formData.set("confidence", "4");
  formData.set("note", "Used the set invariant.");
  return formData;
}

describe("submitAttemptReflectionAction", () => {
  beforeEach(() => {
    mocks.clearActivePractice.mockReset().mockResolvedValue(undefined);
    mocks.clockNow
      .mockReset()
      .mockReturnValue(new Date("2026-07-14T15:00:01.000Z"));
    mocks.completeAttempt.mockReset().mockResolvedValue({
      status: "completed",
      attemptId,
      memory: { status: "updated" },
    });
    mocks.getPatterns
      .mockReset()
      .mockResolvedValue([{ id: patternId, name: "Arrays & Hashing" }]);
    mocks.getProblems
      .mockReset()
      .mockResolvedValue([{ id: problemId, title: "Contains Duplicate" }]);
    mocks.getProblemPatterns
      .mockReset()
      .mockResolvedValue([{ problemId, patternId }]);
    mocks.issuePracticeDraftCleanupToken
      .mockReset()
      .mockReturnValue("signed-cleanup-token");
    mocks.readActivePractice.mockReset().mockResolvedValue({
      problemId,
      startedAt: "2026-07-14T15:00:00.000Z",
      highestHintLevel: 0,
    });
    mocks.redirect.mockReset().mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    mocks.requestAttemptFeedback.mockReset().mockResolvedValue({
      status: "unavailable",
      reason: "not_configured",
    });
    mocks.revalidatePath.mockReset();
  });

  it("uses only signed session evidence and commits before optional MIND feedback", async () => {
    const formData = reflectionForm();
    formData.set("durationMinutes", "180");
    formData.set("highestHintLevel", "4");

    await expect(
      submitAttemptReflectionAction(problemId, {}, formData),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.readActivePractice).toHaveBeenCalledWith(
      problemId,
      expect.objectContaining({ now: expect.any(Function) }),
    );
    expect(mocks.completeAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        clock: expect.objectContaining({ now: expect.any(Function) }),
      }),
      {
        problemId,
        result: "solved",
        durationMinutes: 1,
        confidence: "4",
        note: "Used the set invariant.",
        highestHintLevel: 0,
        occurredAt: "2026-07-14T15:00:01.000Z",
      },
    );
    expect(mocks.requestAttemptFeedback).toHaveBeenCalledWith(
      expect.any(Object),
      {
        attemptId,
        patternId,
        problemTitle: "Contains Duplicate",
        patternName: "Arrays & Hashing",
        result: "solved",
        durationMinutes: 1,
        confidence: 4,
        highestHintLevel: 0,
        note: "Used the set invariant.",
      },
    );
    expect(mocks.completeAttempt.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.requestAttemptFeedback.mock.invocationCallOrder[0],
    );
    expect(
      mocks.requestAttemptFeedback.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.clearActivePractice.mock.invocationCallOrder[0]);
    expect(mocks.issuePracticeDraftCleanupToken).toHaveBeenCalledWith({
      attemptId,
      problemId,
      startedAt: "2026-07-14T15:00:00.000Z",
    });
    expect(mocks.redirect).toHaveBeenCalledWith(
      `/feedback/${attemptId}?cleanup=signed-cleanup-token`,
    );
  });

  it("caps duration at 180 minutes from the signed start time", async () => {
    mocks.readActivePractice.mockResolvedValue({
      problemId,
      startedAt: "2026-07-14T11:00:00.000Z",
      highestHintLevel: 2,
    });

    await expect(
      submitAttemptReflectionAction(problemId, {}, reflectionForm()),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.completeAttempt).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ durationMinutes: 180, highestHintLevel: 2 }),
    );
  });

  it("keeps the durable Attempt flow moving when projection is stale and MIND is unavailable", async () => {
    mocks.completeAttempt.mockResolvedValue({
      status: "completed",
      attemptId,
      memory: { status: "stale", reason: "projection_failed" },
    });

    await expect(
      submitAttemptReflectionAction(problemId, {}, reflectionForm()),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.clearActivePractice).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith(
      `/feedback/${attemptId}?cleanup=signed-cleanup-token`,
    );
  });

  it("does not clear active practice or request MIND when the Attempt commit fails", async () => {
    mocks.completeAttempt.mockRejectedValue(new Error("commit failed"));

    await expect(
      submitAttemptReflectionAction(problemId, {}, reflectionForm()),
    ).resolves.toEqual({
      formError: "Your attempt could not be saved. Try again.",
    });

    expect(mocks.requestAttemptFeedback).not.toHaveBeenCalled();
    expect(mocks.clearActivePractice).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("rejects missing or mismatched signed practice without writing", async () => {
    mocks.readActivePractice.mockResolvedValue(null);

    await expect(
      submitAttemptReflectionAction(problemId, {}, reflectionForm()),
    ).resolves.toEqual({
      formError: "This practice session is no longer active. Start from Today.",
    });

    expect(mocks.completeAttempt).not.toHaveBeenCalled();
    expect(mocks.requestAttemptFeedback).not.toHaveBeenCalled();
    expect(mocks.clearActivePractice).not.toHaveBeenCalled();
  });

  it("validates the structured fields without accepting unexpected fields or a Reflection body", async () => {
    const formData = reflectionForm();
    formData.set("result", "blocked");
    formData.set("unexpected_field", "untrusted extra value");
    formData.set("body", "standalone reflection");

    const result = await submitAttemptReflectionAction(problemId, {}, formData);

    expect(result.fieldErrors?.result).toBeDefined();
    expect(JSON.stringify(result)).not.toContain("untrusted extra value");
    expect(JSON.stringify(result)).not.toContain("standalone reflection");
    expect(mocks.readActivePractice).not.toHaveBeenCalled();
    expect(mocks.completeAttempt).not.toHaveBeenCalled();
  });
});
