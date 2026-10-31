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

test("Anna fixes the shot the Engine flagged in a video", async ({ page }) => {
  await page.goto("/studio/doc/doc-night-ritual?as=anna");
  await expect(page.getByRole("heading", { level: 1, name: "Night ritual · Reels 9:16" })).toBeVisible();
  const checks = page.getByRole("list", { name: "The Engine’s checks" });
  await expect(checks).toContainText("Shot 3: Oil runs out of the bottle’s base while the cap is on");

  // The flag on the ruler jumps to the shot; the clean take replaces it and the check clears
  await page.getByRole("button", { name: /^Shot 3: Oil runs out/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Shot 3 · The bottle in the hand" })).toBeVisible();
  await page.getByRole("button", { name: "Use take 2 from 1.4 s" }).click();
  await page.getByRole("button", { name: "Back to the edit" }).click();
  await expect(checks).not.toContainText("Oil runs out");
  await expect(page.getByRole("button", { name: /^Shot 3: Oil runs out/ })).toHaveCount(0);

  // The Engine bar shows a cut before it is kept
  await page.getByLabel("Tell the Engine what to change").fill("Cut it to 6 s on the beat");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("The edit from 15.0 s to 6.0 s; every shot gives up the same share")).toBeVisible();
  await page.getByRole("button", { name: "Keep" }).click();
  await expect(page.getByText(/\/ 0:06\.0$/)).toBeVisible();
});
