# Fume-skolen — brief for Codex

Fume-skolen is the Fume Engine's own marketing school. Marcus approved it on 13 Nov 2026. Everything you produce is PROPOSED, not decided.

## Goal
Read free marketing material and turn it into:
(a) **skills**: principles the Engine can check, and
(b) **flows**: real automation flows the Engine runs.

Marcus: "the curriculum is not just data we feed the Engine, but real automation flows we build."

## Copyright rules (hard)
- Free to read means free to learn from. Store principles **in our own words**, each with a source and a locator (URL, plus chapter, page or section).
- At most ONE short quote per skill, under 25 words, marked as a quote.
- Never save full copyrighted texts in skill or flow files, or anywhere else here.
- Only public-domain full texts (e.g. Claude Hopkins, *Scientific Advertising* 1923, *My Life in Advertising* 1927) may be stored in `sources/`.
- If a source is a paid book, say so and use only legitimately free material about it (author's own articles, publisher excerpts, talks, reputable summaries). Mark it clearly in `free_access`.

## Folder layout
- `sources/pensum.json`: the reading list (step 1), plus public-domain texts.
- `skills/<Subject>.json`: one file per subject (step 2).
- `flows/<id>.json`: one file per flow (step 3).
- `review/review.md`: the reviewer's report (step 4).
- `NOTES.md`: your running log: what you did, failed URLs, open questions.

## Step 1 — Pensum (reading list)
For each seed source, verify a working free URL (actually fetch it; record HTTP failures). Add more free sources, for 60–100 in total. Write `sources/pensum.json` as a JSON array of:
```
{subject, source, url, what_engine_takes, free_access, tier, checkpoints: [1-10], url_status}
```
- `subject`: Strategi | Leseren | Idé | Copy | Plattform | Lov
- `free_access`: exactly what is free. Say so when the book itself is not free.
- `tier`: lov | forskning | plattform | praktiker | fume
- `url_status`: "ok" (fetched, with the date) or "failed: <reason>" (and then give an alternative URL if one exists)

Seed sources:
- Ehrenberg-Bass (Byron Sharp, Jenni Romaniuk): laws of growth, distinctive assets, category entry points
- Binet & Field, "5 Principles of Growth in B2B Marketing" (LinkedIn B2B Institute)
- IPA effectiveness free summaries (The Long and the Short of It, EffWorks)
- The Better Briefs Project (2021)
- Eugene Schwartz, *Breakthrough Advertising*, awareness levels (free summaries)
- Jobs to be Done (Clayton Christensen, Bob Moesta)
- Behavioural Insights Team, EAST framework
- Robert Cialdini (influence principles)
- Processing fluency (Rolf Reber, Norbert Schwarz)
- Claude Hopkins, *Scientific Advertising* (1923) and *My Life in Advertising* (public domain; full text allowed in sources/)
- David Ogilvy, the "How to write" memo
- John Caples, *Tested Advertising Methods* (summaries)
- The Gary Halbert Letter archive
- Dave Trott's blog
- Nielsen Norman Group; plain language (Språkrådet klarspråk, plainlanguage.gov)
- Bill Bernbach / DDB
- System1 (Orlando Wood) and Kantar free reports
- Effie, Cannes Lions, D&AD free cases
- Meta creative best practices and Blueprint
- Google YouTube ABCD and Skillshop
- TikTok Creative Center
- LinkedIn B2B Institute
- Norway: markedsføringsloven and Forbrukertilsynet guidance
- Germany: UWG; EU Unfair Commercial Practices Directive (2005/29/EC)
- UK CAP Code (ASA)
- EU health claims regulation 1924/2006
- Meta, Google and TikTok ad policies

## The 10 checkpoints (Engine pipeline)
1 Briefen forstått · 2 Leseren · 3 Innsikten · 4 Løftet og USP-en · 5 Logikkjeden · 6 Salgsmålet · 7 Bredde så valg · 8 Kunden velger · 9 Utførelse · 10 Sjekket og godkjent

## Step 2 — Skills
Write `skills/<Subject>.json` (Strategi, Leseren, Idé, Copy, Plattform, Lov): one JSON array per file, 150–250 skills in total. Each skill:
```
{id (kebab-case, unique across all files), subject, name, principle (1–2 sentences, own words),
 sources: [{source, url, locator, quote?}], rule (what the Engine can actually check),
 check: "kode" | "kritiker" | "menneske" (or combos, e.g. "kode+kritiker"),
 example_bad, example_good,
 applies_when: {channel, awareness_level (1–5 or "alle"), market ("B2B"|"B2C"|"begge"), country},
 checkpoints: [...], tier, conflicts_with: [ids], read_on (ISO date; platform advice only),
 state: "PROPOSED", lang: "nb"}
```
- name, principle, rule and examples in plain Norwegian bokmål.
- Every rule must be checkable: a pass/fail test that code, a critic model or a human can apply. Drop vague advice.
- **Fume ethics beat platform advice:** never AI UGC, and never AI-generated people posing as real customers. If a platform recommends something that conflicts with this, the Fume rule wins and the conflict is recorded.

## Step 3 — Flows
Write `flows/<id>.json`: processes the Engine runs, built from the sources. Each:
```
{id, name, purpose, sources, checkpoints, input (which stored artifact it reads),
 steps: [{n, what, who: "modell"|"kode"|"kritiker"|"menneske", output}],
 output_artifact, validation (what must be true before the next step),
 fail_route (back with a reason; after 2 tries, to a human),
 skills_used: [skill ids that exist], state: "PROPOSED"}
```
Rules: each step makes one stored artifact, validated before the next step reads it. The critic is never the same model as the writer.

At least these flows:
1. Brief in one sentence, plus questions back to the client
2. Reader card (Schwartz awareness level, category entry points, JTBD)
3. Insight hunt (5–10 sourced insights, each with a tension; a human picks one)
4. Competitor read, before the promise
5. Logic chain: problem → promise → proof → ask
6. 100–200 tweet-length lines in named styles → code weeding → critic ranking → max 3 to the client
7. Image as a third thought (the image adds meaning, not a repeat of the words)
8. Legal check per country
9. Test plan for real ads

Add more where the sources support it.

## Step 4 — Review
A separate, fresh run reviews everything and writes `review/review.md`; a later run applies the fixes.
