# Independent JSON Schema check — round 3

13 November 2026. Scope: schema and list definitions; spot checks do not establish that every platform combination is available or that every possible semantic overlap has been found.

| Check | Result | Evidence |
| --- | --- | --- |
| Requested validator | **PASS** | `.runs/venv/bin/python tools/validate.py` exited 0, `result: PASS`, no errors; reported 102 JSON Schemas, 66 lists, 87 artifact schemas and 7,901 mined occurrences. |
| Draft 2020-12 meta-validation | **PASS** | Independently loaded all 102 `schemas/json/*.json`, checked each declared the 2020-12 dialect and called `jsonschema.Draft202012Validator.check_schema`; zero errors. Meta-validity does not establish semantic correctness. |
| List membership | **PASS for checked structured values; completeness not proved** | An independent scratch script mapped `x-field`/`x-list` bindings from the schemas, compared 36,748 schema enum occurrences and 1,186 registry value occurrences to their lists, and checked 1,567 skill filter values. Zero missing or unmapped fields in those checks. This does not exhaustively classify prose, open records, metadata, conditions, or all possible real-world platform values. |
| Synonyms and overlaps | **PROBLEM** | No identical case-folded labels were found within a list, but semantic overlap remains. `format` combines the general `video` with `yt-skippable`, `yt-non-skippable`, `yt-bumper`, `yt-shorts` and TikTok video modes; `yt-bumper` is itself non-skippable. A single `format` value cannot express both axes without a documented precedence and loss of information. `country-group` contains EU and EEA, overlapping memberships; `channel` contains concrete values and broader filter families such as `google-ads` and `sosiale-medier`, plus `alle`. The latter are explicitly restricted to filters, but the list itself is not disjoint. Distinguish intentional multi-label/filter sets from exclusive fields. |
| Five negative tests | **PASS, 5/5** | Scratch copies of `schemas/lists/format.json` were independently checked against `list.schema.json` with date format checking enabled. Missing `id`, invalid `id` pattern, empty value definition, impossible date, and extra value property were each rejected. The unmodified copy passed. These exercise list-schema validation, not all artifact/runtime rules. |
| Official platform spot checks | **PROBLEM / partial** | Four accessible official pages checked below; this is a sample, not an exhaustive platform audit. Meta's cited placement page redirected to login/block, so Meta is unverified in this check. |

## Platform evidence

1. **Google Ads formats — PASS, sample:** [Google Ads format overview](https://support.google.com/google-ads/answer/1722124?hl=en) describes text, image, video, responsive display and app promotion, and says availability depends on campaign type and goal. Matching list entries exist; exact eligibility is not established by the list.
2. **YouTube — PROBLEM, semantic overlap:** [Google video ad formats](https://support.google.com/google-ads/answer/2375464?hl=en) lists skippable, non-skippable, in-feed, bumper, Masthead and Shorts and identifies bumper as non-skippable. These entries exist, but their coexistence with generic `video` and `yt-non-skippable` leaves overlapping choices. The same source also lists YouTube Playables as a serving location; no explicit Playables placement was found, so check whether it is deliberately covered by a broader entry.
3. **TikTok — PASS with qualification:** [TikTok placement](https://ads.tiktok.com/resources/help/article/tiktok-placement?lang=en) describes For You, Search Feed and Search Results, and identifies Profile, Following, Friends and others as surfaces that may appear when For You is selected. Corresponding entries exist, but treating each sub-surface as independently selectable would overstate the source; eligibility varies by market and objective.
4. **LinkedIn — PASS, sample:** [LinkedIn Ads guide](https://business.linkedin.com/advertise/ads/ads-guide) describes single image, video, document and sponsored messaging; corresponding general or LinkedIn-specific entries exist. The page does not establish every list entry or every combination.

## Short fix list

1. Split creative medium, platform ad product and delivery behavior into separate axes, or specify enforceable precedence and preserve the omitted attributes; include regression cases for video, bumper and non-skippable.
2. Separate filter-only families/wildcards from concrete channel values and document multi-membership for overlapping groups such as EU/EEA. Do not claim all lists are mutually exclusive.
3. Reconcile YouTube Playables and other intended coverage against official sources; verify Meta placement details via an accessible official page and keep sub-surfaces distinct from selectable placements.
4. Extend independent coverage checks to structured metadata, condition operands and other uses, and add artifact-level negative tests. Keep platform availability dependent on actual account, objective and market.

Scratch script and five broken copies: `.runs/scratch/independent-jsonschema/`. The requested validator calls `scripts/validate_schemas.py`, which rewrites `review/schema-validation.json` and `review/schema-counts.md`; this side effect was discovered after running it. No content difference from their pre-run state can be established here because this directory has no Git baseline. No other project files were intentionally edited.
