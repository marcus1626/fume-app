# Uavhengig kontroll, runde 3

13. november 2026. Kontroll av definisjoner og kilder, ikke en kjøring av Engine. Ingen prosjektfiler ble endret utenom denne rapporten. Utvalgene under er stikkprøver; de er ikke bevis for at alle øvrige verdier eller ferdigheter er korrekte.

## 1. Trakt: 10 ferdigheter

Jeg valgte de ni første og `trakt-na-fremtidige-kjopere`, åpnet hver oppgitte kilde, og sammenlignet `source_says`, regel og `house_rule`. Den lokale BRIEF-en og fem ulike nettressurser ble lest, inkludert den oppgitte B2B-rapporten. Alle ti har `house_rule: true`, som er riktig: beståttvilkårene er Fumes operasjonaliseringer, ikke terskler kildene hevdes å fastsette. De kan kontrolleres med dokumentkontroll og faglig skjønn; ikke alle kan avgjøres mekanisk.

| Ferdighet | Resultat og kontroll |
| --- | --- |
| `trakt-kort-for-tekst` | PASS — BRIEF krever sjekkbare ferdigheter og validerte mellomartefakter; rekkefølgeporten er tydelig Fumes egen. |
| `trakt-navngi-oppgaven` | PASS — [Amazon](https://advertising.amazon.com/en-gb/library/guides/marketing-funnel) beskriver trinn; ett hovedtrinn er en separat arbeidsregel. |
| `trakt-ingen-tvungen-reise` | PASS — [Google](https://business.google.com/en-all/think/consumer-insights/navigating-purchase-behavior-and-decision-making/) beskriver vekslende utforskning og evaluering; tilgjengelighetskravet er Fumes regel. |
| `trakt-kundestatus-er-egen-akse` | PASS — [Ehrenberg-Bass](https://marketingscience.info/news-and-insights/effective-brand-growth-acquisition-or-retention) omtaler reklame til både kjøpere og ikke-kjøpere; separat begrunnelse er husregelen. |
| `trakt-kjopsberedskap-med-belegg` | PASS — [95–5-artikkelen](https://business.linkedin.com/advertise/resources/b2b-institute/b2b-research/trends/95-5-rule) gir grunnlag for skillet mellom folk i og utenfor markedet; dokumentasjonsporten er Fumes. |
| `trakt-ikke-fast-nittifem` | PASS — samme artikkel bruker kjøpsintervaller og ulike kategorier; ingen universell lokal andel påstås. |
| `trakt-merkebygging-med-minne` | PASS — samme artikkel omtaler minne og kjøpssituasjoner; én kobling og måleplan er Fumes krav. |
| `trakt-hosting-har-kjopshinder` | PASS — [Binet og Field, B2B-rapporten](https://business.linkedin.com/content/dam/lem/business/en/advertise/resources/b2b-institute/b2b-research/LIN_B2B-Marketing-Report-Digital-v02.pdf), prinsipp 2, skiller merke og aktivering. Konkret hinder er Fumes port. |
| `trakt-balanse-er-lokal` | PASS — samme rapport diskuterer variasjon og lite utvalg; lokale beløp og begrunnelse er Fumes port. |
| `trakt-na-fremtidige-kjopere` | PASS — samme rapport, prinsipp 3, vektlegger bredere kundebase; skriftlig unntak er Fumes regel. |

## 2. Funnel på 25 eksisterende ferdigheter

Reproduserbart utvalg: Python `random.seed(303); random.sample(...)` over eksisterende `skills/*.json` unntatt Trakt, i den rekkefølgen filene ble returnert lokalt. 22 PASS, 3 PROBLEM. `alle/begge` er her vurdert som et rimelig bredt kandidatfilter, med regelens egen betingelse som ytterligere avgrensning.

| Ferdighet | Resultat |
| --- | --- |
| `copy-avgrens-superlativer` | PASS |
| `plattform-tiktok-fungerende-lyd` | PASS |
| `lov-no-kundeunntak` | PASS |
| `plattform-samling-koblet-til-katalog` | PROBLEM — utelater topp. En samlingsannonse med katalog kan også brukes til kjennskap; en ugyldig produkt-ID bør ikke unngå kontroll fordi oppgaven er topp. |
| `copy-annen-leser-kontrollerer` | PASS |
| `ide-sammenlign-ideer` | PASS |
| `leseren-aapne-intervjuspoersmaal` | PASS |
| `plattform-tiktok-ulike-testvarianter` | PASS |
| `ide-ny-hypotese-etter-avslag` | PASS |
| `ide-test-med-berorte` | PASS |
| `strategi-nye-kjopere` | PASS |
| `copy-leseren-forklarer-med-egne-ord` | PASS |
| `strategi-salgsutlosende-informasjon` | PASS — eksplisitt avgrenset til valgt aktivering. |
| `ide-figur-med-handling` | PROBLEM — en fortellende filmskisse kan brukes i høsting og bunn/salgsrunde også; merkingen filtrerer da bort dens egen formkontroll. |
| `lov-de-forklar-omtaler` | PASS |
| `leseren-kjent-loesning` | PASS — kunnskapsnivå er egen akse. |
| `copy-les-hoeyt-og-rett` | PASS |
| `plattform-tiktok-kontroller-undertekster` | PASS |
| `ide-bevar-kjernen` | PASS |
| `ide-begrunn-endringer` | PASS |
| `lov-de-etterprovbar-sammenligning` | PASS |
| `leseren-svar-foerst` | PASS |
| `lov-google-finnbart-tilbud` | PASS |
| `leseren-allerede-kunde` | PROBLEM — gjelder salgse-post til eksisterende kjøpere, men er avgrenset til `hosting` og utelater topp. En e-post med salgskall kan forekomme i en annen klassifisert del; filtrering kan dermed fjerne regelen før dens konkrete utløser vurderes. |
| `copy-menneskelig-korrektur` | PASS |

Dette er mulige falske negative under filterets AND-regel, ikke påstander om at alle slike annonser faktisk skal lages. Bruk bredere kandidatmerking eller en eksplisitt regelutløser som ikke kan filtreres bort av trinn/modus.

## 3. Kampanjekort og flytregler

- **PASS, definert flyt:** Seks steg har hvert sitt artefakt, inngang og validering; kritiker er en annen faktisk modell, med attestasjon og feilrute. Feilforsøk telles og eskaleres. Dette følger de relevante reglene i `BRIEF.md` på definisjonsnivå.
- **PASS, lenker:** Alle 16 andre flyter har `input_fields.kampanjekort` og omtaler kortet i første steg. Manifest, aktiv del, versjon og hash er del av kontrakten. Dette viser erklært lesing og videreføring, ikke at en runtime faktisk gjør det.
- **PASS, bindinger:** Alle 86 stegutdata og oppdraget har angitt skjemafil; flytenes input/output og indekshenvisninger er kontrollert mot filene. Dette er feltregistre, ikke kjørbare JSON Schema-kontrakter.

## 4. Skjemaer

- **PROBLEM — lukkede lister er ikke gjennomgående gjensidig utelukkende eller komplette:** `kanal-format.channel` blander distribusjonssystem, flate, annonseprodukt og innhold: `google-ads` omfatter Demand Gen og YouTube, `google-demand-gen` overlapper `youtube`, `meta` overlapper `sosiale-medier`, og `brev` omfatter digitalt brev som overlapper `e-post`. `film` er format/innhold, mens `skjema` er en flate/komponent. Selv om `scripts/schema_filter.py` har familier, er det uklart hvilken konkret verdi produsenten skal velge og om alle relevante regler utløses. `taste.gender_expression` har også `ikke-maskulint` som overlapper både `feminint` og `noytralt`; det utelukker ikke samtidig maskuline elementer i `blandet`. `kategori.purchase_frequency.class` har `engang` som kan overlappe en observert median i en tidsklasse, uten forrangsregel. Derfor kan fullstendighet og ikke-overlapp ikke godkjennes samlet.
- **PROBLEM — felttyper/ansvar:** `merkevare-vs-kampanje.override.old_value` og `.new_value` er `object`, mens eksempelets målfelt `taste.gender_expression` er `string` og policyen krever målfeltets type. Definer en eksplisitt wrapper med verdi og metadata, eller bruk en typeunion. `taste.gender_expression` er `filled_by: modell`, `scope: begge` og alltid påkrevd, også ved cold start; det er uklart hvem som faktisk fastsetter en eventuell arvet merkeverdi og hvordan ukjent profil skilles fra modellforslag. Flere registre har brede gjenbrukte forklaringer; metadata er til stede, men de alene fastsetter ikke faktisk autoritet.
- **PROBLEM — overstyringsevaluator:** Policyen krever menneskelig merkeansvar, begrunnelse, nøyaktig godkjent verdi/versjon og hash. I `scripts/schema_filter.py:effective_override` kontrolleres bare at rolle er en ikke-tom streng, hashene har 64 tegn, og at et par scope-ID-er matcher. Jeg testet i minnet med arbeidseksempelet: endret kampanjeverdien fra `maskulint` til `feminint`, slettet begrunnelsen, satte rollen til `intern` og hashene til 64 x-er/y-er; funksjonen returnerte fortsatt `True`. Den verifiserer heller ikke signatur/autoritet, hashinnhold eller binding til den godkjente verdien. Det er en konkret forskjell mellom policy og eksempelkode; den dokumenterte avgrensningen sier at runtime ikke er bygget, så dette er ikke påstand om et faktisk produksjonsbrudd.
- **PASS med avgrensning — policyens hensikt:** Identitet, produkt og etikk er beskyttet; utløp, del og menneskevedtak er uttrykt, og profilendring forbys. Det er et fornuftig utgangspunkt når punktene over gjøres entydige og håndheves.
- **PASS, strukturelle referanser:** Alle `read_by`-ID-er finnes som flow eller skill, og alle flytartefakter har navngitte skjemafiler. Eksistens av en ID er ikke bevis for at en flow faktisk leser hvert enkelt felt: mange felt har identiske brede `read_by`-lister. Disse bør gjennomgås mot konkrete feltforbruk før de brukes som presis avhengighetsgraf.

### Åtte kildestikkprøver for lister

1. **ISO alpha-2 — PASS, stikkprøve:** [UN M49](https://unstats.un.org/unsd/methodology/m49/overview/) gir alpha-2 for blant annet NO, DE og GB; [portugisisk ISO-tabell](https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/irs/documents/tabela_paises_cod_norma_iso_3166.pdf) gir TW. Jeg har ikke uavhengig sammenlignet samtlige 249 koder mot et autoritativt ISO-snapshot.
2. **Meta-plasseringer — UAVKLART:** [Oppgitt Meta-side](https://www.facebook.com/business/help/407108559393196) åpnet til innlogging/blokkering, ikke listen. Tidligere rapportert Firecrawl-uttak er ikke selvstendig verifisert her; hverken fullstendighet eller alle konkrete plasseringer kan godkjennes på dette grunnlaget.
3. **Google-formater — PROBLEM:** [Google Ads](https://support.google.com/google-ads/answer/1722124) skiller blant annet annonseformater og kampanjetyper. Registeret skiller dem delvis, men `channel`-verdiene overlapper som beskrevet ovenfor. Kilden underbygger ikke en entydig gjensidig utelukkende kanalliste.
4. **TikTok-plasseringer — PASS med forbehold:** [TikTok](https://ads.tiktok.com/help/article/tiktok-placement?lang=en) beskriver egne visningsflater og avhengighet av oppsett. Registrerte feed-/søkeflater er rimelige stikkprøver; underflater bør ikke antas individuelt valgbare uten kontokontroll.
5. **LinkedIn-formater — PASS med forbehold:** [LinkedIn Ads Guide](https://business.linkedin.com/advertise/ads/ads-guide) beskriver blant annet dokument-, melding- og videoannonser. Konkrete kombinasjoner må verifiseres for mål og konto; stikkprøven beviser ikke uttømmende liste.
6. **B2B-kjøpsroller — PASS:** [OpenStax](https://openstax.org/books/principles-marketing/pages/4-2-buyers-and-buying-situations-in-a-b2b-market) beskriver de seks rollene og at én person kan ha flere. Listen er roller, ikke gjensidig utelukkende persontyper.
7. **Schwartz — PASS:** [Destini Copps sekundærforklaring](https://www.destinicopp.com/blog/eugene-schwartz-five-levels-of-awareness) beskriver fem nivåer fra problemukjent til mest bevisst; registerets rekkefølge er konsistent. Ikke kontrollert mot betalt originalbok.
8. **JTBD-dimensjoner — PASS:** [Christensen Institute](https://www.christenseninstitute.org/theory/jobs-to-be-done/) beskriver funksjonelle, sosiale og emosjonelle dimensjoner; de kan opptre samtidig og bør ikke tvinges til ett eksklusivt valg uten nærmere regel.

## Prioritert retteliste

1. Gjør override-kontrakten og evaluator konsistente: bind signert menneskevedtak og myndighet til eksakt felt, merke, gammel/ny verdi, versjon, kampanje/del og verifiserte hasher; krev begrunnelse og test manipulasjon. Avklar wrapper/union for verdier.
2. Rett kanalmodellen og overlappende verdilister, med eksplisitt valg av akser og forrang der verdier kan overlappe; sørg for at filteret får entydige faktiske kombinasjoner.
3. Utvid de tre identifiserte funnel-merkene, og gjennomgå øvrige smale merkninger for regler som gjelder et konkret format eller en handling uavhengig av kampanjens trinn/modus.
4. Avklar menneskelig eierskap og cold-start for arvet smak, og kontroller `read_by` mot faktiske feltlesninger. Verifiser Meta-listen på nytt mot tilgjengelig kilde og skill valgbare plasseringer fra underflater.
