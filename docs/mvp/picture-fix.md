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
     image model's own ratios so nothing is stretched (`services/design/src/fix.ts`, op `fix-crop`).
  2. Nano Banana Pro on fal redraws the crop at 2K: the crop is image 1, the product's packshots (at most three)
     follow; the prompt says what is wrong and that everything else stays as it is.
  3. The model's picture is stored in Fume's storage, and the design service sets it back (op `fix-set`): the new
     pixels inside the marked box and a little beyond, fading into the picture's own by the crop's edge. The model's
     drift in light and colour is measured on the ring around the box and taken out first.
  4. `fix_finish` adds the fixed picture. About 15 cents a fix.
- The pixel work runs in the design service, not the edge function: decoding and writing a four megapixel PNG takes
  more CPU time than an edge function has.

## Still open

- The UI (the design thread's lane): in Studio, mark a part of a candidate and say what is wrong.
- Finding the wrong label by itself: the picture check does not read small print yet.
