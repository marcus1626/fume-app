# The copy Engine: checks by code

Status: BUILT 10 Nov 2026 as pure code with tests; PROPOSED for wiring. Nothing here calls a model, writes to the
database or is deployed. Marcus, 10 Nov: build the copy part of the Engine as far as it goes overnight, research how
copy is made and learnt, and solve Eike's SGB brief with Claude writing every line (no API calls).

A model writes copy; code decides whether it holds, the same rule as the plan's claim check (brand-books.md).

## The parts (`supabase/functions/_shared/copy/`)

| File | What it does |
|---|---|
| `formats.ts` | The format registry: every slot copy goes into (Meta, LinkedIn, Google search, email, WhatsApp, landing page, form, quiz, video, thinking), its limit and where the limit comes from (`platform`, `practice`, `proposed`). Counts graphemes. Checks that the visible part of Meta and LinkedIn text ends on a finished thought, buttons from the platform's fixed list, plain WhatsApp buttons, a summary of 100 words. A brief may override limits (`formatOverrides`). |
| `slop.ts` | The habits that make copy read as AI-written (Ad Legends' study of 400 AI ads, Oct 2026: long dash 52%, the brief handed back 66%, five buttons 62%): stock phrases in English, German and Norwegian, long dashes, exclamation marks, emoji, "Tired of" openers, "not just X, it's Y", three abstract adjectives, generic calls to action, a headline that is mostly the brief, a headline that starts with "we". Words the Tone of Voice avoids are errors. |
| `truth.ts` | Quotes must be verbatim (cuts marked `[...]`); every number must come from a verified fact; no price or saving when the brief rules it out (a customer's verbatim quote may say it, the brand may not); no superlative without a verified comparison; forbidden patterns; every `[placeholder]` listed as an assumption. |
| `swap.ts` | The swap test: a line is `anchored` (carries a brand anchor or a customer's own words), `generic` (mostly the category's words, nothing only this brand has) or `open` (a person judges). |
| `check.ts` | `checkDeck`: all of the above over a whole deck, plus the rules across lines: fields in one `group` keep the same text (a track's headline in all six asks), near-duplicate search headlines, pieces no line of which carries an anchor. `reportText` for the writer's second try. |
| `graph.ts` | The copy graph: insight, promise, proof, fact, quote, stall reason, voice trait, customer phrase, category line, piece, line, verdict, lesson. `toBrainRows` maps it onto `brain_nodes`/`brain_edges` (layers market, rules, memory; the copy edge kind in `body.edge`). `readiness` lists what Brand DNA lacks before the Engine should write. |
| `learn.ts` | Learning from people: an expert's edit (before/after) and yes/no with why become lesson candidates with a Beta confidence; active at two supports and 0.7; retrieved by format then channel (PRELUDE/CIPHER, arXiv 2404.15269); `lessonsPrompt` fences them as data; confirmed avoid-lessons become words the slop check enforces. |

Tests: `copy.test.ts` (Deno, `deno test -A --no-check supabase/functions/_shared/copy/`).

## Tools

- `deno run -A tools/copy/check-deck.ts <deck.json> <context.json> [report.json]`: checks a deck (pieces, or a
  presentation whose `piece` and `beats` blocks hold the lines). Exit 1 on errors.
- `node tools/copy/render-deck.mjs <deck.json> <report.json|-> <kit-dir> <logo.svg> <out.html>`: a Fume web-kit page of
  the deck with each line's count, limit, swap verdict and warnings, and the report at the end.
- `tools/copy/fixtures/`: the SGB work package 1 deck and its context, the first real run.

## First real run: SGB work package 1 (10 Nov)

180 lines in 36 pieces. The first run found 4 real errors (two unproven "the only" claims, an on-screen caption too
long, a quiz answer that led with "lowest price") and three rules that were too strict (on-screen text may take two
caption lines; brief echo needs four content words; a piece passes the swap test when any line carries an anchor).
After fixes: 0 errors, 15 warnings kept on purpose (Track A's headline is generic by the swap test and leans on its
subline; that is said to Eike as the first thing to test).

## Not yet (PROPOSED order)

1. Wire `checkDeck` into the copy lane of `fume-plan` next to the claim check (dev thread; no new table).
2. `copy_feedback` and `copy_lessons` tables, and a Teach the Engine deck for lines (design thread draws it first).
3. Research step: reviews and competitors' ads (Meta Ad Library API for EU/UK ads, Google Ads Transparency via
   Firecrawl) into the Brand Brain as customer phrases and category lines.
4. The copy writer: many variants, code checks, the best go to the expert with the report.
5. Long formats from the SGB brief as registry entries with structure: landing page block ladder, quiz, email flow,
   call guide, beat tables.
