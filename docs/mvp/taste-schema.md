# The taste schema: everything Fume records about a brand's pictures

Marcus, 10 Nov 2026: every brand needs "et giga schema, et smaks/brand schema, med ALT som er analysert av alle
bilder, kategorisert", large parts deterministic and other parts read by a model, a taste score that says how well
the brand's taste is trained, and an Engine that learns by test generation how to prompt for the brand's taste. This
is that schema. PROPOSED as a design; the direction is his. Nothing of it shows in the app yet, and customers never
see it.

## The parts

| Part | Where | What |
| --- | --- | --- |
| Registry | `supabase/functions/_shared/taste/schema.ts` | 349 fields in 14 groups. 77 are `measured` by code from the pixels, 272 are `read` by a vision model from closed lists of options (a few are free words). Each field says where the Engine can act on it (`lever`: plan, prompt, reference, finish, design, select) and of which pictures it can be asked (`when`). |
| Card | `card.ts`, `finish.ts`, `taste-learn/measure.ts` | One per picture: `{id, source, campaign, shows, measured, read}`. The measured half is the same number every time. |
| Reading | `read.ts`, `taste-read/` | The read half. Six questions a picture: `idea` first, which also says what the picture shows, then the passes that apply, side by side. |
| Profile | `profile.ts` `buildProfile` | The brand's cards counted field by field: the value, its shares or range, how sure, and a standing. |
| Score | `profile.ts` `tasteScore` | 0 to 100: how well Fume knows the brand's taste. |
| Fit and gap | `profile.ts` `fit`, `compare` | One picture against the profile; one set of pictures (the Engine's) against another (the brand's). |
| Proof | `profile.ts` `proofOf` | How close the Engine's pictures come to the brand's, like with like. |
| Direction | `direction.ts` | The profile said to whoever makes the next picture: lines for the plan and the prompt, numbers for the finish step. |
| Kept | `build.ts`, migration `20261110070000_taste_schema.sql` | `taste_readings` (a card per picture) and `taste_profiles` (profile, score, direction per brand). |

## Brand or campaign: the standing of a field

Counted, never guessed. A field needs five pictures before it says anything.

- **always**: the lower bound of the commonest answer's share is 60 % or more (Wilson, 90 %), or a number's middle
  four fifths take up little of the range the field can take. The Engine must follow it.
- **usually**: the commonest answer holds 60 % of the pictures, but they are too few to be sure.
- **by_campaign**: free across the brand, but every campaign with three pictures or more is consistent in itself and
  the campaigns differ. The campaign chose it, not the brand.
- **free**: the brand varies.
- **unknown**: fewer than five pictures answer the field.

From 15 pictures a choice field also lists the options the brand has never used.

## The taste score

Pictures 30 (n / (n + 40)), coverage 20 (fields answered by five pictures or more), certainty 20 (fields settled),
breadth 10 (campaigns, five for full marks), proof 20 (how close the Engine's own pictures come to the profile,
against how close the brand's own come when each is left out of the profile it is held against). Proof is the only
part that shows the knowledge works, and it is 0 until the Engine has been tested. The score says what would raise it
most.

Proof is counted like with like (`proofOf`): only the brand's pictures with a photograph in them (a card of type
alone says nothing about how the brand shoots), and only the fields a photograph carries, not the words and the logo
set on it. It waits until the brand has six such pictures. It is still too kind: many fields are the same in every
tidy advertising picture (no flash, no border), so any competent photograph fits most of a profile. What it needs is a
floor: the fit of pictures the Engine makes without knowing the brand. Never another customer's pictures.

## Direction: what the Engine is told

`direction(profile, engineProfile)` turns the profile into what the next picture is made from.

- **Lines**: one for each read field the brand keeps to (`always` or `usually`), in fixed words built from the
  registry: "Camera, depth of field: deep". A habit that something is not there is an absence ("Design: no badge").
- **Order**: how sure Fume is, times 0.7 for `usually`, times 0.5 for an absence. Once the Engine's own pictures for
  the brand were read against the schema, a field they missed weighs up to twice as much and a field they already
  keep weighs a third, and the line says what they did instead. This is how a test round teaches the next prompt.
- **Targets**: the measured numbers the brand keeps to, with the middle four fifths as the range; the finish step
  takes the ones with the lever `finish`.
- **Choices**: fields a campaign chooses. The plan takes them from the campaign, never from habit.

Who reads it:

- The plan writer (`fume-plan`, `tastePart`) gets every lever but the finish step as a `<taste_schema>` block, with
  the campaign's choices. The brief wins where it asks for something else.
- The picture prompt (`engine/context.ts` `schemaLines`) gets the twelve weightiest lines of the levers `prompt` and
  `reference` that apply to what the plan says the picture shows, at most two of them absences (long lists of what to
  avoid make image models worse). They are soft brand rules with ids `schema-<field>`, routed to the camera, people
  and scene slots by their group. The plan wins over a habit; the ledger says which lines went in and which did not.
- The picture check does not judge them. Whether a picture keeps the brand's habits is for `fit` to say.

## Reading with a vision model

- The answer shape is built from the registry, so a field added there is asked without another line of code.
- No optional and no either-or parts in the shape: a choice the model cannot make is the option `cannot_tell`, a list
  comes back empty, and both are kept as null. Only options the schema lists are kept.
