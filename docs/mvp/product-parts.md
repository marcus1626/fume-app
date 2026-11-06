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
   count. A clear fault is asked twice before it stands.
4. **Code decides.** A count is compared by code (the product's number against what the picture shows, when the whole
   part shows). The design service measures each part's colour in Lab on both crops; a colour far off (another hue, or a
   light part drawn without colour where the product has a strong one) counts when the model saw a difference too.
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

See the bench results below. The bench: deliberately wrong pictures (two buttons removed, the pocket removed, a striped
patch, a band collar, the Nike swoosh drawn white, the Møllers cap drawn red) and the right ones (the Dressmann master
and its formats, the Nike and Møllers pictures).

## Still open

- The surgical fix cannot remove a part (the image model keeps buttons and pockets it is asked to remove); a missing
  part it can add.
- A part larger than half the picture (the shape, the whole fabric) is fixed by drawing the picture again, not by the
  surgical fix.
