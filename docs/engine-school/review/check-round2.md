# Independent check — round 2

2026-11-13. Scope: the changed skills and metadata described in `review/fixes-round2.md`; no broader audit. A sample was deliberately selected across Hopkins, Ogilvy, Google and Meta, rather than randomly selected. For each sampled row, “pass” means both the flag and the source summary pass; “problem” identifies the failing part. Definitions follow the round-two report: a mandatory gate, more specific documentation, or operational requirement beyond the source makes `house_rule` true.

## (a) Health claims — pass

- `lov-mat-godkjent-helsepastand`: **Pass.** Article 28(5) covers Article 13(1)(a) subject to the regulation and applicable national provisions. Article 28(6) covers other specified claims subject to historical lawful use and its separate notification/application conditions. The skill requires current status and evidence and does not treat on-hold status as permission.
- `lov-mat-generell-helsefordel`: **Pass.** The default accompaniment requirement and the separately documented Article 28(6) exception reflect the judgment's paragraph 83 and operative part. The skill does not make pending status or paragraph 5 alone sufficient.
- `lov-mat-ikke-vekttapstall`: **Pass.** Article 12(b) prohibits claims referring to the rate or amount of weight loss; the skill does not treat the relevant transitional provisions as a general exemption.
- `lov-mat-sukkerfri-grense`: **Pass.** The 0.5 g per 100 g or 100 ml limit concerns a nutrition claim, and the botanical health-claim transition is not a general exemption from it.

