// A visitor through the client link (/c/:token): no account, no way into Fume (FLOWS §24.5, §26.8). The demo's link
// /c/bfplan lives in the agency demo; signed in there as anyone outside the agency, the page is what a visitor sees.
import { expect, test } from "./fixtures";

test("a visitor asks for changes to the plan through the client link", async ({ page }) => {
  await page.goto("/c/bfplan?agency&as=maja");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Brygga Studio sent you the plan for LYSNE · Black Friday",
  );
  await expect(page.getByText("The plan · version 1")).toBeVisible();
  await expect(page.getByRole("note")).toHaveCount(0);

  await page.getByLabel("Your name").fill("Maja Lind");
  await page.getByRole("button", { name: "Ask for changes" }).click();
  await page.getByLabel("What should change in the plan").fill("Less gold: gold words only on the first master.");
  await page.getByRole("button", { name: "Send the changes" }).click();

  await expect(page.getByText("You asked for changes")).toBeVisible();
  await expect(page.getByText("“Less gold: gold words only on the first master.”")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Thank you, Maja. Brygga Studio has your changes." })).toBeVisible();
});

test("an unknown client link says it no longer works", async ({ page }) => {
  await page.goto("/c/no-such-link?agency&as=maja");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "This link has expired or no longer works; ask the person who sent it for a new one.",
  );
});
