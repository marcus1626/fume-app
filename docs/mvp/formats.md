# Formats from the master (Part 4)

A format (square 1:1, story 9:16, banner 16:9) is made from the master's approved picture, so the product stays the
product the customer approved. FLOWS §16 (Make formats) shows it on the master's strip; each format is its own
creative and goes to the expert's check like any other picture.

## How it is made

1. The designer presses Make formats on an approved master. The app opens each format's creative (`open_creative`)
   and asks for it (`make_format`, designers only). The make is staff-only (`format_makes`); the job is a manual-mode
   job, so the Engine never draws a new picture for it.
2. The edge function `format` takes it (`format_take`): the master's picture, under its words when it was designed
   (the format gets its own words, laid for its own shape).
3. Unless the designer chose, Claude Haiku says where the product is (one box around all that must stay whole).
4. The design service (`op: "format"`) chooses:
   - **Crop** when the product fits the new shape with 4 % air on each side (in a story, clear of the platform's top
     250 px and bottom 340 px of 1920) and the crop keeps at least 60 % of the master. The crop is the master's own pixels. No image model, no cost but the product's place (about 0.1 c).
   - **Expand** otherwise (or when the product's place is not known, so nothing is cut). The master is put on a canvas
     of the new shape at its own scale, the new parts plain grey. Nano Banana Pro (fal, 2K, about 15 c) draws only the
     new edges. `format-set` brings the drawing to the canvas, moves its colour to the master's (median difference), and
     sets every pixel of the master back, with a 48 px soft seam only along the edges that meet a new part.
5. `format_finish` adds the result as a candidate of the format's job, with how and why. The tile shows the method,
   the Engine's choice and why; the designer can switch crop and expand, or drag the crop window, and the format is
   made again (`setFormatTile` → `make_format` with the method and window).

Costs count in the Engine's week (pictures) and the language model's week. A failed make says why on the tile.

## Files

- `supabase/migrations/20261105160000_format_make.sql`, test `supabase/tests/9zd_format_make.sql`
- `supabase/functions/format/` (handler, models, tests)
- `services/design/src/format.ts`, ops in `services/design/src/handler.ts`, tests `services/design/test/format.test.ts`
- `app/src/api/live/production.ts` (`makeFormat`, the tiles), `app/src/api/live/studio.ts` (`setFormatTile`)

## Live test (5 Nov 2026, Dressmann)

Master: the fixed shirt picture, designed, checked by a second person and approved by the test owner. Square: cropped
in 9 s for 0.07 c. Story: the first rule cropped it with the shirt under the platform's top and bottom; with the safe
areas the Engine extended it instead, in 49 s for 15 c, with no visible seam. Pictures in
/mnt/project-files/engine-test/2026-11-05/formats/.
