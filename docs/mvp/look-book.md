# The Look Book

Marcus, 4 Nov 2026: the pictures had no taste. "Smak fra brands handler om alle detaljene, kamera, grain, lys,
komposisjon, alt." Beside its Tone of Voice and design system (brand-books.md), every brand gets a third book: its
photography, read from its own pictures.

## How it is written

- `write_brand_book(ws, 'look')` starts it; the `brand-book` function writes it (`brand-book/look.ts`).
- Pictures: the brand's Brand DNA imagery, the pictures its people liked or turned down (`brand_look_pictures`), and the
  large pictures on its home page and three more pages (`pageImages`, which also reads image links kept in a shop's
  script data). At most twelve; at least two, or the writing fails with why.
- Claude Sonnet 5.5 looks at the pictures in two parts (about $0.15 to $0.17 a book) and writes camera (capture, lenses
  in mm, aperture, height, distance, motion), light (key, quality, direction, kelvin, contrast, time of day), colour
  (grade, saturation, blacks, highlights, white balance, palette), texture (grain, sharpness, surfaces, lens
  character), composition, styling, people, retouching, what it never does, and recipes per kind of scene.
- Evidence may only name pictures the model was shown. `brand_book_finish` refuses a look without camera, light,
  colour, texture and never.
- An expert checks it, the customer approves it, as for the other books.

## How the Engine uses it

- `engine_look(job)` gives the prompt writer the look in use (approved, else checked, else newest draft), without its
  sources, gaps and evidence.
- `lookRules` (context.ts) turns it into soft rules: the recipe closest to the planned scene, camera, light, grade,
  texture, and the brand's taste ("never", minus the marks of generated pictures). Skin is a hard rule when the plan
  shows people.
- The campaign still grammar v2 has a `camera` slot. Look rules go there. Lint refuses a camera slot without a focal
  length (85 mm), an aperture (f/8), a colour temperature (5200 K) and grain, and refuses empty quality words
  (stunning, cinematic, 8k, hyperrealistic and so on). Findings send the prompt back to be written again.
- The marks of a generated picture (plastic skin, light with no source, glow, everything sharp) are not listed in the
  prompt, since long lists of what to avoid make image models worse. The picture check (evaluate.ts) looks for them.

## First test, 4 Nov 2026 (test brands, internal)

Nike (test) and Møllers (test), same plan before and after:
`/mnt/project-files/engine-test/2026-11-04/look-book/`. Better light, lens and grade; still open: highlight banding on
white cloth, small label text, and lamp bloom.

## Room for the words (5 Nov 2026)

Dressmann, 4 Nov: the plan's scene said "Left side of the frame kept clear for the headline", and the composer also
wrote "The shirt is the whole picture"; the image model filled the frame, and the design layer had to inset it.

- `wordsRoom` and `roomRules` (context.ts): a planned creative with words gets a hard composition rule in the scene
  slot. The side comes from the plan's scene when it names one, else from the brand's first layout that sets words
  on the photograph (`public.engine_words_room`, the design system in use). The share is the layout's words width
  plus a margin (38 to 50% across, 40% for a top or bottom band, which holds a two-line headline, a line under it and the logo). The rule says where the product sits, how much
  bare ground is left, and that the product never fills the frame. A correction of a picked version keeps its frame.
- The composer is told to write the product's place and size where such a rule exists, never "the whole picture".
- The Look Book's own composition notes (subject placement, negative space) are a soft rule in the scene slot.
