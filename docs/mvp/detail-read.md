# The picture check reads the small print

Del 4 (picture quality). The picture check reads the product's own print (a woven label, a wordmark, a number on the
pack) closer than it can on the whole picture, against the product's own photographs. A label that reads wrong flags
the picture's product truth with a note a designer can act on ("The collar label reads Dressmeann; on the product it
reads Dressmann."), and its place on the picture is where the designer fixes it with the real product
(docs/mvp/picture-fix.md). It helps the expert; it never checks a picture in their place. Customers never see it.

## Pieces

- Database (`20261105140000_detail_read.sql`, `20261105150000_detail_read_again.sql`): `candidates.details`,
  `details_usd`, `details_at`; `details_take` and `details_finish` (service role). A wrong detail sets the
  evaluation's `productTruth` to `flag` and adds its note; a read again replaces the notes the last one added. The cost
  counts in the language model's week. The crops (`<ws>/check/<candidate>-<n>.png`, `-<n>-ref.png`) are staff-only.
- The edge function `details` (`supabase/functions/details`): the Engine asks it after it evaluates a picture made
  with the product's photographs; staff can ask it too, with `{candidateId}`.
  1. Claude Haiku finds up to three places on the picture where the product shows print, and the same place on its
     photographs.
  2. For each, on the picture and on the photograph: a wider crop where the model finds the part again (its first box
     can be off by a label's height), then a close crop of that, enlarged to 1024 px (design service `fix-crop` with
     `read`). Read on a small crop, the model corrects garbled letters by itself.
  3. The model reads both crops, letter for letter. Code compares the letters: the model's own verdict does not decide
     when it read the letters on both. The model tends to read a garbled word as the word it should be, never the other
     way, so a read that finds the letters right is read once more, and a mismatch in either stands.
- Live (5 Nov, Dressmann): three rounds on the garbled label ("DRESSMEANN") and the fixed one, all six right; one read
  alone missed the garbled label once in two. About a quarter of a cent a picture.

## In the Studio

- A version carries what was read (`RenderVersion.details`, one per place, id `<candidate>:<n>`), and `detailTokens`
  answers the real product's cut-out for each (`-<n>-ref.png`). The Studio's details overlay (FLOWS §17) shows a wrong
  one; "Fix with the real product" fixes its place with an ask made from what it reads and should read
  (`api/live/studio.ts`). The place kept is the one found again on the close crop, grown to the least a fix takes.
- A fixed picture is read again by itself (the `fix` function asks `details`), so the designer sees whether the fix
  holds. Live (5 Nov, Dressmann): found "DRESSMEANN", fixed, and read again as "Dressmann", without anyone marking it.

## Still open

- The small lines on a label (above and below the wordmark) are not compared, only the main word.
