// A brand that has just signed up (`?fresh`): the person says who they are ("About you"), then the first run, outside
// the workspace, starts with its Brand DNA.
import { expect, test } from "./fixtures";

test("a new person says who they are before anything else", async ({ page }) => {
  await page.goto("/?fresh");
  await expect(page).toHaveURL(/\/hello/);
  await expect(page.getByRole("heading", { level: 1, name: "About you" })).toBeVisible();
  const name = page.getByLabel("Your name");
  await expect(name).toHaveValue("Maja Lind");
  await name.fill("");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Write your name.")).toBeVisible();
  await expect(page).toHaveURL(/\/hello/);
  await name.fill("Maja Lind");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole("heading", { level: 1, name: "Welcome to Fume, LYSNE" })).toBeVisible();
});

test("a new brand's first run starts by reading its website", async ({ page }) => {
  await page.goto("/?fresh");
  await expect(page).toHaveURL(/\/hello/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole("heading", { level: 1, name: "Welcome to Fume, LYSNE" })).toBeVisible();

  await page.getByRole("button", { name: "Build my Brand DNA" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Fume is reading your brand" })).toBeVisible();
  await page.getByRole("button", { name: "Show me the result" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "LYSNE, as Fume read it" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm what Fume found" })).toBeVisible();
});
