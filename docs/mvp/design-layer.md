# The design layer

Statics and graphic design come before video (DECIDED 4 Nov 2026). The design layer lays the plan's words on a
picture the Engine made, in the brand's own design system, and keeps an editable file.

## Pieces

- `services/design/`: a Node service on OpenPencil 0.16. It builds the layout as design JSX from the brand's design
  book (type steps, colours, components, grid, radius), renders it with CanvasKit, and measures it in code:
  safe area, line counts, contrast of headline (3:1) and subline (4.5:1) at the 10th percentile of the pixels under
  them, bright spots, how busy the ground is, and whether words cover what must stay clear. It tries layouts (band,
  ground, align, columns, headline step, colour) until one passes, and returns a PNG and a .fig.
- The service holds no keys. It takes only a signed read link to a picture in Fume's storage and signed upload links
  for the result (`handler.ts`).
- Database (`20261105030000_design_layer.sql`): `design_layers`, staff-only. `design_candidate` (designer asks),
  `design_take` (service reads the ask, picture, planned creative, copy and design book), `design_finish` (stores the
  PNG and .fig and adds a candidate with `designed_from`), `design_fail`. Its LLM cost counts in the week's budget.

## Hosting

Marcus, 4 Nov 2026: the service goes into the existing fume-app Vercel project, not a new project.

- `services/design/tools/build.mjs` bundles Fume's code into `app/api/design.js` (built, do not edit; CI checks it is
  up to date). OpenPencil and CanvasKit are dependencies of the app, since they read their own files (the wasm, the
  default fonts) from where they are installed; `app/vercel.json` includes those files in the function.
- `POST /api/design` is left out of the preview password (`app/middleware.ts`): Fume's backend calls it, and it does
  work only with signed links to Fume's own storage. `GET /api/design` answers that it is up.

## Still open

- The `design` edge function: a vision model picks the words (verbatim from the plan), band, alignment and what must
  stay clear, calls the service, checks the result, then `design_finish`.
- The UI (owned by the design thread): "Add graphic design" on a candidate, the Look Book screens, the copy check.
