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
  protection closes to server calls (401), so a live run needs either a protection bypass or the merge.

## Designed, not wired yet (FLOWS §33)

The Studio and Check screens run on the mock. Wiring them to the backend above:

- `RenderVersion.design` (`VersionDesign`) is a row of `design_layers`: `state` (designing, made, failed), `ask`,
  `book_version` with the book's state, `words`, `layout`, `checks`, `findings` with the review's verdict,
  `document_file_id`, `error`, `llm_usd`, `requested_by`. Code's own finding ("No layout passed every check; this is
  the closest one.") comes with `by: "code"`.
- `designAsk(documentId, versionId)` reads, without writing: the plan's approved words for the creative (as
  `wordsOf` in `layer.ts`), `brand_book_in_use` for the design book, and whether a layer is designing on that
  picture. `blocked` is the reason it cannot be asked: no finished picture, no design book, no headline.
- `designVersion(documentId, versionId, ask?)` calls `design_candidate`, then the `design` function with
  `{layerId}`, and answers at once. A designing layer is a version in state `rendering` with `design.state`
  `designing`; the candidate `design_finish` adds (`designed_from`) is the made version, picked. `design_fail` is a
  failed version with `design.error`.
- `design.document.url` is a signed link to `document_file_id`, made when the version is read.
- `RenderVersion.drawn` and `QaItem.drawn` are the demo's way to draw the words over the photograph; live, the
  version's picture is the designed PNG and `drawn` is left out.
- `QaItem.design` is the layer of the version in check, for Fume's people only (`is_staff`, as the table's RLS).

## Still open

- A live run from Supabase (see above).
- The UI (owned by the design thread): "Add graphic design" on a candidate, the Look Book screens, the copy check.
