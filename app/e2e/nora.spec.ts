// Nora Vik, lead at the agency Brygga Studio (`?as=nora`): the agency checks; only its client, Maja, approves
// (FLOWS §24, §26.8).
import { expect, test } from "./fixtures";

test("Nora checks the Winter gifting plan and sends it to Maja, who approves it", async ({ page }) => {
  await page.goto("/?as=nora");
  await page.getByRole("link", { name: /Winter gifting.*The plan waits for your check/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Winter gifting" })).toBeVisible();

  const footer = page.locator(".ui-page-footer");
  await expect(footer).toContainText("Check the plan, then send it to Maja.");
  await footer.getByRole("button", { name: "Send to Maja" }).click();
  const send = page.getByRole("dialog", { name: "Send the plan to Maja" });
  await expect(send).toContainText("The plan · version 1");
  await send.getByRole("button", { name: "Send to Maja" }).click();
  await expect(send).toBeHidden();
  await expect(footer).toContainText("You sent it to Maja today.");
  await expect(page.getByText(/^Checked by you today/)).toBeVisible();

  // Maja, from the person menu: the people change, the data stays
  await page.getByRole("button", { name: /^Nora Vik, Brygga Studio\./ }).click();
  await page.getByRole("menuitem", { name: "Maja, LYSNE (the client)" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/, Maja$/);
  const winter = page.getByRole("link", { name: /^The plan for Winter gifting is ready/ });
  await expect(winter).toContainText("Checked by Brygga Studio. Approve it and Fume starts.");

  await winter.click();
  await expect(footer).toContainText("Brygga Studio checked it.");
  await footer.getByRole("button", { name: "Approve and start" }).click();
  await expect(page.getByText(/^You approved it today/)).toBeVisible();
  await expect(footer).toBeHidden();
});

test("Nora's own view of the client link is a preview with its buttons off", async ({ page }) => {
  await page.goto("/?as=nora");
  await page.getByRole("link", { name: /^Black Friday LYSNE/ }).click();
  await page.getByRole("tab", { name: /^Plan/ }).click();
  await page.getByRole("link", { name: "Open the client link" }).click();

  await expect(page).toHaveURL(/\/c\/bfplan$/);
  await expect(page.getByRole("note")).toContainText("Preview of what Maja sees. Nothing you do here counts.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Brygga Studio sent you the plan for LYSNE · Black Friday",
  );
  await expect(page.getByRole("button", { name: "Approve the plan" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Ask for changes" })).toBeDisabled();
  await expect(page.getByLabel("Your name")).toHaveCount(0);

  await page.getByRole("button", { name: "Close the preview" }).click();
  await expect(page).toHaveURL(/\/agency\/b\/w-lysne\/campaigns\/c-bf/);
});
