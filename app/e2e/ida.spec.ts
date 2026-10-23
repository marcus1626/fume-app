// Ida Strand, a viewer at LYSNE (`?as=ida`): she sees, never acts.
import { expect, test } from "./fixtures";

test("Ida sees a creative in Review and cannot answer it", async ({ page }) => {
  await page.goto("/review?as=ida");
  await expect(page.getByRole("heading", { level: 1, name: "Review" })).toBeVisible();
  await expect(page.getByText(/Maja approves these\./)).toBeVisible();

  await page.getByRole("button", { name: "Night Body Oil · Feed 3", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Night Body Oil · Feed 3" });
  await expect(viewer.getByRole("heading", { name: "Comments" })).toBeVisible();
  await expect(viewer.getByRole("button", { name: /^Approve/ })).toHaveCount(0);
  await expect(viewer.getByRole("button", { name: /^Needs changes/ })).toHaveCount(0);
  await expect(viewer.getByRole("textbox")).toHaveCount(0);
});
