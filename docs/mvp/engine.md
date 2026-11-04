# The Engine, version 1

Status: BUILT 4 Nov 2026 (Marcus opened the Engine track: "la oss jobbe", and asked us to work on our own). The
design follows Marcus's five domains and the Fume Engine prototype (Oct 2026), ported into this repo.

## What happens when a designer presses Render

1. `render_creative` (designer only) starts the creative's Engine job under `start_job`'s rules: an approved plan,
   verified required facts, and for a variant or format an approved master. The job's snapshot freezes the facts.
2. The app asks the edge function `engine`. It answers at once and works in the background.
3. `engine_take` hands it the attempt and the **data domain**: the frozen facts, the approved plan, the product's
   pictures (files, or addresses from the brand's website), the Brand DNA's rules, the taste model, the lessons and
   the prompts behind approved pictures. For a correction: the version it corrects and what must change and stay.
4. The **reasoning domain** (`_shared/engine`) picks the method (a slot grammar per image type, a dialect per image
   model) and builds the compile package: the product text is the verified facts word for word, the product
   pictures go first, and every rule and fact becomes a manifest item the prompt must carry.
5. **The motor**: Claude Haiku composes the free slots; code checks it (no rendered text, no equipment, no file
   names, no forbidden terms, locked slots unchanged); Claude answers, for each item, whether the prompt carries it,
   works against it or says what is not visible; unclear answers go to a verifier and then to a person. Findings
   send it back, up to three times. `engine_prompted` keeps the prompt, its checks and their cost.
6. Only a prompt that passed goes to the image model (fal or Higgsfield, the prompt unchanged), and the picture
   comes back as a candidate of the job, made for the designer who pressed Render, so someone else checks it.
7. The **feedback domain**: `engine_lessons` holds what people's verdicts taught (only people's verdicts teach);
   approved pictures' prompts become examples. A person's Yes or No (`teach_engine`) waits as an answer; before the
   next prompt for the brand, the Engine turns up to three answers that say why into at most three lessons each
   (`engine_pending`, Claude with DIGEST_SYSTEM, `engine_digested`), from what the person said only. That prompt
   already uses them; a changed answer is digested again and its old lessons retire. Digesting counts in the
   language model's week.
8. **The Engine bar** (FLOWS §9.1). The designer's words go into the creative's Direction and show before anything
   renders. Keep and render sends them with Render (`render_creative`'s `p_direction`): with a picture on the desk,
   the Engine changes that picture (the `picture_edit` grammar: the picked picture first, the change, what stays; the
   scene and the look are the picture's own, so only hard rules and the product's facts are written again); without
   one, the Direction goes into a new campaign still. A plain Render sends the Direction. The job keeps the words
   (`production_jobs.direction`), and its tries count from the Render that queued it (`tries_from`).
   **Make formats**: each new format creative is rendered by the Engine at once, from the approved master, with the
   same `picture_edit` grammar (the master first, the new shape, the product whole). When it cannot render yet, the
   format waits in its own creative as before.
9. **The Engine looks at its picture** (`_shared/engine/evaluate.ts`). Right after a picture is kept, Claude Haiku
   sees the product's own photographs (at most three; never the master) and the picture, and answers for each item
   of the prompt's checklist whether the picture holds it, is off, or cannot be told, and names artefacts and
   printed words outside the product. The first item is always that the product is the product in its photographs.
   The format and the taste model's words are code's, so they are not on the list. Code turns the answers into the
   candidate's `evaluation` (product truth, brand rules, artefacts, notes in order of weight) through
   `engine_evaluated`. It helps the expert and never checks a picture in their place; customers never see it. About
   $0.0015 a picture, in the language model's week. A failure leaves the picture unevaluated.

10. **The Brand Brain in the prompt** (`app.engine_brain`, `_shared/engine/context.ts`). `engine_take` hands over
   what the brand's knowledge graph knows about its pictures: the palette, the brand's own pictures in words, notes
   about the picture, the market, and what was asked to change in its other creatives and what experts noted. They
   become soft rules (never hard: the Brand DNA's rules are the hard ones) and lessons the writer reads. Captions that
   only say where a picture came from, text and ground colours, unsure colours and proposed nodes stay out.
   Every prompt keeps a **ledger** (`_shared/engine/ledger.ts`, `engine_prompts.ledger`): each product fact, rule,
   taste word, brain node, lesson and picture the Engine had, whether it went in, how it was checked (word for word
   by code, or by meaning) and whether the check found it, or why it was left out.
11. **The prompt graph** (`app.engine_prompt_rows`, `public.engine_learning`). Every validated prompt with what it
   was built from (the model's rules, the kinds of brand rule and lesson, the kinds of data the ledger says went in,
   the number of pictures) and its best picture's score: people's verdicts first (approved 1.0, checked 0.8, Yes
   0.7, taken as a version 0.6, a correction or change 0.2, No 0), else the picture check (0.5 pass, 0.25 a brand
   rule or major artefacts, 0.1 the product). `engine_learning` gives the numbers per model and kind of picture and
   per feature with and without it, with how many prompts each rests on: for Fume's people on a brand, and across
   brands (how models behave only) for Fume's admins. Customers never read it.

## Money

- The language model's week (`llm_week_usd`, $50) counts the plan writer, the chat, the Engine's prompts, digesting
  answers and looking at pictures.
- The pictures have their own week (`engine_week_usd`, $20). Over it, Render says so.
- A dry run (no image provider's key yet) writes and checks the prompt for about $0.002 and renders nothing.

## Secrets and providers

`FAL_KEY` (fal) and `HF_CREDENTIALS` (Higgsfield "key id:key secret"). Optional: `FAL_ENDPOINTS` and `HF_ENDPOINTS`
to change a model's address, and `ENGINE_ROUTE` (`{"model": "fal" | "higgsfield"}`) to move a model. The image model
is `engine_image_model` in `app.settings`.

Each model goes to the provider that has it (`byModel` in `engine/provider.ts`), and a request is collected from the
provider that took it (fal's request id is its result address).

- **Higgsfield's API** (checked 4 Nov 2026 with Fume's key, route by route) has 18 image models: Qwen Image 3
  (text-to-image and edit), Grok Imagine 2.0, Ideogram 4, Recraft 4.1, Soul and Z-Image. Its Nano Banana Pro answers
  `model_disabled`; Nano Banana 2, GPT Image and Seedream are not there. Its video models include Seedance 2.0 and
  2.5, Kling 2.5 to 4.0, Wan 3.0 and Hailuo 2.3, so video goes there. Qwen Image 3 does not make 4:5, so a feed
  picture is asked for as 7:9 and cropped.
- **fal** (`engine/fal.ts`, queue API) makes Nano Banana Pro and Nano Banana 2 (ratio, 2K, `image_urls` for edits),
  Seedream 4 (a width and height of about four megapixels) and GPT Image 1.5 (its nearest of three shapes). The
  addresses come from fal's catalogue and are checked by the probe once `FAL_KEY` is set.

A POST to `engine` with `{"jobId", "probe": true, "routes"?: [...]}` checks each provider's key and model addresses
without making a picture.

## Not yet

Statics and graphic design come before video (Marcus, 4 Nov). Not built yet: the Engine choosing between ways of
saying a thing from the prompt graph's numbers, a fixed test set, the picture check's notes as findings, product
references apart from composition references, and graphic design (OpenPencil). The Engine bar reads every word into the Direction; reading words into the
desk's own variables (light, angle, lens) is not built yet. The Studio's side (a failed version in the strip, the
prompt for Fume's own people, Teach the Engine) is on the design branch, app/FLOWS.md §29.
