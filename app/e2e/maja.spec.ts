// Maja Lind, LYSNE's owner: the customer who approves (signed in by default, `/`).
import { expect, test } from "./fixtures";

test("every main place in Maja's sidebar opens", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/, Maja$/);

  const sidebar = page.getByRole("complementary", { name: "LYSNE in Fume" });
  const places: [place: string, heading: string | RegExp][] = [
    ["Review", "Review"],
    ["Campaigns", "Campaigns"],
    ["Deliveries", "Deliveries"],
    ["Brand", "Brand"],
    ["Home", /, Maja$/],
  ];
  for (const [place, heading] of places) {
    // a place's name can carry its count ("Review 6")
    const link = sidebar.getByRole("link", { name: new RegExp(`^${place}( \\d+)?$`) });
    await link.click();
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  }
});

test("Maja approves a creative in Review", async ({ page }) => {
  await page.goto("/review");
  const sidebar = page.getByRole("complementary", { name: "LYSNE in Fume" });
  await expect(sidebar.getByRole("link", { name: "Review 6" })).toBeVisible();

  await page.getByRole("button", { name: "Night Body Oil · Feed 3", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Night Body Oil · Feed 3" });
  await expect(viewer.getByText("Checked by Anna")).toBeVisible();
  await viewer.getByRole("button", { name: /^Approve/ }).click();

  await expect(page.getByText("Feed 3 approved")).toBeVisible();
  // the viewer moves on to the next creative that waits on her
  await expect(page.getByRole("dialog", { name: "Night Body Oil · Story 1" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(sidebar.getByRole("link", { name: "Review 5" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Night Body Oil · Feed 3", exact: true })).toHaveCount(0);
});
