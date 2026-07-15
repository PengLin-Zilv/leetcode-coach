import { describe, expect, it } from "vitest";

import type { PersistedMindOutput } from "../mind/request-mind";
import type {
  Attempt,
  Pattern,
  Problem,
  ProblemPattern,
  SkillState,
} from "../training/training-repository";
import { getFeedback, type FeedbackRepository } from "./get-feedback.server";

const attemptId = "0190f6f5-9b5a-7a22-8c44-123456789abc";
const problemId = "0190f6f5-9b5a-7a22-8c44-123456789abd";
const patternId = "0190f6f5-9b5a-7a22-8c44-123456789abe";
const secondPatternId = "0190f6f5-9b5a-7a22-8c44-123456789ac0";

const attempt: Attempt = {
  id: attemptId,
  problemId,
  result: "solved",
  durationMinutes: 15,
  confidence: 4,
  note: "Used a set invariant.",
  highestHintLevel: 0,
  occurredAt: new Date("2026-07-14T15:00:00.000Z"),
  createdAt: new Date("2026-07-14T15:00:01.000Z"),
};

class FakeFeedbackRepository implements FeedbackRepository {
  attempts: Attempt[] = [attempt];
  patterns: Pattern[] = [
    { id: patternId, name: "Arrays & Hashing", slug: "arrays-hashing" },
  ];
  problems: Problem[] = [
    {
      id: problemId,
      number: null,
      title: "Contains Duplicate",
      difficulty: "easy",
      url: "https://leetcode.com/problems/contains-duplicate/",
      estimatedMinutes: 15,
      source: "neetcode-150",
    },
  ];
  problemPatterns: ProblemPattern[] = [{ problemId, patternId }];
  skillStates: SkillState[] = [
    {
      id: "0190f6f5-9b5a-7a22-8c44-123456789abf",
      patternId,
      mastery: "practicing",
      recentSuccess: 1,
      nextReviewDate: "2026-07-17",
      lastComputedAt: new Date("2026-07-14T15:00:01.000Z"),
    },
  ];
  mindOutput: PersistedMindOutput | null = null;

  async getAttempt(id: string) {
    return this.attempts.find((item) => item.id === id) ?? null;
  }
  async getAttempts() {
    return this.attempts;
  }
  async getPatterns() {
    return this.patterns;
  }
  async getProblems() {
    return this.problems;
  }
  async getProblemPatterns() {
    return this.problemPatterns;
  }
  async getSkillStates() {
    return this.skillStates;
  }
  async getSingleForAttempt() {
    return this.mindOutput;
  }
}

function addSecondMappedPattern(repository: FakeFeedbackRepository): void {
  repository.patterns.push({
    id: secondPatternId,
    name: "Set Reasoning",
    slug: "set-reasoning",
  });
  repository.problemPatterns.push({ problemId, patternId: secondPatternId });
  repository.skillStates.push({
    id: "0190f6f5-9b5a-7a22-8c44-123456789ac1",
    patternId: secondPatternId,
    mastery: "practicing",
    recentSuccess: 1,
    nextReviewDate: "2026-07-17",
    lastComputedAt: new Date("2026-07-14T15:00:01.000Z"),
  });
}

function addMappedAttempt(
  repository: FakeFeedbackRepository,
  addedAttempt: Attempt,
): void {
  repository.attempts.push(addedAttempt);
  repository.problems.push({
    ...repository.problems[0]!,
    id: addedAttempt.problemId,
    title: `Problem ${addedAttempt.problemId}`,
    url: `https://leetcode.com/problems/${addedAttempt.problemId}/`,
  });
  repository.problemPatterns.push({
    problemId: addedAttempt.problemId,
    patternId,
  });
}

