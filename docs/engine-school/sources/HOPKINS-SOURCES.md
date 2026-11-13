# Hopkins public-domain texts

Downloaded and extracted on 2026-11-13. Only the original works are retained as plain UTF-8 text. These are historical readings, not approved Fume rules.

## Scientific Advertising (1923)

- Local file: `scientific-advertising.txt`.
- Download: https://www.scientificadvertising.com/ScientificAdvertising.pdf — curl GET initially returned HTTP 502; subsequent GET returned HTTP 200, 634845 bytes.
- Discovery/provenance: University of Pennsylvania, The Online Books Page: https://onlinebooks.library.upenn.edu/webbin/book/lookupid?key=olbp36428 (successfully fetched by curl; a later web-tool open timed out).
- Edition: Carl Galletti's transcription labelled “The Original Text”. Extracted only PDF pages 2–114: all 21 chapters through “The End”. Omitted the modern cover, running publisher headers, and the modern promotional appendix on pages 115–116. The downloaded PDF was removed after extraction; it is not part of the deliverable.
- Local SHA-256: `fdad6e126e03e030b16a65e9843c233bc59e3de727667af3876f6d7885c8c1b5`.
- Also verified an accessible OCR alternative: https://archive.org/download/scientific-advertising/Scientific%20Advertising_djvu.txt (HTTP 200, 131820 bytes). This is an October 2026 upload rather than an original-edition library scan; it was not used for the local text.
- Territorium, vurdert 2026-11-13 (PROPOSED): bare Hopkins' opprinnelige engelske verk fra 1923 vurderes som falt i det fri i USA fra 2019 og i Norge fra 2003. Den lokale filen er Gallettis transkripsjon av originalteksten, ikke en dokumentert faksimile av en bestemt trykksats fra 1923; ingen moderne tillegg, oversettelser eller selvstendige redaksjonelle bidrag inngår i vurderingen. Andre territorier og andre utgaver er ikke klarert. Provenienssiden hos University of Pennsylvania ble hentet på nytt med Python GET 2026-11-13: HTTP 200, 4216 bytes; web.open tidsavbrøt.

## My Life in Advertising (1927)

- Local file: `my-life-in-advertising.txt`.
- Catalogue/scan: https://archive.org/details/mylifeinadverti00unkngoog — HTTP 200.
- Direct plain text: https://archive.org/download/mylifeinadverti00unkngoog/mylifeinadverti00unkngoog_djvu.txt — curl GET HTTP 200, 301654 bytes before trimming. Archive download-server redirects may vary.
- Metadata: https://archive.org/metadata/mylifeinadverti00unkngoog — fetched with curl. Harper & Brothers; University of California scan, digitized by Google; `date: 1927`, `possible-copyright-status: NOT_IN_COPYRIGHT`, LCCN 27024090. Metadata also contains an inconsistent `year: 1917`; the OCR likewise misreads the copyright year. Catalogue evidence identifies the work as 1927: https://www.loc.gov/item/27024090/ (search indexed; web open returned 403).
- Retained the original volume's title matter, contents, preface, and all 19 chapters through its OCR “Thb Entd” ending (printed page 206). Excluded the modern Google wrapper, trailing publisher advertisements, and library circulation slips. Original “Digitized by Google” attribution remains in the transcription.
- Local SHA-256: `cbff0ef5bd66ea69b8133150269deac7fa85d1db0a357d87f9d3d34b3dce97af`.
- Territorium, vurdert 2026-11-13 (PROPOSED): den opprinnelige engelske Harper & Brothers-utgaven fra 1927 vurderes som falt i det fri i USA fra 2023 og i Norge fra 2003. Vurderingen omfatter den beholdte originalteksten fra University of California/Google-skanningen, ikke moderne omslag, tillegg eller oversettelser. Andre territorier og andre utgaver er ikke klarert. Archive-metadata ble hentet på nytt med Python GET 2026-11-13: HTTP 200, 6572 bytes; bekrefter forlag, skanneopphav, `date: 1927`, forfatterens dødsår 1932 og `possible-copyright-status: NOT_IN_COPYRIGHT`, men har fortsatt motstridende `year: 1917`. Avviket er beholdt i dokumentasjonen; tilgjengelighet alene brukes ikke som rettighetsbevis.

Hopkins died in 1932; these original 1923/1927 works are public domain in the US and in Norway under the ordinary life-plus-70 term. No modern annotations or other authors' books were included. OCR and transcription errors remain; verify important wording and page references against the scan. Historical medical claims and testing assumptions require independent modern scrutiny.

## Grunnlag for territorievurderingen, 2026-11-13 (PROPOSED)

For USA er beregningen basert på maksimal vernetid på 95 år fra utgivelsesåret for disse eldre utgavene, med utløp ved årsslutt, ikke på den nyere hovedregelen for verk skapt etter 1977. Lest i [U.S. Copyright Office, Circular 15A](https://www.copyright.gov/circs/circ15a.pdf), side 2, «Works Already Under Statutory Protection before 1978», og side 3, «Year-End Expiration of Copyright Terms».

For Norge er beregningen 1932 + 70 år, regnet fra utløpet av dødsåret. [Åndsverkloven § 11](https://lovdata.no/dokument/NL/lov/2018-06-15-40) ble hentet med Python GET 2026-11-13: HTTP 200, 387045 bytes; bestemmelsen ble lest. Web.open returnerte 405; [WIPO Lex sin gjengivelse av 2018-loven](https://www.wipo.int/wipolex/en/text/504068), § 11, var også lesbar og ble brukt som kontroll, ikke som en påstand om oppdatert konsolidering. Dødsåret fremgår av de nyhentede Archive-metadataene ovenfor. Disse beregningene er vår vurdering av originalverkene i de to navngitte territoriene, ikke en verdensomspennende klarering av alle digitale utgaver.

Begge lokale tekstfiler ble SHA-256-kontrollert på nytt 2026-11-13 og samsvarer med hashene ovenfor; fulltekstene er uendret. LOC-katalogsiden returnerte fortsatt web.open 403. Ingen nye beskyttede fulltekster er lagret.
