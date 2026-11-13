# Skjemaer — runde 3B

Definisjonene er **PROPOSED**. De beskriver registre og lagringskontrakter; de installerer ingen databaseendring eller kjørende Engine.

Kjør fra prosjektet, uten ekstra Python-pakker:

```sh
python3 scripts/build_schemas.py
python3 scripts/validate_schemas.py
```

`build_schemas.py` bygger områderegistre, ett register per eksakt artefaktsti og indeks. Den binder flytenes inngang/utgang, steg og valgfrie ruter til skjemafiler, og normaliserer skills gjennom den versjonsbevarte mappingen i `review/schema-value-mapping.json`. Den kan kjøres igjen uten å miste originaletikettene. Gjør varige registerendringer i byggeren; JSON-filene er lesbare, genererte leveranser. Endringer i skills utover `applies_when` er ikke en del av denne migreringen.

`country_codes.json` er et datert, faktuelt kodesnapshot: 248 ISO alpha-2-verdier fra UN M49 pluss TW kontrollert mot portugisiske skattemyndigheters ISO-tabell. Kilder og metode står i filen. Landlisten er separat fra juridiske regelområder; EU og CAP skal ikke lagres som land. Oppdater snapshotet og kontroller kildene før en senere standardoppdatering.

`validate_schemas.py` kontrollerer streng JSON, obligatorisk feltmetadata, typer, lukkede verdier, kildehenvisninger, feltreferanser, importgraf, alle `read_by`-ID-er, alle artefakt- og rutebindinger, indekssamsvar, stegkrav, JSON-pekere, mappingens bevaring av øvrig skill-innhold og hver verdi i `applies_when`. Den tester også faktisk filteratferd og et fiktivt menneskegodkjent smaksavvik. Resultatet skrives til stdout uten å endre filer. Bruk `--report <sti>` for å lagre en JSON-rapport eksplisitt. TXT/PDF-kildearkiver er valgfrie; registrerte kilde-URL-er, locatorer og sikre arkivbaner kontrolleres fortsatt.

`schema_filter.py` evaluerer ett predikat mot én konkret kombinasjon. Bruk `filter_values` fra kampanjekortets kombinasjonsrad som `context`; kildebelegg og forklaringer ligger utenfor dette objektet. Kanal-/formatfamilier er eksplisitte, land gir aldri automatisk juridisk område, og manglende nødvendige fakta gir `uavklart`. Evaluer ulike annonser separat, og bind ferdighetsutvalget til kombinasjons-ID. Lov, etikk og menneskeporter gjelder uavhengig av et filtertreff.

Feltregistrene bruker punktbaner, `[]` for listeelementer og `imports` for felleskontrakt/domener. De er ikke filer i standardformatet JSON Schema. Valideringen dokumenterer referanse- og definisjonsintegritet; reelle artefakter trenger i tillegg flytenes lagrede strukturkontroll, innholdskritikk, kildeverifisering og menneskevedtak. Plattformlister er datert kunnskap, og konkret tilgjengelighet og spesifikasjoner må bekreftes i faktisk oppsett før bruk.

## Retting etter kontrollrunde 3

Byggeren leser også `review/funnel-fixes-round3.json`: opprinnelige predikater bevares i migreringsloggen, og tilsiktede utvidelser har egne før-/etterverdier og begrunnelser. Film er format; skjema er komponent/utløser. `kanal-format.channel_contract` fastsetter eksklusive distribusjonsruter og forrang. `google-ads` og `sosiale-medier` er bare filterfamilier. Demand Gen krever konkret plassering for å skille YouTube fra Gmail, Discover og Display. Betalt YouTube matcher Google Ads; egen YouTube-distribusjon gjør ikke det, og ukjent medieklasse avklares før et Google Ads-predikat avgjøres.

`field_reads` i hver flyt navngir konkrete domenefelt og formålet med lesingen. `read_by` beregnes fra disse kontraktene og særskilte skill-forbrukere; en import alene etablerer ingen feltlesning. Første steg har en port for dette. Dette er erklært forbruk, ikke målinger fra en kjørende Engine.

`effective_override(example, registry, now, verifier=None)` avviser uten en ekstern betrodd verifier. Verifier får kanoniske signerte byte, signatur, godkjenner, merke-ID og brukstid, og må kontrollere menneskeidentitet, signatur, tilbakekalling og myndighet for merket mot en betrodd tjeneste. Artefaktets egne rollenavn eller nøkler er ikke autoritet. Før-/etterhash beregnes fra eksakte felt, merke, verdi og versjon; ettergrunnlaget inkluderer kampanje/del. Hele vedtaket, også begrunnelse, begge verdiwrappere, tidspunkt og omfang, signeres. JSON-kanonisering er eksplisitt i registeret. Det leverte fiktive eksemplet er foreslått og usignert; validatoren godkjenner og signerer bare en isolert testkopi med en lokal testnøkkel. Ingen reell signaturtjeneste eller menneskegodkjenning er installert.

Kjør også negative kontroller:

```sh
python3 scripts/check_round3_negative.py
```

Åtte tilsiktede feil prøves i en midlertidig kopi uten å endre leveransen. Resultatet skrives til stdout; bruk `--report <sti>` for å lagre det eksplisitt. Signatur- og myndighetsmanipulasjoner inngår i hovedvalidatoren.
