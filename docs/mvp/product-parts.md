# The validation machine: every part checked against the real product

Del 4 (picture quality). Marcus, 6 Nov: the picture check must check the label, buttons, sleeves, fabric, finish,
shape, zip, pockets and size against the real product, not only the print. This is that machine. It helps the expert;
it never checks a picture in their place, and customers never see it.

## How it works

1. **A part map, once per product** (`product_parts`). The first time a picture of a product is checked, Claude
   Sonnet 5.5 maps the product's parts from its own photographs (up to three: detail, front, back): for a shirt the
   collar, the front buttons and how many, the cuffs, the pockets, the label, the pattern, the fabric, the hem, the
   shape. Each part has a kind (`count`, `present` or `look`), one plain sentence of how it looks, the photograph it
   shows best on and its box there. New photographs map it again. About 1.5 cents a product.
2. **Find each part on the picture** (Claude Haiku): shown, hidden (this view does not show it: no fault) or missing.
   A part said to be missing is looked for once more; only a part missing twice is called missing.
3. **Compare each part** (up to eight), crop beside crop: the part on the picture and the same part on the product's
   photograph (design service `fix-crop`). The model says how it looks, how many it shows, and whether it differs not,
   slightly or clearly. Only a clear fault counts: a different number, a missing or added part, another shape, a clearly
   different colour, another pattern (or a patch of one), another material. Fine texture, stitching and edges never
   count. The product's photograph is the truth: where the part map's words disagree with it, the photograph wins.
   A clear fault stands only when Sonnet 5.5 says so too (a second, careful opinion). Patterns, fabric and shape are
   compared by Sonnet from the start; the rest by Haiku first.
4. **Code decides.** A count is made blind (the model sees only the picture's crop, never the product's number) and
   compared by code, when the whole part shows; a different count is counted twice before it stands. From five of a
   thing, one off is not a fault (seven buttons are now and then counted six on a right picture); two off is. When
   none is counted where the part was found, the box may be off the part: it is looked for once more and counted
   there. The design
   service measures each part's colour in Lab on both crops; it is kept with the finding as evidence and flags
   nothing by itself.
5. **Findings** are kept with the print reads in `candidates.details` (`kind: "part"`, `part`, `reads` = how it
   looks on the picture, `expected` = how it looks on the product, `note`, `tones`). A wrong part flags the picture's
   product truth with its note, like a wrong label.

Packshots kept only as a link to the brand's site (Nike, Møllers) are fetched once into Fume's storage
(`<ws>/check/source-<source>.img`, read only by the function), so those products are checked too.

## A clear fault stops the check

Marcus, 6 Nov: «Stopp til eksperten avgjør». Each fault the check finds on the product (a part, or a label that reads
wrong) is a critical finding on every version made from the picture (`findings.detail` names the part, or `print:`
and the words; migration `20261106150000_product_faults_stop_check.sql`). `mark_checked` refuses a version with an
open critical finding. In Check, «Mark checked» then asks: «Fix it first», or «Accept and mark checked», which
accepts the faults with the expert's name (`resolve_finding … 'accepted'`) and checks. A fault decided once is not
raised again on that version; a new version made from a fixed picture is checked anew. Customers never see them.

## In the Studio

A wrong part shows on the picture with its name ("Front buttons differs", "Chest pocket missing"); the popover shows
the part on the creative beside the real one, with the note. "Fix with the real product" fixes just that place, with
an ask made from the note and how the part looks on the product. The fix copies the part's shape, number, colours,
pattern and material from the product's photograph, and adds no wordmark the part does not carry (the first pocket
fix copied the collar label's "Dressmann" onto the pocket). Packshots kept only as a link reach the fix too
(`20261106140000_fix_links_and_parts.sql`; before, a Nike or Møllers fix had no photograph of the product), and two
parts of one picture can be fixed at once.

## Measured (6 Nov, bench)

