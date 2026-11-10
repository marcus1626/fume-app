// The Library (FLOWS §37, PROPOSED 10 Nov 2026): everything made, in one place, for Fume's people and the admin.
import { expect, test } from "./fixtures";

test("Anna finds the checked ads of a brand in the Library and opens one", async ({ page }) => {
  await page.goto("/studio/b/w-lysne?as=anna");
  const sidebar = page.getByRole("complementary", { name: /Fume studio/ });
  await sidebar.getByRole("link", { name: "Library" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();

  await page.getByRole("tab", { name: /^Checked/ }).click();
  await expect(page).toHaveURL(/show=checked/);
  const grid = page.getByRole("list", { name: "Creatives" });
  await expect(grid.getByRole("listitem")).toHaveCount(6);
  await expect(grid.getByText("In the Studio")).toHaveCount(0);

  await grid.getByRole("button").first().click();
  const viewer = page.getByRole("dialog");
  await expect(viewer).toBeVisible();
  await expect(viewer.getByText(/Checked · Anna/)).toBeVisible();
  await expect(viewer.getByRole("link", { name: "The campaign" })).toBeVisible();
});

test("Vera, the admin, has the Library across every brand, without the ways into Check and the Studio", async ({
  page,
}) => {
  await page.goto("/studio?as=vera");
  const sidebar = page.getByRole("complementary", { name: /Fume studio/ });
  await sidebar.getByRole("link", { name: "Library" }).click();
  await expect(page).toHaveURL(/\/studio\/library/);
  await page.getByRole("tab", { name: /^To check/ }).click();
  await page.getByRole("list", { name: "Creatives" }).getByRole("button").first().click();
  const viewer = page.getByRole("dialog");
  await expect(viewer.getByText("In check")).toBeVisible();
  await expect(viewer.getByRole("link", { name: "Open in Check" })).toHaveCount(0);
});
