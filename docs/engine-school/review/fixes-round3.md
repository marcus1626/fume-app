# Rettinger, runde 3 del A — Trakt — PROPOSED

2026-11-13. Lest `BRIEF.md`, de siste oppføringene i `NOTES.md` og hele `review/fixes-round2.md`, inkludert etterkontrollen. Alle eksisterende 220 ferdighets-ID-er og øvrige ferdighetsfelt er beholdt. Bare `applies_when.funnel` er lagt til i de eksisterende ferdighetene. Nye definisjoner er på bokmål, `lang: nb`, `state: PROPOSED`; ingen annonser eller Engine-kjøringer er utført.

## Nye kilder

**11 nye oppføringer med subject Trakt**, 82 → 93 i pensum, uten duplikate URL-er. Alle nye URL-er er forsøkt med curl GET med omdirigering; 9 ga HTTP 200 med relevant innhold. De to norske veiledningene ga curl 406 med tomt svar, men faktisk kildeinnhold ble hentet og lest via Firecrawl med HTTP 200 etter nettsøk. `url_status` skiller metodene og dokumenterer feilene. PDF-ene ble også lest gjennom web-verktøyet. HTTP 200 alene er ikke regnet som innholdsbekreftelse.

| Kilde | Verifisert URL | Uttak og avgrensning |
| --- | --- | --- |
| IPA / Binet & Field — The Long and the Short of It, gratis presentasjon | [https://ipa.co.uk/media/14463/long_and_short_of_it_presentation_final_030424.pdf](https://ipa.co.uk/media/14463/long_and_short_of_it_presentation_final_030424.pdf) | ok (2026-11-13; curl GET HTTP 200, 931752 byte; innhold lest; PDF også åpnet og lest med web.open); Gratis presentasjon av ti prinsipper; den fullstendige rapporten er ikke brukt som gratis fulltekst. |
| Binet & Field — The 5 Principles of Growth in B2B Marketing, rapport | [https://business.linkedin.com/content/dam/lem/business/en/advertise/resources/b2b-institute/b2b-research/LIN_B2B-Marketing-Report-Digital-v02.pdf](https://business.linkedin.com/content/dam/lem/business/en/advertise/resources/b2b-institute/b2b-research/LIN_B2B-Marketing-Report-Digital-v02.pdf) | ok (2026-11-13; curl GET HTTP 200, 1250948 byte; innhold lest; PDF også åpnet og lest med web.open); Gratis rapport-PDF fra LinkedIn B2B Institute; lite utvalg av IPA-caser begrenser generalisering. |
| Ehrenberg-Bass — Effective brand growth: Acquisition or retention? | [https://marketingscience.info/news-and-insights/effective-brand-growth-acquisition-or-retention](https://marketingscience.info/news-and-insights/effective-brand-growth-acquisition-or-retention) | ok (2026-11-13; curl GET HTTP 200, 195849 byte; innhold lest); Gratis fagartikkel med referanser; How Brands Grow er en betalt bok og er ikke brukt som fulltekst. |
| LinkedIn B2B Institute — 95-5 Rule | [https://business.linkedin.com/advertise/resources/b2b-institute/b2b-research/trends/95-5-rule](https://business.linkedin.com/advertise/resources/b2b-institute/b2b-research/trends/95-5-rule) | ok (2026-11-13; curl GET HTTP 200, 89232 byte; innhold lest); Gratis artikkel av Ty Heath om instituttets forskning; overskriftstallet er ikke et lokalt estimat. |
| Google / The Behavioural Architects — Navigating purchase behavior and decision-making | [https://business.google.com/en-all/think/consumer-insights/navigating-purchase-behavior-and-decision-making/](https://business.google.com/en-all/think/consumer-insights/navigating-purchase-behavior-and-decision-making/) | ok (2026-11-13; curl GET HTTP 200, 232239 byte; innhold lest; effektiv URL https://business.google.com/en-all/think/consumer-insights/navigating-purchase-behavior-and-decision-making/?ucbcb=1); Gratis artikkel om Messy Middle-studien; observasjoner og simulerte kjøp er ikke lokale salgseffekter. |
| Think with Google — The Messy Middle: How behavioural science can help you avoid a pricing race to the bottom | [https://business.google.com/en-all/think/consumer-insights/messy-middle-2023/](https://business.google.com/en-all/think/consumer-insights/messy-middle-2023/) | ok (2026-11-13; curl GET HTTP 200, 240141 byte; innhold lest; effektiv URL https://business.google.com/en-all/think/consumer-insights/messy-middle-2023/?ucbcb=1); Gratis artikkel om studie av fem kategorier i Australia i 2023; ikke en norsk effektgaranti. |
| Amazon Ads — What is a marketing funnel? | [https://advertising.amazon.com/en-gb/library/guides/marketing-funnel](https://advertising.amazon.com/en-gb/library/guides/marketing-funnel) | ok (2026-11-13; curl GET HTTP 200, 477957 byte; innhold lest); Gratis plattformguide; modellbeskrivelsen brukes, ikke produktanbefalingene som uavhengig evidens. |
| LinkedIn Ads — Marketing Funnel Stages | [https://business.linkedin.com/nl/nl/advertise/resources/marketing-terms/stages-of-the-marketing-funnel](https://business.linkedin.com/nl/nl/advertise/resources/marketing-terms/stages-of-the-marketing-funnel) | ok (2026-11-13; curl GET HTTP 200, 228034 byte; innhold lest); Gratis engelsk veiledning på nederlandsk lokalitetssti; kommersiell plattformveiledning. |
| Norge — Prisopplysningsforskriften | [https://lovdata.no/dokument/SF/forskrift/2012-11-14-1066](https://lovdata.no/dokument/SF/forskrift/2012-11-14-1066) | ok (2026-11-13; curl GET HTTP 200, 120231 byte; innhold lest; web.open HTTP 405, faktisk § 9a lest i curl-HTML); Gratis gjeldende forskrift hos Lovdata, sist endret med virkning fra 01.01.2026; § 9a er lest. |
| Forbrukertilsynet — Salg og bruk av førpriser | [https://www.forbrukertilsynet.no/vi-jobber-med/prismarkedsforing/salg-og-bruk-av-forpriser](https://www.forbrukertilsynet.no/vi-jobber-med/prismarkedsforing/salg-og-bruk-av-forpriser) | ok (2026-11-13; curl GET failed: HTTP 406, 0 byte; Firecrawl HTTP 200, relevant innhold lest; offisiell side funnet med nettsøk); Gratis offisiell veiledning, oppdatert 28.08.2025; forvaltningsveiledning må skilles fra forskrift. |
| Forbrukertilsynet — Betingede tilbud | [https://www.forbrukertilsynet.no/vi-jobber-med/prismarkedsforing/betingede-tilbud](https://www.forbrukertilsynet.no/vi-jobber-med/prismarkedsforing/betingede-tilbud) | ok (2026-11-13; curl GET failed: HTTP 406, 0 byte; Firecrawl HTTP 200, relevant innhold lest; offisiell side funnet med nettsøk); Gratis offisiell veiledning, oppdatert 18.03.2025; eksempeltabeller er ikke universelle lovgrenser. |

Binet & Field er lest i gratis originalrapport fra LinkedIn og IPAs gratis presentasjon, ikke bare portalomtaler. Brukte sidesteder står i ferdighetene, særlig B2B-rapportens trykte side 11–17 / PDF-side 12–18, og IPA PDF-side 25, 31 og 34. B2B-rapporten forbeholder seg lite utvalg og varierende optimal balanse. Ingen fast 60/40-, 46/54- eller 95/5-port er innført. Googles funn er modell- og studiegrunnlag, ikke norsk salgsprognose. Amazon og LinkedIn er kommersielle plattformguider; de brukes til oppgaveinndeling, ikke som uavhengig effektbevis.

Schwartz er gjenlest i den eksisterende gratis sekundærforklaringen fra Destini Copp, seksjonen «The five levels, in plain words». Den betalte boken er ikke lest som gratis fulltekst, og ingen ny duplikatoppføring er lagt til. Nummereringen er beholdt: 1 kjenner ikke problemet → 5 kjenner og ønsker produktet.

Den eksisterende norske veiledningen «Salg og betingede tilbud (2025)» er lest i den allerede lagrede tekstfilen med sidemarkører (side 4, 6–10, 13 og 15–17), supplert med de nye, faktisk hentede nettsidene. Særlig er varer/tjenester, allment tilgjengelige klubbpriser, gradvis nedsettelse, betingede tilbud, kampanjelengde og reell prisfordel skilt. Eksempeltabellene er ikke gjort til universelle lovgrenser. Den kildebelagte fristporten fra runde 2 er videreført.

### Tilgangsfeil og alternativer

- Lovdata med paragrafsti `https://lovdata.no/forskrift/2012-11-14-1066/§9a` var utilgjengelig i web-verktøyet; dokumentstien ga web 405, men curl HTTP 200 med faktisk gjeldende § 9a. Dokumentstien er ny pensumoppføring.
- Den prøvde stien `https://www.forbrukertilsynet.no/lov-og-rett/veiledninger-og-retningslinjer/prisveiledning` var utilgjengelig i web-verktøyet. Den prøvde stien med sluttleddet `forbrukertilsynets-veiledning-om-prismarkedsforing` ga web-timeout, curl 406 og faktisk Firecrawl 404. Ingen av disse er pensumført som fungerende kilder. Nettsøk fant de to korrekte sidene under `/vi-jobber-med/prismarkedsforing/`, se tabellen.
- Den gamle salgs-PDF-en ga curl 406 og web-timeout ved denne kontrollen. Tidligere hentestatus i eksisterende pensumoppføring er ikke overskrevet. Lokalt, allerede eksisterende uttak og de to ferskt hentede veiledningssidene er brukt; det påstås ikke at PDF-nettuttaket lyktes denne gangen.
- Google-URL-ene la til `?ucbcb=1`; faktisk artikkelinnhold og tittel ble kontrollert i curl-HTML. LinkedIn-guiden har engelsk innhold på nederlandsk lokalitetssti. Begge forhold er oppgitt i metadata der relevant.

Ingen nye opphavsrettsbeskyttede fulltekster er lagret i prosjektet. Midlertidige nettuttak ligger bare i `/tmp` eller verktøyets minne; ferdighetene bruker egne formuleringer, presise locators og ingen sitater.

## Trakt som eget fag

`skills/Trakt.json`: manglet → **31 sjekkbare ferdigheter**, alle med `trakt-`-ID, `house_rule: true`, eget `source_says`, konkrete beståttvilkår, eksempler, anvendelse og kildelocator. Kildetype er beholdt i `tier`; Fumes arbeidsporter fremstilles ikke som kildenes egne terskler.

Temaene er trinn og ikke-lineær kjøpsreise, kundestatus, kjøpsberedskap, merkebygging/høsting, lokal budsjettbalanse og måling, penetrasjon og lojalitetsmål, innhold og forespørsel i trinnene, kildebasert Schwartz-vurdering, salgsrunder, norske prisregler, reell knapphet og sporbar filtrering. Salgsrunde er et separat planvalg og tillegg til hovedtrinnet; salgsrunde er ikke automatisk prisnedsettelse. `hosting` er den bestilte maskinverdien for høsting/salgsaktivering.

## Traktmerking av eksisterende ferdigheter

220 av 220 har fått `{stage, mode}`. Merkingen er først gruppert i et skript og deretter gjennomgått mot reglene, ikke bare navnene. De fem Schwartz-ferdighetene har trinn `alle`: kunnskap og trinn er uavhengige akser, og eksisterende `awareness_level` avgrenser dem. Et uvanlig, men begrunnet nivå i et trinn skal fortsatt aktivere riktig leserkontroll.

182 har `stage: alle`, **38 har avgrensede trinn**. De brede anvendelsene gjelder særlig faktagrunnlag, språk, testredelighet, teknisk utførelse, generelle forsknings-/briefkontroller og lov. Alle Lov-ferdighetene har `alle/begge`: pris-, bevis-, samtykke- og andre rettslige utløsere kan forekomme i både merkeannonser, salgsannonser og oppfølging. Deres egne vilkår og opprinnelige kanal-/land-/markedsfelt avgrenser faktisk relevans. Avgrensede trinn gjelder konkrete vurderings-, kjøps-, oppfølgings- og merkebyggingsoppgaver. Ingen regler er fjernet for å oppnå en ønsket tallfordeling.

| Lagret stage-verdi | Antall eksisterende ferdigheter |
| --- | ---: |
| `alle` | 182 |
| `midt,bunn,salgsrunde` | 4 |
| `midt,bunn,salgsrunde,lojalitet` | 19 |
| `topp,midt` | 1 |
| `midt,bunn,lojalitet` | 3 |
| `midt` | 1 |
| `topp,midt,lojalitet` | 10 |

Modus: **202 begge, 10 merkebygging, 8 hosting**. Med `alle` utvidet til hvert trinn: **topp 193, midt 220, bunn 208, salgsrunde 205, lojalitet 214**. Dette er overlappende dekning før kanal, nivå, marked og land filtreres, ikke fem gjensidig utelukkende grupper.

### Full feltlogg: manglet → ny verdi

Alle øvrige felt i disse 220 ferdighetene er kontrollert uendret mot kopien før runden.

| Fil | ID | `applies_when.funnel.stage` | `mode` |
| --- | --- | --- | --- |
| `skills/Copy.json` | `copy-overskrift-viser-relevans` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-overskrift-holder-loeftet` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-overskriftsalternativer` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-spor-overskriftstesten` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-fordel-for-leseren` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-proevetilbudets-vilkaar` | manglet → `midt, bunn, salgsrunde` | manglet → `hosting` |
| `skills/Copy.json` | `copy-konkret-produktegenskap` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-tall-med-grunnlag` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-avgrens-superlativer` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-svar-paa-kjoepsspoersmaal` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `begge` |
| `skills/Copy.json` | `copy-uavhengig-av-forrige-annonse` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-bevis-for-hovedloeftet` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-proeven-lar-leseren-proeve` | manglet → `midt, bunn, salgsrunde` | manglet → `hosting` |
| `skills/Copy.json` | `copy-bestill-proeven-tydelig` | manglet → `midt, bunn, salgsrunde` | manglet → `hosting` |
| `skills/Copy.json` | `copy-samme-avsenderstemme` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-be-om-en-handling` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `begge` |
| `skills/Copy.json` | `copy-foelg-opp-samme-interesse` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `begge` |
| `skills/Copy.json` | `copy-forklar-ukjent-produktnavn` | manglet → `topp, midt` | manglet → `begge` |
| `skills/Copy.json` | `copy-vanlig-prosess-er-ikke-enerett` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-beskriv-den-faktiske-prosessen` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-navngi-den-virkelige-opphavspersonen` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-kontroller-sitater` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-les-hoeyt-og-rett` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-annen-leser-kontrollerer` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-mottakeren-vet-neste-steg` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-ett-tema-per-avsnitt` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-mellomtittel-navngir-innhold` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-oppregning-som-liste` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-lenk-til-faglig-grunnlag` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-vis-sammenhengen` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-sammendrag-i-lange-brev` | manglet → `midt, bunn, lojalitet` | manglet → `begge` |
| `skills/Copy.json` | `copy-menneskelig-korrektur` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-selvforklarende-skjemafelt` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `begge` |
| `skills/Copy.json` | `copy-navngi-den-som-handler` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-bruk-verb-for-handlinger` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-riktig-tid-i-produktbeskrivelsen` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-overskriftsnivaa-viser-struktur` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-unngaa-hele-setninger-med-versaler` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-test-tekstutkastet-tidlig` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-test-rettingen` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-leseren-forklarer-med-egne-ord` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-test-med-relevante-lesere` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-ikke-forklar-fasiten-i-testen` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-temaord-tidlig-i-titler` | manglet → `alle` | manglet → `begge` |
| `skills/Copy.json` | `copy-kontroller-tekst-paa-mobil` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-samlet-skisse` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-bildets-bidrag` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-felles-utvikling` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-sted-i-fortelling` | manglet → `topp, midt, lojalitet` | manglet → `merkebygging` |
| `skills/Idé.json` | `ide-handling-med-utvikling` | manglet → `topp, midt, lojalitet` | manglet → `merkebygging` |
| `skills/Idé.json` | `ide-figur-med-handling` | manglet → `topp, midt, lojalitet` | manglet → `merkebygging` |
| `skills/Idé.json` | `ide-folelsestest` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-noytral-reaksjon` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-avsender-i-test` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-metafor-med-forbindelse` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-samme-ide-i-kanaler` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-studentcase-status` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-typografi-baerer-mening` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-symbol-med-betydning` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-handling-for-saken` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-konkret-hverdagsproblem` | manglet → `midt, bunn, lojalitet` | manglet → `begge` |
| `skills/Idé.json` | `ide-test-med-berorte` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-praktisk-losning` | manglet → `midt, bunn, lojalitet` | manglet → `begge` |
| `skills/Idé.json` | `ide-innsikt-som-har-endret-seg` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-bevar-kjernen` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-case-riktig-merke` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-tiltak-bak-saken` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-rapportert-ikke-bevist` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-begrunn-endringer` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-bevar-baerende-grep` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-bilde-med-oppgave` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-test-visuelt-valg` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-grunn-til-a-bytte` | manglet → `midt, bunn, salgsrunde` | manglet → `begge` |
| `skills/Idé.json` | `ide-sammenlign-ideer` | manglet → `alle` | manglet → `begge` |
| `skills/Idé.json` | `ide-ny-hypotese-etter-avslag` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-begrunn-kunnskapsnivaa` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-ukjent-problem` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-kjent-problem` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-kjent-loesning` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-kjent-produkt` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-klar-for-kjoep` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-allerede-kunde` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `hosting` |
| `skills/Leseren.json` | `leseren-situasjon-og-fremgang` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-tre-sider-av-jobben` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-alternativet-i-hverdagen` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-uro-ved-bytte` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-rekonstruer-bytte` | manglet → `topp, midt, lojalitet` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-fire-byttekrefter` | manglet → `topp, midt, lojalitet` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-aapne-intervjuspoersmaal` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-observasjon-og-tolkning` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-kartlegg-friksjon` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-presis-handling` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-begrunn-tidspunkt` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-innsats-naa` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-planlegg-handlingen` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-majoritet-med-grunnlag` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-maal-handling` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-gi-foer-du-ber` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-ekte-knapphet` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-relevant-autoritet` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-frivillig-forpliktelse` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-sammenlignbare-andre` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-rettferdig-sammenligning` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-overskrifter-for-skumming` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-svar-foerst` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-navngi-leseoppgaven` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-lenken-holder-loeftet` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-lenkeomtale-gir-detaljer` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-lettlest-er-ikke-bevis` | manglet → `alle` | manglet → `begge` |
| `skills/Leseren.json` | `leseren-forkunnskap-foer-faguttrykk` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-no-dokumentasjon-for-publisering` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-no-egenskaper-stemmer` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-no-synlig-reklame` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-no-pris-med-tillegg` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-no-selgerens-identitet` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-no-opplys-angrerett` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-no-forklar-omtaleverifisering` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-no-samtykke-elektronisk` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-no-kundeunntak` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-no-gratis-avmelding` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-no-barn-kjopspress` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-no-barn-sosialt-press` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-no-b2b-faktasjekk` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-no-garantivilkar` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-no-forvekslende-etterligning` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-de-samme-behov` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-de-etterprovbar-sammenligning` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-de-telefon-samtykke` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-de-oppbevar-telefonsamtykke` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-de-epost-grunnlag` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-de-forklar-rangering` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-de-forklar-omtaler` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-eu-godkjenning-av-merker` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-eu-ekte-tidsfrist` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-eu-avgrens-miljopastand` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-eu-ikke-eksklusive-lovrettigheter` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-eu-merk-betalt-rangering` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-eu-ekte-kundeomtaler` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-eu-gratis-uten-skjulte-gebyrer` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-eu-ikke-utgi-selger-for-kunde` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-mat-godkjent-helsepastand` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-mat-generell-helsefordel` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-mat-ikke-vekttapstall` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-mat-sukkerfri-grense` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-uk-forbehold-uten-motsigelse` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-uk-tillatelse-til-kundeuttalelse` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-uk-opplys-belonnede-omtaler` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-google-ekte-grensesnitt` | manglet → `alle` | manglet → `begge` |
| `skills/Lov.json` | `lov-google-finnbart-tilbud` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-plassering-stoetter-format` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-test-ulike-metaformater` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-meta-budskap-tre-sekunder` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-karusell-maks-ti-kort` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-samling-koblet-til-katalog` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-youtube-merke-foer-fem` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-youtube-ett-hovedbudskap` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-youtube-handling-synlig-og-hoerbar` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-youtube-vurdering-vis-bruk` | manglet → `midt` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-youtube-handling-etter-kontekst` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `hosting` |
| `skills/Plattform.json` | `plattform-google-lever-flere-sideforhold` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-youtube-skaper-kategorirelevans` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-shorts-ekte-produktbruk` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-tiktok-staaende-video` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-tiktok-minst-720p` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-tiktok-frie-grensesnittsoner` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-tiktok-fungerende-lyd` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-tiktok-innholdslovfte-tre-sekunder` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-tiktok-aapningsgrep-seks-sekunder` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-tiktok-aapning-budskap-handling` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-tiktok-kontroller-undertekster` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-tiktok-ulike-testvarianter` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-tiktok-plan-for-utskifting` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-tiktok-sporbart-materiell` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-tiktok-dater-trendvalget` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-tiktok-hendelse-svarer-til-handling` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-tiktok-registrer-attribusjonsvinduer` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-sammenlign-like-maalegrunnlag` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-tiktok-splittest-med-hypotese` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-google-sertifikat-person-og-dato` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-google-partner-er-egen-status` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-google-tilbud-finnes-paa-maalsiden` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-google-ingen-falske-knapper` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-google-vis-betalingsmodellen` | manglet → `alle` | manglet → `begge` |
| `skills/Plattform.json` | `plattform-ingen-ki-ugc-eller-falske-kunder` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-felles-brief` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-avklar-uenighet` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-lokal-vekstevidens` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-penetrasjonshinder` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-lette-kjopere` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-sammenlign-kjoperprofiler` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-kartlegg-merkeelementer` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-mal-for-merkeendring` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-merkeelement-nytt-marked` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-konkret-kjopssituasjon` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-kjoperskapte-situasjoner` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-troverdig-kjopssituasjon` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-konkurranse-per-situasjon` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-kommersiell-situasjonsverdi` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-ett-budskap-per-annonse` | manglet → `topp, midt, lojalitet` | manglet → `merkebygging` |
| `skills/Strategi.json` | `strategi-merke-og-situasjon-sammen` | manglet → `topp, midt, lojalitet` | manglet → `merkebygging` |
| `skills/Strategi.json` | `strategi-bredere-situasjonsnettverk` | manglet → `topp, midt, lojalitet` | manglet → `merkebygging` |
| `skills/Strategi.json` | `strategi-kjopbarhet` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-mal-mentale-koblinger` | manglet → `topp, midt, lojalitet` | manglet → `merkebygging` |
| `skills/Strategi.json` | `strategi-sov-sammenligningsgrunnlag` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-begrunn-budsjettbalansen` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-nye-kjopere` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-fremtidige-kjopere` | manglet → `alle` | manglet → `merkebygging` |
| `skills/Strategi.json` | `strategi-folelsens-rolle` | manglet → `topp, midt, lojalitet` | manglet → `merkebygging` |
| `skills/Strategi.json` | `strategi-salgsutlosende-informasjon` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `hosting` |
| `skills/Strategi.json` | `strategi-kortsiktig-og-langsiktig-maling` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-pris-og-volum` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-samspill-merke-og-salg` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-prospektdekning` | manglet → `alle` | manglet → `merkebygging` |
| `skills/Strategi.json` | `strategi-effektniva` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-respons-er-ikke-salg` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-kampanjens-rammer` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-konkurrentgrunnlag-for-loftet` | manglet → `alle` | manglet → `begge` |
| `skills/Strategi.json` | `strategi-test-for-oppskalering` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `hosting` |
| `skills/Strategi.json` | `strategi-kundeverdi-fremfor-svar` | manglet → `midt, bunn, salgsrunde, lojalitet` | manglet → `hosting` |
| `skills/Strategi.json` | `strategi-rekkevidde-frekvens-og-leveranse` | manglet → `alle` | manglet → `begge` |

## Flyter og inngangskontrakter

`flows/kampanjekort.json`: manglet → obligatorisk førsteflyt med seks steg: kode samler grunnlag → menneske avklarer → modell lager kort → kode filtrerer → annen faktisk modell kritiserer → menneske godkjenner. Hvert steg skriver ett navngitt JSON-artefakt med egen validering. Modellen skriver bare planutkast; all brief-, løfte-, idé- og annonsetekst kommer etter bestått kort.

Kortets feltkontrakt angir trinn, kundestatus, salgsrunde med kilde og periode, modus, begrunnet Schwartz-nivå, forespørselens tid/penger/data/binding, måling og ferdighetsvalg. Hver del har ett hovedtrinn og én modus; salgsrunde legges til når aktiv. Flere oppgaver kjøres i egne deler og versjonsbundne kjeder. Ingen direkte kobling fra trinn til Schwartz brukes som fasit. Ukjent kunnskap behandles som usikkerhet med menneskevurdering og undersøkelsesplan, aldri som observert faktum.

Filteret har eksplisitte predikater: trinntreff (OR innen listen), modus, nivå, kanal, marked og land kombineres med AND. Eksakte kanal-/territorieetiketter må være godkjent og begrunnet; ukjent er blokkering. Hver bibliotek-ID får utvalgslogg og bibliotekhash. Alle valgte konfliktpar identifiseres og krever begrunnet avgrensning. Lov- og etikkporter kan ikke slås av av markedsføringsfilteret. Fire konkrete maskinlesbare eksempler er lagt inn.

`flows/_index.json`: 16 → 17 flyter; kampanjekort er `order: 1`, avhengighetsfri og leser `oppdrag.json`. Briefen leser kortets godkjente utdata og avhenger av kampanjekortet. De tidligere ni kjerneflytene er nå order 2–10; de sju tilleggsflytene og deres innskuddsrekkefølge er bevart. Indekssammendrag, pekere, scope, ruteregel og overleveringsregel er oppdatert. Detaljer ligger i `campaign_card_rule`.

**Alle 16 eksisterende flyter** har nye `input_fields.kampanjekort`, inngangsport, kontroll i første steg og videreføringsregel. Kortet leses via det ene kjedeartefaktets validerte manifest med aktiv del_id, versjon og SHA-256, ikke som uvalidert ekstrafil. Nye fakta som endrer kortet returneres til kampanjekort og ugyldiggjør berørte etterfølgere. Dette unngår en sirkulær startavhengighet til brief eller leserkort.

| Flyt endret | Konkret tillegg utover felles inngangskontrakt |
| --- | --- |
| `brief-en-setning` | Ny input og første stegs input: oppdrag.json → godkjent kampanjekort; oppdragsgrunnlaget følger manifestet. |
| `leserkort` | Etterprøver kortets nivå; nytt nivå krever retur og ny kortgodkjenning. |
| `innsiktsjakt` | Leser og viderefører kampanjekortets aktive del og ferdighetsutvalg med validerte referanser. |
| `konkurrenter-for-loftet` | Leser og viderefører kampanjekortets aktive del og ferdighetsutvalg med validerte referanser. |
| `logikkjede` | Forespørselen følger kortet; merkebygging tvinges ikke til direkte kjøp. |
| `linjebredde-og-valg` | Leser og viderefører kampanjekortets aktive del og ferdighetsutvalg med validerte referanser. |
| `bilde-som-tredje-tanke` | Leser og viderefører kampanjekortets aktive del og ferdighetsutvalg med validerte referanser. |
| `lovsjekk-per-land` | Leser og viderefører kampanjekortets aktive del og ferdighetsutvalg med validerte referanser. |
| `testplan-ekte-annonser` | Måling følger hovedoppgave og tidshorisont; klikk eller raskt salg alene avgjør ikke merkebygging. |
| `merkeelement-revisjon` | Leser og viderefører kampanjekortets aktive del og ferdighetsutvalg med validerte referanser. |
| `merkevare-og-salgsaktivering` | Utdyper kortets fordeling; beslutter ikke trinn/modus for første gang senere i kjeden. |
| `klarsprak-revisjon` | Leser og viderefører kampanjekortets aktive del og ferdighetsutvalg med validerte referanser. |
| `kanalformat-tilpasning` | Leser og viderefører kampanjekortets aktive del og ferdighetsutvalg med validerte referanser. |
| `rekkevidde-og-medieplan` | Leser og viderefører kampanjekortets aktive del og ferdighetsutvalg med validerte referanser. |
| `resultater-og-laering` | Leser og viderefører kampanjekortets aktive del og ferdighetsutvalg med validerte referanser. |
| `east-tiltak-og-test` | Leser og viderefører kampanjekortets aktive del og ferdighetsutvalg med validerte referanser. |

Kritikerregelen fra tidligere runder er beholdt, inkludert betrodd attestasjon og sammenligning mot alle faktiske skrivermodeller i det rekursive sporet. Samme krav gjelder kortet. Første feil gir ett rettingsforsøk; **andre mislykkede forsøk per produsentsteg går til menneske**, også ved endret begrunnelse, modell eller versjon. Uverifiserbar identitet eller uavklart faglig belegg går straks til menneske.

## Validering

- Streng parsing av alle **26 JSON-filer**, med avvisning av duplikate nøkler og ikke-endelige tall. Felt, typer, enumverdier, språk/status, datoer, sjekkpunkter og kildehenvisninger er kontrollert.
- **251 unike ferdigheter**: 220 beholdte + 31 Trakt. De eksisterende ferdighetene er sammenlignet felt for felt; eneste endring er det nye funnel-objektet. Alle 251 har house_rule/source_says og gyldig funnel. 227 house_rule true, 24 false.
- **93 pensumoppføringer**, inkludert 11 nye med subject Trakt; unike URL-er. Alle kildepekere går til pensum, briefen eller allerede dokumenterte kildealiaser. Faktiske lokale kildestier finnes.
- Alle `skills_used`, `conflicts_with`, eksempel-ID-er og ferdighets-ID-er i regel-/flyttekst finnes. Alle **8 eksisterende konfliktpar er fortsatt gjensidige**, uten duplikater eller selvkonflikter. Nye Trakt-regler krever avgrensning fremfor å introdusere konkurrerende ubetingede regler; ingen nye konfliktpar er nødvendiggjort.
- **17 flyter, 86 unike steg-utdata, 105 gyldige JSON-pekere i indeksen**. Indekssammendrag samsvarer med flytene, standardkjeden er sammenhengende, avhengighetsgrafen er asyklisk, og kampanjekortet er første obligatoriske flyt. Hvert steg har egen validering og ett lagret utdataartefakt.
- Fire konkrete filterkontekster er beregnet mot faktiske ferdigheter: topp/merkebygging, bunn/høsting, lojalitet og norsk B2C-salgsrunde. Negative kontroller bekrefter at riktig trinn ikke overstyrer feil nivå, kanal, modus, marked eller land, og at salgsrunde-tillegget faktisk avgrenser salgsrunderegler.
- Alle flyters kortreferanse, to-forsøksgrense og krav om attestert modellskille er kontrollert. Ingen påstand om at disse definisjonene allerede håndheves av en kjørende Engine.

Kjøringer: `python3 /tmp/validate-round3.py` og `python3 /tmp/check_round3_extra.py`, begge bestått. Midlertidige kontrollskript og førkopi er i `/tmp`; ingen nye fulltekster er lagt i prosjektet. `NOTES.md` er appendert; briefen og tidligere gjennomganger er uendret.


## Runde 3, del B — skjemaer for hele kjeden (13. november 2026)

Alt er fortsatt **PROPOSED**. Lest `BRIEF.md`, hele smaksreferansen og SQL-migreringen, flytindeksen, alle flyter og skill-filer gjennom Python-kartlegging. Smaksskjemaets skille mellom kode, tolkning, merkeprofil og kampanjevalg er brukt; ingen databaseendring eller Engine-deploy er gjort.

### Leveranse og koblinger

- **95 feltregistre**, **805 lokale feltregistreringer**: seks områderegistre, et ferdighetsfilter, en felles artefaktkontrakt og ett register for hver av **87 eksakte lagringsstier** (oppdrag + 86 steg-utdata). `schemas/_index.json` beskriver import, domenereferanser, flyter, skills og alle artefaktbindinger. Felttall inkluderer objektforeldre og gjenbrukte kontraktfelt; importerte felt telles i sine egne registre. Full liste: [schema-counts.md](schema-counts.md).
- Områder: kampanje 24, leser 16, kategori 11, tilbud 13, kanal-format 17, merkevare-vs-kampanje 25, skill-filter 12 og artefakt-felles 38. Det eksterne oppdraget har fire lokale innholdsfelt i tillegg til felleskontrakten.
- Hvert felt har ID, gruppe, bokmålslabel, type, verdier med korte definisjoner (eller eksplisitt grunn til åpent felt), definisjon, utfyller, kilde og locator/Fume, Engine-valg/flyter, anvendelsesvilkår, scope, required og eksisterende read_by-ID-er. Betingelser skiller blant annet bilder fra video, manglende smak fra faktisk smak, og overstyringsforslag fra godkjente valg.
- Alle 17 flyters input, output_artifact og alle stegs input/output har navngitt skjema. Flytindeksen speiler bindingene, inkludert inngang, kortreferanser, endelig artefakt og valgfrie ruter. Runtime-rebinding må flytte både sti og skjema og kontrollere videreført grunnlag. Eksisterende stegtekster, roller, stier, ferdighetskandidater, valideringskrav og feilruter er bevart; nye struktur- og overstyringsporter er lagt til.
- Mellomartefakter har egne registre med trinnavhengig required. Felleskontrakten dekker versjon/hash, manifest, opphav/rettigheter, rekursivt modellspor og betrodd attest, kritikk, menneskevedtak, personvern og feilrute. Dette er feltregistre, ikke standardformatet JSON Schema eller en påstand om ferdig runtime-håndheving.

### Verdier og mapping

`review/schema-value-mapping.json` lagrer før/etter for alle **251 skills**, de eksplisitte kanal- og landmappingene og hash av uendret øvrig skill-innhold. Bare applies_when er endret i skills. Eksisterende trinn/modus, regeltekst, eksempler, kilder og konflikter er bevart.

Eksempler: `Meta-karusell` → kanal `meta` + format `karusell`; `TikTok-video med tale` → kanal `tiktok` + format `video` + utløser `tale`; `e-post og SMS` → OR mellom to kanaler; `Norge/Tyskland/Storbritannia` → `NO/DE/GB`; `EU` flyttes til legal_area. CAP, betalte medier, mat, rapportering, prisbudskap og egenmarkedsføring er selvstendige utløsere, ikke oppdiktede kanaler. Markedsføring av egne Google-tjenester kan ligge i andre kanaler og avgrenses derfor med utløseren.

Kampanjekortet har konkret filterkontekst per faktisk kanal-/format-/landkombinasjon, med kildebelegg separat. `scripts/schema_filter.py` bruker OR innen én dimensjon, AND mellom dimensjoner, eksplisitte format-/kanalfamilier og uavklart ved nødvendige mangler. Jokere finnes bare i biblioteket. To forskjellige annonser kan ikke levere hver sin halvdel av et filtertreff. Lov, etikk og strukturporter gjelder fortsatt uansett filter.

### Smak, konstanter og kampanjeavvik

`merkevare-vs-kampanje.json` har eksplisitt policy for merkeidentitet, produktidentitet og Fume-etikk, arvede felt og kampanjevalg. Appens measured-fakta kan ikke omskrives som et kreativt ønske. Profilversjon, kind, opptelt standing og grunnlag er bevart som egne begreper; cold start krever ingen oppdiktet profil. De 349 appfeltenes ID-er er ikke rekonstruert fra referanseteksten.

Det fiktive muay thai-eksemplet har merkeverdi `ikke-maskulint`, kampanjeverdi `maskulint`, aktivitetsspesifikk undergruppe, begrunnelse, menneskelig merkeansvarlig, tid, utløp, del/kampanje og før-/etterhash. Merkeprofilen endres ikke. Forslag uten menneskevedtak, modellgodkjenning, utløpt vedtak og forsøk på å overstyre etikk avvises. Kampanjekort, bildearbeid og kanaltilpasning har eksplisitte valideringsporter for dette.

### Kildeforankring

**22 nye kilder**, totalt **115 pensumoppføringer**; de opprinnelige 93 er uendret. Offisielle Meta-/Google-/TikTok-/LinkedIn-lister er kontrollert. Format, plassering, ressurs og kampanjemål holdes separat; read_on er lesedato, ingen tilgjengelighetsgaranti. Tall og anbefalinger får eget kravgrunnlag per konkret kombinasjon.

ISO alpha-2-listen har 249 koder: 248 fra engelsk UN M49-tabell og TW separat kontrollert mot portugisiske skattemyndigheters ISO-tabell. EU/CAP er ikke land; GB brukes i stedet for UK. Landnavnene i kodesnapshotet er identifiserende standardtekster, ikke bokmålsoversettelser eller juridiske territorievedtak.

Involvering bygger på Zaichkowskys relevanskonstrukt; Fumes arbeidsklasser er ikke PII-skårer. Kjøpsfrekvens angir kategori, periode og kjøpernevner, med egen Fume-inndeling av medianintervall. CEPs, JTBD og Schwartz er kontrollert mot de eksisterende åpne kildene. De seks B2B-rollene er kontrollert mot OpenStax, med LinkedIns produkt-/prosesseksperter som separat akse. B2C-rollene og budsjettklassene er tydelig Fume-valg. Helse, finans og alkohol utløser lokal fagkontroll og gir ingen markedsføringstillatelse.

Detaljert kildekontroll og feil/fallback: [schema-source-checks.json](schema-source-checks.json). Meta Help ga login/blokkering i web.open, men relevant hovedinnhold og formatmatrise ble hentet med Firecrawl HTTP 200. Demand Gen krevde også fallback. TikToks ulike varighetsangivelser er dokumentert som en konflikt som må avklares for valgt marked/oppsett. Ingen nye fulltekster er lagret i prosjektet.

### Validering og gjentakbarhet

Kommandoer: `python3 scripts/build_schemas.py` og `python3 scripts/validate_schemas.py`. Byggerskript, evaluator og veiledning er beholdt i prosjektet, uten eksterne Python-avhengigheter. Byggeren er kontrollert for byte-identisk resultat ved ny kjøring.

**PASS, null feil, 22 150 kontroller**: streng parsing av 122 JSON-filer i skjema-/flyt-/skill-/pensumsettet; obligatorisk metadata, typer, lukkede verdier, source/locator, alle read_by-ID-er, feltreferanser og asyklisk importgraf; 87 artefaktbindinger, 86 unike steg-utdata, alle indeks- og rutebindinger og 277 pekerrelaterte kontroller; 1 665 faktiske predikatverdier i skills; bevart skill-innhold og gjensidige konflikter. 42 filteratferdskontroller og seks overstyringskontroller inngår.

Fire tilsiktede feil i en isolert midlertidig kopi ble alle avvist: ikke-eksisterende read_by-ID, fjernet artefaktbinding, ukjent kanalverdi i skill og tom kilde-locator. Rapport: [schema-negative-checks.json](schema-negative-checks.json). Maskinrapport: [schema-validation.json](schema-validation.json).

Avgrensning: Dette validerer definisjoner, referanser og filteratferd, samt et fiktivt overstyringseksempel. Faktiske kundeartefakter, ekte signaturmyndighet, plattformkontoer og den kjørende Engine er ikke testet. Flytenes faglige kritikk, kildeverifisering og menneskeporter gjelder i tillegg.

## Runde 3, del C — rettinger etter uavhengig kontroll (13. november 2026) — PROPOSED

Lest hele `review/check-round3.md` og brukt den prioriterte rettelisten. JSON-formatene, bokmål og **PROPOSED** er beholdt. Endringene ligger også i generatoren og validatoren, slik at ny bygging bevarer dem. Ingen Engine-kjøring, publisering, databaseendring eller faktisk kundegodkjenning er utført.

### Endret

1. **Overstyringskontrakt og evaluator.** `effective_override` avviser uten ekstern betrodd signatur- og myndighetsverifikasjon. Verifier skal kontrollere identifisert menneske, signatur, tilbakekalling og myndighet for det eksakte merket ved brukstid; rollenavn i et artefakt er ikke tilstrekkelig. Signert nyttelast binder merke, felt, gammel/ny verdi og versjon, kampanje/del, begrunnelse, godkjenner, vedtaks-ID, gyldighetsperiode, omfang og hasher. SHA-256 beregnes på nytt fra eksplisitt kanonisert innhold. Manglende begrunnelse, feil type/ordliste, endret wrapper, endret verdi/versjon og manglende eller feil verifikasjon avviser. `old_value` og `new_value` er eksplisitte `{value, version}`-wrappere, med registrerte underfelt. De tidligere `override.audit.*`-banene er rettet til de faktiske banene under `override`, inkludert `override.scope.campaign_id` og `.del_id`; ingen separat audit-kopi kan drive bort fra det signerte innholdet. Kampanjekort, bildearbeid og kanaltilpasning har skjerpede porter. Det fiktive eksemplet leveres som `foreslatt`, med signaturplassholder, og avvises som levert. Validatoren signerer bare en isolert testkopi med en lokal testnøkkel.

2. **Kanalmodell og verdilister.** Konkret kanal er nå en eksklusiv distribusjonsrute med dokumentert forrang: Demand Gen før YouTube før øvrig Google Ads (`google-ads-other`); navngitt system før generell markedsplass/produktsøk. `google-ads` og `sosiale-medier` er bare filterfamilier og avvises som konkrete kanaler. Plassering, format, komponent og medieklasse er separate akser. Film mapper til videoformat, skjema til kanalnøytral utløser/komponent, og `brev` betyr fysisk post; digitale brev følger faktisk e-post/nettside. Demand Gen krever konkret plassering: `dg-youtube-*` matcher både YouTube og Google Ads, Gmail/Discover/Display matcher ikke YouTube. Betalt YouTube matcher Google Ads; egen distribusjon gjør ikke det. Manglende nødvendig medieklasse gir uavklart. Google Video Partners er registrert utenfor YouTube-flaten. Ukjent distribusjon kan ikke skjules i `annen`: navngitt binding og kontokontroll kreves.

   `ikke-maskulint` er fjernet fra den lukkede smakslisten. Blandet uttrykk har forrang ved både maskuline og feminine elementer; nøytralt og ukjent har egne dokumentasjonsvilkår. Eldre samleverdier krever menneskelig omklassifisering, ikke automatisk gjetting. Det fiktive merkegrunnlaget bruker nå `noytralt`. Kjøpshyppighet har eksplisitt forrang: dokumentert ikke-gjentakende oppgave → `engang`; ellers manglende median → `ukjent`; ellers én disjunkt tidsklasse.

3. **Funnel.** Alle 57 tidligere smale merkninger er gjennomgått. **42 funnel-predikater er utvidet**, inkludert `plattform-samling-koblet-til-katalog`, `ide-figur-med-handling` og `leseren-allerede-kunde`. Øvrige utvidelser dekker blant annet prøvetilbud, filmfortelling, skjemafelt, oppfølging, bytteintervjuer, handlingsoppfordringer og konkrete plattformhandlinger. Format-/handlingsregler kan nå vurderes uansett trinn/modus; egen regelbetingelse avgjør fortsatt relevans. Strategiske regler som uttrykkelig gjelder valgt merkebygging eller høsting beholder relevant modus, men har bredere trinn der trinnet ikke er en del av selve oppgaven. Før-/etterverdier og beslutninger for hele utvalget står i [funnel-fixes-round3.json](funnel-fixes-round3.json). Opprinnelig migreringsgrunnlag er bevart i `schema-value-mapping.json`. Samtlige 251 skill-ID-er, regeltekster, kilder, eksempler, konflikter og house_rule-verdier er uendret.

4. **Arvet smak og feltlesing.** Menneskelig merkeansvarlig eier arvet kjønnsuttrykk; et modellforslag lagres separat og får ikke arvet autoritet. Cold start bruker `ukjent`, og et avklart arvet uttrykk krever menneskevedtak. Hver av de 17 flytene har nå `field_reads` med konkrete felt-ID-er og lesebegrunnelse samt port i første steg. Domenenes `read_by` beregnes fra disse erklæringene og eksplisitte skill-forbrukere. Blankettilordning fra import er fjernet. Importer og artefaktkontrakter er oppdatert for de faktisk erklærte feltene. Validatoren kontrollerer begge retninger og at feltet finnes i et lest domene. Dette er presise erklærte avhengigheter, ikke observerte runtime-lesninger.

5. **Meta-kilder og plasseringer.** Begge offisielle Meta-sider er forsøkt på nytt med web.open (innlogging/blokkering) og hentet med Firecrawl `maxAge=0` (HTTP 200, faktisk innhold lest). Hovedlisten og måltabellene underbygger de 22 navngitte Meta-radene samlet; Facebook profile feed finnes i måltabellen. Friends er underflate av Facebook Feed, ikke eget plasseringsvalg. Plasseringer krever kontokontroll; underflater merkes som ikke selvstendige valg. To eksisterende pensumoppføringer har oppdatert `url_status`; ingen nye kilder eller fulltekster er lagt til. Se [meta-source-checks-round3.json](meta-source-checks-round3.json).

### Beholdt og avgrenset — med begrunnelse

- **115 kilder, 251 skills, 17 flyter og 95 feltregistre** er beholdt. Ingen nye skill-/flyt-ID-er eller konfliktpar var nødvendige. De åtte eksisterende konfliktparene er fortsatt gjensidige; alle `house_rule`-vurderinger er beholdt fordi kontrollen ikke påviste feil i dem.
- De **15 øvrige tidligere smale funnel-predikatene** beholder sin oppgaveavgrensning: regelen gjelder uttrykkelig valgt modus, et navngitt trinn, lojalitetsoppgave eller salgsrunde. Full gjennomgang og begrunnelse er lagret i funnel-rapporten. Lov og etikk gjelder fortsatt uavhengig av kandidatfilter; de juridiske funnel-merkene er brede som før.
- Ingen ekte signatur-/myndighetstjeneste er installert: dette prosjektet definerer kontrakter og eksempelkode, og inneholder ingen betrodd identitetsinfrastruktur. Verifikatorgrensen er derfor eksplisitt og lukket som standard; testnøkkelen brukes bare i validatoren. En faktisk Engine må koble til en betrodd tjeneste før et avvik kan bli effektivt.
- Ingen faktisk merkeprofil er omklassifisert, ingen appfelt eller SQL-migrering er endret, og ingen målte fakta er skrevet om som smak. Den eldre brede smaksverdien krever menneskelig avklaring ved senere import.
- Plattformkonto, faktisk kontotilgjengelighet og uttømmende kombinasjoner av mål × format × plassering er ikke testet. Meta-kildene verifiserer en datert dokumentert liste; runtime-porten krever konkret konto-/markedskontroll. ISO-snapshotet på 249 koder er ikke hentet på nytt: dette var ingen påvist feil i rettelisten, og snapshot-/referansekontrollene består. Flerroller i B2B og samtidige JTBD-dimensjoner er beholdt som lister, ikke gjort kunstig eksklusive.
- Registrene er fortsatt feltregistre, ikke standard JSON Schema. De eldre midlertidige rundeskriptene antar den tidligere kanal-/landmodellen og før-migreringspredikater; relevante kontroller er videreført i den vedlikeholdte validatoren i stedet for å gjeninnføre utdaterte påstander.

### Sluttvalidering

Kjørt `python3 scripts/build_schemas.py`, `python3 scripts/validate_schemas.py` og `python3 scripts/check_round3_negative.py`.

**PASS — 29 958 kontroller, null feil.** Streng JSON-parsing av 122 leveransefiler; unike ID-er; obligatorisk metadata, kilde-/lokalreferanser, alle `read_by`-ID-er og konkrete feltlesninger; lukkede skjemaverdier og 1 567 faktiske predikatverdier; asykliske importer/flytavhengigheter; gjensidige konflikter uten selvkonflikter eller duplikater; 87 artefaktbindinger og 86 unike stegutdata; indeks/JSON-pekere; alle stegvalideringer, to-forsøksgrenser, kortreferanser og attestert modellskille. 54 filteratferdskontroller og 32 overstyringskontroller inngår. Alle åtte isolerte negative definisjonstester ble avvist uten krasj. Ny bygging av 123 genererte/mappede JSON-filer ga byte-identisk resultat; skill-innhold utenom predikater er sammenlignet med førkopien og bevart.

Rapporter: [schema-validation.json](schema-validation.json), [round3-negative-validation.json](round3-negative-validation.json), [round3-rebuild-check.json](round3-rebuild-check.json) og [schema-counts.md](schema-counts.md).

Slutttall: **115 kilder · 251 skills** (Strategi 36, Leseren 35, Idé 30, Copy 45, Plattform 35, Lov 39, Trakt 31) · **227 house_rule true** · **17 flyter · 95 skjemaer · 817 lokale feltregistreringer**. Felttallet inkluderer objektforeldre og lokale gjenbruk, slik indeksens telleregel angir; importerte felter telles i sine egne registre.

## JSON Schema

13. november 2026 — PROPOSED. Lest briefen, registerindeksen, hele den siste retteloggen og siste NOTES-oppføringer. Feltregistrene er beholdt som Fume-registre; standardformatet er lagt i egne undermapper.

- **66 lukkede lister, 636 typede verdi-ID-er** i `schemas/lists/`. `tools/formal.py` miner alle registrerte `values`, faktiske skill-predikater og kategoriske metadata, og slår sammen samme variabel på tvers av domener, artefakter og filtre. `review/json-schema-inventory.json` inneholder **7 901 forekomster** med fil, JSON-peker, liste og verdi, alle felt→liste-bindinger, opprinnelig feltkilde og tekstbelegg for påstandstypene. Lister omfatter blant annet kanal/plassering/format, land, EU/EØS-grupper, nivå, marked, kjøpsroller, trakt, kontrolltype, kildeklasse, fag, sjekkpunkt, påstandstype, status, utfører, utfyller og omfang. Landlisten beholder alle 249 ISO-koder, ettersom disse allerede faktisk brukes i registrenes verdilister; ingen koder er fjernet. `EU`/`EEA` er egne grupper, ikke landkoder. CAP er et regelområde. Helse, ernæring, miljø, pris, sammenligning, effekt, superlativ og knapphet er Fume-klasser med konkrete teksttreff, ikke en påstand om en uttømmende juridisk taksonomi.
- **102 JSON Schemas, Draft 2020-12**, i `schemas/json/`: skill, flow, pensumoppføring, feltregister og liste; to indekser; 95 genererte domene-/artefaktkontrakter, hvorav **87 dekker alle navngitte artefaktstier**. Enums genereres fra de kanoniske listene og har `x-list`-peker. Konkrete kontrakter utelukker filterjokere/-familier. Punktbaner og `[]` blir nestede objekter/listeelementer; direkte domeneimporter ligger på riktig sted under `grunnlag.domener`. Påkrevdhet, strukturelle `if`/`then`-vilkår, ett hovedtrinn, hashformat, positive versjoner og datoformat håndheves. Kritikk og menneskevedtak kreves når registerets valideringsprofil krever dem. Konvoluttfeltene `forrige_artefakt`/`signatur` er hentet fra eksisterende flytkontrakt/hashkontrakt. Strukturelle objekter er lukket, mens eksplisitt åpne record-felt forblir åpne. Vilkår som trenger et domene utenfor kontraktens importer merkes `x-runtime-conditions`; JSON Schema erstatter ikke disse runtime-portene.
- **Lokal venv** opprettet i `.runs/venv`; `jsonschema==4.26.0` installert. `tools/requirements.txt` gjør oppsettet gjentakbart. `tools/validate.py` validerer alle definisjoner og begge indekser, sjekker liste-/enumdrift, ID-er, `read_by`, `skills_used`, gjensidige `conflicts_with`, imports/feltvilkår og alle artefaktbindinger. Den beholder eksisterende register-/filter-/overstyringskontroller, bruker bare lokale skjemaressurser og avslutter med kode 1 ved feil. `--artifact` kan validere faktiske nyttelaster separat med deres `schema_id`. `tools/build_formal.py --check` bekrefter byte-identisk generering uten å skrive; validatoren reparerer aldri ugyldige data.
- **32 konkrete dataendringer i sju registre:** seks visningsnavn for linjestil er normalisert til `rett-pa-sak`, `gjenkjennelig-hverdag`, `sporsmal`, `kontrast`, `konkret-bevis`, `torr-humor` i fem registre (30 verdiendringer). De norske navnene finnes som `label_nb` og i uendret flytprosa. To plasseringstabeller brukte feilaktig medieklassen `egen` som kanal for `egen-flate`; disse binder nå eksplisitt til `e-post`, `sms`, `nettside`, `brev`, `telefon`. Filteret leser én eller flere konkrete tillatte kanaler og godtar ikke lenger denne plasseringen for en uvedkommende kanal. Original registergenerator er oppdatert med sju tilsvarende literalendringer. **39 før/etter-mappinger** og **14 eksplisitte aliaser** er logget i `review/json-schema-value-mapping.json`; alle kanoniske ID-er er også oppført. Historiske kanal-/landmappinger er bevart i den gamle loggen. Ingen ny synonymgjetting eller automatisk omklassifisering av smak er innført.
- **Kilder og lesestatus:** offisielle Meta-, Google-, TikTok- og LinkedIn-sider er åpnet; Meta krevde Firecrawl-fallback etter innlogging/blokkering i web.open. Hver kanal-/plasserings-/formatverdi har URL, `read_on`, `verified` og forklaring. Demand Gen-siden var utilgjengelig ved denne kontrollen; verdiene er beholdt, tydelig `verified: false`. LinkedIn Audience Network-siden og ISO-snapshotet er heller ikke påstått nyverifisert. Fume-familier og direkte kanalklasser er merket som interne verdier. EFTA-kilden til skillet EU/EØS og innlemmelsesstatus er lest. Detaljer: `review/json-schema-source-checks.json`. Ingen nye beskyttede fulltekster er lagret.

Kjøring: `.runs/venv/bin/python tools/validate.py --report review/json-schema-validation.json`. **PASS, null feil:** 290 strengt parsede JSON-filer; 251 skills, 17 flyter, 115 pensumoppføringer, 95 feltregistre med 817 lokale felt, 66 lister, to indekser og 102 JSON Schemas som består metaskjemakontroll. Alle 87 artefaktbindinger er dekket. I tillegg 6 815 referansekontroller, 4 145 liste-/enumkontroller, 7 901 forekomstkontroller og 29 958 etablerte registerkontroller. Dette er separate kontrolltellere, ikke antall faktiske kunde-/annonseartefakter.

`review/json-schema-preservation.json` bekrefter at alle JSON-forskjeller er nøyaktig de 32 loggede verdiendringene; alle 251 skills, 17 flyter med indeks, 115 pensumoppføringer, register-ID-er, feltbaner og registerindeks er ellers uendret. Veiledning og kommandoer står i `schemas/README.md`. Syntetiske nyttelaster og isolerte feilinjeksjoner dokumenteres i `review/json-schema-checks.json`; ingen faktisk Engine-kjøring eller kundegodkjenning er påstått.

Sluttkontroll med `.runs/venv/bin/python tools/check_formal.py`: **121 kontroller bestått**, inkludert 87 syntetiske artefakter og ni CLI-feilinjeksjoner. Manglende konvoluttfelt, galt artefakt-ID, filterfamilie som konkret kanal, EU/UK som landkode, umulig dato, manglende betinget pris/B2B-rolle, tom attest/vedtak, feil SHA-256 og feil hovedtrinn avvises. Ugyldig `read_by`, `skills_used`, konflikt-ID, kanalverdi, kildelocator, ekstra definisjonsfelt, fjernet listeverdi, svekket artefaktskjema og feil dato gir alle ikke-null avslutningskode. Åpne belegg-records og gyldig direkte kanalbinding godtas. Original registergenerator gir identiske data i isolert kopi; `--artifact` er også kjørt gjennom CLI med et syntetisk inngangsartefakt. Ingen faktiske kunde-/annonseartefakter er brukt.

## Oppfølging: check-round3-jsonschema.md — rettet

2026-11-13. Alle fire punkter i den uavhengige kontrollens korte retteliste er
behandlet. Eksisterende logg over tidligere arbeid er beholdt; tallene nedenfor
supersederer de tidligere JSON Schema-slutttallene.

1. **Formataksene er bevart og håndhevet.** Tre påkrevde felt er lagt til i
   `kanal-format`: `binding.creative_medium`, `binding.ad_product` og
   `binding.delivery_behavior`. Den stabile `format`-velgeren beholdes for
   eksisterende predikater. Registerets `format_contract` dokumenterer prioritet
   (navngitt produkt før generisk medium; bumper før generell non-skippable) og
   alle 26 mappinger. Generatoren håndhever mappingene med `if`/`then` i domenet
   og alle artefaktskjemaer som importerer det. Bumper og non-skippable har begge
   video og ikke-hoppbar atferd, men forskjellige produkt-ID-er. Generisk video
   har produkt `generisk` og en separat, eksplisitt leveringsatferd. Tre nye
   ordlister lagrer aksene. Original registerbygger er oppdatert, inkludert
   feltlesninger og indeks. Ingen ferdighets-ID-er er endret.
2. **Konkrete kanaler og filtervalg er skilt.** `channel` har bare de 15 konkrete
   distribusjonsrutene. Ny liste `channel-filter` har konkrete kanaler samt
   familiene `google-ads`/`sosiale-medier` og joker `alle`. Filterkontraktene binder
   til sistnevnte; konkrete felt binder til førstnevnte. EU/EØS-definisjonene og
   README presiserer overlappende medlemskap og at ikke alle lister er gjensidig
   utelukkende. Ingen grupper er gjort om til ISO-land.
3. **Plattformdekning er avstemt med offisielle kilder.**
   [Googles sammenligning](https://support.google.com/google-ads/answer/2375464?hl=en)
   ble lest med web.open: `yt-playables` er lagt til som dokumentert underflate
   av YouTube in-stream i mobilappen, med `parent` og ikke-selvstendig valg.
   Skippable, non-skippable og bumper er dokumentert der; kontostøtte må fortsatt
   kontrolleres. [Metas plasseringsside](https://www.facebook.com/business/help/407108559393196)
   ga blokkert innlogging i web.open; fersk Firecrawl-henting ga HTTP 200 og
   faktisk plasseringsinnhold. Plasseringsgrupper, Friends som inkludert flate i
   Facebook Feed og begrensninger etter geografi, mål og innstillinger er lest.
   Denne kilden brukes nå direkte som belegg for Meta-plasseringsverdier.
   Facebook profile feed beholdes fra tidligere måltabellkontroll; den hevdes
   ikke funnet i denne hovedlisten. [TikToks oktober 2026-side](https://ads.tiktok.com/resources/help/article/tiktok-placement?lang=en)
   ble lest; eksisterende For You-underflater beholder `parent`, `underflate` og
   `ikke-selvstendig`. Ingen ny fulltekst er lagret. Kontrollmetode, avgrensninger
   og funn står i `review/json-schema-source-checks.json/round3_followup`.
4. **Dekning og negative artefakttester er utvidet.** Miningen inkluderer nå
   lukkede vilkårsoperander, kategoriske metadata med mellomrom, underflateforeldre,
   strukturerte eksempler og alle formatmappinger: 8 296 dokumenterte forekomster.
   Ny `tools/check_round3.py` leser leverte filer uten å importere generatoren og
   sjekker enums, registerverdier, metadata, operander, operatører, predikater,
   felttyper, eksempler, mappinger og kanal-/underflateskillet. Den kjøres også
   av `tools/validate.py`; rapport: `review/round3-independent-coverage.json`.
   Beskrivende indeksprosa og eksplisitt åpne records behandles ikke som lukkede
   kategorier. `tools/check_formal.py` har positive video-/bumper-/non-skippable-
   artefakter, negative tilfeller for motstridende/manglende attributter og
   wildcard som konkret kanal. To nye isolerte CLI-injeksjoner avviser ukjent
   metadata-rolle og ukjent vilkårsoperand.

**Verifisering:** `.runs/venv/bin/python tools/check_formal.py` bestod **138
kontroller**, inkludert **87 syntetiske artefakter og 11 CLI-feilinjeksjoner**.
Original registerbygger gjenskaper data byte-identisk i isolert kopi.
`.runs/venv/bin/python tools/build_formal.py --check` bestod med **0 endrede filer**.
Uavhengig medlemskapskontroll: **47 040 kontroller, null feil**.
`.runs/venv/bin/python tools/validate.py --report review/json-schema-validation.json`
ga **PASS, exit 0, errors: []**, inkludert 30 114 etablerte registerkontroller,
102 metaskjemakontroller, 8 296 forekomstkontroller og alle 87 artefaktbindinger.
Avsluttende kjøring uten argumenter: `.runs/venv/bin/python tools/validate.py`.

**Slutttall:** **115 kilder; 251 skills** — Strategi **36**, Leseren **35**, Idé
**30**, Copy **45**, Plattform **35**, Lov **39**, Trakt **31**; **227 house_rule
true**; **17 flyter; 95 feltregistre / 820 lokale felt; 70 lister; 102 JSON
Schemas**. Kildeantallet er antall pensumoppføringer, ikke antall gjenbrukte
URL-er i alle beleggobjekter.

Alle definisjoner er fortsatt PROPOSED. Denne kontrollen etablerer strukturell
konsistens, ikke uttømmende plattformtilgjengelighet. Faktisk konto, annonsemål,
marked og gjeldende kilder må fortsatt kontrolleres; tidligere forbehold for
Demand Gen, LinkedIn Audience Network og ISO-snapshot er videreført. Ingen
kundeartefakter, annonsering eller Engine-kjøringer er utført.


## Komprimering av JSON Schema med delte definisjoner (2026-11-13)

`tools/formal.py` og `tools/build_formal.py` genererer fortsatt draft 2020-12.
Hver av de 70 lukkede listene har nå én ressurs i
`schemas/json/_defs/<list>.schema.json`. Eksakte delmengder ligger i samme
ressurs under `$defs`; de erstattes ikke med hele listen. Identiske schema-deler,
inkludert felles artefaktkonvolutt og importerte domener, ligger i
`schemas/json/_defs/artifact-parts.schema.json`. Relative `$ref` løses mot hver
ressurs sin absolutte `$id`. Delene trekkes ut som eksakte undertrær, slik at
`additionalProperties`, påkrevde felt, betingelser, typer og array-krav beholdes.

`tools/validate.py` leser nå rekursivt, registrerer alle 173 lokale ressurser i
`referencing.Registry`, kontrollerer referansene og sammenligner alle genererte
filer med generatorens forventede resultat. Ingen nettuthenting brukes.
`tools/check_round3.py` følger referanser i leverte filer for sin uavhengige
medlemskapskontroll. `tools/check_formal.py` bruker Registry ved validering;
referanseutvidelse brukes til å bygge syntetiske testdata.

`review/json-schema-inventory.json` er redusert til feltbindinger, totalt antall
forekomster og antall per liste: **10 515 byte**. Generatoren beholder alle
8 296 forekomster i minnet, og validatoren kontrollerer fortsatt hver av dem.
Detaljert uttrekk kan gjenskapes med `tools.formal.mine(read_data())`.

Størrelse for alle filer rekursivt i `schemas/json/`: **10 582 663 → 1 154 455
byte** (1,154455 MB, omtrent 89,1 % reduksjon), inkludert alle `_defs`-ressurser.
Dette er under målet på 1,5 MB.

Kontrollert etter endringen:

- `.runs/venv/bin/python tools/build_formal.py --check`: PASS, ingen avvik.
- `.runs/venv/bin/python tools/validate.py --report review/json-schema-validation.json`:
  PASS, `errors: []`; 173 draft 2020-12-ressurser, 70 lister, 87 artefaktskjemaer.
- Alle 102 opprinnelige skjemaer er sammenlignet med den nye leveransen etter
  rekursiv referanseutvidelse: identiske begrensninger og annotasjoner, med
  ressursmetadata utelatt og `x-list`-stier normalisert. Resultat i
  `review/json-schema-ref-equivalence.json`: PASS, null avvik.
- `.runs/venv/bin/python tools/check_formal.py`: PASS, 143 kontroller, inkludert
  87 syntetiske artefakter og 11 isolerte CLI-feilinjeksjoner. De fem opprinnelige
  listeskjema-negativtestene er nå permanente tester: manglende `id`, ugyldig
  ID-mønster, tom verdidefinisjon, umulig dato og ekstra verdiegenskap.
  **Alle fem avvises**, og uendret utgangspunkt godtas. Se
  `review/json-schema-checks.json`.
- `.runs/venv/bin/python scripts/check_round3_negative.py`: PASS, alle åtte
  eksisterende registerfeil avvises.
