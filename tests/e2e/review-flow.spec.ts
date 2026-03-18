import { test, expect } from "@playwright/test";

test("loads home and shows title", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Learn Katakana with Spaced Repetition")).toBeVisible();
});
