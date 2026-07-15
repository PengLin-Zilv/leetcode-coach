import { expect, test } from "./fixtures";
import {
  clearProblemCatalogScenario,
  countSkillStatesScenario,
  createLongContentScenario,
  createMissingMemoryScenario,
  deleteSkillStatesScenario,
  saveProfileScenario,
  UNKNOWN_ATTEMPT_ID,
  UNKNOWN_PROBLEM_ID,
} from "./support/scenarios";

test("no Profile routes protected workflow views to Setup", async ({
  page,
}) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/setup$/);
  await expect(
    page.getByRole("heading", { name: "Build your first practice session" }),
  ).toBeVisible();
});

test("an expired deadline asks for a new target on Today and Progress", async ({
  page,
}) => {
  await saveProfileScenario({ deadline: "2000-01-01" });

  for (const route of ["/today", "/progress"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/setup\?reason=deadline-passed$/);
    await expect(
      page.getByText(/interview date has passed.*choose a new target date/i),
    ).toBeVisible();
  }
});

test("no due reviews omits the secondary review sections", async ({ page }) => {
  await saveProfileScenario();

  await page.goto("/today");
  await expect(page.getByText(/reviews? due/i)).toHaveCount(0);

  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Due reviews" })).toHaveCount(
    0,
  );
});

test("an empty catalog keeps Today stable and retryable", async ({ page }) => {
  await saveProfileScenario();
  await clearProblemCatalogScenario();

  await page.goto("/today");
  await expect(
    page.getByRole("heading", { name: "We could not choose a task yet." }),
  ).toBeVisible();
  await expect(
    page.getByText("The practice catalog is unavailable right now."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry recommendation" }).click();
  await expect(
    page.getByRole("heading", { name: "We could not choose a task yet." }),
  ).toBeVisible();
});

test("persisted Attempts self-heal missing MEMORY on Today and Progress", async ({
  page,
}) => {
  await createMissingMemoryScenario();
  expect(await countSkillStatesScenario()).toBe(0);

  await page.goto("/today");
  await expect(page.locator("h1#today-task")).toBeVisible();
  expect(await countSkillStatesScenario()).toBeGreaterThan(0);

  await deleteSkillStatesScenario();
  expect(await countSkillStatesScenario()).toBe(0);
  await page.goto("/progress");
  await expect(
    page.getByRole("row", { name: /Arrays & Hashing Review due/ }),
  ).toBeVisible();
  expect(await countSkillStatesScenario()).toBeGreaterThan(0);
});

test("unavailable MIND never hides attempt completion or Reflection", async ({
  page,
}) => {
  await saveProfileScenario();
  await page.goto("/today");
  await page.getByRole("button", { name: "Start session" }).click();

  await page.getByRole("button", { name: "Give me a hint" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "temporarily unavailable" }),
  ).toBeVisible();
  const endAttempt = page.getByRole("link", { name: "End attempt" });
  await expect(endAttempt).toBeVisible();
  await endAttempt.click();
  await expect(
    page.getByRole("heading", { name: "Finish attempt" }),
  ).toBeVisible();
});

test("long title, reason, and note preserve actions without clipping", async ({
  page,
}) => {
  const scenario = await createLongContentScenario();
  await page.setViewportSize({ width: 320, height: 700 });

  await page.goto("/today");
  await expect(
    page.getByRole("heading", { name: scenario.title }),
  ).toBeVisible();
  const reason = page.locator("main h2", { hasText: "Why this" }).locator("..");
  expect((await reason.textContent())?.length).toBeGreaterThan(150);
  await expect(
    page.getByRole("button", { name: "Start session" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Start session" }).click();
  const longNote = "Invariant and edge-case note. ".repeat(60);
  await page.getByLabel("Notes").fill(longNote);
  await expect(page.getByRole("link", { name: "End attempt" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "End attempt" }).click();
  await expect(page.getByLabel("Optional note")).toHaveValue(longNote);
  await expect(
    page.getByRole("button", { name: "Review this attempt" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("unknown Problem and Attempt IDs show the product not-found state", async ({
  page,
}) => {
  await saveProfileScenario();

  for (const route of [
    `/practice/${UNKNOWN_PROBLEM_ID}`,
    `/practice/${UNKNOWN_PROBLEM_ID}/reflection`,
    `/feedback/${UNKNOWN_ATTEMPT_ID}`,
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", {
        name: "That practice view does not exist.",
      }),
    ).toBeVisible();
    await expect(page.getByText(/raw|stack|error:/i)).toHaveCount(0);
  }
});

async function expectNoHorizontalOverflow(
  page: import("@playwright/test").Page,
) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}
