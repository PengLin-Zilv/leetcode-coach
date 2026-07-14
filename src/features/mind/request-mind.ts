import type { Clock } from "../../lib/clock";
import type { IdGenerator } from "../../lib/id";
import {
  attemptFeedbackRequestSchema,
  mindOutputSchema,
  practiceHintRequestSchema,
  practiceHintResponseSchema,
  type AttemptFeedbackRequest,
  type MindOutput,
  type PracticeHintRequest,
} from "./contracts";
import type { MindGateway } from "./gateway";

type UnavailableReason =
  "not_configured" | "timeout" | "rate_limited" | "invalid_response";

export type MindOutputResult =
  | { readonly status: "stored"; readonly outputId: string }
  | {
      readonly status: "unavailable";
      readonly reason: UnavailableReason;
    };

export type PracticeHintResult =
  | {
      readonly status: "hint";
      readonly body: string;
      readonly hintLevel: 1 | 2 | 3 | 4;
    }
  | {
      readonly status: "unavailable";
      readonly reason: UnavailableReason;
    };

type PersistedMindOutputBase = Readonly<{
  id: string;
  body: string;
  generatedAt: Date;
}>;

export type PersistedMindOutput =
  | (PersistedMindOutputBase &
      Readonly<{
        type: "single";
        attemptId: string;
        patternId: null;
        sourceAttemptIds: readonly [];
      }>)
  | (PersistedMindOutputBase &
      Readonly<{
        type: "pattern";
        attemptId: null;
        patternId: string;
        sourceAttemptIds: readonly string[];
      }>);

export interface MindOutputRepository {
  insert(output: PersistedMindOutput): Promise<void>;
}

export type RequestPracticeHintDependencies = Readonly<{
  gateway: MindGateway;
}>;

export type RequestAttemptFeedbackDependencies = Readonly<{
  gateway: MindGateway;
  repository: MindOutputRepository;
  ids: IdGenerator;
  clock: Clock;
}>;

function hintLevelAfter(request: PracticeHintRequest): 1 | 2 | 3 | 4 {
  if (request.kind !== "next_hint") {
    return request.currentHintLevel;
  }

  const nextLevels = [1, 2, 3, 4] as const;
  return nextLevels[request.currentHintLevel];
}

function matchesFeedbackRequest(
  output: MindOutput,
  request: AttemptFeedbackRequest,
): boolean {
  return output.type === "single"
    ? output.attemptId === request.attemptId
    : output.patternId === request.patternId;
}

function toPersistedMindOutput(
  output: MindOutput,
  id: string,
  generatedAt: Date,
): PersistedMindOutput {
  if (output.type === "single") {
    return {
      id,
      type: output.type,
      body: output.body,
      attemptId: output.attemptId,
      patternId: null,
      sourceAttemptIds: [],
      generatedAt,
    };
  }

  return {
    id,
    type: output.type,
    body: output.body,
    attemptId: null,
    patternId: output.patternId,
    sourceAttemptIds: output.sourceAttemptIds,
    generatedAt,
  };
}

export async function requestPracticeHint(
  dependencies: RequestPracticeHintDependencies,
  input: PracticeHintRequest,
): Promise<PracticeHintResult> {
  const request = practiceHintRequestSchema.parse(input);
  const gatewayResult = await dependencies.gateway.requestHint(request);

  if (gatewayResult.status === "unavailable") {
    return gatewayResult;
  }

  const response = practiceHintResponseSchema.safeParse(gatewayResult.raw);

  if (!response.success) {
    return { status: "unavailable", reason: "invalid_response" };
  }

  return {
    status: "hint",
    body: response.data.body,
    hintLevel: hintLevelAfter(request),
  };
}

export async function requestAttemptFeedback(
  dependencies: RequestAttemptFeedbackDependencies,
  input: AttemptFeedbackRequest,
): Promise<MindOutputResult> {
  const request = attemptFeedbackRequestSchema.parse(input);
  const gatewayResult =
    await dependencies.gateway.requestAttemptFeedback(request);

  if (gatewayResult.status === "unavailable") {
    return gatewayResult;
  }

  const parsed = mindOutputSchema.safeParse(gatewayResult.raw);

  if (!parsed.success || !matchesFeedbackRequest(parsed.data, request)) {
    return { status: "unavailable", reason: "invalid_response" };
  }

  const outputId = dependencies.ids();
  const output = toPersistedMindOutput(
    parsed.data,
    outputId,
    dependencies.clock.now(),
  );

  await dependencies.repository.insert(output);

  return { status: "stored", outputId };
}
