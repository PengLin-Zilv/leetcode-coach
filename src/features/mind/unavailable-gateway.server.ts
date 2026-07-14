import "server-only";

import type { MindGateway, MindGatewayResult } from "./gateway";

const notConfigured = (): MindGatewayResult => ({
  status: "unavailable",
  reason: "not_configured",
});

export class UnavailableMindGateway implements MindGateway {
  async requestHint(): Promise<MindGatewayResult> {
    return notConfigured();
  }

  async requestAttemptFeedback(): Promise<MindGatewayResult> {
    return notConfigured();
  }
}
