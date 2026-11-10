# The surgical fix

Del 4 (picture quality). Marcus, 5 Nov 2026: «"Dresemann" blir en bra test på surgical fixes når vi kommer dit, den
delen i studio der du kan trykke på tekstdelen og regenerere med referanse og riktig tekst.»

A designer marks a part of a picture the Engine made (the label that reads "Dresemann") and says what is wrong. Only
that part is redrawn, with the product's own photographs as reference; every other pixel stays as it was. The result
is a new candidate of the same job: the designer takes it as a version, the expert checks it, only the customer
approves it. Customers never see a fix.

## Pieces

- Database (`20261105100000_picture_fix.sql`): `picture_fixes`, staff-only. `fix_candidate(candidate, box, ask)`
  (designer; the box is shares of the picture, at least 2% a side and at most half the picture: a bigger change is a
  new Render), `fix_take`, `fix_finish` (adds the candidate with `fixed_from`), `fix_fail`. On a designed candidate
  the picture under the words is fixed. The cost counts in the Engine's week (`app.engine_spent_usd`).
- The edge function `fix` (`supabase/functions/fix`): the app calls it with `{fixId}` after `fix_candidate`.
  1. The design service crops the marked part with room around it (40% of its size, at least 384 px), in one of the
     image model's own ratios so nothing is stretched (`services/design/src/fix.ts`, op `fix-crop`). The marked part
     itself is blanked to its own plain colour: the first live test (5 Nov) showed that the image model keeps wrong
     letters it can see, even with the right ones beside it.
  2. Claude Haiku finds the same part on the product's own photographs (`fix/locate.ts`), and finds it again on its own
     close crop for a tight box; the design service crops it close (`<fix>-ref.png`). A woven label is about 60 px on
     a whole packshot, too small for the image model to read. Under a tenth of a cent; it counts in the language
     model's week (`picture_fixes.llm_usd`, `reference` keeps where it was found).
  3. Nano Banana Pro on fal redraws the crop at 2K: the crop is image 1, the close part is image 2, the product's
     packshots (at most three) follow; the prompt says what is wrong and that everything else stays as it is.
  4. The model's picture is stored in Fume's storage, and the design service sets it back (op `fix-set`): the new
     pixels inside the marked box and a little beyond, fading into the picture's own by the crop's edge. The model's
     drift in light and colour is measured on the ring around the box and taken out first.
  5. `fix_finish` adds the fixed picture. About 15 cents a fix.
- The parts of a fix (`-crop`, `-ref`, `-redrawn`) are staff-only reads (`20261105130000_fix_parts_read.sql`), so a
  designer sees what Fume copied from.
- The pixel work runs in the design service, not the edge function: decoding and writing a four megapixel PNG takes
  more CPU time than an edge function has.

## Still open

- The Studio (FLOWS §17, `features/studio/doc/fix.tsx`, the design thread's screen) is live: "Brush a fix" calls `fixProduct`, which runs `fix_candidate` and `fix` and waits for the fix; the fixed picture comes back as the picked version (`api/live/studio.ts`). A detail token needs its region marked by the live picture check first, so for now the designer brushes it. Still open: the design thread's screens for a failed fix and for the `-ref.png` beside the result.
- Finding the wrong label by itself: the picture check does not read small print yet.
