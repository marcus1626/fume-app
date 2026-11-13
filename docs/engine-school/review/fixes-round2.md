# Rettinger, runde 2 — PROPOSED

2026-11-13. Omfang: bare de fire bestilte punktene (a–d). Lest `BRIEF.md`, `review/spotcheck-web.md` og `review/fixes-applied.md`. Alle 220 ferdighets-ID-er, emner, anvendelsesfelt, sjekkpunkter og eksisterende felt er beholdt; `house_rule` og `source_says` er lagt til alle, og `verified` til de to Meta-ferdighetene. Alle ferdigheter og flyter er fortsatt `PROPOSED`, med bokmål i ferdighetstekstene. Flytfilene og de tidligere gjennomgangene er uendret.

## (a) Helsepåstander og overgangsregler

- `skills/Lov.json`, `lov-mat-godkjent-helsepastand`: «Manglende godkjenning gir ikke bestått» → godkjent påstand **eller dokumentert fortsatt tillatt overgangsbruk**. Kontrollen skiller artikkel 13(1)(a)/28(5) fra andre påstander under 28(6), inkludert psykiske/adferdsmessige funksjoner. Den krever nasjonalt grunnlag, belegg, relevant historisk bruk, innmelding/søknad og kontroll av senere vedtak og utløp. On hold gir ingen automatisk tillatelse; fravær fra EU-registeret gir heller ikke automatisk avslag. Usikkerhet stopper publisering og går til juridisk ansvarlig menneske.
- `skills/Lov.json`, `lov-mat-generell-helsefordel`: absolutt krav om listeført ledsagende påstand → hovedregel med konkret dokumentert overgangsunntak. For botaniske generelle fordeler uten listeført ledsagelse kreves særskilt vurdering av artikkel 28(6), i tråd med C-386/23 avsnitt 83 og domsslutningen; nr. 5 eller ventestatus alene er utilstrekkelig. Samme dokumentasjons- og menneskerute som over.
- `skills/Lov.json`, `lov-mat-ikke-vekttapstall`: rent artikkel 12-forbud → uttrykkelig presisering av at artikkel 28(5)–(6) ikke opphever forbudet; usikker klassifisering går til menneske.
- `skills/Lov.json`, `lov-mat-sukkerfri-grense`: bare sukkergrensen → samme grense med uttrykkelig skille mellom ernæringspåstanden og botaniske helsepåstander; ingen generell overgangsfritakelse fra grensen, og usikkert annet overgangsgrunnlag går til menneske.

Fire treff som siterer 1924/2006 er gjennomgått; de to siste trenger avgrensning, ikke lemping. Artikkel 28s utløpte ordninger kan ikke brukes som ny tillatelse.

Åpnede kilder og presise locators:

