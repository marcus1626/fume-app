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
- **The brand's own font files** (5 Nov). A TrueType or OpenType file the brand adds as a font source
  (`public.brand_font_files`) is read for the family, weight and italic its own tables hold (`brand-book/fontfile.ts`),
  copied beside the book (`<workspace>/brand/font/`) and named in `body.fonts`; the writer is told the families, and a
  typeface naming one becomes `source: "brand"`. A file no typeface names is a gap. The design function sends signed
  links; the service sets the face before any stand-in and says so in a passing check. The renderer keeps every face
  for the life of the process, so a brand's file is registered under its family plus a hash of its files, never the
  plain family: another brand's book naming the same family never gets it. The .fig file names that hashed family.

## Still open

- The brand's own ads: a brand's site rarely shows how it sets words on an ad. Uploads of its ads come first in the
  book's pictures when the customer adds them.
- Layouts for a tall product in the middle of the frame (Møllers): the words need a smaller block or a side column.
- The UI (owned by the design thread): "Add graphic design" on a candidate, the Look Book screens, the copy check.
