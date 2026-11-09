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
  1. Claude Sonnet finds up to eight places on the picture where the product shows print, the small print first (the
     words under icons, around a seal, a count, a collar label's small lines), and the same place on its photographs.
     When it finds none, Claude Haiku looks too (it finds a shirt's small collar label that Sonnet passed over). The
     places are read four at a time; one that cannot be read is left to the expert's eye, the others still count.
  2. For each, on the picture and on the photograph: a wider crop where the model finds the part again (its first box
     can be off by a label's height), then a close crop of that, enlarged to 1024 px (design service `fix-crop` with
     `read`). Read on a small crop, the model corrects garbled letters by itself.
  3. The model reads both crops, letter for letter, every word of the named part, small lines too. Code compares: the
     same letters are right; otherwise every word on the picture must be a word on the product, so one garbled word
     (HJEBNE for HJERNE, 1864 for 1854) is wrong, a footnote mark is not. The model's own verdict does not decide
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

- Live (9 Nov, the 14-ad round): the old read (three places, main words) missed garbled small print on all four
  Møllers packs. The new read caught every one: the icon words on Tran, Trankapsler and Geléfisker, "Non originale",
  the seal's year and words, "28 dagodeser", "GELE- FIGKER", and the Dressmann collar label with its small lines.
  On the Nike pictures and the right print it raised no alarm. About 7 to 25 cents a picture with the parts.
- Each place is read twice, and a third read decides when the two disagree: the real photograph's small print can be
  misread too (HUERNE for HJERNE on a fixed Tran label). A word on the picture that the product shows in another place
  is no fault (MÖLLER'S Tran on the picture, MÖLLER'S on the photograph's crop).
- The fixes (9 Nov): one fix per picture over all its wrong print made the four Møllers labels and the Dressmann
  label read right. A small box can bring in more than asked from the real photograph's crop (an extra "28 dagsdoser"
  next to "Kosttilskudd"), and a fix cannot paint that out again; a large box once drew the fish mascot twice, which a
  second fix took away.

## Still open

- Print the product's photographs do not show (a small tag on a shoe's side) is read but not compared, so a garbled
  word there is not flagged.
- Size against the scene (a pack too big for the hand) is not measured.
