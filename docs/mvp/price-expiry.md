# Prices that run out (Part 4)

A price or an offer is true for a while. Fume never puts a price on a creative that no longer holds.

- `product_facts.valid_until`: until when a fact holds. A claim fact that names a price or an offer (`app.is_price`:
  a figure with a currency or ",-", or a share off with a sale word) always has one: the brand's own date, or 14 days
  from when it was stated (`add_product_fact(..., p_valid_until)`). Prices stated before this change got 14 days from
  when they were stated.
- `set_fact_until(fact, until)`: the brand's owner or approver sets any date; Fume's people may only bring it closer.
  A price never loses its date.
- After the date the plan writer is not given the fact (`fume_take_plan`), and a plan cannot rely on it
  (`fume_finish_plan`).
- `app.expired_claims(creative)`: the facts a creative's planned words rely on (its planned creative's `claimRefs` in
  the approved plan, and for a format or variant its master's too) that have run out.
- A trigger on `creative_versions` refuses to check, send, approve or deliver a version while that list is not empty,
  whichever command asks. The message names the price and the date it ran out, so the brand states the new price or
  the words are laid again without it.

Live check (5 Nov 2026): the Dressmann price holds until 19 Nov. With the date moved into the past inside a rolled-back
transaction, delivering the approved Dressmann master was refused with the price and the date.

Files: `supabase/migrations/20261105170000_price_expiry.sql`, test `supabase/tests/9ze_price_expiry.sql`.
Open: the screens to show the date on a fact and to set a new one (design thread).
