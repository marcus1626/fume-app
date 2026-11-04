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
   approved pictures' prompts become examples. Turning verdicts into lessons is the next step.

## Money

- The language model's week (`llm_week_usd`, $50) counts the plan writer, the chat and the Engine's prompts.
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

The Engine bar's words, Make formats by the Engine, picture checks by a vision model, lessons from verdicts, video.
The Studio's side is designed in app/FLOWS.md §29 (PROPOSED): a failed version in the strip with its reason, the
prompt and its checks for Fume's people, and Yes or No on the Engine's pictures. The database side is in place
(migration 20261104150000_engine_studio: prompts and lessons for Fume's own people only, `teach_engine`, one answer
per person and picture). The live API still has to map a failed attempt to a version (`failure`, `prompt`), fill
`Generation.taught`, and call `teach_engine` from `teachEngine` (the generation id is the Engine candidate's id).
