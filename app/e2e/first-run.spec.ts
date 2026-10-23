// A brand that has just signed up (`?fresh`): the first run, outside the workspace, starts with its Brand DNA.
import { expect, test } from "./fixtures";

test("a new brand's first run starts by reading its website", async ({ page }) => {
  await page.goto("/?fresh");
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole("heading", { level: 1, name: "Welcome to Fume, LYSNE" })).toBeVisible();

  await page.getByRole("button", { name: "Build my Brand DNA" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Fume is reading your brand" })).toBeVisible();
  await page.getByRole("button", { name: "Show me the result" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "LYSNE, as Fume read it" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm what Fume found" })).toBeVisible();
});
