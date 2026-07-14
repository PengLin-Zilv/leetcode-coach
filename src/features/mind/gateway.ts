import type { AttemptFeedbackRequest, PracticeHintRequest } from "./contracts";

export type MindGatewayResult =
  | { readonly status: "received"; readonly raw: unknown }
  | {
      readonly status: "unavailable";
      readonly reason: "not_configured" | "timeout" | "rate_limited";
    };

export interface MindGateway {
  requestHint(input: PracticeHintRequest): Promise<MindGatewayResult>;
  requestAttemptFeedback(
    input: AttemptFeedbackRequest,
  ): Promise<MindGatewayResult>;
}
