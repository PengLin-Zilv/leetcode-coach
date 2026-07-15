import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  clearProblemCatalogScenario,
  FIRST_SESSION_PROFILE,
  getSingletonProfileScenario,
} from "./support/scenarios";

type SetupProfile = Readonly<{
  deadline: string;
  sessionsPerWeek: string;
  minutesPerSession: string;
  startingLevel: "new" | "some" | "reviewing";
}>;

async function completeSetup(
  page: Page,
  profile: SetupProfile = FIRST_SESSION_PROFILE,
) {
  await page.getByLabel("Interview date").fill(profile.deadline);
  await page
    .getByLabel("Sessions each week")
    .selectOption(profile.sessionsPerWeek);
  await page
    .getByLabel("Minutes per session")
    .selectOption(profile.minutesPerSession);
  await page.getByLabel("Starting point").selectOption(profile.startingLevel);
  await page.getByRole("button", { name: "Build my first session" }).click();
}

test("setup persists one profile and produces one grounded first task", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);

  await completeSetup(page);

  await expect(page).toHaveURL(/\/today$/);
  await expect(
    page.getByRole("heading", { name: "Contains Duplicate" }),
  ).toBeVisible();

  const reason = page.getByText(/fits your 30-minute session/i);
  await expect(reason).toBeVisible();
  const persistedReason = await reason.textContent();

  await page.reload();

  await expect(page).toHaveURL(/\/today$/);
  await expect(
    page.getByRole("heading", { name: "Contains Duplicate" }),
  ).toBeVisible();
  await expect(page.getByText(persistedReason ?? "")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Build my first session" }),
  ).toHaveCount(0);
});

test("setup updates the singleton Profile without replacing its ID", async ({
  page,
}) => {
  await page.goto("/setup");
  await completeSetup(page);
  await expect(page).toHaveURL(/\/today$/);
  const initialProfile = await getSingletonProfileScenario();

  await page.goto("/setup");
  await page.getByLabel("Minutes per session").selectOption("45");
  await page.getByRole("button", { name: "Build my first session" }).click();
  await expect(page).toHaveURL(/\/today$/);
  const updatedProfile = await getSingletonProfileScenario();

  expect(initialProfile).not.toBeNull();
  expect(updatedProfile).toMatchObject({
    id: initialProfile?.id,
    minutesPerSession: 45,
  });
});

test("an expired deadline returns to Setup with an actionable message", async ({
  page,
}) => {
  await page.goto("/setup");
  await completeSetup(page, {
    ...FIRST_SESSION_PROFILE,
    deadline: "2000-01-01",
  });

  await expect(page).toHaveURL(/\/setup\?reason=deadline-passed$/);
  await expect(
    page.getByText(/interview date has passed.*choose a new target date/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Build my first session" }),
  ).toBeEnabled();
});

test("catalog_empty keeps Today stable and offers a retry", async ({
  page,
}) => {
  await page.goto("/setup");
  await completeSetup(page);
  await expect(page).toHaveURL(/\/today$/);

  await clearProblemCatalogScenario();
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "We could not choose a task yet." }),
  ).toBeVisible();
  await expect(
    page.getByText("The practice catalog is unavailable right now."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry recommendation" }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "We could not choose a task yet." }),
  ).toBeVisible();
});
