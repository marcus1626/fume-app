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

  // The picked version's prompt, from the board's rail, with everything the Engine had for it
  await page.getByRole("button", { name: "The Engine’s prompt and checks" }).click();
  const prompt = page.getByRole("dialog", { name: "The prompt behind version 3" });
  await expect(prompt).toBeVisible();
  await expect(prompt.getByRole("heading", { name: "What the Engine had · 17 of 26 went in" })).toBeVisible();
  await prompt.getByRole("button", { name: /^Product facts/ }).click();
  await expect(prompt.getByText("A scent fact is for the words, not the picture.")).toBeVisible();
});

test("Anna sees what went into a stopped prompt and what its check didn't find", async ({ page }) => {
  await page.goto("/studio/doc/doc-autumn-m3?as=anna&prompt=rv-4");
  const panel = page.getByRole("dialog", { name: "Version 4 didn’t render" });
  await expect(
    panel.getByRole("heading", { name: /What the Engine had · 17 of 26 went in · 2 not found/ }),
  ).toBeVisible();
  // the group with a piece that was not found opens by itself
  await expect(panel.getByRole("button", { name: /^Product facts.*1 not found/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(panel.getByText("Word for word, not found in the prompt")).toBeVisible();
});

test("Anna settles the Engine's findings in Check", async ({ page }) => {
  await page.goto("/studio/b/w-lysne/qa?as=anna&item=qa-7");
  await expect(page.getByRole("heading", { level: 2, name: "Night Body Oil · Feed 8" })).toBeVisible();
  const findings = page.getByRole("list", { name: "The Engine’s findings" });
  const finding = (text: string) => findings.getByRole("listitem").filter({ hasText: text });
  // The cap is off, so the creative can't be marked checked yet
  await expect(finding("The cap is glossy").getByText("Product · stops the check")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Mark checked/ })).toBeDisabled();
  await expect(page.getByText("The product finding stops the check.")).toBeVisible();

  // The light is not a problem here, and Undo takes that back
  await finding("The light comes from above").getByRole("button", { name: "Not a problem" }).click();
  await expect(finding("The light comes from above").getByText(/^Brand · not a problem, said you/)).toBeVisible();
  await finding("The light comes from above").getByRole("button", { name: "Undo" }).click();
  await expect(finding("The light comes from above").getByText("Brand · minor")).toBeVisible();

  // The cap goes to the Engine in the note, and its fix settles it
  await finding("The cap is glossy").getByRole("button", { name: "Add to the note" }).click();
  await expect(page.getByRole("textbox", { name: "Tell the Engine" })).toHaveValue(
    "The cap is glossy; LYSNE's cap is matte. It should be: Burgundy matte cap, as in its photographs.",
  );
  await expect(finding("The cap is glossy").getByRole("button", { name: "In the note" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /^Tell the Engine/ }).click();
  // Check moves on while the Engine fixes it; back to it once the fix is in
  await expect(page.getByRole("heading", { level: 2, name: "Night Body Oil · Feed 8" })).toBeHidden();
  await page
    .getByRole("button", { name: /^Night Body Oil · Feed 8 .*The Engine’s fix is back$/ })
    .click({ timeout: 15_000 });
  await expect(finding("The cap is glossy").getByText("Product · fixed by the Engine")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: /^Mark checked/ })).toBeEnabled();
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