- [Konsolidert 1924/2006, 13.12.2014](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02006R1924-20141213): artikkel 5–6, 8(1), 10(1)/(3), 12(b), 13(1)/(3), 28 særlig (5)–(6), 29 og vedlegget SUGARS-FREE. Lest via Firecrawl 2026-11-13, HTTP 200 (cache fra 11.11); direkte web.open ga robotkontroll. Ingen påstand om at robotkontrollen var lest lovtekst.
- [EU Register](https://food.ec.europa.eu/food-safety/labelling-and-nutrition/nutrition-and-health-claims/eu-register-health-claims_en): «About the EU register» og «Claims not in the EU Register», særlig uferdigbehandlede botaniske funksjonspåstander. Åpnet med web.open 2026-11-13; registeret er en informasjonskilde, ikke selve tillatelsesrettsakten.
- [Ventelisten som registeret lenker til](https://ec.europa.eu/food/food-feed-portal/backend/claims/files/claims_pending.pdf): PDF-side 1–4, særlig overskriften om botaniske påstander på side 1. Åpnet via registerlenken 2026-11-13. Arbeidsdokumentet er datert 12.06.2013; status må kontrolleres mot senere vedtak for den konkrete påstanden.
- [C-386/23, dom 30.04.2025](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:62023CJ0386): avsnitt 55–60, 66, 72 og 83 samt domsslutningen. Lest via Firecrawl 2026-11-13, HTTP 200; direkte web.open ga robotkontroll. Dommen gjelder også den avgrensede adgangen til fortsatt overgangsbruk.

## (b) To Meta-punkter bekreftet i andre offisielle kilder

| Fil og ID | Før → etter | Verifisering |
| --- | --- | --- |
| `skills/Plattform.json` · `plattform-meta-budskap-tre-sekunder` | Generisk Ad creative / Video uten lest støtte → offisiell Instagram-hjelpeside, «Creative best practices for Instagram video ads → Showcase your brand early». `verified` manglet → `true`; `house_rule` manglet → `true`. Prinsipp og regel sier at obligatorisk port og utvidelse til Meta-video er Fumes valg. `tier: plattform` beholdt. | Rådet om merke og hovedbudskap innen tre sekunder er bekreftet; det er en Instagram-anbefaling, ikke et teknisk Meta-krav. |
| `skills/Plattform.json` · `plattform-karusell-maks-ti-kort` | Generisk Ad creative / Carousel og 1–10 kort → offisiell hjelpeside, innledningen og «Tell your story with all the available carousel components», og **2–10 kort**. `verified` manglet → `true`; `house_rule` manglet → `false`. `tier: plattform` beholdt. | Begge kortgrenser er bekreftet i kildeinnholdet. |

`read_on` er nykontrollert til 2026-11-13 for begge; datoverdien var allerede den samme, så den er beholdt. Søket fant offisielle sider; deretter ble selve sideinnholdet lest, ikke bare søkeutdrag eller tredjepartsomtaler.

- [Instagram-video, offisiell Meta Business Help Center](https://www.facebook.com/business/help/188534925073536): Firecrawl HTTP 200 (cache fra 12.11), og separat `curl -L --max-time 25 -A Mozilla/5.0` mot URL med `?locale=en_US`, HTTP 200, 617008 byte. Relevant råd finnes i curl-HTML-en.
- [Karusell, offisiell Meta Business Help Center](https://www.facebook.com/business/help/927639917355563): Firecrawl HTTP 200 (cache fra 12.11), og samme curl-metode med `?locale=en_US`, HTTP 200, 593188 byte. Både minimum to og maksimum ti finnes i curl-HTML-en.

En første curl-runde uten engelsk språkkode ga norsk Meta-HTML for karusellsidene og tomt svar for Instagram-videoen; den påfølgende engelske runden over ga det lesbare kildeinnholdet. Manglende førsteuttak ble ikke telt som bekreftelse. Nye presise kilder er lagt til pensum. Ingen av de to trengte fallback til `verified: false` / `tier: fume`.

## (c) Kildebelagt frist og norske veiledninger

- `skills/Lov.json`, `lov-eu-ekte-tidsfrist`: samsvar med kampanjeplan + reset-test → lagret faktum med kilde, eksempelvis kundens skriftlige kampanjeslutt med tidssone og avgrensning. Kontroll før publisering skal registrere kildeversjon, kontrolltid, ansvarlig og resultat mot kundebeslutning, oppsett og relevant pris-/tilbudshistorikk. Samme eller tilsvarende videreført tilbud og nullstilt nedtelling kontrolleres. Manglende kilde, nødvendig historikk eller utført kontroll gir stopp og straksrute til menneske. Dette er en mer spesifikk Fume-port enn selve UCPD-forbudet.
- `skills/Leseren.json`, `leseren-ekte-knapphet`: datert opplysning eller vedtatt frist uten uttrykkelig kilde-/publiseringsport → kildebelagt lager/kapasitet og samme fulle fristkontroll som `lov-eu-ekte-tidsfrist`, med delt avviks-ID for å unngå dobbeltelling. Manglende belegg går til menneske. UCPD og norsk salgsveiledning er lagt til som kilder.
- Søk etter `frist`, `deadline`, `tidsbegrens` og `nedtelling` i alle seks ferdighetsfiler fant disse to operative knapphets-/tilbudsfristkontrollene. Andre treff gjelder lesernivå, påminnelsestidspunkt eller interne målefrister; de er ingen påstand om tidsbegrenset tilbud og fikk ingen ny tilbudsregel.
- `skills/Lov.json`, `lov-eu-avgrens-miljopastand`: bare samsvar mellom dokumentert del og påstand → også uttrykkelig kontroll av samlet inntrykk og skillet produkt/produktdel/virksomhet; nødvendig forklaring i første informasjonslag for norsk markedsføring når førsteinntrykket ellers villeder. Norsk veiledning er supplerende og fremstilles ikke som lov i andre land.

Begge bestilte veiledninger **fantes allerede** i `sources/pensum.json` med `url_status` som begynner med `ok`; de er oppdatert uten duplikater:

| Fil / oppførings-ID (source) | Før → etter | Leste sidesteder |
| --- | --- | --- |
| `sources/pensum.json` · Forbrukertilsynet — Salg og betingede tilbud (2025) | Generelt uttak om førpris/betingelser og tidligere `ok`-GET → presist bruksområde for dokumentasjon, tilbudshistorikk og Fumes fristport; `ok` beholdt med lokal lese-/stireferanse. | `sources/fetched/veiledning-om-reglene-som-gjelder-ved-markedsforing-av-salg-og-betingede-tilbud-l2398774.txt`: side 4 punkt 2, side 7–10 punkt 3.3–3.4, side 13 punkt 3.6, side 15–17 punkt 4.3–4.5 og side 19 punkt 6. Veiledningen er et brev til klesbransjen; kampanjesluttdato som eget lagret felt er Fumes operasjonalisering. |
| `sources/pensum.json` · Forbrukertilsynet — Bærekraftpåstander | Generell avgrensning/dokumentasjon og tidligere `ok`-GET → presist uttak om helhetsinntrykk, omfang og forklaring ved påstanden; `ok` beholdt med lokal lese-/stireferanse. | `sources/fetched/Veiledning-om-bruk-av-bk-pastander_versj2.txt`: punkt 3.2–3.4.3, trykt side 6–8 / PDF-side 4–5. PDF-en har oppslag med to trykte sider; lokalt sidemerke 5 dekker trykt side 8–9. |

Norsk salgsveiledning krever dokumenterbare, reelle prisfordeler og omtaler historikk og rutiner; den er ikke kilde for et påstått eget EU-krav om nøyaktig disse lagringsfeltene. Tabellene i brevet er eksempler på vurdering av prisfordeler, ikke nye universelle tidsgrenser i ferdighetene.

## (d) Kildens utsagn og Fumes kontrollport

`house_rule: true` betyr at ferdighetens regel legger til en terskel, mer spesifikk dokumentasjon, arbeids-/godkjenningsport, videre anvendelsesområde eller obligatorisk standard utover kildens egen formulering. Det gjelder også når et kreativt råd gjøres til en ubetinget blokkering eller et enkelt case generaliseres til alle konsepter. `false` er brukt når den materielle kontrollen følger kildekravet direkte uten en slik tilleggsport. `source_says` oppsummerer kildens eget smalere utsagn i én selvstendig setning med egne ord.

Alle Schwartz-, Binet & Field- og Ehrenberg-Bass-ferdigheter er merket `true`, også der de siteres via LinkedIn eller IPA. Alle 15 ferdigheter merket «partly» i spottsjekken er merket `true`. YouTube-/TikTok-råd brukt som obligatoriske porter, Hopkins-operasjonaliseringer, caseavledede idéregler og Fumes etikk-/proveniensport er også vurdert. `tier` angir fortsatt kildetype; `house_rule` skiller Fumes kontroll fra kildeutsagnet.

Tabellene nedenfor logger hver av de 220 metadataendringene. Begge feltene manglet før; pilene viser de faktiske nye verdiene. Andre endrede felt for de ni berørte ferdighetene logges deretter.

### `skills/Copy.json`

| ID | `house_rule`: før → etter | `source_says`: før → etter |
| --- | --- | --- |
| `copy-overskrift-viser-relevans` | manglet → `true` | manglet → Hopkins beskriver overskriften som et middel til å fange interessen til de rette potensielle kjøperne. |
| `copy-overskrift-holder-loeftet` | manglet → `true` | manglet → Hopkins anbefaler overskrifter som trekker relevante lesere inn i annonsens salgsargument. |
| `copy-overskriftsalternativer` | manglet → `true` | manglet → Hopkins beskriver utprøving av overskrifter som appellerer til forskjellige interesser. |
| `copy-spor-overskriftstesten` | manglet → `true` | manglet → Hopkins beskriver sporbare annonser og resultatmåling som grunnlag for å sammenligne overskrifter. |
| `copy-fordel-for-leseren` | manglet → `true` | manglet → Hopkins anbefaler å fremheve hva selgeren kan gjøre for kjøperen fremfor selgerens ønske om salg. |
| `copy-proevetilbudets-vilkaar` | manglet → `true` | manglet → Hopkins omtaler prøving og service som måter å gjøre tilbudet nyttig for mottakeren. |
| `copy-konkret-produktegenskap` | manglet → `true` | manglet → Hopkins anbefaler konkrete opplysninger fremfor generelle kvalitetsord. |
| `copy-tall-med-grunnlag` | manglet → `true` | manglet → Hopkins fremhever presise opplysninger som mer overbevisende enn generelle påstander. |
| `copy-avgrens-superlativer` | manglet → `true` | manglet → Hopkins beskriver at overdrevne superlativer ofte oppfattes som tom skryt fremfor troverdige opplysninger. |
| `copy-svar-paa-kjoepsspoersmaal` | manglet → `true` | manglet → Hopkins anbefaler å gi potensielle kjøpere hele den relevante salgshistorien. |
| `copy-uavhengig-av-forrige-annonse` | manglet → `true` | manglet → Hopkins anbefaler at hver annonse formidler sin relevante salgshistorie uten å forutsette at tidligere annonser er lest. |
| `copy-bevis-for-hovedloeftet` | manglet → `true` | manglet → Hopkins fremhever konkretisering og troverdighet i produktpåstander. |
| `copy-proeven-lar-leseren-proeve` | manglet → `true` | manglet → Hopkins beskriver vareprøver som en måte å la interesserte undersøke produktet på. |
| `copy-bestill-proeven-tydelig` | manglet → `true` | manglet → Hopkins anbefaler å gjøre det lett for interesserte å be om en prøve. |
| `copy-samme-avsenderstemme` | manglet → `true` | manglet → Hopkins beskriver verdien av en gjenkjennelig og konsekvent personlighet i annonseringen. |
| `copy-be-om-en-handling` | manglet → `true` | manglet → Hopkins anbefaler å vise den ønskede positive handlingen fremfor bare å advare mot uønsket atferd. |
| `copy-foelg-opp-samme-interesse` | manglet → `true` | manglet → Hopkins anbefaler at svarbrev følger interessen som utløste mottakerens forespørsel. |
| `copy-forklar-ukjent-produktnavn` | manglet → `true` | manglet → Hopkins beskriver fordelen ved produktnavn som bidrar til å forklare hva produktet er. |
| `copy-vanlig-prosess-er-ikke-enerett` | manglet → `true` | manglet → Hopkins' Schlitz-eksempel beskriver hvordan en vanlig bryggeprosess ble fortalt som et konkret salgsargument. |
| `copy-beskriv-den-faktiske-prosessen` | manglet → `true` | manglet → Hopkins beskriver hvordan observasjoner fra fabrikken ga konkrete argumenter om fremstillingen av puffet korn. |
| `copy-navngi-den-virkelige-opphavspersonen` | manglet → `true` | manglet → Hopkins knytter utviklingen av puffet korn til professor Anderson i den beskrevne historien. |
| `copy-kontroller-sitater` | manglet → `false` | manglet → Ogilvys memo anbefaler å kontrollere sitater. |
| `copy-les-hoeyt-og-rett` | manglet → `true` | manglet → Ogilvys memo anbefaler å lese egen tekst høyt etter å ha lagt den bort en stund. |
| `copy-annen-leser-kontrollerer` | manglet → `true` | manglet → Ogilvys memo anbefaler at en kollega forbedrer viktig tekst før den sendes. |
| `copy-mottakeren-vet-neste-steg` | manglet → `false` | manglet → Ogilvys memo anbefaler å gjøre det helt klart hva man vil at mottakeren skal gjøre. |
| `copy-ett-tema-per-avsnitt` | manglet → `true` | manglet → NN/g anbefaler ett poeng per avsnitt for å gjøre nettinnhold lettere å skanne. |
| `copy-mellomtittel-navngir-innhold` | manglet → `true` | manglet → NN/g anbefaler informative mellomtitler som hjelper leseren å finne innholdet. |
| `copy-oppregning-som-liste` | manglet → `true` | manglet → NN/g anbefaler punktlister som et virkemiddel for skannbar tekst. |
| `copy-lenk-til-faglig-grunnlag` | manglet → `true` | manglet → NN/g beskriver at lenker til andre kilder kan øke en nettsides troverdighet. |
| `copy-vis-sammenhengen` | manglet → `true` | manglet → Språkrådet anbefaler å gjøre sammenhengen mellom setninger og opplysninger tydelig. |
| `copy-sammendrag-i-lange-brev` | manglet → `true` | manglet → Språkrådet anbefaler sammendrag i lengre brev slik at leseren raskt finner det viktigste. |
| `copy-menneskelig-korrektur` | manglet → `true` | manglet → Språkrådet anbefaler korrektur og oppmerksomhet på tegnsetting fremfor å stole på automatiske hjelpemidler alene. |
| `copy-selvforklarende-skjemafelt` | manglet → `true` | manglet → Språkrådet anbefaler forståelige feltbetegnelser og forklaringer der skjemabrukeren trenger dem. |
| `copy-navngi-den-som-handler` | manglet → `true` | manglet → Plainlanguage.gov anbefaler aktivt språk som gjør det tydelig hvem som gjør hva. |
| `copy-bruk-verb-for-handlinger` | manglet → `true` | manglet → Plainlanguage.gov anbefaler verb fremfor substantiver som skjuler handlingen. |
| `copy-riktig-tid-i-produktbeskrivelsen` | manglet → `true` | manglet → Plainlanguage.gov anbefaler nåtid når det er korrekt og andre tider når presisjon krever det. |
| `copy-overskriftsnivaa-viser-struktur` | manglet → `true` | manglet → Plainlanguage.gov anbefaler et overskriftshierarki som viser forholdet mellom deler av teksten. |
| `copy-unngaa-hele-setninger-med-versaler` | manglet → `true` | manglet → Plainlanguage.gov fraråder sammenhengende tekst med bare store bokstaver fordi den er vanskeligere å lese. |
| `copy-test-tekstutkastet-tidlig` | manglet → `true` | manglet → Plainlanguage.gov anbefaler å teste tekst tidlig nok til at funn kan brukes til forbedring. |
| `copy-test-rettingen` | manglet → `true` | manglet → Plainlanguage.gov beskriver testing og revisjon som en gjentatt prosess. |
| `copy-leseren-forklarer-med-egne-ord` | manglet → `true` | manglet → NN/g anbefaler oppfølgingsspørsmål i modererte innholdstester for å undersøke deltakernes forståelse. |
| `copy-test-med-relevante-lesere` | manglet → `true` | manglet → NN/g anbefaler å rekruttere testdeltakere som er relevante for innholdet og oppgavene. |
| `copy-ikke-forklar-fasiten-i-testen` | manglet → `true` | manglet → NN/g anbefaler at testlederen tåler stillhet og lar deltakeren forsøke uten å få løsningen forklart. |
| `copy-temaord-tidlig-i-titler` | manglet → `true` | manglet → NN/g anbefaler å legge meningsbærende ord tidlig i overskrifter for å støtte skanning. |
| `copy-kontroller-tekst-paa-mobil` | manglet → `true` | manglet → NN/g påpeker at responsiv utforming kan endre hvor ordene havner i lesernes skannemønstre. |

### `skills/Idé.json`

| ID | `house_rule`: før → etter | `source_says`: før → etter |
| --- | --- | --- |
| `ide-samlet-skisse` | manglet → `true` | manglet → Bernbach-omtalen beskriver samarbeid mellom tekstforfatter og art director om annonsens samlede uttrykk. |
| `ide-bildets-bidrag` | manglet → `true` | manglet → Bernbach-omtalen fremhever samspillet mellom tekst og bilde i kreativt arbeid. |
| `ide-felles-utvikling` | manglet → `true` | manglet → Bernbach-omtalen beskriver at tekstforfatter og art director utvikler annonser sammen. |
| `ide-sted-i-fortelling` | manglet → `true` | manglet → Woods presentasjon knytter konkret sted til reklametrekk han forbinder med høyre hjernehalvdel. |
| `ide-handling-med-utvikling` | manglet → `true` | manglet → Woods presentasjon fremhever fortelling og hendelsesforløp som kreative kjennetegn. |
| `ide-figur-med-handling` | manglet → `true` | manglet → Woods presentasjon fremhever karakterer og handling i fortellende reklame. |
| `ide-folelsestest` | manglet → `true` | manglet → System1 beskriver måling av publikums følelsesreaksjoner som del av sin annonsetestmetode. |
| `ide-noytral-reaksjon` | manglet → `true` | manglet → System1s metode omfatter nøytral reaksjon i målingen av følelser. |
| `ide-avsender-i-test` | manglet → `true` | manglet → System1 beskriver måling av om publikum gjenkjenner merket i annonsen. |
| `ide-metafor-med-forbindelse` | manglet → `true` | manglet → D&AD-caset bruker en håndlaget firkant som en visuell forbindelse til produktet og håndverket. |
| `ide-samme-ide-i-kanaler` | manglet → `true` | manglet → D&AD-caset beskriver hvordan den håndlagde firkanten ble brukt som en gjennomgående kreativ idé. |
| `ide-studentcase-status` | manglet → `true` | manglet → D&AD presenterer arbeidet som et New Blood-studentkonsept. |
| `ide-typografi-baerer-mening` | manglet → `true` | manglet → D&AD-caset bruker bokstavenes utforming til å uttrykke sakens budskap. |
| `ide-symbol-med-betydning` | manglet → `true` | manglet → D&AD-caset bruker gjentatte visuelle enheter til å formidle omfanget av problemet. |
| `ide-handling-for-saken` | manglet → `true` | manglet → D&AD-caset knytter en visuell fremstilling av problemet til en oppfordring om handling. |
| `ide-konkret-hverdagsproblem` | manglet → `true` | manglet → ThisAbles-caset tar utgangspunkt i konkrete hindringer mennesker med funksjonsnedsettelser møter ved bruk av møbler. |
| `ide-test-med-berorte` | manglet → `true` | manglet → ThisAbles-caset beskriver utvikling sammen med mennesker som selv møter de aktuelle brukshindrene. |
| `ide-praktisk-losning` | manglet → `true` | manglet → ThisAbles-caset beskriver konkrete hjelpemidler og hvordan de kunne gjøres tilgjengelige for brukerne. |
| `ide-innsikt-som-har-endret-seg` | manglet → `true` | manglet → Effies Dove-case beskriver et nytt syn på kategorien som grunnlag for fornyet kommunikasjon. |
| `ide-bevar-kjernen` | manglet → `true` | manglet → Effies Dove-case beskriver fornyelse av uttrykket med en videreført merkevareidé. |
| `ide-case-riktig-merke` | manglet → `true` | manglet → Effies case oppgir hvilket Dove-merke, hvilken annonsør, kategori og hvilke markeder arbeidet gjelder. |
| `ide-tiltak-bak-saken` | manglet → `true` | manglet → Cannes Lions beskriver konkrete tiltak i Contract for Change som grunnlag for kampanjens formål. |
| `ide-rapportert-ikke-bevist` | manglet → `true` | manglet → Cannes Lions-omtalen gjengir resultater for Contract for Change uten i seg selv å fastsette en generell metode for årsaksbevis. |
| `ide-begrunn-endringer` | manglet → `true` | manglet → Trott kritiserer endringer og inngrep som svekker kreativt arbeid uten å forbedre det. |
| `ide-bevar-baerende-grep` | manglet → `true` | manglet → Trott beskriver hvordan en idé kan miste kraft når dens bærende kreative grep fjernes. |
| `ide-bilde-med-oppgave` | manglet → `true` | manglet → Hopkins mener annonsebilder bør bidra med et salgsargument fremfor å være pynt alene. |
| `ide-test-visuelt-valg` | manglet → `true` | manglet → Hopkins anbefaler å sammenligne annonsebilders resultater fremfor å stole på personlig smak. |
| `ide-grunn-til-a-bytte` | manglet → `true` | manglet → Hopkins påpeker at mennesker trenger en grunn til å endre vaner og velge et annet tilbud. |
| `ide-sammenlign-ideer` | manglet → `true` | manglet → Hopkins anbefaler sammenlignende testkampanjer som grunnlag for valg av annonsering. |
| `ide-ny-hypotese-etter-avslag` | manglet → `true` | manglet → Hopkins viser med et matvareeksempel at resultater for én produktform ikke uten videre gjelder en annen. |

### `skills/Leseren.json`

| ID | `house_rule`: før → etter | `source_says`: før → etter |
| --- | --- | --- |
| `leseren-begrunn-kunnskapsnivaa` | manglet → `true` | manglet → Den gratis forklaringen av Schwartz deler lesere i fem nivåer etter kjennskap til problem, løsning og produkt samt ønske om produktet. |
| `leseren-ukjent-problem` | manglet → `true` | manglet → Den gratis forklaringen av Schwartz beskriver det minst bevisste nivået som lesere som ennå ikke oppfatter problemet. |
| `leseren-kjent-problem` | manglet → `true` | manglet → Den gratis forklaringen av Schwartz beskriver problembevisste lesere som kjent med problemet uten å kjenne løsningen. |
| `leseren-kjent-loesning` | manglet → `true` | manglet → Den gratis forklaringen av Schwartz beskriver løsningsbevisste lesere som kjent med løsningstypen uten nødvendigvis å kjenne produktet. |
| `leseren-kjent-produkt` | manglet → `true` | manglet → Den gratis forklaringen av Schwartz beskriver produktbevisste lesere som kjent med produktet, men ennå ikke overbevist om å velge det. |
| `leseren-klar-for-kjoep` | manglet → `true` | manglet → Den gratis forklaringen av Schwartz beskriver de mest bevisste som kjent med og interessert i produktet og opptatt av pris og kjøpsmulighet. |
| `leseren-allerede-kunde` | manglet → `true` | manglet → Den gratis forklaringen av Schwartz advarer mot å behandle eksisterende kjøpere som om de ennå ikke kjenner tilbudet. |
| `leseren-situasjon-og-fremgang` | manglet → `true` | manglet → Christensen og Moesta forklarer kjøp gjennom situasjonen og fremgangen kunden ønsker, fremfor demografi alene. |
| `leseren-tre-sider-av-jobben` | manglet → `true` | manglet → Christensen Institute beskriver jobber som sammensatt av funksjonelle, følelsesmessige og sosiale sider. |
| `leseren-alternativet-i-hverdagen` | manglet → `true` | manglet → JTBD-eksemplene viser at produkter konkurrerer med andre måter å løse den samme oppgaven på. |
| `leseren-uro-ved-bytte` | manglet → `true` | manglet → Christensen Institutes boligeksempel viser at uro og praktiske hindringer kan holde kjøpere fra å bytte løsning. |
| `leseren-rekonstruer-bytte` | manglet → `true` | manglet → Moesta beskriver detaljerte intervjuer om faktiske kjøpsbytter og hendelsene som ledet frem til dem. |
| `leseren-fire-byttekrefter` | manglet → `true` | manglet → Moesta beskriver misnøye, tiltrekning, uro og vane som fire krefter som påvirker et bytte. |
| `leseren-aapne-intervjuspoersmaal` | manglet → `true` | manglet → Moesta anbefaler å legge egne antakelser til side og undersøke kundens faktiske kjøpshistorie. |
| `leseren-observasjon-og-tolkning` | manglet → `true` | manglet → Moesta beskriver hvordan to intervjuere kan bidra til å oppdage og drøfte ulike tolkninger av kundens historie. |
| `leseren-kartlegg-friksjon` | manglet → `true` | manglet → EAST anbefaler å redusere innsatsen som kreves for å utføre en handling og undersøke tiltak i sin kontekst. |
| `leseren-presis-handling` | manglet → `true` | manglet → EAST anbefaler enkle budskap som gjør den ønskede handlingen lett å forstå. |
| `leseren-begrunn-tidspunkt` | manglet → `true` | manglet → EAST anbefaler å nå mennesker på tidspunkter der de er mottakelige for den aktuelle handlingen. |
| `leseren-innsats-naa` | manglet → `true` | manglet → EAST anbefaler å ta hensyn til at umiddelbare kostnader og fordeler veier tungt i beslutninger. |
| `leseren-planlegg-handlingen` | manglet → `true` | manglet → EAST beskriver hvordan konkrete planer for når og hvordan man handler kan øke gjennomføring. |
| `leseren-majoritet-med-grunnlag` | manglet → `true` | manglet → EAST anbefaler å vise utbredt ønsket atferd, mens Cialdinis etikk krever sannferdig og redelig bruk av påvirkning. |
| `leseren-maal-handling` | manglet → `true` | manglet → EAST advarer mot å behandle holdninger og uttalte hensikter som om de var faktisk atferd. |
| `leseren-gi-foer-du-ber` | manglet → `true` | manglet → Cialdini beskriver gjensidighet ved å gi først og krever redelig bruk av påvirkningsprinsippene. |
| `leseren-ekte-knapphet` | manglet → `true` | manglet → Cialdini beskriver knapphet som påvirkningsmekanisme, mens UCPD forbyr falsk tidspressmarkedsføring og norsk veiledning krever reelle dokumenterbare prisfordeler. |
| `leseren-relevant-autoritet` | manglet → `true` | manglet → Cialdini beskriver betydningen av troverdig og relevant ekspertise for autoritet. |
| `leseren-frivillig-forpliktelse` | manglet → `true` | manglet → Cialdini beskriver hvordan frivillige og aktive forpliktelser kan støtte senere konsistent handling. |
| `leseren-sammenlignbare-andre` | manglet → `true` | manglet → Cialdini beskriver at andres atferd kan påvirke oss særlig når de ligner oss. |
| `leseren-rettferdig-sammenligning` | manglet → `true` | manglet → Cialdinis etiske regler krever sannferdig fremstilling og avviser villedende bruk av kontraster og sammenligninger. |
| `leseren-overskrifter-for-skumming` | manglet → `true` | manglet → NN/g beskriver at nettlesere ofte skanner teksten og bruker overskrifter til å finne relevant innhold. |
| `leseren-svar-foerst` | manglet → `true` | manglet → NN/g beskriver skanning av nettsider, og EAST anbefaler å forenkle budskap og fremheve viktig informasjon. |
| `leseren-navngi-leseoppgaven` | manglet → `true` | manglet → NN/g beskriver flere lesemønstre og at oppgaven påvirker hvordan mennesker leser på nett. |
| `leseren-lenken-holder-loeftet` | manglet → `true` | manglet → NN/g beskriver hvordan tydelige lenketekster gir forventninger om målinnholdet og hvordan misvisende lokking svekker tillit. |
| `leseren-lenkeomtale-gir-detaljer` | manglet → `true` | manglet → NN/g beskriver at innhold ved en lenke bidrar til å vise om målsiden er relevant. |
| `leseren-lettlest-er-ikke-bevis` | manglet → `true` | manglet → Fluensforskningen beskriver at lett bearbeiding og gjentakelse kan øke opplevd sannhet uten å sikre faktisk sannhet. |
| `leseren-forkunnskap-foer-faguttrykk` | manglet → `true` | manglet → Fluensforskningen beskriver forskjeller mellom eksperter og nybegynnere, mens NN/g anbefaler forståelige signaler om lenkers innhold. |

### `skills/Lov.json`

| ID | `house_rule`: før → etter | `source_says`: før → etter |
| --- | --- | --- |
| `lov-no-dokumentasjon-for-publisering` | manglet → `true` | manglet → Markedsføringsloven krever at faktapåstander kan dokumenteres og at annonsøren har dokumentasjonen når markedsføringen skjer. |
| `lov-no-egenskaper-stemmer` | manglet → `true` | manglet → Markedsføringsloven forbyr uriktige eller villedende opplysninger om blant annet produktets viktigste egenskaper. |
| `lov-no-synlig-reklame` | manglet → `true` | manglet → Markedsføringsloven krever gjenkjennelig markedsføring og forbyr villedende utelatelse av det kommersielle formålet. |
| `lov-no-pris-med-tillegg` | manglet → `false` | manglet → Ved kjøpsoppfordringer krever markedsføringsloven pris med avgifter og relevante tillegg eller opplysninger om beregning og mulige tillegg når beløp ikke kan beregnes på forhånd. |
| `lov-no-selgerens-identitet` | manglet → `false` | manglet → Ved kjøpsoppfordringer regner markedsføringsloven selgerens identitet og geografiske adresse som vesentlige opplysninger dersom de ikke fremgår av sammenhengen. |
| `lov-no-opplys-angrerett` | manglet → `false` | manglet → Markedsføringsloven krever opplysning om eventuell angrerett eller avbestillingsrett ved kjøpsoppfordringer når den ikke fremgår av sammenhengen. |
| `lov-no-forklar-omtaleverifisering` | manglet → `false` | manglet → Markedsføringsloven krever informasjon om hvorvidt og hvordan virksomheten sikrer at tilgjengelige forbrukeromtaler kommer fra reelle brukere eller kjøpere. |
| `lov-no-samtykke-elektronisk` | manglet → `true` | manglet → Markedsføringsloven krever som hovedregel forhåndssamtykke for elektronisk markedsføring til fysiske personer, med et avgrenset kundeunntak. |
| `lov-no-kundeunntak` | manglet → `false` | manglet → Kundeunntaket gjelder egne tilsvarende ytelser når adressen er mottatt ved salg og kunden får enkel og gebyrfri reservasjon ved innsamling og hver henvendelse. |
| `lov-no-gratis-avmelding` | manglet → `true` | manglet → Markedsføringsloven krever enkel og gebyrfri reservasjon i hver elektroniske markedsføringshenvendelse som bruker kundeunntaket. |
| `lov-no-barn-kjopspress` | manglet → `false` | manglet → Markedsføringsloven forbyr direkte kjøpsoppfordringer til barn og oppfordringer om å overtale voksne til kjøp. |
| `lov-no-barn-sosialt-press` | manglet → `true` | manglet → Ved vurdering av markedsføring overfor barn skal det blant annet tas hensyn til om den spiller på sosial usikkerhet eller dårlig samvittighet. |
| `lov-no-b2b-faktasjekk` | manglet → `true` | manglet → Markedsføringsloven forbyr villedende fremstillinger som kan påvirke etterspørselen mellom næringsdrivende og krever dokumentasjon for faktapåstander. |
| `lov-no-garantivilkar` | manglet → `false` | manglet → Markedsføringsloven fastsetter hvilke opplysninger garantivilkår skal inneholde og krav til språk og utlevering på varig medium. |
| `lov-no-forvekslende-etterligning` | manglet → `true` | manglet → Markedsføringsloven forbyr etterligning som både urimelig utnytter andres innsats eller resultater og medfører fare for forveksling. |
| `lov-de-samme-behov` | manglet → `true` | manglet → UWG krever at sammenlignende reklame gjelder varer eller tjenester som dekker samme behov eller formål. |
| `lov-de-etterprovbar-sammenligning` | manglet → `false` | manglet → UWG krever objektiv sammenligning av vesentlige, relevante, etterprøvbare og representative egenskaper eller pris. |
| `lov-de-telefon-samtykke` | manglet → `true` | manglet → UWG krever uttrykkelig forhåndssamtykke for reklamesamtaler til forbrukere. |
| `lov-de-oppbevar-telefonsamtykke` | manglet → `false` | manglet → UWG krever at samtykke til telefonreklame dokumenteres ved avgivelsen og oppbevares i fem år fra avgivelsen og hver bruk. |
| `lov-de-epost-grunnlag` | manglet → `false` | manglet → UWG krever uttrykkelig forhåndssamtykke til e-postreklame med et avgrenset unntak for egne lignende ytelser til eksisterende kunder. |
| `lov-de-forklar-rangering` | manglet → `false` | manglet → UWG krever lett tilgjengelig informasjon om hovedparametere for produktrangering og deres relative betydning, med et unntak for nettbaserte søkemotorer. |
| `lov-de-forklar-omtaler` | manglet → `false` | manglet → UWG krever informasjon om hvorvidt og hvordan tilgjengelige omtaler kontrolleres som skrevet av reelle brukere eller kjøpere. |
| `lov-eu-godkjenning-av-merker` | manglet → `true` | manglet → UCPD forbyr bruk av tillitsmerker uten tillatelse og uriktige påstander om godkjenning eller om at godkjenningsvilkår er oppfylt. |
| `lov-eu-ekte-tidsfrist` | manglet → `true` | manglet → UCPD forbyr falske påstander om svært begrenset tilbudstid som presser frem raske valg, og norsk veiledning krever reelle dokumenterbare prisfordeler. |
| `lov-eu-avgrens-miljopastand` | manglet → `false` | manglet → UCPD forbyr miljøpåstander om hele produktet eller virksomheten som bare gjelder en del, og norsk veiledning krever presis avgrensning og et ikke-villedende helhetsinntrykk. |
| `lov-eu-ikke-eksklusive-lovrettigheter` | manglet → `false` | manglet → UCPD forbyr å presentere lovfestede forbrukerrettigheter som en særfordel ved tilbudet. |
| `lov-eu-merk-betalt-rangering` | manglet → `true` | manglet → UCPD forbyr å vise søkeresultater uten tydelig opplysning om betaling som gir annonsering eller høyere rangering. |
| `lov-eu-ekte-kundeomtaler` | manglet → `false` | manglet → UCPD forbyr falske eller fordreide omtaler og udokumentert påstand om at omtaler kommer fra reelle brukere uten rimelige kontrolltiltak. |
| `lov-eu-gratis-uten-skjulte-gebyrer` | manglet → `false` | manglet → UCPD tillater bare uunngåelige svar-, hente- eller leveringskostnader når en ytelse omtales som gratis. |
| `lov-eu-ikke-utgi-selger-for-kunde` | manglet → `true` | manglet → UCPD forbyr å skjule kommersiell opptreden som privat forbrukeratferd eller å gi uriktig inntrykk av å være forbruker. |
| `lov-mat-godkjent-helsepastand` | manglet → `true` | manglet → Forordningen krever normalt godkjent helsepåstand med oppfylte vilkår, men artikkel 28 åpner avgrenset overgangsbruk også for enkelte uavklarte botaniske påstander. |
| `lov-mat-generell-helsefordel` | manglet → `true` | manglet → Generelle helsefordeler krever normalt en ledsagende spesifikk listeført påstand, men overgangsreglene kan gi unntak der deres konkrete vilkår er oppfylt. |
| `lov-mat-ikke-vekttapstall` | manglet → `true` | manglet → Artikkel 12 bokstav b forbyr helsepåstander som viser til vekttapets hastighet eller størrelse, også når påstanden ellers kan brukes under overgangsreglene. |
| `lov-mat-sukkerfri-grense` | manglet → `true` | manglet → Vedlegget tillater sukkerfri og uttrykk med samme betydning ved høyst 0,5 gram sukker per 100 gram eller 100 milliliter, uten noe generelt botanisk overgangsunntak fra denne grensen. |
| `lov-uk-forbehold-uten-motsigelse` | manglet → `false` | manglet → CAP Code krever tydelige vesentlige forbehold som presiserer fremfor å motsi hovedpåstanden. |
| `lov-uk-tillatelse-til-kundeuttalelse` | manglet → `false` | manglet → CAP Code krever tillatelse til kundeuttalelser med avgrensede unntak i regel 3.50. |
| `lov-uk-opplys-belonnede-omtaler` | manglet → `false` | manglet → CAP Code krever tydelig opplysning om at en forbrukeromtale er gitt mot en fordel. |
| `lov-google-ekte-grensesnitt` | manglet → `false` | manglet → Google forbyr annonseutforming som etterligner systemvarsler eller inneholder misvisende betjeningselementer. |
| `lov-google-finnbart-tilbud` | manglet → `true` | manglet → Google forbyr annonsering av tilbud som ikke er tilgjengelige eller ikke lett kan finnes på målsiden. |

### `skills/Plattform.json`

| ID | `house_rule`: før → etter | `source_says`: før → etter |
| --- | --- | --- |
| `plattform-plassering-stoetter-format` | manglet → `true` | manglet → Meta beskriver at annonseformater har bestemte tilgjengelige plasseringer. |
| `plattform-test-ulike-metaformater` | manglet → `true` | manglet → Meta presenterer bilde, video, karusell og samling som forskjellige annonseformater. |
| `plattform-meta-budskap-tre-sekunder` | manglet → `true` | manglet → Meta anbefaler å vise merke og hovedbudskap i de første tre sekundene av Instagram-videoannonser. |
| `plattform-karusell-maks-ti-kort` | manglet → `false` | manglet → Meta beskriver karusellannonser som to eller flere bilder eller videoer og oppgir opptil ti kort per annonse. |
| `plattform-samling-koblet-til-katalog` | manglet → `true` | manglet → Meta beskriver samlingsannonser som et format for å vise og utforske produkter. |
| `plattform-youtube-merke-foer-fem` | manglet → `true` | manglet → Googles artikkel anbefaler tidlig og tydelig merkevarebygging i YouTube-videoer. |
| `plattform-youtube-ett-hovedbudskap` | manglet → `true` | manglet → Googles ABCD-råd anbefaler å fokusere budskapet for å skape kontakt med seeren. |
| `plattform-youtube-handling-synlig-og-hoerbar` | manglet → `true` | manglet → Googles ABCD-råd anbefaler synlig handlingsoppfordring som forsterkes med tale. |
| `plattform-youtube-vurdering-vis-bruk` | manglet → `true` | manglet → Googles ABCD-råd anbefaler å vise hvordan produktet passer inn i seerens liv ved vurderingsmål. |
| `plattform-youtube-handling-etter-kontekst` | manglet → `true` | manglet → Googles ABCD-råd anbefaler å etablere sammenheng før en handlingsoppfordring ved handlingsmål. |
| `plattform-google-lever-flere-sideforhold` | manglet → `true` | manglet → Google anbefaler flere formater og kreative temaer for å gi automatiseringen flere muligheter. |
| `plattform-youtube-skaper-kategorirelevans` | manglet → `true` | manglet → Google beskriver samarbeid med skapere som en måte å utfylle merkevareannonser på. |
| `plattform-shorts-ekte-produktbruk` | manglet → `true` | manglet → Googles Shorts-råd anbefaler å vise produktbruk og knytte produktet til seerens hverdag. |
| `plattform-tiktok-staaende-video` | manglet → `true` | manglet → TikToks Creative Codes anbefaler stående video i sideforholdet 9:16. |
| `plattform-tiktok-minst-720p` | manglet → `true` | manglet → TikToks Creative Codes anbefaler produksjon med minst 720p oppløsning. |
| `plattform-tiktok-frie-grensesnittsoner` | manglet → `true` | manglet → TikToks Creative Codes anbefaler å holde viktig innhold innenfor soner der plattformens grensesnitt ikke dekker det. |
| `plattform-tiktok-fungerende-lyd` | manglet → `true` | manglet → TikToks Creative Codes anbefaler lyd som en aktiv del av videoens uttrykk. |
| `plattform-tiktok-innholdslovfte-tre-sekunder` | manglet → `true` | manglet → TikTok anbefaler å introdusere hva innholdet tilbyr i de første tre sekundene. |
| `plattform-tiktok-aapningsgrep-seks-sekunder` | manglet → `true` | manglet → TikTok anbefaler et oppmerksomhetsgrep i de første seks sekundene. |
| `plattform-tiktok-aapning-budskap-handling` | manglet → `true` | manglet → TikToks Creative Codes anbefaler en struktur med åpning, hoveddel og avslutning. |
| `plattform-tiktok-kontroller-undertekster` | manglet → `true` | manglet → TikTok anbefaler tekstlag og automatiske undertekster som del av plattformtilpasset kreativt arbeid. |
| `plattform-tiktok-ulike-testvarianter` | manglet → `true` | manglet → TikTok anbefaler flere varierte kreative alternativer i annonsegrupper for å undersøke hva som virker. |
| `plattform-tiktok-plan-for-utskifting` | manglet → `true` | manglet → TikTok anbefaler å følge resultatene og fornye materiell når effekten svekkes. |
| `plattform-tiktok-sporbart-materiell` | manglet → `true` | manglet → TikTok anbefaler å bygge et bibliotek av kreativt materiell for videre bruk og optimalisering. |
| `plattform-tiktok-dater-trendvalget` | manglet → `true` | manglet → TikTok anbefaler å bruke trender som utgangspunkt for fortellergrep. |
| `plattform-tiktok-hendelse-svarer-til-handling` | manglet → `true` | manglet → TikTok beskriver valg av hendelser og parametere som del av oppsettet for datatilkobling. |
| `plattform-tiktok-registrer-attribusjonsvinduer` | manglet → `true` | manglet → TikTok beskriver klikk- og visningsbaserte attribusjonsvinduer og deres betydning for måling. |
| `plattform-sammenlign-like-maalegrunnlag` | manglet → `true` | manglet → TikTok anbefaler å vurdere attribusjonsvinduer når resultater sammenlignes mellom plattformer. |
| `plattform-tiktok-splittest-med-hypotese` | manglet → `true` | manglet → TikTok beskriver splittester som en metode for å undersøke forskjeller mellom kampanjealternativer. |
| `plattform-google-sertifikat-person-og-dato` | manglet → `false` | manglet → Google beskriver sertifisering som personlig og tidsbegrenset til det aktuelle produktområdet. |
| `plattform-google-partner-er-egen-status` | manglet → `false` | manglet → Google skiller mellom en persons produktsertifisering og en virksomhets Google Partner-status. |
| `plattform-google-tilbud-finnes-paa-maalsiden` | manglet → `false` | manglet → Google forbyr utilgjengelige tilbud og misvisende sammenheng mellom annonse og målinnhold. |
| `plattform-google-ingen-falske-knapper` | manglet → `false` | manglet → Google forbyr misvisende annonseutforming som etterligner systemmeldinger eller viser falske betjeningselementer. |
| `plattform-google-vis-betalingsmodellen` | manglet → `false` | manglet → Google krever tydelig informasjon om betalingsmodell og kostnader og forbyr villedende prispraksis. |
| `plattform-ingen-ki-ugc-eller-falske-kunder` | manglet → `true` | manglet → Fumes brief forbyr KI-generert UGC og KI-genererte personer som utgir seg for å være virkelige kunder. |

### `skills/Strategi.json`

| ID | `house_rule`: før → etter | `source_says`: før → etter |
| --- | --- | --- |
| `strategi-felles-brief` | manglet → `true` | manglet → BetterBriefs beskriver manglende felles forståelse mellom oppdragsgiver og byrå som et problem ved briefer. |
| `strategi-avklar-uenighet` | manglet → `true` | manglet → BetterBriefs peker på svakheter og misforståelser i markedsføringsbriefer. |
| `strategi-lokal-vekstevidens` | manglet → `true` | manglet → Ehrenberg-Bass tilbyr analyser av om kjente vekstmønstre gjelder i en bestemt kategori og et bestemt land. |
| `strategi-penetrasjonshinder` | manglet → `true` | manglet → Ehrenberg-Bass beskriver kategorianalyse som hjelp til å finne hindringer for merkevekst. |
| `strategi-lette-kjopere` | manglet → `true` | manglet → Ehrenberg-Bass trekker frem utbredelsen av kjøpere som handler sjelden som en del av konkurranseanalysen. |
| `strategi-sammenlign-kjoperprofiler` | manglet → `true` | manglet → Ehrenberg-Bass undersøker hvordan merkets kjøperprofil ligner på eller skiller seg fra konkurrentenes. |
| `strategi-kartlegg-merkeelementer` | manglet → `true` | manglet → Ehrenberg-Bass beskriver kartlegging av eksisterende merkeelementer som første trinn i måling av særpreg. |
| `strategi-mal-for-merkeendring` | manglet → `true` | manglet → Ehrenberg-Bass anbefaler måling av merkeelementer som grunnlag ved endring eller oppdatering. |
| `strategi-merkeelement-nytt-marked` | manglet → `true` | manglet → Ehrenberg-Bass omtaler måling av merkeelementer ved kategoriutvidelse og etablering i nye markeder. |
| `strategi-konkret-kjopssituasjon` | manglet → `true` | manglet → Ehrenberg-Bass beskriver kjøpssituasjoner som signaler som får kategorikjøpere til å hente frem merker fra hukommelsen. |
| `strategi-kjoperskapte-situasjoner` | manglet → `true` | manglet → Ehrenberg-Bass beskriver en prosess som først finner mulige kjøpssituasjoner og deretter undersøker dem blant kategorikjøpere. |
| `strategi-troverdig-kjopssituasjon` | manglet → `true` | manglet → Romaniuk beskriver intern vurdering av merkets troverdighet som ett hensyn ved prioritering av kjøpssituasjoner. |
| `strategi-konkurranse-per-situasjon` | manglet → `true` | manglet → Romaniuk vurderer hvor sterkt konkurrerende merker er knyttet til en kjøpssituasjon når situasjoner prioriteres. |
| `strategi-kommersiell-situasjonsverdi` | manglet → `true` | manglet → Romaniuk vurderer kjøpssituasjoners utbredelse og økonomiske verdi som deler av prioriteringen. |
| `strategi-ett-budskap-per-annonse` | manglet → `true` | manglet → Romaniuk anbefaler én kjøpssituasjon per enkeltannonse og flere situasjoner gjennom den langsiktige kommunikasjonen. |
| `strategi-merke-og-situasjon-sammen` | manglet → `true` | manglet → Romaniuk beskriver samtidig presentasjon av merke og kjøpssituasjon som grunnlag for å bygge minnekoblinger. |
| `strategi-bredere-situasjonsnettverk` | manglet → `true` | manglet → Romaniuk anbefaler å bygge et bredere nettverk av kjøpssituasjoner gjennom kommunikasjon over tid. |
| `strategi-kjopbarhet` | manglet → `true` | manglet → Romaniuk understreker at mental tilgjengelighet må støttes av fysisk tilgjengelighet. |
| `strategi-mal-mentale-koblinger` | manglet → `true` | manglet → Romaniuk beskriver tre mål for merkets koblinger til kjøpssituasjoner: mental markedsandel, mental penetrasjon og nettverksstørrelse. |
| `strategi-sov-sammenligningsgrunnlag` | manglet → `true` | manglet → Binet og Field knytter investering i reklameandel til vekstmuligheter i B2B-markeder. |
| `strategi-begrunn-budsjettbalansen` | manglet → `true` | manglet → LinkedIns omtale av Binet og Field anbefaler omtrent jevn fordeling mellom merkevarebygging og aktivering som utgangspunkt i B2B. |
| `strategi-nye-kjopere` | manglet → `true` | manglet → Binet og Field fremhever utvidelse av kundebasen som en vekstdriver. |
| `strategi-fremtidige-kjopere` | manglet → `true` | manglet → LinkedIns omtale av Binet og Field anbefaler parallelle strategier for kjøpere som er og ikke er i markedet nå. |
| `strategi-folelsens-rolle` | manglet → `true` | manglet → Binet og Field fremhever følelsers betydning for langsiktig merkevarebygging også i B2B. |
| `strategi-salgsutlosende-informasjon` | manglet → `true` | manglet → LinkedIns omtale av Binet og Field skiller mellom langsiktig følelsesbasert merkevarebygging og mer produktorientert aktivering. |
| `strategi-kortsiktig-og-langsiktig-maling` | manglet → `true` | manglet → IPAs oppsummering anbefaler å måle både kortsiktige og langsiktige virkninger. |
| `strategi-pris-og-volum` | manglet → `true` | manglet → IPAs oppsummering anbefaler å støtte både salgsvolum og oppnådd pris. |
| `strategi-samspill-merke-og-salg` | manglet → `true` | manglet → IPAs oppsummering anbefaler at merkevarebygging og aktivering integreres. |
| `strategi-prospektdekning` | manglet → `true` | manglet → IPAs oppsummering anbefaler kommunikasjon til alle potensielle kjøpere. |
| `strategi-effektniva` | manglet → `true` | manglet → B2B Effectiveness Code skiller mellom ulike nivåer av kommunikasjonseffekt fra respons til langsiktig forretningsvekst. |
| `strategi-respons-er-ikke-salg` | manglet → `true` | manglet → B2B Effectiveness Code behandler respons og gjennomført salg som forskjellige effektnivåer. |
| `strategi-kampanjens-rammer` | manglet → `true` | manglet → B2B Effectiveness Code beskriver kreativ forpliktelse gjennom blant annet budsjett, varighet og kanalbredde. |
| `strategi-konkurrentgrunnlag-for-loftet` | manglet → `true` | manglet → Hopkins anbefaler å ta hensyn til konkurrentenes tilbud og argumenter når annonseringsstrategien utformes. |
| `strategi-test-for-oppskalering` | manglet → `true` | manglet → Hopkins beskriver små testkampanjer som en måte å undersøke kostnader og resultater før større investeringer. |
| `strategi-kundeverdi-fremfor-svar` | manglet → `true` | manglet → Hopkins påpeker at kostnad per svar ikke er endelig resultat fordi svar må vurderes ut fra senere kjøp. |
| `strategi-rekkevidde-frekvens-og-leveranse` | manglet → `true` | manglet → IPA anbefaler bred prospektdekning og måling over flere tidshorisonter, mens Ehrenberg-Bass fremhever kategoridata og penetrasjon. |

## Øvrige feltendringer, før → etter

Forkortede utdrag er merket med «…»; full avgrensning og alle nye rettslige vilkår står i punkt (a–c) og de aktuelle JSON-feltene. `read_on` har samme datoverdi etter ny lesing og vises derfor ikke som en verdiendring.

| Fil | ID | Felt | Før → etter, kort |
| --- | --- | --- | --- |
| `skills/Leseren.json` | `leseren-ekte-knapphet` | `check` | kode+menneske → kode+kritiker+menneske |
| `skills/Leseren.json` | `leseren-ekte-knapphet` | `rule` | Hver påstand om få plasser, begrenset lager eller utløpende tilbud skal ha en datert lageropplysning, kapasitetsgrense eller vedtatt frist. En nedtelling som s… → Hver påstand om få plasser eller begrenset lager skal ha en datert, kildebelagt lageropplysning eller kapasitetsgrense kontrollert før publisering; manglende e… |
| `skills/Leseren.json` | `leseren-ekte-knapphet` | `sources` | Robert Cialdini / Influence at Work — Principles of Persuasion — The Second Universal Principle of Persuasion is Scarcity; Cialdini — Code of Ethics — Cialdini Code of Ethics, punkt 1, 3 og 4 → Robert Cialdini / Influence at Work — Principles of Persuasion — The Second Universal Principle of Persuasion is Scarcity; Cialdini — Code of Ethics — Cialdini Code of Ethics, punkt 1, 3 og 4; EU — Unfair Commercial Practices Directive 2005/29/EC, konsolidert 27.09.2026 — Vedlegg I punkt 7; Forbrukertilsynet — Salg og betingede tilbud (2025) — Side 4 punkt 2 (dokumentasjon når markedsføringen skjer); side 7–10 punkt 3.3–3.4; side 13 punkt 3.6 |
| `skills/Lov.json` | `lov-eu-avgrens-miljopastand` | `principle` | En fordel ved én del gir ikke grunnlag for en påstand om hele produktet eller virksomheten. → En dokumentert fordel for emballasjen er ikke automatisk en fordel for hele produktet. Både ord og bilder må avgrense påstanden tydelig og gi et samlet inntryk… |
| `skills/Lov.json` | `lov-eu-avgrens-miljopastand` | `rule` | Bestått bare når miljøpåstandens omfang i tekst og bilder er begrenset til produktdelen eller aktiviteten som dokumentasjonen gjelder. Dokumentasjon bare om em… → Bestått bare når miljøpåstandens omfang i tekst og bilder er begrenset til produktdelen eller aktiviteten som dokumentasjonen gjelder. Dokumentasjon bare om em… |
| `skills/Lov.json` | `lov-eu-avgrens-miljopastand` | `sources` | EU — Unfair Commercial Practices Directive 2005/29/EC, konsolidert 27.09.2026 — Vedlegg I punkt 4b, innført ved direktiv (EU) 2024/825; konsolidert tekst 27.09.2026 → EU — Unfair Commercial Practices Directive 2005/29/EC, konsolidert 27.09.2026 — Vedlegg I punkt 4b, innført ved direktiv (EU) 2024/825; konsolidert tekst 27.09.2026; Forbrukertilsynet — Bærekraftpåstander — Punkt 3.2–3.4.3, trykt side 6–8 (PDF-side 4–5); punkt 3.4.3, trykt side 8 (PDF-side 5): skill hele p |
| `skills/Lov.json` | `lov-eu-ekte-tidsfrist` | `check` | kode+menneske → kode+kritiker+menneske |
| `skills/Lov.json` | `lov-eu-ekte-tidsfrist` | `example_bad` | Bare ti minutter igjen, med nedtelling som nullstilles ved hver sidevisning. → En kampanjeplan sier søndag uten skriftlig kundegrunnlag; samme tilbud fortsetter etter nedtellingen. |
| `skills/Lov.json` | `lov-eu-ekte-tidsfrist` | `example_good` | Tilbudet slutter fredag klokken 18, og kampanjen er satt til å stoppe da. → Kundens skriftlige sluttdato med tidssone og referanse samt pris- og tilbudshistorikk er lagret; ansvarlig har kontrollert oppsettet og reelt opphør før publis… |
| `skills/Lov.json` | `lov-eu-ekte-tidsfrist` | `principle` | Falsk knapphet kan presse frem et kjøp før kunden rekker å vurdere det. → En kort tilbudsfrist skal være reell og bygge på kildebelagte fakta som kontrolleres før publisering. Fume krever lagret sluttdato og kontrollgrunnlag; manglen… |
| `skills/Lov.json` | `lov-eu-ekte-tidsfrist` | `rule` | Når annonsen oppgir en kort tilbudsfrist: Bestått bare når fristen samsvarer med kampanjeplanen og en test viser at samme tidsbegrensede tilbud ikke starter på… → Når annonsen oppgir en tidsbegrensning, tilbudsfrist eller nedtelling: Fristen skal være et lagret faktum med kilde: kundens skriftlig vedtatte kampanjeslutt m… |
| `skills/Lov.json` | `lov-eu-ekte-tidsfrist` | `sources` | EU — Unfair Commercial Practices Directive 2005/29/EC, konsolidert 27.09.2026 — Vedlegg I punkt 7 → EU — Unfair Commercial Practices Directive 2005/29/EC, konsolidert 27.09.2026 — Vedlegg I punkt 7; Forbrukertilsynet — Salg og betingede tilbud (2025) — Side 4 punkt 2 (dokumentasjon når markedsføringen skjer); side 7–10 punkt 3.3–3.4; side 13 punkt 3.6 |
| `skills/Lov.json` | `lov-mat-generell-helsefordel` | `check` | menneske → kritiker+menneske |
| `skills/Lov.json` | `lov-mat-generell-helsefordel` | `example_bad` | Bra for helsen, uten noen ledsagende godkjent helsepåstand. → God for helsen uten ledsagende listeført påstand, begrunnet bare med at planten står på ventelisten. |
| `skills/Lov.json` | `lov-mat-generell-helsefordel` | `example_good` | Den generelle formuleringen fjernes fra annonsen når ingen relevant godkjent helsepåstand kan dokumenteres. → Den generelle fordelen ledsages av en relevant listeført påstand med oppfylte vilkår, eller den konkrete overgangsbruken er dokumentert etter artikkel 28 nr. 6… |
| `skills/Lov.json` | `lov-mat-generell-helsefordel` | `principle` | Et generelt løfte om helse trenger en tilhørende godkjent helsepåstand. → Generelle helsefordeler skal normalt ledsages av en relevant spesifikk påstand på listen etter artikkel 13 eller 14. Et mulig unntak krever konkret grunnlag i … |
| `skills/Lov.json` | `lov-mat-generell-helsefordel` | `rule` | For en generell, uspesifikk helsefordel: Bestått bare når den ledsages av en relevant spesifikk helsepåstand som finnes på listen etter artikkel 13 eller 14, m… → For en generell, uspesifikk helsefordel: Bestått når den ledsages av en relevant spesifikk påstand på listen etter artikkel 13 eller 14, med oppfylte bruksvilk… |
| `skills/Lov.json` | `lov-mat-generell-helsefordel` | `sources` | EU — Nutrition and Health Claims Regulation 1924/2006, konsolidert 13.12.2014 — Artikkel 10 nr. 3 → EU — Nutrition and Health Claims Regulation 1924/2006, konsolidert 13.12.2014 — Artikkel 10 nr. 3 sammenholdt med artikkel 13 og artikkel 28 nr. 5–6; for generelle botaniske helsef; EU-kommisjonen — EU register of health claims — About the EU register (kun informasjon); Claims not in the EU Register → Some function claims ... no; EU-kommisjonen — Article 13.1 claims for which evaluation is not finalised — PDF side 1–4; side 1: Claims on botanical substances for which finalisation is pending; arbeidsdokum; EU-domstolen — C-386/23 Novel Nutriology, 30.04.2025 — Avsnitt 55–60, 66, 72 og 83 samt domsslutningen; artikkel 28 nr. 5–6 og særskilt nr. 6 for psykiske/ |
| `skills/Lov.json` | `lov-mat-godkjent-helsepastand` | `check` | menneske → kritiker+menneske |
| `skills/Lov.json` | `lov-mat-godkjent-helsepastand` | `example_bad` | Påstår at en drikk styrker hukommelsen uten å kontrollere godkjent påstand. → Avviser en botanisk påstand bare fordi den mangler i EU-registeret, uten å undersøke dokumentert overgangsbruk. |
| `skills/Lov.json` | `lov-mat-godkjent-helsepastand` | `example_good` | Utkastet godkjennes først når fagansvarlig har koblet påstanden til gjeldende godkjenning og dokumentert produktvilkårene. → Kontrollarket viser den konkrete påstanden, oppfylte produktvilkår og enten godkjenningsrettsakten eller dokumentert anvendelig artikkel 28-overgang; uklare ti… |
| `skills/Lov.json` | `lov-mat-godkjent-helsepastand` | `principle` | Helsepåstander om mat krever godkjenning og oppfylte bruksvilkår. → Helsepåstander om mat krever normalt godkjenning og oppfylte bruksvilkår, men dokumentert overgangsbruk etter artikkel 28 kan være tillatt. Botaniske påstander… |
| `skills/Lov.json` | `lov-mat-godkjent-helsepastand` | `rule` | For en helsepåstand om mat: Bestått bare når kontrollarket lenker til den aktuelle godkjente påstanden i gjeldende liste, dokumenterer at ordlyden har samme be… → Bestått ved enten dokumentert godkjenning etter artikkel 10 nr. 1 med lenke til gjeldende rettsakt/listet påstand, samme betydning i ordlyden og oppfylte bruks… |
| `skills/Lov.json` | `lov-mat-godkjent-helsepastand` | `sources` | EU — Nutrition and Health Claims Regulation 1924/2006, konsolidert 13.12.2014 — Artikkel 10 nr. 1 → EU — Nutrition and Health Claims Regulation 1924/2006, konsolidert 13.12.2014 — Artikkel 10 nr. 1; artikkel 5–6; artikkel 13 nr. 1 bokstav a–c og nr. 3; artikkel 28, særlig nr. 5 o; EU-kommisjonen — EU register of health claims — About the EU register (kun informasjon); Claims not in the EU Register → Some function claims ... no; EU-kommisjonen — Article 13.1 claims for which evaluation is not finalised — PDF side 1–4; side 1: Claims on botanical substances for which finalisation is pending; arbeidsdokum; EU-domstolen — C-386/23 Novel Nutriology, 30.04.2025 — Avsnitt 55–60, 66, 72 og 83 samt domsslutningen; artikkel 28 nr. 5–6 og særskilt nr. 6 for psykiske/ |
| `skills/Lov.json` | `lov-mat-ikke-vekttapstall` | `rule` | Bestått bare når ingen helsepåstand i tekst, bilde, lyd eller kundeuttalelse angir mengde eller hastighet for vekttap. → Bestått bare når ingen helsepåstand i tekst, bilde, lyd eller kundeuttalelse angir mengde eller hastighet for vekttap. Overgangsreglene i artikkel 28 nr. 5–6 f… |
| `skills/Lov.json` | `lov-mat-ikke-vekttapstall` | `sources` | EU — Nutrition and Health Claims Regulation 1924/2006, konsolidert 13.12.2014 — Artikkel 12 bokstav b → EU — Nutrition and Health Claims Regulation 1924/2006, konsolidert 13.12.2014 — Artikkel 12 bokstav b; artikkel 28 nr. 5–6 sammenholdt med artikkel 13 (overgangsbruk opphever ikke  |
| `skills/Lov.json` | `lov-mat-sukkerfri-grense` | `rule` | Ved sukkerfri eller en formulering med samme betydning: Bestått bare når dokumentert sukkerinnhold er høyst 0,5 gram per 100 gram eller 100 milliliter av produ… → Ved sukkerfri eller en formulering med samme betydning: Bestått bare når dokumentert sukkerinnhold er høyst 0,5 gram per 100 gram eller 100 milliliter av produ… |
| `skills/Lov.json` | `lov-mat-sukkerfri-grense` | `sources` | EU — Nutrition and Health Claims Regulation 1924/2006, konsolidert 13.12.2014 — Vedlegget, SUGARS-FREE → EU — Nutrition and Health Claims Regulation 1924/2006, konsolidert 13.12.2014 — Vedlegget, SUGARS-FREE; artikkel 8 nr. 1; artikkel 28, særlig utløpt nr. 3 og helsepåstandsreglene i |
| `skills/Plattform.json` | `plattform-karusell-maks-ti-kort` | `principle` | En Meta-karusell kan vise opptil ti bilder eller videoer i én annonse. → Meta beskriver karusellannonser med to til ti bilder eller videoer i én annonse. |
| `skills/Plattform.json` | `plattform-karusell-maks-ti-kort` | `rule` | Bestått bare når karusellen inneholder mellom ett og ti kort. → Bestått bare når karusellannonsen inneholder mellom to og ti kort. |
| `skills/Plattform.json` | `plattform-karusell-maks-ti-kort` | `sources` | Meta — Ad creative — Formats → Carousel → Meta — Best practices for carousel ads — Innledningen om 2 eller flere bilder/videoer; Tell your story with all the available carousel compon |
| `skills/Plattform.json` | `plattform-karusell-maks-ti-kort` | `verified` | manglet → true |
| `skills/Plattform.json` | `plattform-meta-budskap-tre-sekunder` | `principle` | Seeren kan forlate en Meta-video før avslutningen. Hovedbudskapet må derfor komme tidlig. → Meta anbefaler merke og hovedbudskap i de første tre sekundene av Instagram-videoannonser. Fume bruker dette som obligatorisk husregel for Meta-video, ikke som… |
| `skills/Plattform.json` | `plattform-meta-budskap-tre-sekunder` | `rule` | Bestått bare når annonsens hovedbudskap kan identifiseres i bilde, tekst eller tale senest ved 00:03. → Fumes husregel: Bestått bare når annonsens hovedbudskap kan identifiseres i bilde, tekst eller tale senest ved 00:03; den obligatoriske porten og bruken på tve… |
| `skills/Plattform.json` | `plattform-meta-budskap-tre-sekunder` | `sources` | Meta — Ad creative — Formats → Video → Meta — Best practices for Instagram video ads — Creative best practices for Instagram video ads → Showcase your brand early; lest 2026-11-13 med Fir |
| `skills/Plattform.json` | `plattform-meta-budskap-tre-sekunder` | `verified` | manglet → true |

### Pensum: øvrige endringer

| Fil | Oppførings-ID (source; pensum har ikke eget id-felt) | Før → etter |
| --- | --- | --- |
| `sources/pensum.json` | Forbrukertilsynet — Bærekraftpåstander | `what_engine_takes`: PROPOSED: Avgrense og dokumentere miljø- og etikkpåstander. → PROPOSED: Avgrense miljøpåstander til riktig produktdel eller virksomhet, kontrollere helhetsinntrykk og dokumentasjon og gi nødvendig forklaring sammen med påstanden; punkt 3.2–3…; `url_status`: ok (curl GET 2026-11-13; HTTP 200; 214771 bytes) → ok (curl GET 2026-11-13; HTTP 200; 214771 bytes); lokal tekst med sidemarkører lest 2026-11-13: sources/fetched/Veiledning-om-bruk-av-bk-pastander_versj2.txt |
| `sources/pensum.json` | Forbrukertilsynet — Salg og betingede tilbud (2025) | `what_engine_takes`: PROPOSED: Kontrollere førpris og betingelser i salgsbudskap. → PROPOSED: Kontrollere reelle prisfordeler, tilbudshistorikk og betingelser etter side 4, 7–10, 13, 15–17 og 19; Fume krever i tillegg kildebelagt lagret sluttdato og kontroll før …; `url_status`: ok (curl GET 2026-11-13; HTTP 200; 1278638 bytes) → ok (curl GET 2026-11-13; HTTP 200; 1278638 bytes); lokal tekst med sidemarkører lest 2026-11-13: sources/fetched/veiledning-om-reglene-som-gjelder-ved-markedsforing-av-salg-og-bet… |
| `sources/pensum.json` | EU — Nutrition and Health Claims Regulation 1924/2006 | `what_engine_takes`: PROPOSED: Kontrollere hjemmel for ernærings- og helsepåstander om mat. → PROPOSED: Kontrollere helsepåstander og ernæringspåstander med artikkel 10, 12, 13 og 28, inkludert dokumentert fortsatt tillatt overgangsbruk og menneskelig avklaring ved tvil.; `url_status`: ok (curl GET 2026-11-13; HTTP 200; 450485 bytes) → ok (curl GET 2026-11-13; HTTP 200; 450485 bytes); konsolidert HTML med artikkel 28 lest via Firecrawl 2026-11-13 (HTTP 200); direkte web.open viste robotkontroll |
| `sources/pensum.json` | Meta — Best practices for Instagram video ads | manglet → ny oppføring med URL, gratis tilgang, uttak, tier, sjekkpunkter og `ok (2026-11-13; Firecrawl HTTP 200, cache fra 2026-11-12; curl GET locale=en_US HTTP 200, 617008 bytes; relevant råd lest i begge uttak)`. |
| `sources/pensum.json` | Meta — Best practices for carousel ads | manglet → ny oppføring med URL, gratis tilgang, uttak, tier, sjekkpunkter og `ok (2026-11-13; Firecrawl HTTP 200, cache fra 2026-11-12; curl GET locale=en_US HTTP 200, 593188 bytes; relevante kortgrenser lest i begge uttak)`. |
| `sources/pensum.json` | EU-kommisjonen — EU register of health claims | manglet → ny oppføring med URL, gratis tilgang, uttak, tier, sjekkpunkter og `ok (web.open 2026-11-13; innhold og lenke til ventelisten lest)`. |
| `sources/pensum.json` | EU-kommisjonen — Article 13.1 claims for which evaluation is not finalised | manglet → ny oppføring med URL, gratis tilgang, uttak, tier, sjekkpunkter og `ok (web.click fra registerside 2026-11-13; PDF åpnet og tekst lest)`. |
| `sources/pensum.json` | EU-domstolen — C-386/23 Novel Nutriology, 30.04.2025 | manglet → ny oppføring med URL, gratis tilgang, uttak, tier, sjekkpunkter og `ok (Firecrawl 2026-11-13; HTTP 200; direkte web.open viste robotkontroll, HTML lest via Firecrawl)`. |

## Validering

- Streng parsing av alle **24 JSON-filer**, inkludert avvisning av duplikate nøkler og ikke-endelige tall. Påkrevde felt, typer, enumverdier, ID-format, språk/status, datoer, sjekkpunkter og kildefelt er kontrollert. Nye metadata har riktig type for 220 av 220 ferdigheter; ingen opprinnelige felt eller ID-er er fjernet.
- **220 unike ferdigheter**, **192 `house_rule: true`**, **28 `false`**. Per emne: Strategi 36, Leseren 35, Idé 30, Copy 45, Plattform 35, Lov 39. Alle 15 «partly» og alle treff på de tre særskilt nevnte kildefamiliene er kontrollert for `true`.
- Alle `skills_used` og `conflicts_with` peker til eksisterende ferdigheter. **8 konfliktpar** er gjensidige, uten selvkonflikter eller duplikater. Ingen konfliktlenker måtte endres.
- **16 flyter**, **80 steg**, **96 gyldige indekspekere**. Kontrollert indeksdekning, avhengighets-ID-er, ett unikt navngitt utdataartefakt per steg, kjeding, valideringsobjekter og samsvar mellom indeks og flytfiler.
- **82 pensumoppføringer**, med unike URL-er og komplette felt. Alle ferdigheters og flyters kildepekere er knyttet til pensum, lokal brief eller eksplisitte underdokument-/navnealiaser. Eksisterende aliaser gjelder blant annet Digital.gov-underkapitler, Googles ABCD-side, D&ADs ThisAbles-case, Trotts navngitte blogginnlegg og konsoliderte versjoner av samme EU-rettsakt; de er ikke nye kilder eller ødelagte ferdighets-ID-er. De to nye norske referansestiene og alle øvrige lokale kildestier finnes.
- Valideringen gjelder struktur, referanseintegritet og de bestilte semantiske kontrollpunktene, ikke ny nettverifisering av alle gamle pensum-URL-er eller kjøring av en Engine. Ingen annonser er publisert og ingen runtime-håndheving er påstått.

Valideringskjøring: `python3 /tmp/validate-round2.py` (streng parser og integritetskontroller; fullført uten feil). Endringsloggen er laget ved sammenligning med kopien før runde 2. Egne kontrollskript og midlertidige kildeuttak ligger bare i `/tmp`; det er ikke lagret nye beskyttede fulltekster i prosjektet.

## Loggfiler

- `review/fixes-round2.md`, dokument uten ferdighets-ID: manglet → denne nye rapporten med alle endringer før → etter og verifisering.
- `NOTES.md`, loggpost «2026-11-13 — Runde 2»: manglet → appendert sammendrag av punkt (a–d), omfang, kildetilgang, telling og bestått validering.

## Etter terra-kontroll (review/check-round2.md)
- `skills/Copy.json` copy-kontroller-sitater: house_rule false -> true
- `skills/Copy.json` copy-mottakeren-vet-neste-steg: house_rule false -> true
- `skills/Plattform.json` plattform-google-sertifikat-person-og-dato: house_rule false -> true
- `skills/Plattform.json` plattform-google-partner-er-egen-status: house_rule false -> true
(Regelen krever mer enn kilden sier; source_says er uendret.)
