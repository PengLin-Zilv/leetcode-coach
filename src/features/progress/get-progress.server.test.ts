import { describe, expect, it, vi } from "vitest";

import type { Clock } from "../../lib/clock";
import type {
  Attempt,
  Pattern,
  PatternPrerequisite,
  Problem,
  ProblemPattern,
  Profile,
  SkillState,
  TrainingRepository,
} from "../training/training-repository";
import { getProgress } from "./get-progress.server";

const arraysPatternId = "0190f6f5-9b5a-7a22-8c44-123456789aa1";
const twoPointersPatternId = "0190f6f5-9b5a-7a22-8c44-123456789aa2";
const stackPatternId = "0190f6f5-9b5a-7a22-8c44-123456789aa3";
const olderProblemId = "0190f6f5-9b5a-7a22-8c44-123456789ab1";
const tiedProblemId = "0190f6f5-9b5a-7a22-8c44-123456789ab2";
const laterTiedProblemId = "0190f6f5-9b5a-7a22-8c44-123456789ab3";
const twoPointersProblemId = "0190f6f5-9b5a-7a22-8c44-123456789ab4";
const now = new Date("2026-07-15T15:00:00.000Z");
const clock: Clock = { now: () => new Date(now) };

function problem(id: string, title: string): Problem {
  return {
    id,
    number: null,
    title,
    difficulty: "easy",
    url: `https://leetcode.com/problems/${id}/`,
    estimatedMinutes: 15,
    source: "neetcode-150",
  };
}

function attempt(
  id: string,
  problemId: string,
  occurredAt: string,
  overrides: Partial<Attempt> = {},
): Attempt {
  const occurred = new Date(occurredAt);

  return {
    id,
    problemId,
    result: "viewed_solution",
    durationMinutes: 15,
    confidence: null,
    note: null,
    highestHintLevel: 0,
    occurredAt: occurred,
    createdAt: new Date(occurred.getTime() + 1_000),
    ...overrides,
  };
}

class FakeProgressRepository implements TrainingRepository {
  profile: Profile | null = {
    id: "0190f6f5-9b5a-7a22-8c44-123456789ac1",
    deadline: "2026-07-20",
    sessionsPerWeek: 4,
    minutesPerSession: 30,
    startingLevel: "new",
  };
  patterns: Pattern[] = [
    { id: stackPatternId, name: "Stack", slug: "stack" },
    {
      id: twoPointersPatternId,
      name: "Two Pointers",
      slug: "two-pointers",
    },
    {
      id: arraysPatternId,
      name: "Arrays & Hashing",
      slug: "arrays-hashing",
    },
  ];
  prerequisites: PatternPrerequisite[] = [
    { patternId: stackPatternId, prerequisitePatternId: arraysPatternId },
    {
      patternId: twoPointersPatternId,
      prerequisitePatternId: arraysPatternId,
    },
  ];
  problems: Problem[] = [
    problem(olderProblemId, "Valid Anagram"),
    problem(tiedProblemId, "Contains Duplicate"),
    problem(laterTiedProblemId, "Contains Duplicate"),
    problem(twoPointersProblemId, "Valid Palindrome"),
  ];
  problemPatterns: ProblemPattern[] = [
    { problemId: olderProblemId, patternId: arraysPatternId },
    { problemId: tiedProblemId, patternId: arraysPatternId },
    { problemId: laterTiedProblemId, patternId: arraysPatternId },
    { problemId: twoPointersProblemId, patternId: twoPointersPatternId },
  ];
  attempts: Attempt[] = [
    attempt("attempt-independent", olderProblemId, "2026-07-10T15:00:00.000Z", {
      result: "solved",
      highestHintLevel: 0,
    }),
    attempt("attempt-tie-a", tiedProblemId, "2026-07-14T15:00:00.000Z"),
    attempt("attempt-tie-b", laterTiedProblemId, "2026-07-14T15:00:00.000Z"),
    attempt(
      "attempt-helped",
      twoPointersProblemId,
      "2026-07-14T16:00:00.000Z",
      { result: "solved", highestHintLevel: 1 },
    ),
  ];
  skillStates: SkillState[] = [];

