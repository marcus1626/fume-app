# Train the Engine

Marcus, 6 Nov 2026: a swiping page where Marcus and Tore train the Engine with yes, no and comments in their own words,
because people have the eye and the experience. Live at **Studio › Train the Engine** (`/studio/train`), for Fume's own
people only (never an agency's, never a customer's).

## What a card asks

1. **The picture.** One of the Engine's pictures from any brand the person works on: "Good enough to show the
   customer?" Swipe right or press **Y** for Yes, left or **N** for No. After the answer, **Why?** offers quiet chips
   (Product is right/wrong, On brand / Not on brand, Looks real / Looks AI-made, The light, The composition, Text or
   label) and **Write…** for their own words. **Back one** (Backspace) returns to the last card; a new answer replaces
   the old one.
2. **Fume's check.** Beside the picture, what the validation machine found wrong on the product
   ([product-parts.md](product-parts.md)), with the part on the picture next to the same part on the product's own
   photograph. The person says **Right** or **Wrong**, and why. When the check found nothing, they say **Right** or
   **Missed something** (and what). A picture the check has not read says so.

The pictures the check has read come first, then the newest; ten to a round. Answered pictures leave the deck. Each
picture shows once, in its newest form: not the picture a design or a fix was made from, not its formats, and not the
bench's test pictures (Marcus, 9 Nov: the pictures were almost the same).

## Where the answers go

- **Yes / No + why** is `teach_engine` (live since 4 Nov): an answer waits as `pending` in `engine_lessons`, and the
  Engine's digest turns each why into a lesson for that brand before its next prompt. A No also lowers the picture in
  the Engine's picture graph.
- **Right / Wrong + why** on the check is `judge_detail` into `detail_labels` (one per person, picture and finding;
  `detail` is the part's key, `print:<words>`, or `none`). They measure the check against people:

```sql
select l.detail, count(*) filter (where verdict = 'right') as right, count(*) filter (where verdict = 'wrong') as wrong
from public.detail_labels l group by 1 order by wrong desc;
```

  A wrong call with a why is the next bench case (`tools/bench/parts-bench.json`).

Migrations: `20261106160000_train_the_engine.sql`, `20261106161000_train_cards_close_ups.sql`,
`20261109100000_train_cards_faster.sql` (the deck in about 0.1 s), `20261109110000_train_cards_one_per_picture.sql`. Test: `supabase/tests/9zl_train_the_engine.sql`.

## Who

Any of Fume's own people on a brand (`app.is_fume_staff`): admins on every brand, designers on the brands they are
assigned. Tore needs an invitation as a designer on the brands he should train on.
