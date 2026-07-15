import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clockNow: vi.fn(() => new Date("2026-07-14T15:00:00.000Z")),
  cookieSet: vi.fn(),
  getProblems: vi.fn(),
  getProblemPatterns: vi.fn(),
  getSkillStates: vi.fn(),
  getTodayRecommendation: vi.fn(),
  insertAttempt: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.cookieSet }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../features/recommendation/get-today.server", () => ({
  getTodayRecommendation: mocks.getTodayRecommendation,
}));
vi.mock("../../features/training/training-repository.server", () => ({
  getTrainingRepository: () => ({
    getProblems: mocks.getProblems,
    getProblemPatterns: mocks.getProblemPatterns,
    getSkillStates: mocks.getSkillStates,
    insertAttempt: mocks.insertAttempt,
  }),
}));
vi.mock("../../lib/clock", () => ({
  systemClock: { now: mocks.clockNow },
}));

import { startPracticeAction } from "./actions.server";

const problemId = "0190f6f5-9b5a-7a22-8c44-123456789abd";
const dueProblemId = "0190f6f5-9b5a-7a22-8c44-123456789abe";
const otherProblemId = "0190f6f5-9b5a-7a22-8c44-123456789abf";
const currentPatternId = "0190f6f5-9b5a-7a22-8c44-123456789ac0";
const duePatternId = "0190f6f5-9b5a-7a22-8c44-123456789ac1";

function practiceForm(id: string): FormData {
  const formData = new FormData();
  formData.set("problemId", id);
  return formData;
}

function recommended(id: string) {
  return {
    status: "recommended",
    problem: {
      id,
      patternId: currentPatternId,
      title: "Contains Duplicate",
      difficulty: "easy",
      url: "https://leetcode.com/problems/contains-duplicate/",
      estimatedMinutes: 15,
      source: "neetcode-150",
    },
    pattern: {
      id: currentPatternId,
      name: "Arrays & Hashing",
      slug: "arrays-hashing",
    },
    factors: {
      kind: "next_pattern",
      patternName: "Arrays & Hashing",
      problemTitle: "Contains Duplicate",
      sessionMinutes: 30,
    },
    reason: "Start with Arrays & Hashing.",
  } as const;
}

describe("startPracticeAction", () => {
  beforeEach(() => {
    mocks.clockNow.mockClear();
    mocks.cookieSet.mockReset();
    mocks.getProblems.mockReset().mockResolvedValue([
      { id: problemId },
      { id: dueProblemId },
      { id: otherProblemId },
    ]);
    mocks.getProblemPatterns.mockReset().mockResolvedValue([
      { problemId, patternId: currentPatternId },
      { problemId: dueProblemId, patternId: duePatternId },
      { problemId: otherProblemId, patternId: currentPatternId },
    ]);
    mocks.getSkillStates.mockReset().mockResolvedValue([
      {
        patternId: currentPatternId,
        mastery: "unseen",
        nextReviewDate: null,
      },
      {
        patternId: duePatternId,
        mastery: "practicing",
        nextReviewDate: "2026-07-14",
      },
    ]);
    mocks.getTodayRecommendation
      .mockReset()
      .mockResolvedValue(recommended(problemId));
    mocks.insertAttempt.mockReset();
    mocks.redirect.mockReset().mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("starts the current deterministic recommendation in a secure transient cookie", async () => {
    await expect(startPracticeAction(practiceForm(problemId))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "lc_active_practice",
      JSON.stringify({
        problemId,
        startedAt: "2026-07-14T15:00:00.000Z",
        highestHintLevel: 0,
      }),
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    );
    expect(mocks.redirect).toHaveBeenCalledWith(`/practice/${problemId}`);
    expect(mocks.insertAttempt).not.toHaveBeenCalled();
  });

  it("also authorizes a Problem belonging to a currently due review", async () => {
    mocks.getTodayRecommendation.mockResolvedValue({
      status: "unavailable",
      reason: "no_session_fit",
    });

    await expect(
      startPracticeAction(practiceForm(dueProblemId)),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.cookieSet).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith(
      `/practice/${dueProblemId}`,
    );
  });

  it.each([
    ["an invalid ID", "not-a-problem-id"],
    ["a catalog Problem that is neither current nor due", otherProblemId],
  ])("rejects %s without writing active or training state", async (_label, id) => {
    await expect(startPracticeAction(practiceForm(id))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.insertAttempt).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/today");
  });
});
