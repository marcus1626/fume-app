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
- At most three layers are designed at a time (9 Nov: fourteen at once ran the function out of memory and left the
  layers waiting). A fourth answers 503 "unavailable" and stays waiting; the caller asks again in a minute. A layer
  started more than four minutes ago and never finished is taken again on the next call. When the Studio is wired
  live, it asks again for a waiting layer when it reads it.
- The words are picked by the plan's English or Norwegian labels (Headline/Overskrift, Supporting line/Støttelinje,
  Call to action/Handlingsoppfordring/CTA). A price may be set down to 35% of its style so it stays on one line.
- First live runs from Supabase, 4 Nov: Nike (test) passed every check in about 26 s; Møllers (test) gave only the
  closest layout (the call to action sits close to the bottle cap). About $0.0015 a layer.

## On brand (4 Nov 2026)

Marcus: "Designet var ikke veldig on brand." What changed:

- **Fonts.** Every creative was set in Inter: OpenPencil's web-font providers come back empty on the server.
  `src/fonts.ts` fetches TrueType files from Google Fonts itself and takes the nearest weight a family has.
- **How the brand sets words on pictures.** The design book reads it with eyes (`brand-book/creatives.ts`) from the
  brand's own pictures and from screenshots of its site (`app/api/shot.js`): the headline's face, case, weight,
  tracking and size, the layouts it repeats, the button's look and colour, where the logo sits. The site counts as
  the brand's own graphic design. A widget's face from the stylesheets (VideoJS) gives way to what the eyes saw.
- **The logo.** The screenshots keep the SVG in the site's header (made safe), else the Brand DNA's logo picture,
  never the favicon; the book names the file (`body.logo`). The service sets it in the brand's corner or a calm one
  away from the words, light or dark for a one-colour logo, and leaves it off where the brand's layout carries none.
- **A new book is used only once it is checked and approved** (`app.brand_book_in_use`).
- **Whole words.** A word wider than its box fails the layout ("FLANELLS / KJORTER"); balancing never narrows a text
  below its longest word. A long headline or button word is set smaller than its style (not below 60%, and the
  headline stays at least a quarter bigger than the subline) so it fits whole, and the expert is told the share.
- **Room on a studio picture** (`src/room.ts`). When no layout passes and the picture's top and left edges are a smooth
  backdrop, the picture is set at 82%, then 72%, in the bottom right corner, its backdrop carried on from a softened
  copy, and the keep-clear boxes move with it. A scene is never stretched. The expert is told.
- **The price as the brand's figure** (5 Nov). A copy line labelled Price, which the plan writes only from a verified
  fact, is set under the headline in the book's `price` style (Dressmann: 200 px), fitted to its column like the
  headline, and checked for whole words, one line and contrast. Without a price style it is 1.6 times the headline.
  The figure is fitted as one line ("NÅ 199,-" never breaks after "NÅ"); the price before it ("TIDLIGERE 399,-") is
  set small under it in the label style.
- **Where the Engine left room** (5 Nov). `design_take` passes the picture's hard rule "room-for-words" (`room`); its
  bare side is the first band (top, bottom) or alignment (left, right) the search tries, before the model's eye. The
  brand's own words colour is tried before the model's. The inset for studio pictures reads the edges in sRGB, so a
  dark scene is never taken for a backdrop.
- **A time budget** (5 Nov). The search stops trying once it has a layout and 22 s have gone (40 s with the inset
  passes), and on an inset picture it tries the top band first, so a layer comes back well inside Vercel's limit.
- **The brand's own font files** (5 Nov). A TrueType or OpenType file the brand adds as a font source
  (`public.brand_font_files`) is read for the family, weight and italic its own tables hold (`brand-book/fontfile.ts`),
  copied beside the book (`<workspace>/brand/font/`) and named in `body.fonts`; the writer is told the families, and a
  typeface naming one becomes `source: "brand"`. A file no typeface names is a gap. The design function sends signed
  links; the service sets the face before any stand-in and says so in a passing check. The renderer keeps every face
  for the life of the process, so a brand's file is registered under its family plus a hash of its files, never the
  plain family: another brand's book naming the same family never gets it. The .fig file names that hashed family.

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

- The brand's own ads: a brand's site rarely shows how it sets words on an ad. Uploads of its ads come first in the
  book's pictures when the customer adds them.
- Layouts for a tall product in the middle of the frame (Møllers): the words need a smaller block or a side column.
- The UI (owned by the design thread): "Add graphic design" on a candidate, the Look Book screens, the copy check.

- Former price (9 Nov): the plan writes it as its own line ("Former price: TIDLIGERE 399,-"); the layer puts it on the
  price line, where the design sets it under the price as "Was". A bare figure is marked "Tidligere" or "Was"; a former
  price without a price is not set. It is never taken for the price itself.
- No call to action on the picture is on purpose for a brand whose own ads carry none (Møllers, Nike): it sits in the
  ad's own button.
- A long headline in a narrow brand column (Dressmann's stack beside the shirt, 9 Nov) broke a word ("MAND / AG").
  Since then the plan writer is told the brand's column (the median width of the design book's layouts that carry
  words, read through `fume_plan_extras`) and asked for a headline that fits it: under 45% of the width at most 22
  characters and no word over 8 letters, under 70% 32 and 11, else 42 and 11. Code holds it (`tooLongFor`, kind
  `too_long`): a headline over that by more than a little is written again once, as for a claim. The run's copy check
  keeps the column. Live test on Dressmann (25%): Sonnet wrote "SKJORTE HELE UKA" on the first try.
- A picture designed again (new words) or fixed (a small part redrawn) keeps the layout people saw: the newest design
  in the picture's line (up its `fixed_from`) that went into a creative or was made with a designer's ask; with
  neither, the first design. Read through `design_layout_before`; the layer's choice says `kept: true`, or
  `not_kept` with why. A designer's own ask always gets a fresh look. Live test: Dressmann kontor, its label fixed,
  kept "Hero over lower body, white" exactly as before.
- The service role has no rights on the tables (plan_versions, brand_books, design_layers). An edge function that
  needs more than its task reads it through a SECURITY DEFINER function granted only to service_role
  (20261109150000_engine_lookups.sql); a direct read fails on permissions and, caught, silently gives nothing.

