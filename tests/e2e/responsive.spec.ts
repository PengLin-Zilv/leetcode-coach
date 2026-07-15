import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { resetBrowserDatabase } from "./support/database";
import {
  createLongContentScenario,
  saveProfileScenario,
} from "./support/scenarios";

const viewports = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "tablet", width: 768, height: 1024 },
  { label: "mobile", width: 390, height: 844 },
  { label: "narrow", width: 320, height: 700 },
] as const;

for (const viewport of viewports) {
  test(`${viewport.width}px Practice has stable targets and no overlap or overflow`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await createLongContentScenario();
    await page.goto("/today");
    await expectPrimaryAction(
      page.getByRole("button", { name: "Start session" }),
    );
    if (viewport.width > 600) {
      const difficulty = await page
        .getByText("Easy", { exact: true })
        .boundingBox();
      expect(difficulty).not.toBeNull();
      expect(difficulty!.width).toBeGreaterThanOrEqual(50);
      expect(difficulty!.height).toBeLessThanOrEqual(44);
    }
    await page.getByRole("button", { name: "Start session" }).click();

    await expectNoHorizontalOverflow(page);
    await expectPrimaryAction(page.getByRole("link", { name: "End attempt" }));
    await expectPrimaryAction(
      page.getByRole("link", { name: /Open problem on LeetCode/ }),
    );
    await expectInteractiveTargets(page);
    await expectNoOverlap(
      page.getByRole("link", { name: "← Today" }),
      page.getByRole("link", { name: "End attempt" }),
    );

    if (viewport.width > 700) {
      const [practice, mind] = await Promise.all([
        page.locator('section[aria-labelledby="practice-title"]').boundingBox(),
        page.locator('aside[aria-labelledby="mind-title"]').boundingBox(),
      ]);
      expect(practice).not.toBeNull();
      expect(mind).not.toBeNull();
      const practiceShare = practice!.width / (practice!.width + mind!.width);
      expect(practiceShare).toBeGreaterThan(0.56);
      expect(practiceShare).toBeLessThan(0.64);
    } else {
      const opener = page.getByRole("button", { name: "Open coaching" });
      await expectPrimaryAction(opener);
      await opener.click();
      const sheet = page.getByRole("dialog", { name: "MIND" });
      const bounds = await sheet.boundingBox();
      expect(bounds).toMatchObject({ x: 0, y: 0, width: viewport.width });
      expect(bounds?.height).toBe(viewport.height);
      await expectPrimaryAction(
        sheet.getByRole("link", { name: "End attempt" }),
      );
      await expectNoOverlap(
        sheet.getByRole("button", { name: "Close coaching" }),
        sheet.getByRole("link", { name: "End attempt" }),
      );
      await page.keyboard.press("Escape");
      await expect(opener).toBeFocused();
    }
  });
}

test("the complete primary loop remains operable at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await saveProfileScenario();
  await page.goto("/today");
  await expectScreen(page, page.getByRole("button", { name: "Start session" }));

  await page.getByRole("button", { name: "Start session" }).click();
  await expectScreen(page, page.getByRole("link", { name: "End attempt" }));
  await page.getByRole("button", { name: "Open coaching" }).click();
  await expectScreen(
    page,
    page.getByRole("dialog", { name: "MIND" }).getByRole("link", {
      name: "End attempt",
    }),
  );
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "End attempt" }).click();

  const solved = page.getByLabel("Solved", { exact: true });
  await expectScreen(
    page,
    page.getByRole("button", { name: "Review this attempt" }),
  );
  await solved.check();
  await page
    .getByLabel("Optional note")
    .fill("A narrow-screen invariant note.");
  await page.getByRole("button", { name: "Review this attempt" }).click();

  await expectScreen(page, page.getByRole("link", { name: "Finish" }));
  await page.getByRole("link", { name: "View progress" }).click();
  await expectScreen(page, page.getByRole("link", { name: "Today" }));
  await page.getByRole("link", { name: "Today" }).click();
  await expectScreen(page, page.getByRole("button", { name: "Start session" }));
});

test("captures the five workflow views at desktop, mobile, and 320px", async ({
  page,
}) => {
  const outputDirectory = resolve("test-results/task-12-screenshots");
  await mkdir(outputDirectory, { recursive: true });

  for (const viewport of [viewports[0], viewports[2], viewports[3]]) {
    await resetBrowserDatabase();
    await page.context().clearCookies();
    await page.evaluate(() => window.localStorage.clear()).catch(() => {});
    await page.setViewportSize(viewport);
    await createLongContentScenario();
    const screenshot = async (screen: string) => {
      await page.evaluate(() => window.scrollTo(0, 0));
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        fullPage: true,
        path: resolve(outputDirectory, `${viewport.width}-${screen}.png`),
      });
    };

    await page.goto("/today");
    await expect(page.locator("h1#today-task")).toBeVisible();
    await screenshot("today");
    await page.getByRole("button", { name: "Start session" }).click();
    await expect(page).toHaveURL(/\/practice\/[0-9a-f-]+$/);
    await page.getByLabel("Notes").fill("Long evidence note. ".repeat(30));
    await screenshot("practice");
    await page.getByRole("link", { name: "End attempt" }).click();
    await expect(page).toHaveURL(/\/reflection$/);
    await expect(
      page.getByRole("heading", { name: "Finish attempt" }),
    ).toBeVisible();
    await screenshot("reflection");
    await page.getByLabel("Solved", { exact: true }).check();
    await page.getByRole("button", { name: "Review this attempt" }).click();
    await expect(page).toHaveURL(/\/feedback\/[0-9a-f-]+\?cleanup=/);
    await expect(page.getByText("Memory updated")).toBeVisible();
    await screenshot("feedback");
    await page.getByRole("link", { name: "View progress" }).click();
    await expect(page).toHaveURL(/\/progress$/);
    await expect(
      page.getByRole("heading", { name: "Evidence from your practice" }),
    ).toBeVisible();
    await screenshot("progress");
  }
});

async function expectScreen(page: Page, primaryAction: Locator) {
  await expectNoHorizontalOverflow(page);
  await expectPrimaryAction(primaryAction);
  await expectInteractiveTargets(page);
}

async function expectPrimaryAction(action: Locator) {
  await action.scrollIntoViewIfNeeded();
  await expect(action).toBeVisible();
  const box = await action.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectInteractiveTargets(page: Page) {
  const undersized = await page
    .locator("a[href], button, input:not([type=hidden]), select, textarea")
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const htmlElement = element as HTMLElement;
        if (
          htmlElement.getClientRects().length === 0 ||
          htmlElement.matches(":disabled") ||
          element.getRootNode() !== document
        ) {
          return [];
        }
        const labelledTarget =
          element instanceof HTMLInputElement && element.type === "radio"
            ? element.closest("label")
            : null;
        const rect = (labelledTarget ?? element).getBoundingClientRect();
        return rect.width < 44 || rect.height < 44
          ? [
              `${htmlElement.tagName.toLowerCase()} ${htmlElement.textContent?.trim() ?? htmlElement.getAttribute("aria-label") ?? ""}: ${rect.width}x${rect.height}`,
            ]
          : [];
      }),
    );
  expect(undersized).toEqual([]);
}

async function expectNoOverlap(first: Locator, second: Locator) {
  const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  const overlaps =
    a!.x < b!.x + b!.width &&
    a!.x + a!.width > b!.x &&
    a!.y < b!.y + b!.height &&
    a!.y + a!.height > b!.y;
  expect(overlaps).toBe(false);
}
