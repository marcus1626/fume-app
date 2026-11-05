# One image model per task (Part 4)

Each image task names its model in `app.settings` key `task_models` (read by the functions through `task_model`), so
a cheaper model can take a task it does as well, without a deploy. Every fix and format records the model it used and
its cost.

| Task | Model | Why |
| --- | --- | --- |
| Render (the master's picture) | the Engine's choice (`engine_image_model` and its arms) | the Engine learns which model and prompt dialect work per brand |
| Fix (redraw a marked part) | Nano Banana Pro, 2K, about 15 c | letters must be copied letter for letter from the product's photograph |
| Expand (a format's new edges) | Nano Banana Pro, 2K, about 15 c | tested against Nano Banana 2 below |
| Crop (a format) | none | the master's own pixels |
| Upscale | none yet | every delivery size (1080 px wide) is smaller than the master (1856 px) |

## Test: expanding a story, Pro against Nano Banana 2 (5 Nov 2026)

The same Dressmann master, extended to 9:16. Nano Banana 2 (41 s, 8 c) drew the new edges flatter and lighter than
the master's backdrop, so a band shows above and below the master. Nano Banana Pro (49 s, 15 c) continued the
backdrop's light and vignette with no visible seam, twice. Pro stays the expand model. Pictures in
/mnt/project-files/engine-test/2026-11-05/formats/ (story-pro-mot-nb2.jpg).

Files: `supabase/migrations/20261105180000_task_models.sql`, test `supabase/tests/9zf_task_models.sql`,
`supabase/functions/fix/`, `supabase/functions/format/`.
