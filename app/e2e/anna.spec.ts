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

test("Anna sees what Fume's word check found in a plan, and changes the line it flags", async ({ page }) => {
  await page.goto("/studio/b/w-lysne/campaigns/c-bf/plan?as=anna");
  const words = page.getByRole("region", { name: "The words, checked" });
  await expect(words).toContainText("6 lines read · 1 claim nothing backs · 1 off the voice · 1 word the voice avoids");
  await expect(words).toContainText("Written in the Tone of Voice, version 1 (approved).");
  const foot = page.locator(".ui-page-footer");
  await expect(foot).toContainText("1 claim nothing backs is still in the plan.");

  // The finding glides to its master, where the note says what is wrong
  await words.getByRole("link", { name: /^Master 2 A claim nothing backs/ }).click();
  const master = page.locator("#plan-words-pd-c-bf-a-pc-c-bf-a-m2");
  await expect(master).toBeFocused();
  await expect(master).toContainText("No verified fact says this: “roligere søvn”. A health claim needs one.");

  // She changes the words; the note stays, muted, and the foot no longer counts it
  await master.getByRole("button", { name: "Change Master 2" }).click();
  await master.getByLabel("The words on it").fill("Til timen før du sovner.");
  await master.getByRole("button", { name: "Save" }).click();
  await expect(master).toContainText("You changed this line after the check.");
  await expect(foot).not.toContainText("claim nothing backs");
});

test("Anna checks Fume's new Tone of Voice before Maja reads it", async ({ page }) => {
  await page.goto("/studio/b/w-lysne/brand/voice?as=anna");
  await expect(page.getByRole("heading", { level: 1, name: "Tone of Voice" })).toBeVisible();
  // The header says which version and where it stands
  await expect(page.getByText("Draft · waits on your check", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Version 1 stays in use until Maja approves this one")).toBeVisible();

  await page.getByRole("button", { name: "Mark checked" }).click();
  await expect(page.getByText("Tone of Voice, version 2 checked")).toBeVisible();
  await expect(page.getByText("Checked by you · waits on Maja", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark checked" })).toHaveCount(0);
});
