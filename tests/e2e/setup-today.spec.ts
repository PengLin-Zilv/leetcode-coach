import { expect, test } from "./fixtures";
import { FIRST_SESSION_PROFILE } from "./support/scenarios";

test("setup persists one profile and produces one grounded first task", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);

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
