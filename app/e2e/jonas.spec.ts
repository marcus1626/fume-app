// Jonas Berg, a member at LYSNE (`?as=jonas`): he briefs, comments and asks for changes; only Maja approves.
import { expect, test } from "./fixtures";

test("Jonas sees the creatives in Review but no Approve", async ({ page }) => {
  await page.goto("/review?as=jonas");
  await expect(page.getByRole("heading", { level: 1, name: "Review" })).toBeVisible();
  await expect(page.getByText(/Maja approves\./)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Approve/ })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /^Select / })).toHaveCount(0);

  await page.getByRole("button", { name: "Night Body Oil · Feed 3", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Night Body Oil · Feed 3" });
  await expect(viewer.getByRole("button", { name: /^Needs changes/ })).toBeVisible();
  await expect(viewer.getByRole("textbox", { name: "A comment" })).toBeVisible();
  await expect(viewer.getByRole("button", { name: /^Approve/ })).toHaveCount(0);
});
