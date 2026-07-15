import { test as base } from "@playwright/test";

import { resetBrowserDatabase } from "./support/database";

export { expect } from "@playwright/test";

export const test = base.extend<{ resetDatabase: void }>({
  resetDatabase: [
    async ({}, use) => {
      await resetBrowserDatabase();
      await use();
    },
    { auto: true },
  ],
});