describe("getFeedback", () => {
  it("derives an exact reload-safe MEMORY transition and review cue from Attempts", async () => {
    const repository = new FakeFeedbackRepository();

    await expect(getFeedback({ repository }, attemptId)).resolves.toEqual({
      attempt,
      problemTitle: "Contains Duplicate",
      observation: "Solved independently in 15 minutes.",
      mindFeedback: null,
      memory: {
        status: "updated",
        changes: [
          {
            patternId,
            patternName: "Arrays & Hashing",
            before: "unseen",
            after: "practicing",
            nextReviewDate: "2026-07-17",
            reviewCue: "Review Arrays & Hashing in 3 days.",
          },
        ],
      },
    });
  });

  it("keeps a historical MEMORY delta unchanged after a later Attempt is appended", async () => {
    const repository = new FakeFeedbackRepository();
    addMappedAttempt(repository, {
      ...attempt,
      id: "0190f6f5-9b5a-7a22-8c44-123456789ac2",
      problemId: "0190f6f5-9b5a-7a22-8c44-123456789ac3",
      occurredAt: new Date("2026-07-15T15:00:00.000Z"),
      createdAt: new Date("2026-07-15T15:00:01.000Z"),
    });

    await expect(getFeedback({ repository }, attemptId)).resolves.toMatchObject(
      {
        memory: {
          changes: [
            {
              before: "unseen",
              after: "practicing",
              nextReviewDate: "2026-07-17",
              reviewCue: "Review Arrays & Hashing in 3 days.",
            },
          ],
        },
      },
    );
  });

  it("uses the UUIDv7 text ID to break equal-createdAt append ties", async () => {
    const repository = new FakeFeedbackRepository();
    const sharedCreatedAt = attempt.createdAt;
    addMappedAttempt(repository, {
      ...attempt,
      id: "0190f6f5-9b5a-7a22-8c44-123456789aba",
      problemId: "0190f6f5-9b5a-7a22-8c44-123456789ac4",
      occurredAt: new Date("2026-07-10T15:00:00.000Z"),
      createdAt: sharedCreatedAt,
    });
    addMappedAttempt(repository, {
      ...attempt,
      id: "0190f6f5-9b5a-7a22-8c44-123456789acb",
      problemId: "0190f6f5-9b5a-7a22-8c44-123456789ac5",
      occurredAt: new Date("2026-07-15T15:00:00.000Z"),
      createdAt: sharedCreatedAt,
    });

    await expect(getFeedback({ repository }, attemptId)).resolves.toMatchObject(
      {
        memory: {
          changes: [
            {
              before: "practicing",
              after: "reliable",
              nextReviewDate: "2026-07-21",
              reviewCue: "Review Arrays & Hashing in 7 days.",
            },
          ],
        },
      },
    );
  });

  it("marks MEMORY pending when a mapped row is missing or older than the Attempt commit", async () => {
    const missing = new FakeFeedbackRepository();
    missing.skillStates = [];
    const older = new FakeFeedbackRepository();
    older.skillStates = [
      {
        ...older.skillStates[0]!,
        lastComputedAt: new Date("2026-07-14T15:00:00.999Z"),
      },
    ];

    await expect(
      getFeedback({ repository: missing }, attemptId),
    ).resolves.toMatchObject({
      memory: { status: "stale" },
    });
    await expect(
      getFeedback({ repository: older }, attemptId),
    ).resolves.toMatchObject({
      memory: { status: "stale" },
    });
  });

  it("derives one independent transition for every mapped Pattern", async () => {
    const repository = new FakeFeedbackRepository();
    addSecondMappedPattern(repository);

    await expect(getFeedback({ repository }, attemptId)).resolves.toMatchObject(
      {
        memory: {
          status: "updated",
          changes: [
            {
              patternId,
              patternName: "Arrays & Hashing",
              before: "unseen",
              after: "practicing",
            },
            {
              patternId: secondPatternId,
              patternName: "Set Reasoning",
              before: "unseen",
              after: "practicing",
            },
          ],
        },
      },
    );
  });

  it.each(["missing", "older"] as const)(
    "marks the whole multi-pattern MEMORY update stale when one mapped row is %s",
    async (staleKind) => {
      const repository = new FakeFeedbackRepository();
      addSecondMappedPattern(repository);
      const secondStateIndex = repository.skillStates.findIndex(
        ({ patternId: mappedPatternId }) => mappedPatternId === secondPatternId,
      );

      if (staleKind === "missing") {
        repository.skillStates.splice(secondStateIndex, 1);
      } else {
        repository.skillStates[secondStateIndex] = {
          ...repository.skillStates[secondStateIndex]!,
          lastComputedAt: new Date("2026-07-14T15:00:00.999Z"),
        };
      }

      await expect(
        getFeedback({ repository }, attemptId),
      ).resolves.toMatchObject({
        memory: { status: "stale", changes: [{}, {}] },
      });
    },
  );

  it("shows only a validated single MIND output for this Attempt", async () => {
    const repository = new FakeFeedbackRepository();
    repository.mindOutput = {
      id: "0190f6f5-9b5a-7a22-8c44-123456789ac0",
      type: "single",
      body: "Keep naming what the set remembers before writing the loop.",
      attemptId,
      patternId: null,
      sourceAttemptIds: [],
      generatedAt: new Date("2026-07-14T15:00:02.000Z"),
    };

    await expect(getFeedback({ repository }, attemptId)).resolves.toMatchObject(
      {
        mindFeedback:
          "Keep naming what the set remembers before writing the loop.",
      },
    );

    repository.mindOutput = {
      ...repository.mindOutput,
      attemptId: "0190f6f5-9b5a-7a22-8c44-123456789ac1",
    };
    await expect(getFeedback({ repository }, attemptId)).resolves.toMatchObject(
      {
        mindFeedback: null,
      },
    );
  });

  it("returns null for a missing Attempt instead of inventing Feedback", async () => {
    await expect(
      getFeedback(
        { repository: new FakeFeedbackRepository() },
        "0190f6f5-9b5a-7a22-8c44-123456789ac2",
      ),
    ).resolves.toBeNull();
  });
});
