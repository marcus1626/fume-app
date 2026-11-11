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
| Card | `card.ts`, `finish.ts`, `taste-learn/measure.ts` | One per picture: `{id, source, campaign, shows, measured, read}`. The measured half is the same number every time. Grain and sharpness are read at one viewing size (see below). |
| Reading | `read.ts`, `taste-read/` | The read half. Six questions a picture: `idea` first, which also says what the picture shows, then the passes that apply, side by side. |
| Profile | `profile.ts` `buildProfile` | The brand's cards counted field by field: the value, its shares or range, how sure, and a standing. |
| Score | `profile.ts` `tasteScore` | 0 to 100: how well Fume knows the brand's taste. |
| Fit and gap | `profile.ts` `fit`, `compare` | One picture against the profile; one set of pictures (the Engine's) against another (the brand's). |
| Proof | `profile.ts` `proofOf` | How close the Engine's pictures come to the brand's, like with like. |
| Direction | `direction.ts` | The profile said to whoever makes the next picture: lines for the plan and the prompt, numbers for the finish step. |
| Kept | `build.ts`, migration `20261110070000_taste_schema.sql` | `taste_readings` (a card per picture) and `taste_profiles` (profile, score, direction per brand). |

### Measured at one viewing size

Grain and sharpness are numbers per pixel, so they depend on the size a picture was delivered at: the same photograph
at 18 megapixels and at 4 measures as two different finishes. `finish.ts` therefore brings every picture to 1536 px on
its long side before it reads them (`resizeTo`, each new pixel the mean of the area it covers; a picture is never made
larger). A picture delivered under 1000 px on its long side (a screenshot of an ad in a feed) has no finish to read:
its grain and sharpness are left unmeasured (-1), and a profile leaves them out. Compression is read from the file as
it was delivered.

A card with no photograph in it (type alone, a drawing) has no finish of a photograph either: its black point and its
grain are a designer's flat colours. Where the cards were read, `build.ts` `finishOfPhotographs` leaves the
finish-lever numbers of such a card out of the profile, so the finish targets say how the brand finishes its
photographs.

Found 10 Nov 2026 on Nike UK (test): before this, the brand's ads (3840 px wide JPEGs, three of them type on black)
measured grain 0.07 against the Engine's 0.65 (1856 px PNGs), and the direction would have told the finish step to
take the grain out. At the same size the four photographs measure 0.19 to 0.54 in the shadows and the Engine's 0.23 to
0.86: much the same. Four photographs are too few for a grain target (a field needs five), so there is none yet.

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
set on it. It waits until the brand has six such pictures.

Coverage holds a read field against the pictures that were read: a picture that was only measured answers no read
field, and that is not knowledge that the brand leaves the thing out.

### Kinds of picture

A brand does not make every kind of picture the same way. With 195 Nike pictures read (10 Nov 2026) the profile
counted over everything kept 96 fields `always` and left 216 `free`: a shoe alone is a studio picture, an athlete is
outdoors, and together they cancel out, so the Engine's wet-street product pictures fitted as well as Nike's own
(0.86 against 0.86). The brand's pictures are therefore also counted kind by kind (`KINDS`, `kindOf`, `byKind` in
`profile.ts`), once a kind has 15 pictures (`MIN_KIND`):

- `product_alone`: the product with no people in the picture.
- `people`: a picture with people in it.

The kind comes from what the picture shows (the `idea` pass), for a picture to be made from what the plan says of its
people. A picture that shows neither (type alone, a place) has no kind and is held against the whole. Nike's product
kind keeps 134 fields `always`; its people kind is tested by no Engine picture yet.

- **Proof** holds each of the Engine's pictures against the brand's pictures of its own kind (`Proof.kinds`), and has
  a **floor**: how the brand's pictures of its other kinds fit this kind, which is what a picture scores that is the
  brand's but not this kind. The share of proof is how far the Engine's pictures have come from the floor to the
  brand's own: Nike's product kind 0.82 for the Engine, 0.91 for Nike's own, floor 0.61, so two thirds, 14 of 20.
  A brand with one kind has no floor and keeps the plain ratio. Still not built: a floor from pictures the Engine
  makes without knowing the brand. Never another customer's pictures.
- **Direction** carries one direction a kind beside the whole (`Direction.kinds`), each compared with the Engine's
  pictures of that kind (three or more). `directionFor(d, planned)` picks the kind for one picture.
- Nothing changes for a brand with fewer pictures: no kinds, the whole profile as before.

