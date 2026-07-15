import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { saveProfileScenario } from "./support/scenarios";

test("pages expose one h1 and labelled primary navigation with current state", async ({
  page,
}) => {
  await saveProfileScenario();

  await page.goto("/today");
  await expect(page.locator("h1")).toHaveCount(1);
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Today" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(nav.getByRole("link", { name: "Progress" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.goto("/progress");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Progress" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("Setup labels and Reflection fieldsets expose native form semantics", async ({
  page,
}) => {
  await page.goto("/setup");
  for (const label of [
    "Interview date",
    "Sessions each week",
    "Minutes per session",
    "Starting point",
  ]) {
    await expect(page.getByLabel(label)).toBeVisible();
  }

  await completeSetup(page);
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("link", { name: "End attempt" }).click();
  const resultGroup = page.getByRole("group", { name: "Result" });
  await expect(resultGroup).toBeVisible();
  await expect(resultGroup.locator("legend")).toHaveText("Result");
  await expect(page.getByLabel("Confidence")).toBeVisible();
  await expect(page.getByLabel("Optional note")).toBeVisible();
});

test("keyboard-only operation completes Setup through next Today", async ({
  page,
}) => {
  await page.goto("/setup");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Interview date")).toBeFocused();
  await page.keyboard.type("08312099");
  await tabTo(page, page.getByLabel("Sessions each week"));
  await page.keyboard.type("4");
  await tabTo(page, page.getByLabel("Minutes per session"));
  await page.keyboard.type("30");
  await tabTo(page, page.getByLabel("Starting point"));
  await page.keyboard.type("New");
  await tabTo(
    page,
    page.getByRole("button", { name: "Build my first session" }),
  );
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/today$/);
  await tabTo(page, page.getByRole("button", { name: "Start session" }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/practice\/[0-9a-f-]+$/);
  await tabTo(page, page.getByRole("link", { name: "End attempt" }));
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/reflection$/);
  await tabTo(page, page.getByLabel("Solved", { exact: true }));
  await page.keyboard.press("Space");
  await tabTo(page, page.getByRole("button", { name: "Review this attempt" }));
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/feedback\/[0-9a-f-]+\?cleanup=/);
  await tabTo(page, page.getByRole("link", { name: "View progress" }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/progress$/);
  await tabTo(page, page.getByRole("link", { name: "Today" }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/today$/);
});

test("keyboard focus is visibly rendered on every workflow control", async ({
  page,
}) => {
  await page.goto("/setup");
  await page.getByLabel("Interview date").fill("2099-08-31");
  await page.getByLabel("Sessions each week").selectOption("4");
  await page.getByLabel("Minutes per session").selectOption("30");
  await page.getByLabel("Starting point").selectOption("new");
  await expectKeyboardFocus(page, [
    page.getByLabel("Interview date"),
    page.getByLabel("Sessions each week"),
    page.getByLabel("Minutes per session"),
    page.getByLabel("Starting point"),
    page.getByRole("button", { name: "Build my first session" }),
  ]);

  await page.getByRole("button", { name: "Build my first session" }).click();
  await expectKeyboardFocus(page, [
    page.getByRole("link", { name: "Today" }),
    page.getByRole("link", { name: "Progress" }),
    page.getByRole("button", { name: "Start session" }),
  ]);
  await page.getByRole("button", { name: "Start session" }).click();
  await expectKeyboardFocus(page, [
    page.getByRole("link", { name: "← Today" }),
    page.getByRole("link", { name: "End attempt" }),
    page.getByRole("link", { name: /Open problem on LeetCode/ }),
    page.getByLabel("Notes"),
    page.getByRole("button", { name: "Give me a hint" }),
    page.getByRole("button", { name: "Simpler" }),
    page.getByRole("button", { name: "Example" }),
    page.getByRole("button", { name: "Trace it" }),
  ]);
  await page.getByRole("link", { name: "End attempt" }).click();
  await expectKeyboardFocus(page, [
    page.getByLabel("Solved", { exact: true }),
    page.getByLabel("Confidence"),
    page.getByLabel("Optional note"),
    page.getByRole("button", { name: "Review this attempt" }),
  ]);
});

test("Reflection validation announces the error and focuses the first invalid result", async ({
  page,
}) => {
  await saveProfileScenario();
  await page.goto("/today");
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("link", { name: "End attempt" }).click();

  await page.getByRole("button", { name: "Review this attempt" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: /select a result/i }),
  ).toBeVisible();
  await expect(page.getByLabel("Solved", { exact: true })).toBeFocused();
});

test("timer, unavailable status, and external-link copy announce honest semantics", async ({
  page,
}) => {
  await saveProfileScenario();
  await page.goto("/today");
  await page.getByRole("button", { name: "Start session" }).click();

  await expect(page.getByRole("timer")).toHaveAttribute("aria-live", "off");
  const external = page.getByRole("link", {
    name: /Open problem on LeetCode.*opens in a new tab/i,
  });
  await expect(external).toHaveAttribute("target", "_blank");
  await page.getByRole("button", { name: "Give me a hint" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "temporarily unavailable" }),
  ).toBeVisible();
});

test("mobile coaching Escape closes the sheet and restores its trigger", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await saveProfileScenario();
  await page.goto("/today");
  await page.getByRole("button", { name: "Start session" }).click();
  const trigger = page.getByRole("button", { name: "Open coaching" });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "MIND" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "MIND" })).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("reduced-motion preference removes nonessential motion globally", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/setup");

  const motion = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const styles = Array.from(document.querySelectorAll("*"), (element) =>
      getComputedStyle(element),
    );
    return {
      tokenMilliseconds: Number.parseFloat(
        root.getPropertyValue("--motion-duration"),
      ),
      hasTransition: styles.some((style) =>
        style.transitionDuration
          .split(",")
          .some((duration) => Number.parseFloat(duration) > 0.00001),
      ),
      hasLoopingAnimation: styles.some(
        (style) =>
          style.animationName !== "none" &&
          style.animationIterationCount !== "1",
      ),
    };
  });
  expect(motion).toEqual({
    tokenMilliseconds: 0.01,
    hasTransition: false,
    hasLoopingAnimation: false,
  });
});

async function completeSetup(page: Page) {
  await page.getByLabel("Interview date").fill("2099-08-31");
  await page.getByLabel("Sessions each week").selectOption("4");
  await page.getByLabel("Minutes per session").selectOption("30");
  await page.getByLabel("Starting point").selectOption("new");
  await page.getByRole("button", { name: "Build my first session" }).click();
}

async function tabTo(page: Page, target: Locator) {
  for (let index = 0; index < 20; index += 1) {
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

async function expectKeyboardFocus(page: Page, targets: readonly Locator[]) {
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  for (const target of targets) {
    await tabTo(page, target);
    const state = await target.evaluate((active) => {
      const focusTarget =
        active instanceof HTMLInputElement && active.type === "radio"
          ? active.closest("label")
          : active;
      const style = focusTarget ? getComputedStyle(focusTarget) : null;
      return {
        identity: `${active.tagName}:${active.getAttribute("name") ?? active.textContent?.trim() ?? ""}`,
        visible:
          style !== null &&
          (Number.parseFloat(style.outlineWidth) >= 2 ||
            style.boxShadow !== "none"),
      };
    });
    expect(state.visible, state.identity).toBe(true);
  }
}
