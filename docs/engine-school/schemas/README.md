# Feltregistre, lister og JSON Schema

Alt er **PROPOSED**. Filene `schemas/*.json` er fortsatt Fume-feltregistre:
felt-ID, punktbane (`[]` betyr hvert listeelement), definisjon, kilde, utfyller,
vilkår, påkrevdhet og lesere. `_index.json` beskriver importer og artefaktbindinger.

`lists/*.json` er lukkede ordlister med stabile, typede `id`-verdier og bokmålsfelt
`label_nb`/`definition`. Ordlisten dekker både konkrete verdier og bibliotekets
filterverdier; den enkelte kontrakten avgrenser hvilke som er lovlige. `alle`,
`begge` og kanalfamilier er derfor ikke automatisk lovlige i konkret kontekst.
Landlisten beholder de 249 ISO-kodene som allerede brukes i registrene, pluss
filterjoker. `country-group` skiller `EU`/`EEA` (EØS) fra land og fra CAP-regelområdet.
Tall og boolske ID-er beholder JSON-typen. Plattformverdier har URL, `read_on`,
`verified` og forklaring; `false` betyr at verdien ikke er nyverifisert eller er
en intern Fume-klasse. Påstandstyper er Fumes klassifisering av eksisterende tekst.

`json/*.schema.json` er faktiske **JSON Schema Draft 2020-12**. De validerer skill,
flow, pensumoppføring, feltregister, liste, begge indekser og alle registrerte
artefakter/domener. Enums genereres fra listene; `x-list` peker til ordlisten.
Artefakter har fellesfelt på toppnivå, direkte domeneimporter under
`grunnlag.domener.<register-id>` og familiefelt under `innhold`. Konvoluttfeltene
`forrige_artefakt` og `signatur` kommer fra flytenes eksisterende artefaktkontrakt.
Strukturelle objekter er lukket; registerfelter med åpent innhold beholder dette.
Vilkår som kan uttrykkes strukturelt blir `if`/`then`; vilkår uten tilgjengelig
ekstern domeneimport står i `x-runtime-conditions`. Faglig belegg, modellskille,
signaturmyndighet og menneskevedtak må fortsatt kontrolleres av flytens porter.

Kjør fra prosjektroten:

```sh
python3 -m venv .runs/venv
.runs/venv/bin/python -m pip install -r tools/requirements.txt
.runs/venv/bin/python tools/validate.py --report review/json-schema-validation.json
```

Validatoren bruker bare lokale skjemaer, sjekker alle definisjoner, listeverdier,
ID-er, referanser og genereringsdrift, kjører eksisterende registerkontroller og
avslutter med kode 1 ved feil. Et faktisk artefakt kan sjekkes med
`tools/validate.py --artifact sti/til/artefakt.json` via samme Python; det må ha
`schema_id`. Definisjoner og kundeartefakter telles separat.

Etter tilsiktede endringer i feltregistre eller kategorier: oppdater generatorens
semantiske mapping i `tools/formal.py`, kjør `tools/build_formal.py`, og valider.
`tools/build_formal.py --check` kontrollerer uten å skrive. Ikke rett genererte
skjemaer for å få ugyldige data til å passere. `tools/normalize_values.py` er den
idempotente migreringen med full før/etter-logg. Alle uttrekk ligger i
`review/json-schema-inventory.json`; aliaser og endringer ligger i
`review/json-schema-value-mapping.json`. `tools/check_formal.py` kjører syntetiske
artefakter, feilinjeksjoner og kontroll av original registerbygging i isolert kopi.

## Oppfølging av uavhengig kontroll, runde 3

`channel.json` inneholder bare konkrete kanaler. `channel-filter.json` er en egen
predikatordliste med konkrete kanaler, familiene `google-ads`/`sosiale-medier` og
`alle`; den brukes bare av filterkontrakten. Familier kan overlappe og innebærer
ikke at én leveranse har flere konkrete distribusjonsruter. Andre lister kan også
være flerverdisett: EU og EØS er overlappende medlemsgrupper, ikke eksklusive land.
Det hevdes ikke at alle lister er gjensidig utelukkende.

`kanal-format.format` beholdes som stabil velger for eksisterende filtre. Den
krever tre separate attributter under `binding`: `creative_medium`, `ad_product`
og `delivery_behavior`. `format_contract` i registeret definerer prioriteten og
hver tillatt mapping; JSON Schema håndhever dette også i importerte domener.
Navngitt produkt velges før generisk medium. `yt-bumper` krever video,
produktet `yt-bumper` og ikke-hoppbar atferd; `yt-non-skippable` krever sitt eget
produkt og samme atferd. Generisk `video` bruker produktet `generisk` og kan ha
forskjellig leveringsatferd. Dette er ikke en plattformmatrise: uspesifiserte
medium-/atferdskombinasjoner må fortsatt belegges i faktisk konto, mål og marked.

`yt-playables` er en dokumentert underflate av YouTube in-stream i mobilappen,
ikke påstått selvstendig plasseringsvalg. TikToks For You-underflater har fortsatt
`parent`, `selection_kind: underflate` og `selectable: ikke-selvstendig`. Metas
Friends-fane beholdes som inkludert flate under Facebook Feed.

`tools/check_round3.py` kontrollerer leverte filer uavhengig av generatoren:
metadata, vilkårsoperatorer/-operander, strukturerte eksempler, formatmappinger,
underflater, feltverdier, predikater og skjema-enums. Validatoren kjører også denne
kontrollen. Rapporten skiller fritekst og åpne records fra lukkede verdier;
`flows/_index.json/scope` er beskrivende prosa, ikke feltets kategoriske omfang.
`tools/check_formal.py` har positive og negative artefakttester for formataksene.
