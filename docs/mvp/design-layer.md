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

## The `design` edge function

- The app calls it with `{layerId}` after `design_candidate`; the caller's own token must see the layer (staff only).
- The words are the plan's approved headline, supporting line and call to action, picked by code, word for word.
- Claude Haiku 5.5 looks at the picture and says what must stay clear (the product, bright lights, faces, the label)
  and which band, alignment and colour role fit. That is a help, not a gate: without it the service still searches.
- The service lays it out and stores the PNG and .fig through signed upload links. Haiku then reviews the result as a
  designer (findings, staff only), and `design_finish` adds the candidate. About $0.002 a layer.
- `DESIGN_URL` points at the service. Until PR #2 is merged it is this branch's preview, which Vercel's deployment
  protection closes to server calls. The function sends Vercel's automation bypass (`VERCEL_BYPASS_SECRET`, Marcus
  chose this 4 Nov); it is harmless once the service runs in production.
- A 500 or 504 from the service is tried once more; a refusal is not.
- First live runs from Supabase, 4 Nov: Nike (test) passed every check in about 26 s; Møllers (test) gave only the
  closest layout (the call to action sits close to the bottle cap). About $0.0015 a layer.

## Still open

- Layouts for a tall product in the middle of the frame (Møllers): none passes yet; the words need a smaller block
  or a side column.
- Nike's design book still has the scan's old fonts until Nike is scanned again.
- The UI (owned by the design thread): "Add graphic design" on a candidate, the Look Book screens, the copy check.
