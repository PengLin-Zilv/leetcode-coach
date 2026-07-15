import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { resetBrowserDatabase } from "./support/database";
import {
  createLongCatalogScenario,
  createLongContentScenario,
  FIRST_SESSION_PROFILE,
} from "./support/scenarios";

const viewports = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "tablet", width: 768, height: 1024 },
  { label: "mobile", width: 390, height: 844 },
  { label: "narrow", width: 320, height: 700 },
] as const;

for (const viewport of viewports) {
  test(`${viewport.width}px completes the full workflow with contained, non-overlapping controls`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const scenario = await createLongCatalogScenario();
    await page.goto("/setup");
    await fillSetup(page);
    await expectScreen(
      page,
      page.getByRole("button", { name: "Build my first session" }),
    );
    await page.getByRole("button", { name: "Build my first session" }).click();

    await expect(page).toHaveURL(/\/today$/);
    await expectScreen(
      page,
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

    await expectScreen(page, page.getByRole("link", { name: "End attempt" }));
    await expectPrimaryAction(
      page.getByRole("link", { name: /Open problem on LeetCode/ }),
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
      await expectScreen(
        page,
        sheet.getByRole("link", { name: "End attempt" }),
      );
      await page.keyboard.press("Escape");
      await expect(opener).toBeFocused();
    }

    await page.getByRole("link", { name: "End attempt" }).click();
    await expectScreen(
      page,
      page.getByRole("button", { name: "Review this attempt" }),
    );
    await page.getByLabel("Solved", { exact: true }).check();
    await page.getByLabel("Optional note").fill(scenario.longNote);
    await page.getByRole("button", { name: "Review this attempt" }).click();

    await expectScreen(page, page.getByRole("link", { name: "Finish" }));
    await page.getByRole("link", { name: "View progress" }).click();
    await expectScreen(page, page.getByRole("link", { name: "Today" }));
    if (viewport.width === 1440) {
      await expectStatusLabelsUnbroken(page);
    }
    await page.getByRole("link", { name: "Today" }).click();
    await expectScreen(
      page,
      page.getByRole("button", { name: "Start session" }),
    );
  });
}

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
    const scenario = await createLongContentScenario();
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
    await expectScreen(
      page,
      page.getByRole("button", { name: "Start session" }),
    );
    await screenshot("today");
    await page.getByRole("button", { name: "Start session" }).click();
    await expect(page).toHaveURL(/\/practice\/[0-9a-f-]+$/);
    await page.getByLabel("Notes").fill(scenario.longNote);
    await expectScreen(page, page.getByRole("link", { name: "End attempt" }));
    await screenshot("practice");
    await page.getByRole("link", { name: "End attempt" }).click();
    await expect(page).toHaveURL(/\/reflection$/);
    await expect(
      page.getByRole("heading", { name: "Finish attempt" }),
    ).toBeVisible();
    await expectScreen(
      page,
      page.getByRole("button", { name: "Review this attempt" }),
    );
    await screenshot("reflection");
    await page.getByLabel("Solved", { exact: true }).check();
    await page.getByRole("button", { name: "Review this attempt" }).click();
    await expect(page).toHaveURL(/\/feedback\/[0-9a-f-]+\?cleanup=/);
    await expect(page.getByText("Memory updated")).toBeVisible();
    await expectScreen(page, page.getByRole("link", { name: "Finish" }));
    await screenshot("feedback");
    await page.getByRole("link", { name: "View progress" }).click();
    await expect(page).toHaveURL(/\/progress$/);
    await expect(
      page.getByRole("heading", { name: "Evidence from your practice" }),
    ).toBeVisible();
    await expectScreen(page, page.getByRole("link", { name: "Today" }));
    if (viewport.width === 1440) {
      await expectStatusLabelsUnbroken(page);
    }
    await screenshot("progress");
  }
});

async function expectScreen(page: Page, primaryAction: Locator) {
  await expectNoHorizontalOverflow(page);
  await expect(
    page.getByRole("button", { name: "Open Next.js Dev Tools" }),
  ).toHaveCount(0);
  await expectPrimaryAction(primaryAction);
  await expectInteractiveTargets(page);
  await expectContentContainedAndSeparate(page);
}

async function expectPrimaryAction(action: Locator) {
  await action.scrollIntoViewIfNeeded();
  await expect(action).toBeVisible();
  const box = await action.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  const viewport = await action.evaluate(() => ({
    height: window.innerHeight,
    width: window.innerWidth,
  }));
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 0.5);
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
          htmlElement.closest("[inert]")
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

async function expectContentContainedAndSeparate(page: Page) {
  const failures = await page
    .locator(
      "main h1, main h2, main p, main legend, main label, main a[href], main button, main input:not([type=hidden]), main select, main textarea, [role=dialog] h2, [role=dialog] p, [role=dialog] a[href], [role=dialog] button",
    )
    .evaluateAll((rawElements) => {
      const viewportWidth = document.documentElement.clientWidth;
      const normalize = (element: Element) =>
        element instanceof HTMLInputElement && element.type === "radio"
          ? (element.closest("label") ?? element)
          : element;
      const elements = Array.from(new Set(rawElements.map(normalize))).filter(
        (element) =>
          element.getClientRects().length > 0 &&
          !element.matches(":disabled") &&
          element.closest("[inert]") === null,
      );
      const failures: string[] = [];

      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        if (rect.left < -0.5 || rect.right > viewportWidth + 0.5) {
          failures.push(
            `outside viewport: ${element.tagName.toLowerCase()} ${element.textContent?.trim().slice(0, 50) ?? ""} at ${rect.left}..${rect.right}`,
          );
        }
      }

      for (let first = 0; first < elements.length; first += 1) {
        for (let second = first + 1; second < elements.length; second += 1) {
          const a = elements[first];
          const b = elements[second];
          if (a.contains(b) || b.contains(a)) continue;
          const ar = a.getBoundingClientRect();
          const br = b.getBoundingClientRect();
          const overlapWidth =
            Math.min(ar.right, br.right) - Math.max(ar.left, br.left);
          const overlapHeight =
            Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top);
          if (overlapWidth > 1 && overlapHeight > 1) {
            failures.push(
              `overlap: ${a.tagName.toLowerCase()} ${a.textContent?.trim().slice(0, 30) ?? ""} / ${b.tagName.toLowerCase()} ${b.textContent?.trim().slice(0, 30) ?? ""}`,
            );
          }
        }
      }
      return failures;
    });
  expect(failures).toEqual([]);
}

async function expectStatusLabelsUnbroken(page: Page) {
  const wrapped = await page.locator("[data-state]").evaluateAll((labels) =>
    labels.flatMap((label) => {
      const text = label.textContent?.trim() ?? "";
      const textNode = label.firstChild;
      if (text === "" || textNode === null) return [];
      const range = document.createRange();
      range.selectNodeContents(textNode);
      return range.getClientRects().length > 1 ? [text] : [];
    }),
  );
  expect(wrapped).toEqual([]);
}

async function fillSetup(page: Page) {
  await page.getByLabel("Interview date").fill(FIRST_SESSION_PROFILE.deadline);
  await page
    .getByLabel("Sessions each week")
    .selectOption(FIRST_SESSION_PROFILE.sessionsPerWeek);
  await page
    .getByLabel("Minutes per session")
    .selectOption(FIRST_SESSION_PROFILE.minutesPerSession);
  await page
    .getByLabel("Starting point")
    .selectOption(FIRST_SESSION_PROFILE.startingLevel);
}