A caution on the source: Nike's 185 new pictures are launch imagery from its newsroom, where the product alone is a
studio hero picture. Paid social ads may show the product in a scene more often. The brief still wins.

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
- Where the brand has kinds, the prompt takes its lines from the kind the picture will be, and the plan writer is
  told the whole first and then, under a heading for each kind, what the brand does only in that kind.

### The brief decides the place, the taste decides the craft

The first round with taste on (Nike UK (test), 10 Nov 2026, eight creatives) showed what happens when a habit is
taken for a rule. The briefs asked for street scenes; Nike's product alone is a studio picture. Seven of a prompt's
twelve lines were studio habits (a pristine, dry, plain ground with no trace of use) written into wet streets, and the
habits of craft that hold anywhere (deep focus, no blur behind the subject, clean edges) were crowded out or
contradicted. The rule since then:

- **The brief decides what the picture is of and where it is. The brand's taste decides how it is made.**
- The plan says where each picture is set: `place` on a planned creative (`studio`, `indoors`, `outdoors`,
  `not_set`). A plan from before that says it in its scene's words or not at all (`plannedPlace` in `context.ts`),
  and then every habit applies as before.
- A field is **of the place** (`ofThePlace`) when it describes where the picture is: everything under `setting.`,
  and `kind.capture`, `light.sky`, `colour.sky_colour`, `colour.background_colour`. Every other field is craft.
- `habitualPlace(direction)` is where the brand's pictures of a kind usually are, from its `setting.type` line:
  studio, or out in the world, or nothing when the brand keeps to no one kind of place. Nike UK's product alone:
  studio. Its pictures with people: none.
- A picture the plan sets away from that place (`awayFromHabit`) leaves the fields of the place out of its prompt
  (`promptLines`), so the twelve lines are all craft. The ledger says why each was left out: "The plan sets this
  picture somewhere else than the brand's usual place, so the habits of that place are left out."
- The composer is told the same (rule 14): a habit of craft holds in whatever place the concept sets, and nothing in
  the prompt is written against it. Where the habit is deep focus, nothing is described as blurred.
- The plan writer is told it too (`tastePart`), and says the tone the words need of the picture under them
  (`layoutPart`).

How the round measured (the same six shoes, product alone, read by the same reader; the mean of the six):

| | Before taste | With taste | Nike's own | Floor |
|---|---|---|---|---|
| Every field Nike keeps to | 0.79 | 0.82 | 0.91 | 0.61 |
| Only what the brief left open (29 fields of the place left out) | 0.85 | 0.89 | 0.92 | 0.60 |

The second line is the fairer measure of the Engine: it does not count against a picture that it is on a street when
the brief asked for a street. `tools/taste/open.ts` counts both. The rule above is live in the plan writer
(`fume-plan`) and in the Engine (`engine`) since 11 Nov 2026; a round that measures it has not been made yet.

The Look Book's rules are soft too (only skin is hard, `lookRules`). Nike UK's Look Book, read from ten paid ads,
asks for a cool bleached grade; the profile, read from newsroom pictures, keeps no such habit. Which of the two says
what the brand's grade is, is the brand owner's call, and is not settled.

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
Jev joined the same day, so "agrees" is counted among seven readers.

| Reader | Steady | Agrees | Filled | $ a picture | s a picture |
| --- | --- | --- | --- | --- | --- |
| `jev` (TypeSafe Jev) | 0.956 | 0.815 | 0.996 | 0.0023 | 2 |
| `sonnet-r` (Claude Sonnet, router) | 0.954 | 0.873 | 0.993 | 0.0815 | 14 |
| `gemini` | 0.938 | 0.862 | 0.986 | 0.0527 | 25 |
| `gpt-terra` | 0.923 | 0.889 | 0.972 | 0.0156 | 14 |
| `haiku-r` (Claude Haiku, router) | 0.909 | 0.750 | 0.925 | 0.0040 | 9 |
| `gemini-flash` | 0.901 | 0.884 | 0.993 | 0.0728 | 41 |
| `gpt-luna` | 0.865 | 0.811 | 0.963 | 0.0015 | 11 |

Recommended standard reader of the taste schema: **`gpt-terra`**. It is nearly as steady and as agreed-with as Claude
Sonnet at a fifth of the price, about 1.6 cents a picture. PROPOSED until Marcus says yes.

