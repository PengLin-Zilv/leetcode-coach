import { describe, expect, it } from "vitest";

import type { Clock } from "../../lib/clock";
import { FakeMindGateway } from "./testing/fake-gateway";
import {
  requestAttemptFeedback,
  requestPracticeHint,
  type MindOutputRepository,
  type PersistedMindOutput,
} from "./request-mind";
import { UnavailableMindGateway } from "./unavailable-gateway.server";

const attemptId = "0190f6f5-9b5a-7a22-8c44-123456789abc";
const attemptTwo = "0190f6f5-9b5a-7a22-8c44-123456789abd";
const patternId = "0190f6f5-9b5a-7a22-8c44-123456789abe";
const problemId = "0190f6f5-9b5a-7a22-8c44-123456789abf";
const outputId = "0190f6f5-9b5a-7a22-8c44-123456789ac0";
const generatedAt = new Date("2026-07-14T15:00:00.000Z");
const clock: Clock = { now: () => new Date(generatedAt.getTime()) };

const feedbackRequest = {
  attemptId,
  patternId,
  problemTitle: "Valid Palindrome",
  patternName: "Two Pointers",
  result: "not_solved",
  durationMinutes: 30,
  confidence: 2,
  highestHintLevel: 2,
  note: "I moved both boundaries after every comparison.",
} as const;

const hintRequest = {
  problemId,
  problemTitle: "Valid Palindrome",
  patternName: "Two Pointers",
  attemptSummary: "I compare the outer characters.",
  currentHintLevel: 2,
} as const;

class InMemoryMindOutputRepository implements MindOutputRepository {
  readonly outputs: PersistedMindOutput[] = [];
  readonly attempts = [{ id: attemptId }, { id: attemptTwo }];
  readonly skillStates = [{ patternId, mastery: "learning" }];

  async insert(output: PersistedMindOutput): Promise<void> {
    this.outputs.push(output);
  }

  trainingSnapshot(): string {
    return JSON.stringify({
      attempts: this.attempts,
      skillStates: this.skillStates,
    });
  }
}

function feedbackDependencies(
  gateway: FakeMindGateway,
  repository = new InMemoryMindOutputRepository(),
) {
  return {
    dependencies: {
      gateway,
      repository,
      ids: () => outputId,
      clock,
    },
    repository,
  };
}

describe("requestAttemptFeedback", () => {
  it("Zod-parses a valid per-Attempt response before persistence", async () => {
    const { dependencies, repository } = feedbackDependencies(
      new FakeMindGateway({
        attemptFeedback: {
          status: "received",
          raw: {
            type: "single",
            body: "  State the invariant before moving either boundary.  ",
            attemptId,
          },
        },
      }),
    );

    await expect(
      requestAttemptFeedback(dependencies, feedbackRequest),
    ).resolves.toEqual({ status: "stored", outputId });
    expect(repository.outputs).toEqual([
      {
        id: outputId,
        type: "single",
        body: "State the invariant before moving either boundary.",
        attemptId,
        patternId: null,
        sourceAttemptIds: [],
        generatedAt,
      },
    ]);
  });

  it("persists a valid Pattern response with all source Attempt links", async () => {
    const { dependencies, repository } = feedbackDependencies(
      new FakeMindGateway({
        attemptFeedback: {
          status: "received",
          raw: {
            type: "pattern",
            body: "Boundary updates are the repeated failure mode.",
            patternId,
            sourceAttemptIds: [attemptId, attemptTwo],
          },
        },
      }),
    );

    await expect(
      requestAttemptFeedback(dependencies, feedbackRequest),
    ).resolves.toEqual({ status: "stored", outputId });
    expect(repository.outputs[0]).toMatchObject({
      type: "pattern",
      attemptId: null,
      patternId,
      sourceAttemptIds: [attemptId, attemptTwo],
    });
  });

  it("returns invalid_response and writes nothing for invalid raw output", async () => {
    const { dependencies, repository } = feedbackDependencies(
      new FakeMindGateway({
        attemptFeedback: {
          status: "received",
          raw: {
            type: "single",
            body: "Advice",
            attemptId,
            unrecognized: true,
          },
        },
      }),
    );

    await expect(
      requestAttemptFeedback(dependencies, feedbackRequest),
    ).resolves.toEqual({
      status: "unavailable",
      reason: "invalid_response",
    });
    expect(repository.outputs).toEqual([]);
  });

  it("returns the provider's honest unavailable reason and writes nothing", async () => {
    const { dependencies, repository } = feedbackDependencies(
      new FakeMindGateway({
        attemptFeedback: { status: "unavailable", reason: "rate_limited" },
      }),
    );

    await expect(
      requestAttemptFeedback(dependencies, feedbackRequest),
    ).resolves.toEqual({
      status: "unavailable",
      reason: "rate_limited",
    });
    expect(repository.outputs).toEqual([]);
  });

  it("leaves Attempt count and Skill State byte-equivalent on either failure", async () => {
    const repository = new InMemoryMindOutputRepository();
    const before = repository.trainingSnapshot();
    const invalid = feedbackDependencies(
      new FakeMindGateway({
        attemptFeedback: { status: "received", raw: { type: "unknown" } },
      }),
      repository,
    );
    const unavailable = feedbackDependencies(
      new FakeMindGateway({
        attemptFeedback: { status: "unavailable", reason: "timeout" },
      }),
      repository,
    );

    await requestAttemptFeedback(invalid.dependencies, feedbackRequest);
    expect(repository.attempts).toHaveLength(2);
    expect(repository.trainingSnapshot()).toBe(before);

    await requestAttemptFeedback(unavailable.dependencies, feedbackRequest);
    expect(repository.attempts).toHaveLength(2);
    expect(repository.trainingSnapshot()).toBe(before);
    expect(repository.outputs).toEqual([]);
  });
});

describe("requestPracticeHint", () => {
  it("keeps presentation depth unchanged and increments next-hint depth once", async () => {
    const presentationGateway = new FakeMindGateway({
      hint: { status: "received", raw: { body: "Try a shorter invariant." } },
    });
    const nextGateway = new FakeMindGateway({
      hint: {
        status: "received",
        raw: { body: "Ask what each pointer means." },
      },
    });

    await expect(
      requestPracticeHint(
        { gateway: presentationGateway },
        { ...hintRequest, kind: "simpler" },
      ),
    ).resolves.toEqual({
      status: "hint",
      body: "Try a shorter invariant.",
      hintLevel: 2,
    });
    await expect(
      requestPracticeHint(
        { gateway: nextGateway },
        { ...hintRequest, kind: "next_hint" },
      ),
    ).resolves.toEqual({
      status: "hint",
      body: "Ask what each pointer means.",
      hintLevel: 3,
    });
  });

  it("returns invalid_response for an invalid raw hint", async () => {
    const gateway = new FakeMindGateway({
      hint: { status: "received", raw: { body: "   " } },
    });

    await expect(
      requestPracticeHint({ gateway }, { ...hintRequest, kind: "next_hint" }),
    ).resolves.toEqual({
      status: "unavailable",
      reason: "invalid_response",
    });
  });

  it("uses an honestly unavailable runtime gateway", async () => {
    const gateway = new UnavailableMindGateway();

    await expect(
      requestPracticeHint({ gateway }, { ...hintRequest, kind: "next_hint" }),
    ).resolves.toEqual({
      status: "unavailable",
      reason: "not_configured",
    });
  });
});
