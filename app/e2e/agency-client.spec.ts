// Maja as Brygga Studio's client (`?agency&as=maja`): she sees a plan only once the agency has checked and sent it,
// and she approves it (FLOWS §26.8).
import { expect, test } from "./fixtures";

test("Maja does not see a plan Brygga Studio has not sent yet", async ({ page }) => {
  await page.goto("/?agency&as=maja");
  // Home's list has loaded (the plan she was sent is there) before we look for the one she was not
  await expect(page.getByRole("link", { name: /^The plan for Black Friday is ready/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^The plan for Winter gifting/ })).toHaveCount(0);

  await page.goto("/campaigns/c-winter/plan?agency&as=maja");
  await expect(page.getByText("Brygga Studio is checking the plan")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve and start" })).toHaveCount(0);
});

test("Maja approves the Black Friday plan Brygga Studio sent her", async ({ page }) => {
  await page.goto("/?agency&as=maja");
  const plan = page.getByRole("link", { name: /^The plan for Black Friday is ready/ });
  await expect(plan).toContainText("Checked by Brygga Studio. Approve it and Fume starts.");

  await plan.click();
  await expect(page.getByRole("heading", { level: 1, name: "Black Friday" })).toBeVisible();
  await page.locator(".ui-page-footer").getByRole("button", { name: "Approve and start" }).click();
  await expect(page.getByText(/^You approved it today/)).toBeVisible();
});
