import { describe, expect, it, vi } from "vitest";

import type { Clock } from "../../lib/clock";
import type { IdGenerator } from "../../lib/id";
import { completeAttempt } from "./complete-attempt";
import type {
  Attempt,
  Pattern,
  PatternPrerequisite,
  Problem,
  ProblemPattern,
  Profile,
  Reflection,
  SkillState,
  TrainingRepository,
} from "./training-repository";

const attemptId = "0190f6f5-9b5a-7a22-8c44-123456789abc";
const problemId = "0190f6f5-9b5a-7a22-8c44-123456789abd";
const now = "2026-07-14T15:00:00.000Z";

const validAttemptInput = {
  problemId,
  result: "solved",
  durationMinutes: 15,
  confidence: 4,
  note: "Used a set without help.",
  highestHintLevel: 0,
  occurredAt: "2026-07-14T14:30:00.000Z",
} as const;

function fixedClock(isoTimestamp: string): Clock {
  return { now: () => new Date(isoTimestamp) };
}

function deterministicIds(): IdGenerator {
  return () => attemptId;
}

function deferredCommit() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

class FakeTrainingRepository implements TrainingRepository {
  readonly attempts: Attempt[] = [];
  readonly reflections: Reflection[] = [];
  readonly callOrder: string[] = [];

  constructor(
    private readonly commitAttempt: (
      attempt: Attempt,
    ) => Promise<void> = async () => undefined,
  ) {}

  async getProfile(): Promise<Profile | null> {
    return null;
  }

  async saveProfile(): Promise<void> {}

  async getPatterns(): Promise<readonly Pattern[]> {
    return [];
  }

  async getPrerequisites(): Promise<readonly PatternPrerequisite[]> {
    return [];
  }

  async getProblems(): Promise<readonly Problem[]> {
    return [];
  }

  async getProblemPatterns(): Promise<readonly ProblemPattern[]> {
    return [];
  }

  async getAttempts(): Promise<readonly Attempt[]> {
    return this.attempts;
  }

  async getAttempt(id: string): Promise<Attempt | null> {
    return this.attempts.find((attempt) => attempt.id === id) ?? null;
  }

  async insertAttempt(attempt: Attempt): Promise<void> {
    this.callOrder.push("insertAttempt");
    await this.commitAttempt(attempt);
    this.attempts.push(attempt);
  }

  async insertReflection(reflection: Reflection): Promise<void> {
    this.reflections.push(reflection);
  }

  async getSkillStates(): Promise<readonly SkillState[]> {
    return [];
  }

  async replaceSkillStates(): Promise<void> {}
}

describe("completeAttempt", () => {
  it("waits for the Attempt commit before rebuilding MEMORY or completing", async () => {
    const commit = deferredCommit();
    const repository = new FakeTrainingRepository(async () => commit.promise);
    const rebuildMemory = vi.fn(async () => []);
    let settled = false;

    const completion = completeAttempt(
      {
        repository,
        ids: deterministicIds(),
        clock: fixedClock(now),
        rebuildMemory,
      },
      validAttemptInput,
    ).finally(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(repository.callOrder).toEqual(["insertAttempt"]);
    expect(repository.attempts).toHaveLength(0);
    expect(rebuildMemory).not.toHaveBeenCalled();
    expect(settled).toBe(false);

    commit.resolve();

    await expect(completion).resolves.toEqual({
      status: "completed",
      attemptId,
      memory: { status: "updated" },
    });
    expect(repository.attempts).toHaveLength(1);
    expect(rebuildMemory).toHaveBeenCalledOnce();
    expect(settled).toBe(true);
  });

  it("propagates Attempt insertion failure without rebuilding or completing", async () => {
    const insertionError = new Error("attempt commit failed");
    const repository = new FakeTrainingRepository(async () => {
      throw insertionError;
    });
    const rebuildMemory = vi.fn(async () => []);

    await expect(
      completeAttempt(
        {
          repository,
          ids: deterministicIds(),
          clock: fixedClock(now),
          rebuildMemory,
        },
        validAttemptInput,
      ),
    ).rejects.toBe(insertionError);

    expect(repository.callOrder).toEqual(["insertAttempt"]);
    expect(repository.attempts).toHaveLength(0);
    expect(rebuildMemory).not.toHaveBeenCalled();
  });

  it("keeps the committed Attempt when MEMORY rebuilding fails", async () => {
    const repository = new FakeTrainingRepository();

    const result = await completeAttempt(
      {
        repository,
        ids: deterministicIds(),
        clock: fixedClock(now),
        rebuildMemory: async () => {
          repository.callOrder.push("rebuildMemory");
          throw new Error("projection failed");
        },
      },
      validAttemptInput,
    );

    expect(result).toEqual({
      status: "completed",
      attemptId,
      memory: { status: "stale", reason: "projection_failed" },
    });
    expect(repository.callOrder).toEqual(["insertAttempt", "rebuildMemory"]);
    expect(repository.attempts).toHaveLength(1);
    expect(repository.attempts[0]).toEqual({
      id: attemptId,
      ...validAttemptInput,
      occurredAt: new Date(validAttemptInput.occurredAt),
      createdAt: new Date(now),
    });
  });

  it("validates before writing an Attempt or rebuilding MEMORY", async () => {
    const repository = new FakeTrainingRepository();
    const rebuildMemory = vi.fn(async () => []);

    await expect(
      completeAttempt(
        {
          repository,
          ids: deterministicIds(),
          clock: fixedClock(now),
          rebuildMemory,
        },
        { ...validAttemptInput, result: "guessed" },
      ),
    ).rejects.toThrow();

    expect(repository.attempts).toHaveLength(0);
    expect(rebuildMemory).not.toHaveBeenCalled();
  });

  it("reports updated MEMORY after a successful rebuild", async () => {
    const repository = new FakeTrainingRepository();

    await expect(
      completeAttempt(
        {
          repository,
          ids: deterministicIds(),
          clock: fixedClock(now),
          rebuildMemory: async () => [],
        },
        {
          ...validAttemptInput,
          confidence: "",
          note: "",
        },
      ),
    ).resolves.toEqual({
      status: "completed",
      attemptId,
      memory: { status: "updated" },
    });

    expect(repository.attempts[0]).toMatchObject({
      confidence: null,
      note: null,
    });
  });
});
