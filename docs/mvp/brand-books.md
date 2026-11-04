# The brand's books: a long Tone of Voice and a full design system

Status: BUILT 4 Nov 2026 (Del 2 of "Fume Engine: statics og grafisk design ferdig"). Marcus, 4 Nov: every customer
in Fume has a LONG Tone of Voice with everything from the brand, and a full CSS token design system with examples
of graphic design, so the Engine can make graphic design that is on brand, fits the campaign, the taste and the
picture it is set on.

## How a book is made

1. Someone at Fume who writes the brand (`brand_writer`) asks for a book: `write_brand_book(workspace, 'voice' |
   'design', ask)`. One book of a kind is written at a time. The answer is at once; the edge function `brand-book`
   writes it in the background (about a minute, about $0.02 on Claude Haiku).
2. `brand_book_take` (service only) hands the writer what Fume knows: the Brand Brain context, the identity, the
   Brand DNA state, every rule, the product claims, the website, the version before and its ask, and for a design
   system the approved (or checked) Tone of Voice. The writer reads the site's home page and up to four more pages.
3. The writer asks the model in three parts at once (the schemas are too large for one structured answer) and
   joins them. The data is fenced as data, never instructions.
4. **Code, not the model, builds the design tokens**: DTCG tokens, the `.brand` CSS variables and type classes,
   the generic font fallback, and the contrast of every pair that carries words (WCAG; 4.5:1 for text, 3:1 for
   large marks). Missing roles and failed pairs are listed in `checks`.
5. `brand_book_finish` keeps it as a **draft**. A voice book must have its identity, how the brand speaks and
   examples; a design system its tokens, CSS and examples. A failure is retried; after three tries it stops with why.
6. An expert who can check (`check_brand_book`) checks the draft. Only the customer's owner or approver approves
   it (`approve_brand_book`); the newer approved version supersedes the older.
7. A change (`ask_brand_book_change`) is a new version written from the last with the customer's words. The approved
   version stays in use until the new one is approved.

Customers never see a book being written, nor a draft no expert has checked (row level security). Writing books
counts in the language model's week (`fume_llm_budget`).

## What a Tone of Voice holds

Summary, identity (who, personality), how it speaks (traits with do, don't and what it means; words to use and
avoid), the scale of tone, audience, mechanics, vocabulary, channels (how, length, example), headline patterns,
calls to action, rules (claims among them: only verified claims are used), good and bad pairs with why, examples
from the brand's own words, sources and the gaps Fume still needs answered.

## What a design system holds

Colours with role and use, typefaces with weights and fallbacks, type styles, spacing, radius, formats with safe
areas, the logo, words on photographs, components, rules, layout examples (layers by format, with why), sources,
gaps, and the tokens, CSS and checks code builds from them.

## First live run (4 Nov, Nordlys Kaffe (test))

Voice: 14 examples, 8 channels, 16 pairs, 25 gaps (for example which name to use, Nordlys or KAFFA), $0.023.
Design: 8 colours from Brand DNA and the site, Baskerville and Nunito Sans, every contrast pair passes, 3 layout
examples, $0.025.

## The copy lane (20261105000000_copy_lane.sql)

1. The plan writer (`fume-plan`) reads the brand's Tone of Voice (`brand_voice_of_campaign`: the approved book,
   else the newest checked, else the newest draft, without its sources and gaps) and writes every word the brand
   will say in it: the copy set and the words on each planned creative.
2. **The claim check.** Claude Haiku reads every line for claims (a result, health, best, better than, a price, an
   offer, where it is from, an award) and names the verified fact that states each one. **Code decides**: only a
   verified fact of the campaign's products backs a claim; a result, a health effect, a comparison or an award
   needs a verified *claim* fact; the brand's own words back only a price, an offer, an origin or its own line.
   Code also finds the words the voice avoids, and the model says when a line is off the voice.
3. A claim nothing backs sends the plan back once with what was wrong. If it is still there, the plan goes on to
   the expert with the check: a machine's reading never blocks on its own.
4. The check is kept on the run (`task_runs.copy_check`, staff only) with what the first draft was rewritten for.
   A customer never reads it, nor the Engine's prompts and findings, nor an event about a brand book she may not
   read (the record's read rule, tightened in the same migration).

First live run (4 Nov, Nordlys, a brief asking for "the best coffee in Norway" and "sleep better"): the first draft
carried an unbacked claim and was rewritten; the plan's words use the brand's own line "Det beste er ofte det
enkleste", say in an open question why the claims were left out, and two lines were read as off the voice
("kaffeelskeren" instead of du). $0.014 for the plan and both checks.

## Not yet

The Engine reading the approved design system, the expert's view of the copy check and the screens to read, check and approve a book (design
thread), and graphic design from the tokens (OpenPencil, Del 3).