- The model never names a person; it describes only what is visible.
- Two routes, so no reader is a lock-in. Claude asked of Anthropic directly answers in the shape (structured outputs).
  Any vision model asked through fal's router (`openrouter/router/vision`, the one fal key) answers in text: the JSON
  Schema is written into the question and the object is picked out of the answer. A model that takes no temperature
  or needs reasoning is asked again the way it wants. The router keeps to providers that store nothing; Qwen has none
  and is not offered.
- fal allows ten questions at a time and one picture asks five side by side, so pictures are read one after another.
- Each read is counted against the week's budget for the language model (kept as a `facts` run with
  `input.task = "taste_read"` until the taste tables are live).
- `taste-read` is for Fume's own people on a brand they work on.

## Which reader

See the bake-off below. `tools/taste/bake.ts` scores each reader on what can be checked without a person: the same
picture read twice gives the same answer (steady), its answer is the one the other readers agree on (agrees), its
reading rises with the number where code measures the same thing (measured), and what it cost.

Bake-off of 10 Nov 2026: six pictures of Nike UK (test), each read twice by each reader, 254 choice fields a picture.

| Reader | Steady | Agrees | Filled | $ a picture | s a picture |
| --- | --- | --- | --- | --- | --- |
| `sonnet-r` (Claude Sonnet, router) | 0.954 | 0.916 | 0.993 | 0.0815 | 14 |
| `gemini` | 0.938 | 0.886 | 0.986 | 0.0527 | 25 |
| `gpt-terra` | 0.923 | 0.914 | 0.972 | 0.0156 | 14 |
| `haiku-r` (Claude Haiku, router) | 0.909 | 0.776 | 0.925 | 0.0040 | 9 |
| `gemini-flash` | 0.901 | 0.918 | 0.993 | 0.0728 | 41 |
| `gpt-luna` | 0.865 | 0.832 | 0.963 | 0.0015 | 11 |

Recommended standard reader: **`gpt-terra`**. It is nearly as steady and as agreed-with as Claude Sonnet at a fifth of the
price, about 1.6 cents a picture. PROPOSED until Marcus says yes.

What this does not show:

- Six pictures of one brand is a small test. Run it again on a second brand before the choice is fixed.
- Agreement is not correctness. The real test is a human answer key on about 50 pictures.
- The measured column (rank correlation between ordinal read fields and the measured numbers) moved between -0.04 and
  0.31 and says nothing on six pictures, so it is left out of the table.
- Not tested: the direct Anthropic readers (the key was rejected that day), `gpt-sol`, `opus-r`, and `grok` (the function
  ran out of compute). Qwen is refused by the router's zero-data-retention policy.

First full read with `gpt-terra`, Nike UK (test), 10 real ads and 8 Engine pictures: taste score 49 of 100 (pictures 6 of
30, coverage 18 of 20, certainty 3 of 20, breadth 4 of 10, proof 18 of 20). Counted like with like on the six ads
with a photograph in them, the brand's own pictures fit their profile 0.76 and the Engine's 0.69. The direction it
gives has 113 lines, 64 of them for the prompt, 6 finish targets and 9 campaign choices.

## Tools

```
deno run -A tools/taste/measure.ts <manifest.json> <cards.json>            the measured half
FUME_ACCESS_TOKEN=… deno run -A tools/taste/read.ts <manifest.json> <reads.json> --workspace <id> --reader <reader>
deno run -A tools/taste/merge.ts <cards.json> <reads.json> <out cards.json> both halves on one card
deno run -A tools/taste/report.ts <cards.json> <brand set> [other set]      profile, score, gap
deno run -A tools/taste/bake.ts <cards.json> <dir with read-<reader>-<a|b>.json>
FUME_ACCESS_TOKEN=… deno run -A tools/taste/keep.ts <cards.json> --workspace <id> --brand <set> [--engine <set>]
```

`keep.ts` sends cards made on disk to `taste-read`, which keeps them as the brand's readings and counts its profile
again; no model is asked. `taste-read` with `keep` does the same for a picture it has just read.

## Kept in the database

`taste_readings` holds one card per picture (the brand's own, or one the Engine made for it); a picture read again
replaces its card, and a half that is not sent keeps what was there. `taste_profiles` holds one row per brand: the
profile, the Engine's own profile, the score and the direction, counted again by `taste-read` after every reading.
Fume's people on the brand read both; a customer never does; only the function writes them. `engine_taste(job)` and
`taste_direction_of_campaign(campaign)` hand the direction to the Engine and to the plan writer. The functions work
without the tables: until the migration is applied a reading comes back unkept and the Engine is told nothing.

## Not built yet

1. Applying the migration and deploying `taste-read`, `engine` and `fume-plan` with it (needs Marcus's go).
2. Reading a brand's pictures by itself when the customer adds them (today a tool sends them), and the Engine's own
   pictures after each round, so the direction learns without anyone running a tool.
3. The finish step: grain, black point, tint and sharpness put on the pixels by code after the picture is made,
   brought to the direction's targets.
4. Best of four with the profile as the judge (`fit`), before the expert sees a picture.
5. A floor for proof: pictures the Engine makes without knowing the brand.
6. Calibration per image model: which wording of a line moves a model, remembered per brand and model.
7. A human answer key on about 50 pictures, to settle the reader.
8. `.fig` upload: the design fields read from the file itself.
9. A picture skill per brand beside the copy skill.
10. The taste score and the profile in the app (the design thread owns the screens).
