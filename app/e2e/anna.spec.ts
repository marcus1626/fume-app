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
