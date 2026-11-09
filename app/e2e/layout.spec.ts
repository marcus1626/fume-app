// Nothing leaves its card (round 16, PROPOSED 9 Nov 2026). Marcus, on the round 15 walkthrough: "the button comes
// outside the padding", the chosen "Goes to the Engine" pill in a Check comment. A test now looks for every control
// (a button, a link, a field, a tab) whose box goes past the nearest ancestor that draws a surface (a background, a
// border or a shadow), on the busiest screens at the desktop size the app is made for. A control scrolled out of view
// in its own scroller is left out: only what shows counts.
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

test.use({ viewport: { width: 1440, height: 900 } });

/** Controls that stick out of their card, as "name [element] in [card]". */
async function outside(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    const surfaced = (el: Element) => {
      const cs = getComputedStyle(el);
      const bg = cs.backgroundColor;
      const hasBg = Boolean(bg) && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg);
      const hasBorder = (["Top", "Right", "Bottom", "Left"] as const).some(
        (s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== "none",
      );
      return hasBg || hasBorder || cs.boxShadow !== "none";
    };
    const name = (el: Element) =>
      (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
    const tag = (el: Element) =>
      el.tagName.toLowerCase() +
      (typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/)[0]}` : "");
    const controls = document.querySelectorAll(
      "button, a[href], [role=button], input:not([type=hidden]), select, textarea, [role=tab]",
    );
    for (const el of controls) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width < 2 || r.height < 2 || cs.visibility === "hidden" || cs.opacity === "0") continue;
      // What a scroller on the way up clips away does not show
      let clip = { l: 0, t: 0, r: innerWidth, b: innerHeight };
      for (let c = el.parentElement; c && c !== document.body; c = c.parentElement) {
        const ccs = getComputedStyle(c);
        if (/(auto|scroll|hidden|clip)/.test(ccs.overflowX + ccs.overflowY)) {
          const cr = c.getBoundingClientRect();
          clip = {
            l: Math.max(clip.l, cr.left),
            t: Math.max(clip.t, cr.top),
            r: Math.min(clip.r, cr.right),
            b: Math.min(clip.b, cr.bottom),
          };
        }
      }
      if (r.bottom <= clip.t + 1 || r.top >= clip.b - 1 || r.right <= clip.l + 1 || r.left >= clip.r - 1) continue;
      const partly = r.top < clip.t - 1 || r.bottom > clip.b + 1;
      let up: Element | null = el.parentElement;
      while (up && up !== document.body) {
        const a: Element = up;
        up = a.parentElement;
        if (!surfaced(a)) continue;
        const ar = a.getBoundingClientRect();
        if (ar.width >= innerWidth - 4 && ar.height >= innerHeight - 4) break; // the page itself
        const scrolls = /(auto|scroll)/.test(getComputedStyle(a).overflowY + getComputedStyle(a).overflowX);
        const past = [
          ar.left - r.left,
          r.right - ar.right,
          scrolls || partly ? 0 : ar.top - r.top,
          scrolls || partly ? 0 : r.bottom - ar.bottom,
        ];
        if (past.some((v) => v > 0.75)) found.push(`${name(el)} [${tag(el)}] in [${tag(a)}]`);
        break;
      }
    }
    return found;
  });
}

const screens: [name: string, path: string, then?: (page: Page) => Promise<void>][] = [
  [
    "Check, an Engine comment answered",
    "/studio/qa?as=anna&kind=images&item=qa-7",
    async (page) => {
      await page
        .getByRole("button", { name: /Fix with the Engine/ })
        .first()
        .click();
    },
  ],
  ["Check, designs", "/studio/qa?as=anna&kind=designs"],
  ["Check, video", "/studio/qa?as=anna&kind=video"],
  ["the Studio, picture", "/studio/doc/doc-autumn-m3?as=anna"],
  [
    "the Studio, design",
    "/studio/doc/doc-autumn-m3?as=anna",
    async (page) => {
      await page.getByRole("tab", { name: "Design", exact: true }).click();
    },
  ],
  ["the Studio, video", "/studio/doc/doc-night-ritual?as=anna"],
  ["a plan", "/studio/b/w-lysne/campaigns/c-winter/plan?as=anna"],
  [
    "a plan, with the Engine open",
    "/studio/b/w-lysne/campaigns/c-winter/plan?as=anna",
    async (page) => {
      await page.getByRole("button", { name: "Tell the Engine" }).click();
      await expect(page.getByRole("complementary", { name: "Engine" })).toBeVisible();
    },
  ],
  ["the brand books", "/studio/b/w-lysne/brand?as=anna"],
];

for (const [name, path, then] of screens)
  test(`nothing leaves its card: ${name}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await then?.(page);
    // Let what opens settle (a panel sliding in, a comment's buttons)
    await page.waitForTimeout(600);
    expect(await outside(page)).toEqual([]);
  });
