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
6. Only a prompt that passed goes to the image model (Higgsfield's API, the prompt unchanged), and the picture
   comes back as a candidate of the job, made for the designer who pressed Render, so someone else checks it.
7. The **feedback domain**: `engine_lessons` holds what people's verdicts taught (only people's verdicts teach);
   approved pictures' prompts become examples. Turning verdicts into lessons is the next step.

## Money

- The language model's week (`llm_week_usd`, $50) counts the plan writer, the chat and the Engine's prompts.
- The pictures have their own week (`engine_week_usd`, $20). Over it, Render says so.
- A dry run (no `HF_CREDENTIALS` yet) writes and checks the prompt for about $0.002 and renders nothing.

## Secrets

`HF_CREDENTIALS` (Higgsfield "key id:key secret"), optionally `HF_ENDPOINTS` to change a model's endpoint. The
default image model is `engine_image_model` in `app.settings` (nano-banana-pro).

## Not yet

The Engine bar's words, Make formats by the Engine, picture checks by a vision model, lessons from verdicts, video,
a second image provider. The Studio's side is designed in app/FLOWS.md §29 (PROPOSED): a failed version in the
strip with its reason, the prompt and its checks for Fume's people, and Yes or No on the Engine's pictures. The live
API still has to write a failed attempt as a version (`failure`, `prompt`), send `prompt` only to Fume's people, and
turn `teachEngine` into a row of `engine_lessons`.
