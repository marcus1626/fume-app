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
  await expect(page.getByRole("heading", { level: 2, name: "Shot 3 · Take 1 of 2" })).toBeVisible();
  await expect(page.getByText("The bottle in the hand · made by the Engine")).toBeVisible();
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

test("Anna sees a version under the bar, with its scores, and the prompt behind it", async ({ page }) => {
  // The Engine never stops the designer (FLOWS §34.1): a version under the bar is made and shown, with a warning
  await page.goto("/studio/doc/doc-autumn-m3?as=anna");
  const under = page.getByRole("button", { name: /^Version 4\b.*Under the bar · Engine 58 · Product 64/ });
  await expect(under).toBeVisible();
  await under.click();
  await expect(page.getByText("Version 4 is under LYSNE’s bar")).toBeVisible();
  await expect(page.getByRole("meter", { name: "Engine" })).toHaveAttribute("aria-valuenow", "58");
  await expect(page.getByRole("meter", { name: "Product" })).toHaveAttribute("aria-valuenow", "64");

  // Its prompt went to the image model with a warning; the Engine's rules it worked against are named
  await page.getByRole("button", { name: "The Engine’s prompt and checks" }).click();
  const warned = page.getByRole("dialog", { name: "The prompt behind version 4" });
  await expect(warned.getByText("Burgundy matte cap, never glossy (verified fact)")).toBeVisible();
  await expect(warned.getByText("Works against a rule, sent to the image model with a warning")).toBeVisible();
  await warned.getByRole("button", { name: "Close" }).click();

  // The designer has the last word: sending it asks once, and the expert sees the warning in Check
  await page.getByRole("button", { name: /^Send to check/ }).click();
  await expect(page.getByText("Version 4 is under the bar")).toBeVisible();
  await page.getByRole("button", { name: "Send anyway" }).click();
  await expect(page.getByText("In check", { exact: true })).toBeVisible();

  // Another version's prompt, from the board's rail, with everything the Engine had for it
  await page.getByRole("button", { name: /^Version 3\b/ }).click();
  await page.getByRole("button", { name: "The Engine’s prompt and checks" }).click();
  const prompt = page.getByRole("dialog", { name: "The prompt behind version 3" });
  await expect(prompt).toBeVisible();
  await expect(prompt.getByRole("heading", { name: "What the Engine had · 17 of 26 went in" })).toBeVisible();
  await prompt.getByRole("button", { name: /^Product facts/ }).click();
  await expect(prompt.getByText("A scent fact is for the words, not the picture.")).toBeVisible();
});

test("Anna sees what went into a warned prompt and what its check didn't find", async ({ page }) => {
  await page.goto("/studio/doc/doc-autumn-m3?as=anna&prompt=rv-4");
  const panel = page.getByRole("dialog", { name: "The prompt behind version 4" });
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
  // The cap is off: the product finding is decided first, before the creative is marked checked
  await expect(page.getByRole("heading", { name: /^To decide · 3/ })).toBeVisible();
  await expect(finding("The cap is glossy").getByText("Product · decide first")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Mark checked/ })).toBeDisabled();
  await expect(page.getByText("Decide the product finding first: a fix, or not a problem.")).toBeVisible();

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

test("Anna sees what Fume's word check found in a plan, and changes the line it flags", async ({ page }) => {
  await page.goto("/studio/b/w-lysne/campaigns/c-bf/plan?as=anna");
  const words = page.getByRole("region", { name: "The words, checked" });
  await expect(words).toContainText("3 to look at, in 6 lines");
  // How Fume wrote them folds under the findings
  await words.getByRole("button", { name: "How Fume wrote them" }).click();
  await expect(words).toContainText("In the Tone of Voice, version 1 (approved).");
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

test("Anna asks Fume for the graphic design on a picture, and reads what came back", async ({ page }) => {
  await page.goto("/studio/doc/doc-autumn-m3?as=anna");
  await page.getByRole("button", { name: "Add graphic design to V3" }).click();
  const dialog = page.getByRole("dialog", { name: "Add graphic design to V3" });
  await expect(dialog.getByText("Den langsomme timen før søvn.")).toBeVisible();
  await expect(dialog.getByText(/^Version 1 · checked/)).toBeVisible();
  await dialog.getByLabel("Anything Fume should know (if anything)").fill("Keep the words high, clear of the bottle.");
  await dialog.getByRole("button", { name: "Add graphic design", exact: true }).click();

  // Fume designs it as a new version, and it comes back picked, with its words on the picture
  await expect(page.getByText("Fume is designing version 5 on V3")).toBeVisible();
  await expect(page.getByRole("button", { name: /Designed from V3/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".ui-design-drawn").first()).toContainText("Den langsomme timen før søvn.");

  await page.getByRole("button", { name: "The graphic design and its checks" }).click();
  const sheet = page.getByRole("dialog", { name: "The graphic design on version 5" });
  await expect(sheet.getByRole("list", { name: "What Fume’s review found" })).toContainText(
    "Ready for the expert’s check",
  );
  // What code measured: only what did not pass one by one, the rest in one row
  await expect(sheet.getByRole("list", { name: "What code measured" })).toContainText(/\d+ checks passed/);
  await expect(sheet.getByText("“Keep the words high, clear of the bottle.”")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Design again" })).toBeVisible();

  // In Check, the expert reads the same findings beside the creative
  await page.goto("/studio/qa?as=anna&item=qa-8");
  await expect(page.getByText(/^The graphic design · design system version 1/)).toBeVisible();
  await expect(page.getByRole("list", { name: "What code measured" })).toContainText("checks passed");
});