Jev is the steadiest and by far the fastest (2 seconds and 0.2 cents a picture), and it fills in the most, but its
answer is the one the others agree on less often: 0.81 against 0.89 for `gpt-terra`. The gap is widest where the
prompt gets its craft from (light 0.77, colour 0.77, composition 0.75, against 0.82 to 0.92 for `gpt-terra`). At 1.6
cents a picture price does not decide it, so the taste reading stays with `gpt-terra`, and Jev does the plain
classification it was chosen for (the reference cards, below). The human answer key settles it: Jev can be scored
against it again for a cent.

What this does not show:

- Six pictures of one brand is a small test. Run it again on a second brand before the choice is fixed.
- Agreement is not correctness. The real test is a human answer key on about 50 pictures.
- The measured column (rank correlation between ordinal read fields and the measured numbers) moved between -0.04 and
  0.31 and says nothing on six pictures, so it is left out of the table.
- Not tested: the direct Anthropic readers (the key was rejected that day), `gpt-sol`, `opus-r`, and `grok` (the function
  ran out of compute). Qwen is refused by the router's zero-data-retention policy.

First full read with `gpt-terra`, Nike UK (test), 10 real ads and 8 Engine pictures: taste score 48 of 100 (pictures 6 of
30, coverage 17 of 20, certainty 3 of 20, breadth 4 of 10, proof 18 of 20; it was 49 before the finish numbers of the
type cards were left out). Counted like with like on the six ads with a photograph in them, the brand's own pictures
fit their profile 0.76 and the Engine's 0.69. The direction it gives has 113 lines, 64 of them for the prompt, 8
finish targets and 7 campaign choices. The measured gaps that hold are sharpness and local contrast: the Engine's
pictures are softer (shallow focus, blurred backgrounds) where Nike's are sharp from front to back, which the read
fields say too and the prompt can ask for.

### Jev (TypeSafe), the classifier

DECIDED by Marcus, 10 Nov 2026: classification in Fume uses TypeSafe's model Jev. Jev is a decision model, not a
writing one: it is sent the picture with named questions and answers each with a choice from a closed list or a yes/no
probability, and how sure it is (docs.typesafe.ai/api/system-one). It costs $0.042 per million tokens sent and nothing
for what it answers, and answers in under a second. The reader `jev` in `taste-read` (`_shared/taste/jev.ts`) turns a
pass into Jev questions: a `choice` field is one choice question, a `choices` field one yes/no per option (kept where a
yes is more likely than a no, the likeliest first), and what a picture shows one yes/no per statement. A pass goes as
requests of at most 40 questions side by side. Its answers come back in the shape every reader answers in.

What Jev cannot do: write. The 11 free-word fields stay empty on a card it read. It takes a JPEG or a PNG sent as the
picture itself, not a WebP and not a link. It needs the secret `TYPESAFE_API_KEY` (Supabase, Edge Functions, Secrets).