  async getProfile() {
    return this.profile;
  }
  async saveProfile(profile: Profile) {
    this.profile = profile;
  }
  async getPatterns() {
    return this.patterns;
  }
  async getPrerequisites() {
    return this.prerequisites;
  }
  async getProblems() {
    return this.problems;
  }
  async getProblemPatterns() {
    return this.problemPatterns;
  }
  async getAttempts() {
    return this.attempts;
  }
  async getAttempt(id: string) {
    return this.attempts.find((item) => item.id === id) ?? null;
  }
  async insertAttempt(value: Attempt) {
    this.attempts.push(value);
  }
  async insertReflection() {}
  async getSkillStates() {
    return this.skillStates;
  }
  async replaceSkillStates(states: readonly SkillState[]) {
    this.skillStates = [...states];
  }
}

function refreshedSkillStates(): SkillState[] {
  return [
    {
      id: "0190f6f5-9b5a-7a22-8c44-123456789ad1",
      patternId: arraysPatternId,
      mastery: "practicing",
      recentSuccess: 1,
      nextReviewDate: "2026-07-14",
      lastComputedAt: now,
    },
    {
      id: "0190f6f5-9b5a-7a22-8c44-123456789ad2",
      patternId: twoPointersPatternId,
      mastery: "learning",
      recentSuccess: 0,
      nextReviewDate: "2026-07-17",
      lastComputedAt: now,
    },
    {
      id: "0190f6f5-9b5a-7a22-8c44-123456789ad3",
      patternId: stackPatternId,
      mastery: "unseen",
      recentSuccess: 0,
      nextReviewDate: null,
      lastComputedAt: now,
    },
  ];
}

describe("getProgress", () => {
  it("rebuilds MEMORY before deriving exact session, evidence, and UTC-date fields", async () => {
    const repository = new FakeProgressRepository();
    const callOrder: string[] = [];
    const originalGetSkillStates = repository.getSkillStates.bind(repository);
    repository.getSkillStates = async () => {
      callOrder.push("read-skill-states");
      return originalGetSkillStates();
    };
    const rebuildMemory = vi.fn(async () => {
      callOrder.push("rebuild-memory");
      repository.skillStates = refreshedSkillStates();
      return repository.skillStates;
    });

    const progress = await getProgress({ repository, clock, rebuildMemory });

    expect(callOrder).toEqual(["rebuild-memory", "read-skill-states"]);
    expect(progress?.profile).toEqual({
      daysRemaining: 5,
      sessionsCompleted: 4,
      dueReviewCount: 1,
    });
    expect(progress?.patterns).toEqual([
      {
        id: arraysPatternId,
        name: "Arrays & Hashing",
        displayState: "review_due",
        recentSuccess: 1,
        evidenceSummary: "1 independent solve across 1 problem",
        nextReviewDate: "2026-07-14",
      },
      {
        id: twoPointersPatternId,
        name: "Two Pointers",
        displayState: "learning",
        recentSuccess: 0,
        evidenceSummary: "1 attempt; no independent solves yet",
        nextReviewDate: "2026-07-17",
      },
      {
        id: stackPatternId,
        name: "Stack",
        displayState: "unseen",
        recentSuccess: 0,
        evidenceSummary: "No attempts yet",
        nextReviewDate: null,
      },
    ]);
    expect(rebuildMemory).toHaveBeenCalledOnce();
  });

  it("uses the shared title-then-UUID tie break for the displayed due Problem", async () => {
    const repository = new FakeProgressRepository();
    const rebuildMemory = async () => {
      repository.skillStates = refreshedSkillStates();
      return repository.skillStates;
    };

    const progress = await getProgress({ repository, clock, rebuildMemory });

    expect(progress?.dueReviews).toEqual([
      {
        patternId: arraysPatternId,
        patternName: "Arrays & Hashing",
        problemId: tiedProblemId,
        problemTitle: "Contains Duplicate",
        reviewDate: "2026-07-14",
      },
    ]);
  });

  it("returns null when no persisted Profile exists", async () => {
    const repository = new FakeProgressRepository();
    repository.profile = null;

    await expect(
      getProgress({
        repository,
        clock,
        rebuildMemory: async () => refreshedSkillStates(),
      }),
    ).resolves.toBeNull();
  });
});
