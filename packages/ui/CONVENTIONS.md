# @fume/ui: how the React components are written

Status: PROPOSED (14 Oct 2026). `@fume/ui` is the React layer over the DECIDED design system (`design-system/`, v1,
F-D075): shadcn's way of working (Radix primitives for behaviour, our own markup and classes for the look), with
Fume's CSS. ROADMAP §2 named it `packages/ui`.

## The one rule
**The look lives only in `design-system/`.** A component in `packages/ui` renders the exact markup and classes that
the component's CSS header documents (`design-system/components/<name>.css`) and that the review board shows
(`review/sections/*.html`). It adds no CSS, no inline colours, sizes, radii or shadows, no Tailwind. If a look is
missing, the fix is in `design-system/` (a token, a class), never here. Inline `style` is allowed only for values a
script computes at run time that the CSS reads as custom properties (`--x`, `--w`, `--value`, aspect ratios).

## Code
- React 18.3, TypeScript strict, function components. `forwardRef` on anything that renders a focusable DOM element
  or that Radix `asChild` may wrap. Every component accepts `className` (merged with `cx()` from `./cx`) and passes
  the rest of the native props (`...props`) to its root element.
- Behaviour: Radix primitives where shadcn uses them (`@radix-ui/react-dialog` for dialog, alert dialog, sheet and
  the viewer; `react-dropdown-menu` for menus; `react-popover`; `react-tooltip`; `react-checkbox`; `react-switch`;
  `react-radio-group`; `react-select` where the select needs a listbox). Radix sets `data-state="open|closed"` and
  `data-state="checked|unchecked"`, which the CSS already reads; where the CSS expects another attribute, set it.
  The design system's own vanilla scripts (`*.js`) are the reference for behaviour that Radix lacks (the sliding
  indicator of tabs and segmented controls: place `--x` and `--w` on `.ui-seg-indicator` from the selected option,
  with `is-placing` / `is-ready` as `segmented.js` does). Re-implement it in React; never call the vanilla scripts.
- Keep every ARIA role, label, keyboard behaviour and focus return the CSS header or the vanilla script describes.
  Icon-only buttons need `aria-label`.
- Icons: `<Icon name="chevron-left" />` renders `<svg class="ico" aria-hidden="true"><use href="#fi-chevron-left"/></svg>`.
  Names are the sprite's (`design-system/icons/icons.json`), typed as `IconName`. `<IconSprite />` puts the sprite
  in the page once (imported with Vite's `?raw`).
- Words: components take their words as props or children; defaults, when needed, follow Verbal Identity: "creative",
  never "file"; the expert's state reads "In check" and "Checked by Anna"; "Approve" is only the customer's.
  No exclamation marks, no emoji.
- Exports: each family has its own `index.ts`; `src/index.ts` re-exports them all. Name components after shadcn where
  shadcn has one (`Button`, `Badge`, `Dialog`, `DialogContent`, `DropdownMenu`, …) and after the CSS where it is
  Fume's own (`CreativeTile`, `CheckMark`, `EngineRun`, `Composer`, `QualityGateReview`, …).
- Document each component with a short comment: what it is, which CSS file, and its props when not obvious.
- Each family writes `API.md` in its folder: one line per export with its props, so screens can be written from it.

## Files
```
packages/ui/
  package.json, tsconfig.json
  src/
    index.ts           re-exports every family
    cx.ts              class name helper
    styles.ts          imports the design system CSS in order (tokens, ui.css, base, every component)
    icons/             Icon, IconSprite, IconName
    controls/          button, badge, kbd, spinner, progress, skeleton, shimmer, avatar, separator, field, input group,
                       select, checkbox, radio, switch, toggle, segmented, tabs
    overlays/          dialog, alert dialog, sheet, popover, tooltip, dropdown menu, command, toast
    content/           card, item, alert, empty, data list, accordion, creative tile and check mark, sidebar,
                       breadcrumb, page header, table, stat, chart, filter bar, action bar, stepper, settings layout
    fume/              message, bubble, message scroller, composer, attachment, marker, engine run, dropzone,
                       quality gate review, viewer, notifications, share dialog, onboarding
```