Sources: [EUR-Lex, C-386/23 judgment PDF](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:62023CJ0386), especially paragraphs 19, 55–60, 66 and 83; [EUR-Lex corrected regulation](https://eur-lex.europa.eu/eli/reg/2006/1924/corrigendum/2007-01-18/oj/eng); [Commission register](https://food.ec.europa.eu/food-safety/labelling-and-nutrition/nutrition-and-health-claims/eu-register-health-claims_en). The consolidated HTML URL was opened but presented a robot check; the EUR-Lex judgment PDF opened and reproduces Article 28(5)–(6). The EUR-Lex search index provided the corrected regulation text; this is a limitation on direct access to the consolidated HTML, not a claim to have read that page.

## (b) Meta — pass, 2/2

- `plattform-meta-budskap-tre-sekunder`: **Pass.** [Official Instagram video advice](https://www.facebook.com/business/help/188534925073536?locale=en_US) says to feature brand and key message in the first three seconds. The mandatory gate and its extension to Meta video are explicitly Fume's. `verified: true` is supported for the stated source advice.
- `plattform-karusell-maks-ti-kort`: **Pass.** [Official carousel advice](https://www.facebook.com/business/help/927639917355563?locale=en_US) describes two or more images/videos and up to ten cards. `verified: true` and the 2–10 rule are supported.

Both pages were independently fetched with curl using `locale=en_US`; relevant content appeared in the returned HTML. Browser open alone redirected to a block page.

## (c) Deadline and locators — pass

- `lov-eu-ekte-tidsfrist`: **Pass.** A stored sourced end fact, source version, check against decision/setup/history and prepublication result are required. Missing or uncertain evidence, history or check stops publication and immediately goes to a human. The stored fields are explicitly a Fume gate.
- `leseren-ekte-knapphet`: **Pass.** Repeats the sourced deadline gate and human escalation, and adds sourced inventory/capacity checks.
- `lov-eu-avgrens-miljopastand`: **Pass.** Local sustainability guidance supports overall impression, scope and necessary explanation; the Norwegian qualifier is explicit.
- Forbrukertilsynet sale guidance locators: **Pass.** Local text places documentation on page 4 §2 and page 13 §3.6; frequency/history and price changes on pages 7–10 §§3.3–3.4; conditions and ordinary prices on pages 15–17 §§4.3–4.5; routines and campaign history on page 19 §6. Section 4.5 continues onto page 18; the cited page 17 contains its heading and substantive beginning, so the locator is valid though page 18 would improve completeness.
- Sustainability guidance locators: **Pass.** Local PDF markers 4–5 cover printed pages 6–8, §§3.2–3.4.3, including overall impression, documentation and explanation; printed page 8 is on PDF page 5.

## (d) Metadata completeness and sample

**Completeness: pass.** Parsed all six skill JSON arrays: 220/220 have a boolean `house_rule` and a nonempty string `source_says`; 192 are true and 28 false. This is a presence/type check, not a semantic review of all 220.

### 15 sampled `true` skills

| Skill ID | Result | Evidence / reason |
| --- | --- | --- |
| `copy-overskrift-viser-relevans` | Pass | Hopkins describes selecting interested readers; the required named item and failure gate are Fume's. |
| `copy-overskrift-holder-loeftet` | Pass | Headline relevance is supported; mandatory answer in copy or linked page adds a gate. |
| `copy-overskriftsalternativer` | Pass | Hopkins describes different headline appeals and comparisons; three alternatives is Fume's threshold. |
| `copy-spor-overskriftstesten` | Pass | Hopkins compares keyed headline results; variant IDs and stored text are added controls. |
| `copy-fordel-for-leseren` | Pass | Hopkins emphasizes service to the buyer; a concrete benefit before every CTA is more specific. |
| `copy-konkret-produktegenskap` | Pass | Hopkins favors specificity; the enumerated observable categories and pass gate add detail. |
| `copy-tall-med-grunnlag` | Pass | Hopkins favors precise claims; the evidence fields add a documentation gate. |
| `copy-avgrens-superlativer` | Pass | Hopkins criticizes exaggerated generalities; comparison group, criterion and evidence are added. |
| `copy-les-hoeyt-og-rett` | Pass | Ogilvy recommends reading aloud after a delay; the conditional logged human test and corrections add a workflow. |
| `copy-annen-leser-kontrollerer` | Pass | Ogilvy recommends a colleague improve important writing; named reviewer and closure of all findings add a gate. |
| `plattform-meta-budskap-tre-sekunder` | Pass | Instagram advice is accurately summarized; mandatory cross-Meta gate is additional. |
| `plattform-youtube-ett-hovedbudskap` | Pass | Google recommends focused messaging; one named message and mandatory alignment are extra. |
| `plattform-youtube-handling-synlig-og-hoerbar` | Pass | Google recommends reinforcing an onscreen CTA with voice; mandatory identical CTA is extra. |
| `plattform-youtube-vurdering-vis-bruk` | Pass | Google recommends showing how the product works/fits life; mandatory actual use and result add detail. |
| `plattform-youtube-handling-etter-kontekst` | Pass | Google recommends the ask after context; product and concrete benefit before the first CTA are extra. |

### 5 sampled `false` skills

| Skill ID | Result | Evidence / reason |
| --- | --- | --- |
| `copy-kontroller-sitater` | **Problem: flag** | `source_says` accurately summarizes Ogilvy's advice to check quotations, but the requirement for an original source and an automatic failure when missing is an additional documentation gate. Under the stated definition this should be `true`. |
| `copy-mottakeren-vet-neste-steg` | **Problem: flag** | The source summary is accurate, but Ogilvy's advice becomes a mandatory failure rule for every response-seeking email with a specified action. This operational gate makes it `true` under the stated definition. |
| `plattform-karusell-maks-ti-kort` | Pass | Both the summary and 2–10 substantive control follow Meta's cited description. |
| `plattform-google-sertifikat-person-og-dato` | **Problem: flag** | Google supports individual, current product-area certification; `source_says` is accurate. Requiring documentation showing the person, product area and expiry date before passing adds a specific evidence gate, so the stated definition calls for `true`. |
| `plattform-google-partner-er-egen-status` | **Problem: flag** | Google distinguishes individual certification and company Partner status; `source_says` is accurate. Mandatory documentation of current company status adds an evidence gate beyond the cited wording, so the stated definition calls for `true`. |

Sample sources: [Hopkins, Scientific Advertising, chapters 3, 5 and 7](https://www.scientificadvertising.com/ScientificAdvertising.pdf); [Ogilvy memo, points 6–9](https://fs.blog/david-ogilvy-10-tips-on-writing/); [Google ABCDs](https://support.google.com/google-ads/answer/14783551?hl=en); [Google certification guidance](https://support.google.com/google-ads/answer/9702955?hl=en); Meta URLs above.

**Tally:** (a) 4/4 skills pass; (b) 2/2 pass; (c) 5/5 checks pass; metadata completeness 220/220; sample 16/20 pass, 4 flag problems and no inaccurate `source_says` found in the sample. The sample is not evidence that unsampled flags are correct.
