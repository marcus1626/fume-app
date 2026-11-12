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

// The brand's own pictures (FLOWS §38, PROPOSED 12 Nov 2026)
test("Anna checks the picks of LYSNE's own shoot and puts them into a campaign", async ({ page }) => {
  await page.goto("/studio/b/w-lysne/library?as=anna");
  await page.getByRole("tab", { name: /^Uploaded/ }).click();
  await expect(page).toHaveURL(/from=uploaded/);
  await page.getByRole("link", { name: /^Autumn studio day/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Autumn studio day" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /^Picks/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("list", { name: "Pictures" }).getByRole("listitem")).toHaveCount(8);

  await page.getByRole("tab", { name: /^Left out/ }).click();
  await expect(page.getByText("Soft: out of focus beside the rest of the shoot.")).toBeVisible();

  await page.getByRole("button", { name: "Check the 8 picks" }).click();
  await expect(page.getByText("8 picks checked by Anna")).toBeVisible();

  await page.getByRole("button", { name: "Use in a campaign" }).click();
  const panel = page.getByRole("dialog", { name: "Use in a campaign" });
  await panel.getByRole("combobox").click();
  await page.getByRole("option", { name: "Winter gifting" }).click();
  await panel.getByRole("button", { name: "Make 8 creatives" }).click();
  await expect(page).toHaveURL(/\/studio\/doc\//);
  await expect(page.getByText(/LYSNE's own photograph/).first()).toBeVisible();
});

test("Maja has a Library of her own: what she approved, and her pictures with the picks once an expert checked them", async ({
  page,
}) => {
  await page.goto("/?as=maja");
  await page.getByRole("complementary", { name: "LYSNE in Fume" }).getByRole("link", { name: "Library" }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole("tab", { name: /^Made by Fume/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: /^Uploaded/ }).click();
  await expect(page.getByRole("button", { name: "Upload a shoot" })).toBeVisible();

  await page.getByRole("link", { name: /^Autumn studio day/ }).click();
  await expect(page.getByText("Fume is choosing the best.", { exact: false })).toBeVisible();
  await expect(page.getByRole("tab", { name: /^Picks/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Check the/ })).toHaveCount(0);

  await page.goto("/library/shoots/sh-spring");
  await expect(page.getByText("6 picks checked by Anna", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use in a campaign" })).toHaveCount(0);
});
