import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormStatus: () => ({ pending: true }),
}));

import { SubmitButton } from "./submit-button";

describe("SubmitButton", () => {
  it("renders the task-specific pending label", () => {
    const markup = renderToStaticMarkup(
      createElement(
        SubmitButton,
        { pendingLabel: "Saving your attempt…" },
        "Review this attempt",
      ),
    );

    expect(markup).toContain("Saving your attempt…");
    expect(markup).not.toContain("Building your session…");
  });
});