The bench: six deliberately wrong pictures (two front buttons removed, the chest pocket removed, a striped patch, a
band collar, the Nike swoosh drawn white, the Møllers cap drawn red) and six right ones (the Dressmann master and its
story format, two Dressmann fixes that kept the part, the Nike and Møllers pictures). They sit in bench jobs with no
creative (Dressmann `0453d361`, Nike `7704ccdc`, Møllers `d7f59ee3`), so they never show in a Studio.

| Round | Change | Errors caught | Right pictures with a part alarm |
| --- | --- | --- | --- |
| 1 | first version | 2 of 2 (two more fixes did not make their error) | every one (fabric, cuffs, collar edge) |
| 3 | only clear faults count | 4 of 6 | 0 of 6 (print reads still noisy) |
| 4 | print reads tolerate a cut crop | 4 of 6 | 1 of 6 |
| 5 | blind count; Sonnet for pattern and fabric | 6 of 6 | 4 of 6 (three from colour by code) |
| 6 | colour by code kept as evidence only | 6 of 6 | 1 of 6 (6 buttons counted of 7, not checked by eye) |
| 7 | 19 cases: a black midsole, white laces, a Swedish flag, a zip for buttons; fixes made with the real product | 10 of 10 | 7 of 9 (the map's words against the photo, Haiku's doubts, one button off) |
| 8 | the photo beats the words; Sonnet confirms a fault; one off from five is no fault; a 0 count is looked for again | 12 of 12 | 0 of 7 |
| 9 | a squat bottle added | 12 of 13 (a removed pocket's faint outline counted as a pocket) | 0 of 7 |
| 10 | a pocket or flap counted by Sonnet, only with its edges | 11 of 13 (one run stopped by the platform; one soft case) | 0 of 7 |
| 11 | a retry when a model's answer runs on; what is compared in two minutes is kept | 12 of 13 (the soft case) | 1 of 7 (the Jordan's toe, from the map's words) |
| 12 | Sonnet's second opinion judges from the photo alone, without the map's words | 12 of 13 (the soft case) | 0 of 7 |

What it learned: with the product's number in the prompt, the model counts that number (blind counting caught the two
missing buttons); Haiku does not see a striped patch in a check, Sonnet does; colour measured by code on a box a little
off the part gave only false alarms, while every real colour fault the model called itself. About 5 cents a picture
(round 12: about a dollar for 20 pictures), with everything on (the part map once per product, about 1.5 cents, comes on top).

Rounds 7 to 10 by eye: the Jordan's toe really is black at the tip with blue on top (the map's words had it the other
way); the "pocket redrawn" picture's pocket is square (Haiku saw it rounded); the master shows six of its seven
buttons (the collar button is under the collar). Two fixes the bench first counted as right were not: the pocket
fix left blurred seams in the check, and the cap fix redrew the neck without the oil. They are wrong cases now.

## Still open

- Size and shape are judged by Sonnet beside the real photo (the squat bottle is caught), not measured by code: the
  models' boxes vary by about 12 % on the same bottle, too much to measure by. Measuring needs the product cut out
  (background removal) on both pictures.
- A sleeve length could not be put on the bench: the image model keeps a sleeve it is asked to shorten.
- A run the platform stops leaves no answer. The parts compared within two minutes are now kept; a picture with no
  answer at all is not flagged, and the expert checks it by eye.
- One false call stays on wrong pictures: the Jordan's toe is flagged now and then on pictures that are wrong
  elsewhere (its part map describes the toe the wrong way round).
- The soft case: a fix that left the bottle's neck without oil is caught in two runs of five.
- The print reader still calls the Nike collar logo garbled ("AIR IORDAN"); it may well be garbled, not yet checked by
  eye.

- The surgical fix cannot remove a part (the image model keeps buttons and pockets it is asked to remove); a missing
  part it can add.
- A part larger than half the picture (the shape, the whole fabric) is fixed by drawing the picture again, not by the
  surgical fix.