First run with the key, 10 Nov 2026 (the six bake-off pictures twice, then all 18 Nike test pictures): no pass
failed, 2 seconds and $0.0023 a picture (about 55,000 tokens: the picture goes with each of a pass's requests), 40
questions a request were taken. On the first run Jev chose "cannot tell" where the answer is "none" (no price, no
badge, no sky): 58 of its 259 departures from what the other readers agree on. A list that can already say the thing
is absent is therefore asked without "cannot tell" (84 of the 254 choice fields), which took its agreement from 0.76
to 0.81 and its filled share from 0.94 to 0.996. Read by Jev, Nike UK (test) has 43 fields that are always the brand
and 112 that usually are (`gpt-terra`: 38 and 93), and no proof: Jev reads the two Meta ads of a model on plain grey
as a cut-out on colour, both the same way, where `gpt-terra` read one as a full photograph and one as none, so only
five of the ten ads count as photographs and proof needs six. On the fields both answered, Jev and `gpt-terra` gave
the same answer on 76 % across the 18 pictures.

## Reference pictures chosen for the picture to be made

An image model copies what it is shown. Until 10 Nov the Engine sent a product's pictures front first, up to the
image model's limit, whatever the picture to be made showed. Now (`_shared/engine/references.ts`):

- Every reference picture has a **card**: what it is of (the product alone, on a person, in a scene, a person,
  something else), from where its subject is seen (front, three-quarter, side, back, top, bottom) and how close
  (close, half, whole). The card comes from the picture's slot where the slot says it ("front", "back", "detail"), or
  from a classifier that looked at the picture. A picture with neither is unknown: sent when there is room, never
  preferred over one known to fit.
- The plan says what the picture **needs**: each planned picture carries `view` and `crop` from the same closed lists
  (the plan writer sets them beside the scene), and whether people are in it. A plan written before 10 Nov says it in
  its scene's words ("seen from behind", "in three-quarter view", "back mostly to camera"), which are read instead. A
  plan that names no side leaves the side open, and then no picture is held to be the wrong side.
- Code holds the two against each other (`serves`): the side the picture needs comes first; the product's front is
  always worth sending, for it is the truth about the product; the opposite side is left out; a product worn by a
  person is left out of a picture with no people, and sent, named as such, in one with people; a size chart or a
  drawing is never sent. Each shown product's best picture comes before any product's second.
- The image model is told what each picture is ("Pegasus, worn by a person, seen from the back"), and the prompt's
  ledger says why a picture was not sent.
- A brand's **models** (AI people, never real ones) are chosen the same way, and only for a picture the plan casts them
  in (`castIds` on the planned creative, `cast` on the Engine's task). The Engine side is built and tested; where a
  brand's models are kept and made (FLOWS §9.6) is not built, so no picture is cast yet.

The cards are read by `taste-read` with `references`: the brand's product pictures that have no card yet are fetched
(from Fume's storage, or from the link they were imported with), asked three questions (Jev unless another reader is
named; a WebP goes to the spare reader `gpt-luna`), and kept in `reference_cards`. A picture that cannot be fetched is
marked so and not fetched again; one the reader failed on is asked again next time. `engine_reference_cards(job)`
hands the cards to the Engine by the picture's address. Fume's people on the brand read the cards; a customer never
does. On 10 Nov the live products had 469 pictures: 230 with the slot "front", 235 from web imports with slots that say
nothing ("site-2" to "site-4"), and four others, so most of the gain waits for the cards.

## Tools

```
deno run -A tools/taste/measure.ts <manifest.json> <cards.json>            the measured half
FUME_ACCESS_TOKEN=… deno run -A tools/taste/read.ts <manifest.json> <reads.json> --workspace <id> --reader <reader>
deno run -A tools/taste/merge.ts <cards.json> <reads.json> <out cards.json> both halves on one card
deno run -A tools/taste/report.ts <cards.json> <brand set> [other set]      profile, score, gap
deno run -A tools/taste/bake.ts <cards.json> <dir with read-<reader>-<a|b>.json>
deno run -A tools/taste/open.ts <cards.json>[,<more>] <brand set>[,<more>] <engine set>[,<more>]   fit, and fit on what the brief left open
FUME_ACCESS_TOKEN=… deno run -A tools/taste/keep.ts <cards.json> --workspace <id> --brand <set> [--engine <set>]
FUME_ACCESS_TOKEN=… deno run -A tools/taste/refcards.ts --workspace <id> [--reader <reader>]   reference cards
```

`read.ts --passes idea --reader jev` asks only what a picture shows and what kind it is (under a tenth of a cent):
enough to sort a large set before the pictures worth reading are read in full. On 10 Nov 2026 it sorted 700 pictures
from Nike's newsroom; 185 were then read with `gpt-terra` (2.4 cents a picture at their size). Decoding large JPEGs in
Deno is slow: make 1568 px copies first and read those.

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

1. Applying the `reference_cards` migration (needs Marcus's go), then reading the reference cards of the brands in
   use. Taste itself is on since 10 Nov 2026: the `taste_schema` migration is applied, `taste-read`, `engine` and
   `fume-plan` are deployed with it, and Nike UK (test) has 203 cards and a profile.
2. Reading a brand's pictures by itself when the customer adds them (today a tool sends them), and the Engine's own
   pictures after each round, so the direction learns without anyone running a tool.
3. The finish step: grain, black point, tint and sharpness put on the pixels by code after the picture is made,
   brought to the direction's targets. Nike UK (test) has targets since 10 Nov 2026 (80 product photographs at full
   size): its grain has almost no colour noise (0.07, at most 0.35) where the Engine's pictures have 0.48.
4. Best of four with the profile as the judge (`fit`), before the expert sees a picture.
5. A second floor for proof: pictures the Engine makes without knowing the brand (the first, the brand's other kinds
   of picture, is built). Finer kinds: the product alone in a studio against the product alone in a scene.
6. Calibration per image model: which wording of a line moves a model, remembered per brand and model.
7. A human answer key on about 50 pictures, to settle the reader.
8. `.fig` upload: the design fields read from the file itself.
9. A picture skill per brand beside the copy skill.
10. The taste score and the profile in the app (the design thread owns the screens).
11. Reference cards read by themselves when a product picture is added (today a tool starts it).
12. A brand's models kept in the database with their pictures, and the plan casting them (FLOWS §9.6).
