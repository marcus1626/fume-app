# One image model per task (Part 4)

Each image task names its model in `app.settings` key `task_models` (read by the functions through `task_model`), so
a cheaper model can take a task it does as well, without a deploy. Every fix and format records the model it used and
its cost.

| Task | Model | Why |
| --- | --- | --- |
| Render (the master's picture) | the Engine's choice (`engine_image_model` and its arms) | the Engine learns which model and prompt dialect work per brand |
| Fix (redraw a marked part) | Nano Banana Pro, 2K, about 15 c | letters must be copied letter for letter from the product's photograph |
| Expand (a format's new edges) | Nano Banana Pro, 2K, about 15 c | tested against Nano Banana 2 and Bria Expand below |
| Crop (a format) | none | the master's own pixels |
| Upscale | none yet | every delivery size (1080 px wide) is smaller than the master (1856 px) |

## Test: expanding a story, Pro against Nano Banana 2 (5 Nov 2026)

The same Dressmann master, extended to 9:16. Nano Banana 2 (41 s, 8 c) drew the new edges flatter and lighter than
the master's backdrop, so a band shows above and below the master. Nano Banana Pro (49 s, 15 c) continued the
backdrop's light and vignette with no visible seam, twice. Pro stays the expand model. Pictures in
/mnt/project-files/engine-test/2026-11-05/formats/ (story-pro-mot-nb2.jpg).

## Test: Pro against Bria Expand (6 Nov 2026)

Bria Expand (`bria-expand`, fal-ai/bria/expand) is an outpainter: it is given the master itself and its place on the
canvas, and draws only around it. Same master, 38 s, about 4 c. Its backdrop is close, but it leaves a visible step
where the new bottom edge meets the master (a row-mean jump of 2.0 levels against Pro's 0.5) and a blotchy texture in
the new parts. Pro stays. Bria stays wired: set `task_models.expand` to `bria-expand` to use it. In all three tests
the master's own pixels are identical (checked pixel by pixel). Pictures in
/mnt/project-files/engine-test/2026-11-06/formats/ (story-pro-bria-nb2.jpg).

Files: `supabase/migrations/20261105180000_task_models.sql`, test `supabase/tests/9zf_task_models.sql`,
`supabase/functions/fix/`, `supabase/functions/format/`.
