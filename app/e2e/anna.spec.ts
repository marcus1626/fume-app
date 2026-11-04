// Anna, Fume's expert (`?as=anna`): she works in the studio and checks every creative before a customer sees it.
import { expect, test } from "./fixtures";

test("Anna checks a creative in the studio's Check", async ({ page }) => {
  await page.goto("/?as=anna");
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/, Anna$/);

  const sidebar = page.getByRole("complementary", { name: "Fume studio" });
  await sidebar.getByRole("link", { name: /^Check \d+$/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Check" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Night Body Oil · Feed 6" })).toBeVisible();

  await page.getByRole("button", { name: /^Mark checked/ }).click();
  await expect(page.getByText("Checked: Night Body Oil · Feed 6. Not sent to Maja yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Night Body Oil · Feed 6 .*Checked by you$/ })).toBeVisible();
  // Check moves on to the next creative that waits
  await expect(page.getByRole("heading", { level: 2, name: "Night Body Oil · Square 2" })).toBeVisible();
});

test("Anna sees why a version didn't render, and the prompt behind it", async ({ page }) => {
  await page.goto("/studio/doc/doc-autumn-m3?as=anna");
  const failed = page.getByRole("button", { name: /^Version 4\. .*Stopped by 2 rules/ });
  await expect(failed).toBeVisible();
  await failed.click();

  const panel = page.getByRole("dialog", { name: "Version 4 didn’t render" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Burgundy matte cap, never glossy (verified fact)")).toBeVisible();
  await expect(panel.getByRole("heading", { name: "The last try, never sent" })).toBeVisible();
  await panel.getByRole("button", { name: "Write a new instruction" }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByLabel("Tell the Engine what to change")).toBeFocused();

  // The picked version's prompt, from the board's rail
  await page.getByRole("button", { name: "The Engine’s prompt and checks" }).click();
  await expect(page.getByRole("dialog", { name: "The prompt behind version 3" })).toBeVisible();
});

test("Anna teaches the Engine with yes or no on its pictures", async ({ page }) => {
  await page.goto("/studio/b/w-lysne/output?as=anna");
  await page.getByRole("button", { name: "Teach the Engine · 6" }).click();
  await expect(page.getByRole("dialog", { name: "Teach the Engine" })).toBeVisible();
  await page.getByRole("button", { name: /^No/ }).first().click();
  await page.getByRole("button", { name: "The light" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Teach the Engine · 5" })).toBeVisible();
});
