# LYSNE demo pictures, round 6 (15 Oct 2026)

Made with Higgsfield, model gpt_image_2_5 (0.25 credits each; 35 generations including retries, about 9 credits).
Photographer-style prompts (camera, lens, light, set). Resized to 800 px, JPEG q82. Mock data only: the people are AI people and are labelled as such in the app.

| File | Shows | Used for |
|---|---|---|
| oil-pack, balm-pack, mist-pack, candle-pack | Packshots on warm white: Night Body Oil 100 ml, Hand Balm 50 ml, Pillow Mist 50 ml, Evening Candle 180 g | Product images |
| oil-scene, balm-scene, mist-scene, candle-scene | Each product in its evening setting | Product images (in context) |
| oil-ref-back, oil-ref-side, oil-ref-top, oil-ref-label, oil-ref-hand | Reference angles of Night Body Oil on white (back, side, top, label detail, in hand for scale) | Product reference-shot slots |
| model-ane, model-leo, model-mia | AI people: portraits in warm evening light | Brand models |
| taste-bedroom, taste-stone, taste-hands | In LYSNE's taste | Taste training |
| taste-pink, taste-clinical | Deliberately outside LYSNE's taste (loud pink beauty ad; clinical lab) | Taste training |
| cam-medium, cam-35mm, cam-macro | Unbranded camera bodies and a macro lens on grey | Fume camera presets |

Night Body Oil pictures (oil-*) were made again so they match the Product Truth: tall matte burgundy screw cap, no dropper.
Product-kind pictures for the "What kind of product?" grid are in ../../kinds/ (Higgsfield recraft_v4_1, one per kind).

Known: oil-ref-back carries invented fine print (ingredients block); taste-clinical carries an invented brand name. Both are mock only.
| face-pack, wash-pack, kveld-pack, diffuser-pack, lip-pack, ritual-pack | More LYSNE products (face oil, body wash, Kveld eau de parfum, diffuser, lip balm, Evening Ritual gift set) | Catalogue, All products sheet |
| scrub-pack, scrub-detail, sleep-pack, linen-pack, holder-front, holder-top, holder-lit, mist100-pack | Round 7 (16 Oct, gpt_image_2_5): Body Scrub 200 ml and its texture, Sleep Balm 30 g tin, Linen Spray 150 ml, an unlabelled stoneware incense holder (front, top, lit on a shelf: the zip's unsure group), Pillow Mist in its new 100 ml | Import products demo (seed8.ts) |
| sweater-flat, sweater-back, sweater-detail, sweater-body | Round 7 (16 Oct, gpt_image_2_5): Merino Lounge Sweater in Ecru, flat front and back, the jersey-to-rib detail with the neck label, on a body (no face) | Product page, three levels of product data (seed6.ts) |

## models/ (round 13, 22 Oct 2026, Marcus's comment #41: "Alle tatt i hvitt studio med samme klær")
Made with Higgsfield, model gpt_image_2_5, text only (6 generations, about 1.5 credits): one full-body turnaround sheet and
one head sheet per AI model, cropped into angles. Fictional people, always shown labelled as AI models.
| models/<name>-front, -three-quarter, -profile, -back | ane, leo, mia: full body, white studio, off-white t-shirt, grey trousers | Model sheet |
| models/<name>-face, -face-three-quarter, -face-profile | ane, leo, mia: head and shoulders, same studio | Model sheet, main image |
