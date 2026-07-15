import type { Page } from "@playwright/test";
import { asc } from "drizzle-orm";

import { attempts, mindOutputs, skillStates } from "../../src/db/schema";
import { expect, test } from "./fixtures";
import { openBrowserDatabase } from "./support/database";
import { FIRST_SESSION_PROFILE } from "./support/scenarios";

async function startFirstPractice(page: Page): Promise<void> {
  await page.goto("/setup");
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
  await page.getByRole("button", { name: "Build my first session" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(/\/practice\/[0-9a-f-]+$/);
}

async function trainingStateFingerprint(): Promise<string> {
  const connection = await openBrowserDatabase();

  try {
    const [storedAttempts, storedMindOutputs, storedSkillStates] =
      await Promise.all([
        connection.database.select().from(attempts).orderBy(asc(attempts.id)),
        connection.database
          .select()
          .from(mindOutputs)
          .orderBy(asc(mindOutputs.id)),
        connection.database
          .select()
          .from(skillStates)
          .orderBy(asc(skillStates.patternId)),
      ]);

    return JSON.stringify({
      attempts: storedAttempts,
      mindOutputs: storedMindOutputs,
      skillStates: storedSkillStates,
    });
  } finally {
    connection.close();
  }
}

test("practice preserves work and completion while coaching is unavailable", async ({
  context,
  page,
}) => {
  await startFirstPractice(page);

  await expect(
    page.getByRole("heading", { name: "Contains Duplicate" }),
  ).toBeVisible();
  const practiceRegion = page.getByRole("region", {
    name: "Contains Duplicate",
  });
  await expect(
    practiceRegion.getByText("Arrays & Hashing", { exact: true }),
  ).toBeVisible();
  await expect(practiceRegion.getByText("15 minute target")).toBeVisible();

  const problemLink = page.getByRole("link", {
    name: "Open problem on LeetCode",
  });
  await expect(problemLink).toHaveAttribute(
    "href",
    "https://leetcode.com/problems/contains-duplicate/",
  );
  await expect(problemLink).toHaveAttribute("target", "_blank");
  await expect(problemLink).toHaveAttribute("rel", /\bnoopener\b/);

  const activeCookie = (await context.cookies()).find(
    ({ name }) => name === "lc_active_practice",
  );
  expect(activeCookie).toMatchObject({
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
  });
  expect(activeCookie?.value).toMatch(/^[^.]+\.[^.]+$/);
  const activeCookieValue = activeCookie?.value;

  const notes = page.getByLabel("Notes");
  await notes.fill("Use a set and check before adding each value.");
  await page.reload();
  await expect(notes).toHaveValue(
    "Use a set and check before adding each value.",
  );

  const timer = page.getByRole("timer");
  await expect(timer).toBeVisible();
  await expect(timer).not.toHaveAttribute("aria-live", "assertive");
  await expect(page.getByRole("link", { name: "End attempt" })).toBeVisible();

  const beforeUnavailableMind = await trainingStateFingerprint();
  await Promise.all([
    waitForPracticeAction(page),
    page.getByRole("button", { name: "Give me a hint" }).click(),
  ]);
  await expect(
    page.getByText("Coaching is temporarily unavailable"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "End attempt" })).toBeVisible();
  await expect(page.getByRole("link", { name: "End attempt" })).toHaveAttribute(
    "aria-disabled",
    "false",
  );

  const hintDepth = page.getByText("Hint depth: 0 of 4");
  await expect(hintDepth).toBeVisible();
  for (const control of ["Simpler", "Example", "Trace it"]) {
    const button = page.getByRole("button", { name: control });
    await expect(button).toBeEnabled();
    await Promise.all([waitForPracticeAction(page), button.click()]);
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(hintDepth).toBeVisible();
  }

  expect(await trainingStateFingerprint()).toBe(beforeUnavailableMind);
  const cookieAfterUnavailableMind = (await context.cookies()).find(
    ({ name }) => name === "lc_active_practice",
  );
  expect(cookieAfterUnavailableMind?.value).toBe(activeCookieValue);
});

test("practice exposes MIND as a labelled sheet without horizontal overflow at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await startFirstPractice(page);

  await expect(page.getByRole("link", { name: "End attempt" })).toBeVisible();
  const openCoaching = page.getByRole("button", { name: "Open coaching" });
  const backgroundHeader = page.locator("header").first();
  const backgroundPractice = page.locator(
    'section[aria-labelledby="practice-title"]',
  );
  await openCoaching.click();
  const dialog = page.getByRole("dialog", { name: "MIND" });
  await expect(dialog).toBeVisible();
  await expect(backgroundHeader).toHaveAttribute("inert", "");
  await expect(backgroundHeader).toHaveAttribute("aria-hidden", "true");
  await expect(backgroundPractice).toHaveAttribute("inert", "");
  await expect(backgroundPractice).toHaveAttribute("aria-hidden", "true");
  await expect(dialog.getByRole("link", { name: "End attempt" })).toBeVisible();
  const closeCoaching = page.getByRole("button", { name: "Close coaching" });
  await expect(closeCoaching).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Trace it" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeCoaching).toBeFocused();

  await page.getByRole("button", { name: "Trace it" }).focus();
  await page.keyboard.press("Tab");
  await expect(closeCoaching).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(openCoaching).toBeFocused();
  await expect(backgroundHeader).not.toHaveAttribute("inert", "");

  await openCoaching.click();
  await closeCoaching.click();
  await expect(openCoaching).toBeFocused();
  await openCoaching.click();
  await expect(dialog.getByRole("link", { name: "End attempt" })).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("practice exits contained MIND state when resizing from mobile to desktop", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await startFirstPractice(page);

  await page.getByRole("button", { name: "Open coaching" }).click();
  await expect(page.getByRole("dialog", { name: "MIND" })).toBeVisible();

  const backgroundHeader = page.locator("header").first();
  const backgroundPractice = page.locator(
    'section[aria-labelledby="practice-title"]',
  );
  await page.setViewportSize({ width: 900, height: 700 });

  await expect(page.getByRole("dialog", { name: "MIND" })).toHaveCount(0);
  await expect(backgroundHeader).not.toHaveAttribute("inert", "");
  await expect(backgroundHeader).not.toHaveAttribute("aria-hidden", "true");
  await expect(backgroundPractice).not.toHaveAttribute("inert", "");
  await expect(backgroundPractice).not.toHaveAttribute("aria-hidden", "true");
  await expect(page.getByRole("link", { name: "End attempt" })).toBeVisible();

  const giveHint = page.getByRole("button", { name: "Give me a hint" });
  await expect(giveHint).toBeVisible();
  await expect(giveHint).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Simpler" })).toBeFocused();
});

function waitForPracticeAction(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/practice\/[0-9a-f-]+$/.test(new URL(response.url()).pathname),
  );
}
