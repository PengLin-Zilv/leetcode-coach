import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TodayRecommendation } from "./today-recommendation";

describe("TodayRecommendation", () => {
  it("renders catalog_empty as a stable retry state", () => {
    const markup = renderToStaticMarkup(
      createElement(TodayRecommendation, {
        daysRemaining: 30,
        dueReviewCount: 0,
        recommendation: { status: "unavailable", reason: "catalog_empty" },
        sessionMinutes: 30,
      }),
    );

    expect(markup).toContain("We could not choose a task yet.");
    expect(markup).toContain("The practice catalog is unavailable right now.");
    expect(markup).toContain("Retry recommendation");
    expect(markup).not.toContain("Start session");
  });
});
