import { asc } from "drizzle-orm";

import { attempts, mindOutputs, skillStates } from "../../src/db/schema";
import { expect, test } from "./fixtures";
import { openBrowserDatabase } from "./support/database";
import { FIRST_SESSION_PROFILE } from "./support/scenarios";

test("a persisted reflection updates MEMORY and changes the next Today task", async ({
  context,
  page,
}) => {
  await page.goto("/setup");
  await page.getByLabel("Interview date").fill(FIRST_SESSION_PROFILE.deadline);
  await page
    .getByLabel("Sessions each week")
    .selectOption(FIRST_SESSION_PROFILE.sessionsPerWeek);
  await page
    .getByLabel("Minutes per session")
    .selectOption(FIRST_SESSION_PROFILE.minutesPerSession);
  await page.getByLabel("Starting point").selectOption("new");
  await page.getByRole("button", { name: "Build my first session" }).click();

  await expect(page).toHaveURL(/\/today$/);
  const firstProblem = "Contains Duplicate";
  await expect(page.getByRole("heading", { name: firstProblem })).toBeVisible();
  await expect(
    page.getByText(
      "Contains Duplicate builds Arrays & Hashing, unlocking Two Pointers and Stack, and fits your 30-minute session.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(/\/practice\/[0-9a-f-]+$/);
  const practiceUrl = page.url();
  const problemId = practiceUrl.split("/").at(-1);
  expect(problemId).toBeTruthy();

  await page
    .getByLabel("Notes")
    .fill("Used the set invariant during practice.");
  const persistedDraftKey = await page.evaluate(() =>
    Object.keys(window.localStorage).find((key) =>
      key.startsWith("leetcode-coach:practice:"),
    ),
  );
  expect(persistedDraftKey).toBeTruthy();

  await page.getByRole("link", { name: "End attempt" }).first().click();
  await expect(page).toHaveURL(/\/practice\/[0-9a-f-]+\/reflection$/);
  await expect(
    page.getByRole("heading", { name: "Finish attempt" }),
  ).toBeVisible();
  await expect(page.getByLabel("Optional note")).toHaveValue(
    "Used the set invariant during practice.",
  );

  await page.getByLabel("Solved", { exact: true }).check();
  await page.getByLabel("Confidence").selectOption("4");
  await page.getByLabel("Optional note").fill("Used the set invariant.");

  await page.evaluate(() => {
    const form = document.querySelector("form");
    if (!form) throw new Error("Expected Reflection form");

    for (const [name, value] of [
      ["durationMinutes", "180"],
      ["highestHintLevel", "4"],
    ]) {
      const input = document.createElement("input");
      input.name = name;
      input.value = value;
      form.append(input);
    }
  });
  await page.getByRole("button", { name: "Review this attempt" }).click();

  await expect(page).toHaveURL(/\/feedback\/[0-9a-f-]+$/);
  await expect(page.getByText("Memory updated")).toBeVisible();
  const transition = page.getByText(/Unseen → Practicing/);
  const reviewCue = page.getByText(/Review .* in 3 days/);
  await expect(transition).toBeVisible();
  await expect(reviewCue).toBeVisible();
  await expect(
    page.getByText(/Coaching is temporarily unavailable/),
  ).toBeVisible();
  const persistedTransition = await transition.textContent();
  const persistedReviewCue = await reviewCue.textContent();

  expect(
    await page.evaluate(
      (key) => window.localStorage.getItem(key ?? ""),
      persistedDraftKey,
    ),
  ).toBeNull();
  expect(
    (await context.cookies()).find(({ name }) => name === "lc_active_practice"),
  ).toBeUndefined();

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

    expect(storedAttempts).toHaveLength(1);
    expect(storedAttempts[0]).toMatchObject({
      problemId,
      result: "solved",
      durationMinutes: 1,
      confidence: 4,
      note: "Used the set invariant.",
      highestHintLevel: 0,
    });
    expect(storedMindOutputs).toEqual([]);
    expect(
      storedSkillStates.some(({ mastery }) => mastery === "practicing"),
    ).toBe(true);
  } finally {
    connection.close();
  }

  await page.reload();
  await expect(page.getByText(persistedTransition ?? "")).toBeVisible();
  await expect(page.getByText(persistedReviewCue ?? "")).toBeVisible();
  await expect(
    page.getByText(/Coaching is temporarily unavailable/),
  ).toBeVisible();

  await page.getByRole("link", { name: "Finish" }).click();
  await expect(page).toHaveURL(/\/today$/);
  const nextHeading = page.locator("h1#today-task");
  await expect(nextHeading).toBeVisible();
  const nextProblem = (await nextHeading.textContent())?.trim();
  expect(nextProblem).toBeTruthy();
  expect(nextProblem).not.toBe(firstProblem);
  await expect(
    page.getByText(
      `Continue Arrays & Hashing with ${nextProblem} while it is practicing; it fits your 30-minute session.`,
    ),
  ).toBeVisible();
});

test("Reflection and Feedback keep every action reachable at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/setup");
  await page.getByLabel("Interview date").fill(FIRST_SESSION_PROFILE.deadline);
  await page
    .getByLabel("Sessions each week")
    .selectOption(FIRST_SESSION_PROFILE.sessionsPerWeek);
  await page
    .getByLabel("Minutes per session")
    .selectOption(FIRST_SESSION_PROFILE.minutesPerSession);
  await page.getByLabel("Starting point").selectOption("new");
  await page.getByRole("button", { name: "Build my first session" }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("link", { name: "End attempt" }).first().click();

  const solved = page.getByLabel("Solved", { exact: true });
  await solved.focus();
  await expect(solved).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Review this attempt" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await solved.check();
  await page
    .getByLabel("Optional note")
    .fill(
      "A deliberately long note about the set invariant, duplicate detection, and careful loop ordering at the narrowest supported viewport.",
    );
  await page.getByRole("button", { name: "Review this attempt" }).click();

  await expect(page.getByText("Memory updated")).toBeVisible();
  await expect(
    page.getByText(/Coaching is temporarily unavailable/),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Finish" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View progress" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 780 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
