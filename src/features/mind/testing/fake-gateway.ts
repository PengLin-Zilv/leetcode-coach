import type { AttemptFeedbackRequest, PracticeHintRequest } from "../contracts";
import type { MindGateway, MindGatewayResult } from "../gateway";

export type FakeMindGatewayFixtures = Readonly<{
  hint?: MindGatewayResult;
  attemptFeedback?: MindGatewayResult;
}>;

const unavailable: MindGatewayResult = {
  status: "unavailable",
  reason: "not_configured",
};

export class FakeMindGateway implements MindGateway {
  readonly hintRequests: PracticeHintRequest[] = [];
  readonly attemptFeedbackRequests: AttemptFeedbackRequest[] = [];

  constructor(private readonly fixtures: FakeMindGatewayFixtures) {}

  async requestHint(input: PracticeHintRequest): Promise<MindGatewayResult> {
    this.hintRequests.push(input);
    return this.fixtures.hint ?? unavailable;
  }

  async requestAttemptFeedback(
    input: AttemptFeedbackRequest,
  ): Promise<MindGatewayResult> {
    this.attemptFeedbackRequests.push(input);
    return this.fixtures.attemptFeedback ?? unavailable;
  }
}
