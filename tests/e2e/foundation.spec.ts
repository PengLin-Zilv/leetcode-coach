import { expect, test } from "@playwright/test";

test("renders the connected foundation without exposing configuration", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByText("Database connected", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "LeetCode Coach foundation" }),
  ).toBeVisible();
  await expect(
    page.locator('[data-foundation-status="connected"]'),
  ).toBeVisible();

  await expect(page.locator("body")).not.toContainText("file:./dev.db");
  await expect(page.locator("body")).not.toContainText("TURSO_AUTH_TOKEN");
  await expect(page.locator("body")).not.toContainText("libsql://");
});
