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
   count. A clear fault is asked twice before it stands. Patterns, fabric and shape are compared by Sonnet 5.5; the
   rest by Haiku.
4. **Code decides.** A count is made blind (the model sees only the picture's crop, never the product's number) and
   compared by code, when the whole part shows; a different count is counted twice before it stands. The design
   service measures each part's colour in Lab on both crops; it is kept with the finding as evidence and flags
   nothing by itself.
5. **Findings** are kept with the print reads in `candidates.details` (`kind: "part"`, `part`, `reads` = how it
   looks on the picture, `expected` = how it looks on the product, `note`, `tones`). A wrong part flags the picture's
   product truth with its note, like a wrong label.

Packshots kept only as a link to the brand's site (Nike, Møllers) are fetched once into Fume's storage
(`<ws>/check/source-<source>.img`, read only by the function), so those products are checked too.

## In the Studio

A wrong part shows on the picture with its name ("Front buttons differs", "Chest pocket missing"); the popover shows
the part on the creative beside the real one, with the note. "Fix with the real product" fixes just that place, with
an ask made from the note and how the part looks on the product.

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

What it learned: with the product's number in the prompt, the model counts that number (blind counting caught the two
missing buttons); Haiku does not see a striped patch in a check, Sonnet does; colour measured by code on a box a little
off the part gave only false alarms, while every real colour fault the model called itself. About 4 to 9 cents a
picture with everything on (the part map once per product, about 1.5 cents, comes on top).

## Still open

- Two rounds in a row at 6 of 6 is a start, not proof: the bench should grow (a zip, a sleeve length, a shoe's eyelets,
  a size) and run again before Part 4 is called done.
- The print reader still calls the Nike collar logo garbled ("AIR IORDAN"); it may well be garbled, not yet checked by
  eye.

- The surgical fix cannot remove a part (the image model keeps buttons and pockets it is asked to remove); a missing
  part it can add.
- A part larger than half the picture (the shape, the whole fabric) is fixed by drawing the picture again, not by the
  surgical fix.
