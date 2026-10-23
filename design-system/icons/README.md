# Fume icons

Status: filled Lucide DECIDED (Marcus, 13 Oct 2026). The set and the checked triangle were approved on the review board (round 4); the Engine icon for AI is DECIDED. New icons are PROPOSED until approved.

Generated files, do not edit by hand:

| File | Use |
|---|---|
| `sprite.svg` | Every icon as `<symbol id="fi-<name>">`. Put it once in the page, then `<svg class="ico"><use href="#fi-<name>"/></svg>`. |
| `svg/<name>.svg` | One file per icon, 24 × 24, `currentColor`. |
| `icons.json` | Manifest: name, Lucide source, kind, status, note. |

Source: `tools/icons/icons.mjs`. Build: `node tools/icons/build.mjs`. CI fails when the generated files are out of date.

## Rules

- Icons are **filled**, never Lucide's stroke-only look. One colour, `currentColor`, so an icon takes the colour of its text.
- Sizes: 14, 16 or 18 px in UI (`--ui-size-icon-sm`, `--ui-size-icon`, `--ui-size-icon-lg`), 24 px for display; line-only icons at `--ui-size-icon-stroke` (2.25). Rule `icons-lucide`.
- Icons that are only lines (check, plus, x, arrows, search, refresh, spinner) stay lines at 2.25 px, a little heavier than Lucide's 2, so they carry the same weight as the filled ones.
- No sparkles, stars or wands for AI. Fume's AI icon is its own drawing (see below).
- Amber is only for the checked triangle on checked work. Every other icon follows its text colour.

## How a Lucide icon becomes a Fume icon

Lucide paths are copied exactly from [lucide-icons/lucide](https://github.com/lucide-icons/lucide) (ISC licence), so the footprint matches Lucide. Each element has a role:

| Role | What it does |
|---|---|
| `fill` | A closed Lucide shape, filled, with a 2 px round-joined stroke in the same colour so the outline keeps Lucide's size and soft corners. |
| `cut` / `cutline` | An inner detail (eye pupil, door, image sun, trash slots) knocked out of the fill with a mask, so the icon stays one colour and works on any background. |
| `line` | A line kept as a line, at 2.25 px. |
| `solid` | Exact filled geometry with no stroke: dots and Fume's own shapes. |

`body` elements are masked by `cuts`; `top` elements are drawn after the mask (for example the download arrow over its tray).

## Fume's own icons

Drawn on Lucide's 24 px grid from the brand geometry in `tools/canvas/tools/geo.py`.

- `fume-check`: the checked triangle. The Focus point at the logo angle, the mark a designer leaves when they have checked a creative. Two states: **Amber** (`--ui-check`) when an expert has checked the work, **grey** (`--ui-check-waiting`) while it is in check. Always beside a label.
- `fume-engine`: AI and the Engine (DECIDED 13 Oct). The focus frame's two corners with the focal point in the middle: the Engine finds the focus. Never stars or sparkles.

## Adding an icon

1. Find the Lucide icon and copy its elements into `tools/icons/icons.mjs` with `from: "<lucide name>"`.
2. Give each element a role: closed shapes `fill`, inner details `cuts`, lines `line`.
3. Set `status: "PROPOSED"` until it is approved. Run `node tools/icons/build.mjs`, open `svg/<name>.svg` at 16 and 24 px, and check it reads at 16.
4. Commit the source and the generated files together.
