# Fume app: architecture v2 and the whole customer flow

Status: PROPOSED (14 Oct 2026). Drafted by Claude for Marcus after his round 2 notes (14 Oct, 15:41 and 15:45 UTC).
It extends `ARCHITECTURE.md` (v1). Where the two differ, this one wins once Marcus approves it. Nothing is coded from
it until the flow is approved: Marcus, 14 Oct: "hele kundeflyten i UI/UX må være løst før koding begynner å skje".

Sources: Marcus's notes; Register v0.4; Product Definition v0.1 (APPROVED); Roadmap 2026 v1 (APPROVED); Offer v0.1
(APPROVED); Verbal Identity v0.1 (APPROVED); Imagery & Engine Prompt System v0.2 (APPROVED); Product Vision v0.1
(draft); the Brand Founder Review notes of 9 Oct (OpenPencil in the pipeline); OpenPencil's source (v0.16.0, MIT).

---

## 0. What changes from v1

| # | Marcus asked | v2 answer | Rests on |
|---|---|---|---|
| 1 | Talking to the Engine is separate from customer service | Two places: **Fume** (the chat where work is asked for and followed; the Engine never talks, it only works) and **Contact** (people: your contact and your expert) | F-D040 holds (Marcus 14 Oct 15:51: "man snakker ikke med en motor") |
| 2 | The sidebar is separate and not as long as the page | The frame is the window; only the page scrolls in its own sheet | Done on the branch, not pushed yet |
| 3 | Brand DNA is a designed board with every colour, type and so on, with tabs | Brand DNA opens on a **board**; tabs Board, Colour, Type, Logo, Imagery, Voice, Taste, Rules, Memory | Gate 2 (Brand DNA's four parts) |
| 4 | The customer has a product catalogue | **Products** gets its own nav item: catalogue with categories and collections | Roadmap §5.2 Product Truth |
| 5 | Campaign → products → categorise (SS27) → that collection becomes a delivery | **Collection** is a catalogue entity; a campaign takes products or whole collections; a delivery is made per collection or for the whole campaign | New scope (no Drive source); Roadmap v1 says one product family first |
| 6 | Brand and campaigns can have moodboards | **Board** entity on OpenPencil: one brand moodboard, one per campaign, plus free idea boards | Roadmap §5.2 Taste Map (references with reasons) |
| 7 | Designer Studio like Higgsfield / Photoshop | **Studio**: mode (Free or a Creative Type), product, cast, scene, format; canvas, branches, repair; staff only | Product Definition §8; Vision §4.7 |
| 8 | Workspace is a switcher at the top of the designer's sidebar | Staff sidebar starts with a switcher: **All brands** (team load, deliveries, queue) or one brand (that brand's studio workspace) | Roadmap §5.5 admin queue |
| 9 | OpenPencil's source for the graphic design part | OpenPencil's core (scene graph, renderer, layout, tools, lint) behind a Fume adapter, React shell of our own | 9 Oct review: "open pen ... open source Figma for AI agents" |
| 10 | Brand onboarding animation; Engine proposal vs customer-approved | Onboarding ends in **Building your Brand DNA**: what the Engine found lands on the board as proposals; the customer approves each part | Vision §4.2 comprehension check; motion "Soft to sharp" |

Lines that do not change: every creative is checked before the customer sees it (F-D025); the expert checks, only the
customer approves (F-D077); the customer never picks a model, reads a prompt or repairs a render (Vision §4.1); no AI
UGC, AI people never pose as real people and are labelled (F-D041, Imagery v0.2); "creative", never "file".

---

## 1. Who talks to whom

### 1.1 Fume (where work is asked for; "Snakk med Fume, Engine gjør jobben")
- Nav item **Fume**. One conversation per campaign and a general one to start new work.
- Fume speaks as "we" (Verbal Identity): forms the brief one question at a time, shows the brief card, presents
  directions, takes change requests in words ("make the cap matte"), answers status ("where are the masters?").
- **The Engine never talks.** It shows only where it works: run cards with its icon (F-D068), shimmer on the
  progress line (F-D075), and as the actor in a sentence ("The Engine is making 6 masters"). No agent persona,
  no "Fume Agent" (F-D040).
- What the Engine makes is a **proposal** until the customer approves it.
- **Fume is AI, and says so.** A quiet line at the top of every Fume conversation ("Fume is AI. The people on your
  team are in Contact.") and a way to a person from every message. Required by AI Act art. 50 and the ethics line
  (AI never poses as a person, F-D041); exact wording to counsel.
- **Contact is people.** Marcus, 15 Oct: talking to Fume is talking to AI; talking to the expert or designer is
  talking to a person.
- No model, prompt or seed is ever shown. It is not open image generation (Product Definition §7): every request
  lands inside a campaign and its scope.

### 1.2 Contact (people: customer service)
- Nav item **Contact**, kept apart from Fume so two things never carry the name Fume. One thread with the
  customer's named contact and their expert (Roadmap §5.1: "Named human contact and visible help path").
- For: the package, invoices, rights, a creative the customer is unhappy with, anything off-script.
- Each person shows with name, title and photo (F-D040). The expert's checks link here.
- Fume can hand over ("Anna will answer this in Contact") and people can hand back.

### 1.3 Who speaks on screen (Verbal Identity)
| Actor | Where | Mark |
|---|---|---|
| You (the customer) | Fume, Contact, review | avatar |
| Fume (we) | The conversation, system sentences, emails, the clock | Fume mark |
| The Engine | Run cards, proposals, never a chat message | Engine icon; shimmer while working |
| The expert (Anna, Designer) | Checks, Contact | photo; "Checked by Anna" |

---

## 2. Proposal and approval: one rule across the app

Everything that shapes the work has an origin and a state. The UI shows both on every item (Vision §4.2).

| State | Means | Looks like |
|---|---|---|
| `proposed` | The Engine found or made it (scrape, upload, learning) | Engine mark, dashed outline, "Engine proposal"; Keep · Change · Remove |
| `supplied` | The customer gave it themselves | the customer's avatar, "You added this" |
| `approved` | The customer approved it | solid, "Maja approved · 14 Oct" |
| `changed` | The customer corrected a proposal | solid, "Maja changed this", the old value in the record |
| `unknown` | The Engine is not sure | a question in "What Fume needs": "Is the cap matte or gloss?" |

Applies to: Brand DNA items (colour, type, logo, imagery, voice, rules), product facts, collections, moodboard
items, brief lines. Amber stays for checked creatives only (F-D069); an approved Brand DNA item is not Amber.
A Brand DNA version is approved as a whole once every proposal in it is kept, changed or removed.

---

## 3. Domain additions (entities)

### 3.1 Catalogue
| Entity | Key fields |
|---|---|
| `Product` (v1, extended) | id, name, categoryId, collectionIds[], variants[], images (canonical, angles), facts (Product Truth), origin, state |
| `Variant` | id, productId, name (e.g. "50 ml", "Rose"), sku, images, facts that differ from the product |
| `Category` | id, name, parentId (a tree: Skin care › Serums) |
| `Collection` | id, name ("SS27"), kind (season, launch, line, custom), startsAt, endsAt, productIds[], cover, origin, state |

A product has one category and any number of collections. Import: from the scrape (proposals), CSV, Shopify later,
manual. The Roadmap defers broad catalogue import, so v1 shows import as "Engine proposals from your website" plus
manual and CSV.

### 3.2 Campaign and delivery
| Entity | Change |
|---|---|
| `Campaign` | + `scope`: products[] and/or collections[] (a collection adds all its products, and new ones join it); + `boardId` (its moodboard) |
| `Delivery` | + `scope`: `campaign` or `collection`; + `collectionId?`; groups: by collection › product › direction › master › variant › format |

The flow Marcus named:
```
Create campaign ─► add products (or a whole collection, e.g. SS27) ─► moodboard ─► brief ─► directions
  ─► masters ─► variants and formats ─► approved ─► Make delivery: whole campaign | one collection (SS27)
```
- A campaign can hold several collections; each can become its own delivery when all its creatives are approved
  ("SS27 is ready to deliver; AW27 still has 4 in review").
- A collection can also be delivered across campaigns from the collection's page ("Everything approved for SS27").
- Delivery naming (no scheme in Drive yet, PROPOSED): `brand_collection_campaign_product_direction_format_v#`.
- Package caps (18, 27, 54) count creatives in a campaign, never per collection.

### 3.3 Boards (on OpenPencil)
| Entity | Key fields |
|---|---|
| `Board` | id, workspaceId, kind (`brand_moodboard`, `campaign_moodboard`, `ideas`, `layout`), campaignId?, documentRef (OpenPencil graph + design JSX), updatedAt |
| `BoardItem` (index for search and Taste Map) | id, boardId, kind (image, note, section, link, creative, layout), verdict? (liked, disliked), note, origin, state |

- The brand moodboard feeds the Taste Map: a liked or disliked image with its reason is a `Reference` (v1 entity).
- A campaign moodboard starts from the brand moodboard's liked items plus the Engine's proposals for this brief.
- A `layout` board holds designed pages (a banner, an email header, a social carousel) built only from the
  customer's components and tokens (§6).

### 3.4 Studio (staff)
| Entity | Key fields |
|---|---|
| `CreativeType` | id, name (Packshot, Product in scene, Lifestyle with a person, Portrait and beauty, Detail, Flat lay, Layout), required inputs, prompt structure (Imagery v0.2: brand world · concept · casting · light · camera · composition · product truth), formats, extra check items |
| `CastMember` | id, name, look, sheet images, `isAiPerson` (always labelled on use), consent or likeness record for real people, allowed uses (never UGC, never as a customer or reviewer, F-D041) |
| `Scene` | id, name, brand world from Brand DNA, light, references |
| `StudioSession` | id, workspaceId, campaignId?, slot (which planned creative it fills), recipe, branches[] |
| `Recipe` | mode (`free` or a CreativeType), productId, variantId, angle, castIds[], sceneId, references[], format, count, route (provider, model), prompt, seed |
| `Generation` | id, sessionId, branchId, recipe snapshot, image, evaluation (product truth, brand rules, artefacts), cost, state (candidate, picked, discarded) |

A picked generation becomes a `CreativeVersion` in `making`, then goes to the Quality Gate as in v1. Lineage stays
internal (Roadmap §8.2).

---

## 4. Navigation

### 4.1 Customer
| Nav | Route | Answers |
|---|---|---|
| Home | `/` | What waits for you, what is being made, what Fume needs, what was approved, what Fume learned |
| Fume | `/fume/:threadId?` | Ask for work, follow it, change it |
| Campaigns | `/campaigns`, `/campaigns/:id/:tab` | Tabs: Overview, Moodboard, Brief, Directions, Creatives, Delivery, Record |
| Review | `/review` | Every decision waiting for you |
| Deliveries | `/deliveries/:id?` | By campaign or by collection |
| **Products** | `/products`, `/products/:id`, `/products/collections/:id` | The catalogue: categories, collections, Product Truth |
| **Brand DNA** | `/brand/:tab?` | The board and its tabs |
| **Contact** | `/contact` | Your contact and your expert (people) |
| Settings (footer) | `/settings/:page` | Workspace, people, package, notifications, profile |

Products moves out of Brand DNA because it grows with the catalogue; Brand DNA links to it.

### 4.2 Fume staff (the switcher replaces the "Workspaces" list)
Top of the sidebar: a switcher showing **All brands** or the chosen brand's mark and name.

**All brands** (`/studio`):
| Nav | For |
|---|---|
| Overview | Today across the brands (DECIDED 20 Oct 2026: the same page as an agency's, §24.3): the greeting and one summary sentence; the brands as picture cards (where it stands, the current campaign and how far it is, the next delivery); what needs you (plans and creatives to check); the Engine's runs; deliveries due; the team this week |
| Queue | Every creative waiting for a check, by due date and risk |
| Campaigns | All campaigns, their stage and clock |
| Deliveries | Deliveries due and sent, by brand |
| Team load | Load per person (four Core-equivalents each, Offer §11) |
| Quality log | What was caught |

**One brand, e.g. LYSNE** (`/studio/b/:workspaceId/...`):
| Nav | For |
|---|---|
| Brand home | What the Engine made since you last looked, what waits for a check, the clock |
| Studio | Make and tweak (§5) |
| Engine output | Every run and its candidates for this brand, best first; open any in Studio |
| Queue | This brand's checks |
| Campaigns | This brand's campaigns and their slots |
| Boards | Brand moodboard, campaign moodboards, idea boards, layouts |
| Brand DNA · Products | The customer's view with staff tools (see lineage, add a rule as a proposal) |
| Customer view | Opens the customer's workspace as they see it, marked "Fume view" |

---

## 5. Studio (architecture first, Marcus: "jobbes nøye på og planlegges før det designes")

### 5.1 What it is for
The designer takes what the Engine made and gets it right, or makes a slot from scratch, without leaving Fume. It
borrows from Higgsfield (recipe and presets on the left, results in a grid) and Photoshop (canvas, regions,
layers), and never becomes the customer's product (Product Definition: no customer node canvas).

### 5.2 Layout (desktop first; Studio is a desk tool, phone shows read-only)
```
┌ brand switcher ┐┌──────────────── top bar: campaign › slot · format · Send to check ───────────────┐
│ sidebar        ││ RECIPE (left, 320)      │ CANVAS (centre)                    │ INSPECTOR (right, 320) │
│ (folds to rail ││ Mode: Free | Type ▾     │ the picked generation, large       │ Evaluation: product    │
│  in Studio)    ││ Product › variant › angle│ compare A/B, zoom, region select  │ truth, rules, artefacts│
│                ││ Cast (AI person ▾)       │ layout layer (OpenPencil): text,  │ Lineage: route, model, │
│                ││ Scene · light            │ logo, legal line from components   │ prompt, seed (staff)   │
│                ││ References (moodboard)   │                                    │ Cost                   │
│                ││ Format · count           │                                    │ Notes from the expert  │
│                ││ [Make]                   │                                    │                        │
│                │└──────────── BRANCHES: filmstrip of generations, grouped by branch ─────────────────┘
```

### 5.3 Modes
- **Free**: a written direction plus product and references; the Engine still applies the Brand DNA and Product Truth.
- **Creative Type**: a preset that fixes the recipe's shape and asks only for what it needs.
  - Packshot: product, variant, angle, background from Brand DNA; no cast.
  - Product in scene: product, scene, light.
  - Lifestyle with a person: product, cast member, scene; "AI person" label on the creative.
  - Portrait and beauty: cast member, product in use.
  - Detail: product, area (cap, texture, label).
  - Layout: a creative plus a layout board (§6): headline, logo, offer, legal line.
- The types map to the image families in Imagery v0.2 (S1–S4, H-B, H-D) so the prompt structure is the approved one.

### 5.4 Actions on a generation
Make more like this · Change one input and branch · Repair a region (select, say what is wrong in words, the Engine
repairs: 9 Oct "easy to just tell the engine what was wrong") · Reframe to another format · Upscale · Upload a
replacement (manual fallback, Roadmap §7.1) · Pick for the slot · Send to check.

### 5.5 Rules the Studio enforces
- A product is always the verified Product Truth; a variant can only be picked if its facts are approved.
- A cast member can only be used inside their allowed uses; the AI-person label is added, never optional.
- A designer cannot check their own creative (PROPOSED; Q4).
- Every generation keeps its lineage; nothing is overwritten (Roadmap §5.4).

---

## 6. OpenPencil in Fume

What it is: an MIT-licensed, Figma-like editor (v0.16.0, very active, breaking changes each release). Core in plain
TypeScript (scene graph, CanvasKit/Skia renderer, Yoga layout, 126 agent tools, a lint engine, DTCG tokens); the app
and its embeddable SDK are **Vue**, ours is React.

Proposed use (default picked; Q3 if Marcus wants otherwise):
- Take the framework-free packages (`scene-graph`, `core`, `design-jsx`) pinned to an exact version behind one Fume
  adapter. Leave out `.fig` import (reverse-engineered Figma format).
- Build the canvas and panels in React with our design system (porting OpenPencil's ~5k lines of Vue canvas wiring).
- The customer's design system goes in as tokens (DTCG → variables) and components (a Fume library generated from
  `@fume/ui`), so a layout can only use their tokens and components.
- The Engine writes design JSX limited to frames, text and instances of library components, then runs a **Fume lint
  preset** built from our gate rules (no hard-coded colour, spacing on the scale, contrast, touch size, words rules).
- Boards (moodboards and idea boards) are pages in the same document: images, notes, sections, links.
- The MIT notice ships with the app.

---

## 7. The whole customer flow

Each step names the screen, what the customer sees, what they do, and the states the screen must have. All screens
have: empty, loading, working (Engine), waiting on you, error, done.

### Step 1. Invitation and sign-in
- Screen: sign in (Google or email link). Invited people land in the workspace; the first person of a new customer
  lands in Welcome.
- States: link expired, wrong account, no access ("Ask Maja to invite you").

### Step 2. Welcome: how Fume should learn your brand
- Screen: Welcome to Fume, LYSNE. Three ways in, any mix:
  - **Your website** (address): the Engine reads it.
  - **Upload**: guidelines, logos, fonts, earlier campaigns, packshots.
  - **Start from nothing**: answer questions.
- Then: invite one colleague now or later; name the approver.

### Step 3. Building your Brand DNA (the onboarding animation)
The moment the customer sees Fume understand them. Motion "Soft to sharp" (tokens 160/240/480 ms, brand 2.4 s,
blur 12 → 0, the breathing loop while the Engine works; Register board 16).

From a website:
1. The site's pages appear as soft, blurred cards in a row; a focus frame moves over each one ("Reading lysne.no/about").
2. What the Engine finds lifts out of the page and settles into the empty Brand DNA board: the logo, then colour
   swatches one by one (hex under each), type specimens, imagery, products, a line of voice.
3. Each item lands blurred and sharpens as the Engine grows sure of it. Unsure items stay soft and get a "?".

From an upload:
1. The customer's files drop in as cards; each opens and the same lift-out happens ("Reading LYSNE guidelines.pdf,
   page 4").
2. Items the customer gave land as `supplied` (solid, "You added this"); items the Engine read from them land as
   `proposed`.

Both end on the board with a summary line: "The Engine found 6 colours, 2 typefaces, your logo, 14 products and 22
images. 5 things need you." Buttons: Go through them · Later.
- Reduced motion: no movement; items appear in place with a short fade.
- Errors: site blocks reading ("We could not read lysne.no. Upload your guidelines instead."); nothing usable found.

### Step 4. Go through what the Engine found
- One part at a time (Logo, Colour, Type, Imagery, Voice, Products): proposals with Keep · Change · Remove.
- Questions it could not answer, one at a time, with why it asks ("Is the cap matte or gloss? It decides how light
  falls on it.").
- Conflicts shown plainly ("Your guidelines say #1F3A2E; your website uses #22402F. Which is right?").
- Each part done turns solid: "Maja approved".

### Step 5. Products
- The catalogue the Engine proposed: grid of products, each with images and its Product Truth.
- The customer verifies facts per product (proposal → approved), adds what is missing, sorts products into
  categories, and makes collections (SS27). Also: add a product by hand or CSV.
- A product cannot be used in a campaign until its facts are approved (Vision: verify before production).

### Step 6. Taste and moodboard
- The brand moodboard, prefilled with liked images from the site and uploads (proposals).
- Taste pairs: "Which is more LYSNE?", with a reason (the swipe in Creative Brief v0.3 is the model).
- The customer can add images, notes and links; each liked or disliked image with a reason becomes taste.

### Step 7. What Fume understood (the comprehension check)
- Fume's summary of the brand in a few lines, conflicts left, and three deliberately different test directions.
- The customer picks, rejects with a reason; the Engine updates.
- **Approve Brand DNA v1.** Onboarding ends. Brand DNA opens as the board from now on.

### Step 8. Start a campaign
- From Campaigns (New campaign) or from Fume ("I need the SS27 launch").
- Pick products or a whole collection; the Engine proposes a name, channels, formats and a date from the package.
- The campaign moodboard opens with the brand's liked items and the Engine's proposals for this campaign; the
  customer keeps, removes and adds.

### Step 9. The brief (Fume)
- Fume asks one question at a time, says why, and shows what is still missing.
- The brief card: objective, audience, message, mandatory, never, channels, formats, products or collections,
  creatives, date. The approver approves it or changes a line. The clock starts (`scoped`).

### Step 10. Directions
- Run card while the Engine works; the expert checks; the customer gets three directions, each with the idea, hook,
  why it fits, risks, what it will make.
- Pick one with a reason, or tell Fume why none fits (a direction round).

### Step 11. Masters
- Run card; checked masters arrive ("Checked by Anna · 14:26").
- Review one at a time: Approve, or Request changes with pins and tags. Fume says whether it uses a round or is
  Fume's own correction.

### Step 12. Variants and formats
- Only after masters are approved. Review in bulk ("Approve 9"), grouped by collection and product.

### Step 13. Delivery
- When a collection's creatives are all approved: "SS27 is ready to deliver." Make delivery: whole campaign or one
  collection.
- The delivery page: grouped by collection › product › direction › format; download all or by format; rights note;
  confirm when it is live.

### Step 14. What Fume learned
- After delivery: what was approved, changed and caught, as Creative Memory.
- The Engine proposes Brand DNA updates from it ("You chose warm light three times. Make it a rule?"), which the
  customer approves into Brand DNA v2.

### Always available
- **Contact**: talk to a person at any step.
- **Notifications**: checked, ready for you, waiting on you, delivered.
- **Review**: every waiting decision in one place.
- **Share**: a creative or a delivery with a colleague, by role.

---

## 8. Open questions (asked one at a time, in this order)
1. ~~Q1, Engine and F-D040~~ ANSWERED 14 Oct: F-D040 holds. Customers talk to Fume; the Engine only works.
2. **Q2, collections in v1.** The Roadmap's v1 is one product family; collections and categories are new scope.
   Build them in the UX now (proposed) and switch them on after the pilot?
3. **Q3, OpenPencil.** It is Vue; the app is React. Default: use its core and build our own React canvas. Alternative:
   a Vue island inside React (faster, two frameworks).
4. **Q4, designer checks own work.** Can the designer who made a creative in Studio also check it?
5. **Q5, cast.** Who owns the cast of AI people: Fume (shared across brands) or each brand?

---

# Round 3 (Marcus 15 Oct 12:57 UTC): Studio, QA, review, one chat

Status: PROPOSED (15 Oct 2026). Where this differs from §0–§8, this wins. Marcus's words in quotes.

## 9. Studio, strictly like Photoshop

### 9.1 Three studios, one frame
Studio has three modes at the top: **Render** (images), **Design** (layouts on the customer's components, OpenPencil
later) and **Video** (a draft since 27 Oct 2026: the edit, the player and the timeline, see §27).

```
┌ top bar: brand › campaign › creative · Render | Design | Video · version · Send to check ───────────────┐
│ LEFT (specs, 280)        │ CANVAS (board)                                │ RIGHT (variables, 320)      │
│ Mode picker (grid menu)  │ the creative on a board: zoom, pan, compare,  │ the chosen mode's variables │
│ Format · count           │ region select, layers on top (Design)         │ sliders, light angle dial,   │
│ Image model              │                                               │ camera (lens, height, tilt), │
│ References: library,     │                                               │ palette swatches, toggles    │
│   upload, reference maker│ ┌ Engine bar ───────────────────────────────┐ │ grouped in folding sections  │
│ Product picker · data    │ │ "Make her hair longer"  → variables change │ │ Product data (this render /  │
│ Model picker             │ └────────────────────────────────────────────┘ │   overwrite the product)     │
├──────────────────────────┴───────────────────────────────────────────────┴─────────────────────────────┤
│ VERSIONS: every render of this creative, newest right; edits inside a version are undo/redo (⌘Z ⌘⇧Z)   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
- The page never scrolls, and neither do the side panels: sections fold (one open at a time where space runs out),
  like Photoshop panels. Desk tool: desktop first; a phone shows the canvas read-only.
- The **Engine bar** under the canvas takes words ("Make her hair longer"). The Engine answers with a **variable
  change** shown before it renders (Hair length 40 → 65), the designer keeps or undoes it, then it renders a new
  version. The Engine never talks in the bar; it shows what it changed ("The Engine changed hair length to 65").

### 9.2 The project file: one creative document per creative (like a PSD)
Decision (PROPOSED): every creative has one **CreativeDocument**: its mode, its variables (a JSON object the mode's
schema defines), its specs, its references, its layers (Design), and its **versions**.
- A **render** makes a new **version** (an image) from the document's state at that moment. Versions sit in the strip
  at the bottom, newest right; any version can be opened, compared or branched from. Nothing is ever overwritten
  (Roadmap §5.4).
- **Edits** to variables, specs and layers between renders are **undo/redo** (⌘Z, ⌘⇧Z), not versions.
- The version the designer picks is what goes to the Quality Gate as the creative's version.
So: both, each for its own thing. Versions for renders, undo for edits.

### 9.3 Modes are schemas; the Studio has a small control library
A **mode** is a JSON schema the Engine turns into a prompt: its variables, their types, defaults, ranges and the
control that edits each. An agent that makes a new mode writes only the schema and picks controls from the library.

Control library (packages/ui `studio-controls`, PROPOSED): `slider` (with unit), `segmented`, `select`, `swatch`
(the brand's chosen colours first), `toggle`, `angle` (a light direction dial: azimuth and height), `lens` (focal
length, camera height, tilt), `chips` (multi-pick), `text`, `product` (picker), `model` (picker), `reference`
(picker from the library), `number`.

Modes at launch (Render):
| Mode | Variables (right panel) |
|---|---|
| Free | direction text, mood, light (angle, softness, warmth), camera |
| Packshot | background (brand swatches: e.g. a fashion brand's chosen white), shadow, angle, light, crop |
| Product in scene | scene, surface, props, light, camera |
| Model (make an AI person) | gender presentation, age, skin tone, hair (colour, length, texture), eyes, build, expression, styling; output: a model sheet |
| Lifestyle with a model | model, pose, action, scene, light, camera |
| Reference maker | what to make ("a lamp"), style, material, light; output: a reference in the library |
| 3D object (later) | object, material, CAD upload, turntable angle; output: a reference |

### 9.4 Brand presets
The brand's chosen colours, background colours and light (from Brand DNA) appear first in every swatch and preset:
a packshot's background defaults to the brand's chosen background white.

### 9.5 Product data inside the Studio
The product's Product Truth sits in the left panel. Two kinds of change:
- **For this render**: an override stored on the document, marked "Changed for this creative" and shown to the expert
  in the check.
- **Overwrite the product**: becomes a **proposal** to the customer (only the customer approves Product Truth), and
  is marked "Anna proposed this" until Maja approves it.

### 9.6 Models (AI people) and references are brand assets with a state
| Asset | States | Who |
|---|---|---|
| Model | `draft` (designer) → `saved` (in the brand's models, Fume) → `approved` (customer) or `declined` | designer saves; only the customer approves |
| Reference | `draft` → `saved` (in the brand's reference library) | designer |
Every asset, override and variable change records who did it and when: "Anna overrode the cap colour for this
creative", "Model Ane: saved by Anna, approved by Maja". Always labelled AI person (F-D041).

### 9.7 Batches
Large sets ("50 packshots") are not made in Studio. They are made on the staff campaign page: **Make a batch**: mode,
products (or a collection), count per product, format; the Engine runs it; results land in QA.

## 10. Check (staff): where the Engine's work is checked
Round 12: the page is named **Check** in both frames and is one fixed-height workspace (§25.2). A page of its own for Fume's people (replaces Queue): everything the Engine made that waits for a designer, by
due date and risk. For each creative:
- **Mark checked** (the expert checks; F-D077 words), or
- **Tell the Engine** what is wrong in words; it fixes it and the fix comes back to QA, or
- **Open in Studio**.
- Design creatives (layouts): change words and swap elements **directly in QA**, or open in Studio.
Keyboard: C checked, F feedback, S Studio, arrows next.

## 11. Review (customer): like frame.io
- **Full screen viewer** for every creative: click anywhere to drop a pin and write a comment, or write a plain
  comment; a rating (1–5); Approve or Request changes; versions side by side; arrows for the next.
- **Swipe mode**: one creative at a time, full screen. Yes (approve), No (with a reason), Comment; swipe right/left
  on a phone, keys on a desktop. Ends with a summary to send.
- The app covers what Fume's customers use frame.io, Asana and Slack for: review, tasks and conversation in one place.

## 12. One Fume chat, and a brief without chat
- **One conversation** with Fume. No list of chats: Fume remembers everything, campaigns appear as cards inside it.
- **Write a brief yourself**: a plain form (Campaigns › New › Write the brief) for customers who prefer not to chat.
  It lands as a brief to approve, the same as one made with Fume.

## 13. Campaigns, calmer
Campaign page: one header with the stage strip (Brief · Directions · Masters · Variants · Delivery) and the one thing
waiting; tabs only for **Creatives**, **Moodboard**, **Brief**, **Delivery**; directions live inside Creatives; the
record is a side panel.

## 14. Taste keeps learning
Brand DNA › Taste is never done: **Train taste** is an endless swipe of pairs and single images (this is LYSNE / not
LYSNE / why), with how sure the Engine now is per area (light, colour, people, composition).

---

# Round 4 (Marcus 15 Oct 14:27 UTC): formats, product fixing, light, Engine chat, admin, calendar

Status: PROPOSED (15 Oct 2026). Marcus agreed (14:28): designers talk to the Engine; customers only talk to Fume.
Principle: **simple by default, advanced on request, the Engine decides when nobody else does.**

## 15. Format is the placement; ratio follows
- A **format** is a placement: Instagram Feed, Instagram Story, Reels cover, Meta ad, Pinterest pin, email header,
  product page, web banner. Each carries a ratio, safe zones and text limits. `Format` (feed/story/square) stays as the
  short form; placements map onto it.
- The format picker picks placements; the ratio follows. The Engine renders natively at that ratio when the image
  model supports it, otherwise at the nearest ratio and crops. A custom ratio stays possible. Design can always crop.

## 16. Make formats (format iteration)
From a picked master, **Make formats** shows every target placement as a tile. Per tile the Engine chooses
**crop** (the subject fits the safe zone) or **expand** (generative fill), and says which. The designer switches
method per tile and moves the crop. Lives in the Studio (a strip over the versions) and in batches.

## 17. Product fix: detail tokens and an automatic pass
- Every product gets **detail tokens** in its Product Truth: real cut-outs of the real product (the "100 ml", the
  label, the cap, the logo), each with its region on the product image. The customer sees them as "Details we
  protect" and approves them like any Product Truth.
- **Automatic pass**: on every render the Engine masks the product, compares it with the tokens, and fixes what is
  wrong (it reads "200 ml" where the token says "100 ml") before the creative reaches QA. The fix is a version of its own:
  "The Engine fixed 100 ml".
- **By hand**: on any render, tap a detail the Engine has masked (or brush your own mask) → **Fix with the real
  product**. The Engine gets the crop of the real detail, regenerates only that region and places it back. Before
  and after side by side. Available in the Studio (any mode) and in QA.

## 18. Light and camera: Brand · Fume · Own · Engine
- Every section that sets a look offers the same four sources: **Brand** (the brand's own, e.g. "LYSNE evening light"),
  **Fume preset**, **Own** (write it or set it), **Engine decides**.
- **Light, simple**: as now (preset, direction dial, softness, warmth).
  **Light, advanced**: a square over the canvas where you drag light sources and see them on the creative as you drag;
  add several lights (key, fill, rim) with their own warmth and strength; a three.js 3D preview of the lights around
  a stand-in of the product.
- **Camera**: the brand's named camera specs ("LYSNE close, 85 mm, low") and Fume's camera presets with a picture of
  the camera ("Hasselblad X2D · 90 mm"), or own lens values.

## 19. The Engine chat (designers)
- Fume's people talk to the Engine the way customers talk to Fume. **One Engine chat per brand** (staff nav "Engine"),
  with the brand as context. "Take LYSNE's latest catalogue" → a widget to tick the products → the Engine asks what it
  needs (mode, formats, count) → runs → results in QA, with **Open in Studio** for more control.
- The Engine bar in the Studio is the same Engine with the document as context.
- The rule "the Engine never talks" now reads: **the Engine never talks to customers.**

## 20. Roles: admin
**Fume admin** is a role in the same app: All brands with deliveries, usage and cost, team load and the quality log.
No Studio, QA or Engine chat in an admin's nav.

## 21. Customers: Fume answers, people when needed, meetings, calendar
- **Contact leaves the sidebar.** Fume answers everything it can. When it can't, it hands over **in the same chat**:
  "Sander at Fume will answer you here" (a person's message is marked with their name). Fume's team for the brand is
  shown in Settings.
- **Book a meeting**: in the chat (Fume offers times) and in the person menu. Lands in the calendar.
- **Content calendar** (nav "Calendar"): campaign windows, collection drops, deliveries and approved creatives
  placed on days and channels. Drag approved creatives onto a day and placement. v1 plans only; publishing to Meta and
  Instagram comes later.

# Round 10 (Marcus 20 Oct 08:12 UTC): the plan before the Engine makes anything, one chat, the Smoke glass

Marcus: "Brief ser tynn ut, hvor er hele brief teksten, alle variabler, retning? ... hvor er planen som blir lagd før
Engine genererer? Kunden må jo godkjenne det før Engine begynner å generere." Chat: one conversation (his card, 20 Oct).
Glass: every floating layer is the Smoke again (round 9's solid fill undone). PROPOSED 20 Oct 2026 unless marked.

## 22. The plan

### 22.1 The cycle, with the plan in it
Brief (hers) → **Plan** (Fume's, checked by the expert, approved by her) → Masters → Variants and formats → Delivery.
- **The brief is her order.** Short: what, for whom, the message, where, when, how many, must show, never. She writes
  it in the chat with Fume or on the form and **sends** it to Fume ("Send to Fume"). Nothing is generated yet.
- **Fume writes the plan** from the brief, the Brand DNA, the taste, the moodboard and Creative Memory; the expert
  checks it ("Checked by Anna"); then it waits on her.
- **She approves the plan.** Only then does the Engine start, on the masters. Approve acts at once with Undo (as on
  creatives), so a slip costs nothing.
- **Directions are part of the plan, as words and reference pictures**, never generated pictures (the vocabulary:
  "distinct concepts with their reasoning, shown before production"). The plan carries Fume's recommended direction in
  full and up to two more it considered; she can take another with one click, and the plan's look and creatives follow
  it. The reason for her choice is kept.
- The generated "three directions" step is gone from new campaigns. Campaigns that already ran keep their chosen
  direction; their plan is shown from their brief and that direction (approved).

### 22.2 What the plan holds (one document, in this order)
1. **The brief, in words.** Fume's paragraph: what the campaign does, for whom, the one thing to remember, where and
   from when. Her own brief lines fold under it ("Your brief, sent 13 Oct").
2. **The direction.** Name, the idea (two or three sentences), the hook, why it fits (each reason names its source:
   your Brand DNA, your taste, your moodboard, an approved campaign), and 4 to 6 reference pictures with where each
   comes from. Under it, "Two more directions Fume considered": name, one line, two pictures, "Use this direction".
3. **The variables.** What the Engine holds to on every creative, one line each with its source and Change:
   - The look: light, camera, set, props, colour, people (no people, hands only, an AI person by name).
   - The content: products, formats, text on the creative (the headline lines, in the market's language), call to
     action, logo, language.
4. **What the Engine makes.** Every creative, before it exists: the masters first (name, format, product, the scene in
   one line, its text, people), then the variants and formats that follow once she approves the masters. The total
   matches the brief's number.
5. **Rules it keeps.** Must show and never from her brief, and the Brand DNA rules that apply (by name, linked).
6. **When.** Plan approved → masters (checked) → variants and formats → delivery → goes live, each with its date, and
   how many change requests the package includes.
The foot, pinned: "Ask for changes" (secondary) and "Approve the plan" (the one Ink). A line changes in place
("Changed by you"); anything larger goes to Fume with "Ask for changes", and Fume answers with the next version and
what it changed, at the top of the plan.

### 22.3 States and words
| State | Who acts | The status sentence |
|---|---|---|
| writing | Fume | Fume is writing the plan · by Thu 15 Oct |
| in_check | the expert | The plan is in check · by Fri 16 Oct |
| ready | her | The plan is ready to approve |
| changes_asked | Fume | Fume is changing the plan |
| approved | the Engine | The Engine is making 3 masters · by Thu 22 Oct |
The campaign's stage dots: Brief · Plan · Masters · Variants · Delivery. Home, the bell, the chat and ⌘K say "The plan
for Winter gifting is ready" and open the plan. The campaign page's tabs: Creatives · Moodboard · **Plan** · Delivery
(the Plan tab replaces Brief; before the plan exists it shows the brief and "Fume writes the plan once you send it").
Staff: the expert opens the same plan, may change any line, and marks it checked, which sends it to the customer.

## 23. One Fume chat (Marcus's card, 20 Oct: "Én samtale", DECIDED)
One conversation with Fume, as §12 said: no list of conversations. Campaigns appear in it as cards (a brief being
written, a plan ready, creatives to approve); each message about a campaign carries the campaign's name. On a desk the
brief being written fills in a panel on the right ("The brief", "Send to Fume" at its foot); once it is sent the panel
shows the plan being written, then the plan's summary with "Open the plan".

---

# Round 11 (Marcus 20 Oct 10:48 UTC): the agency role

Marcus: "Ny incoming rolle i appen (ikke høyest prioritert, men må bli med)", with his document "Fume for Agencies"
(20 Oct: agencies that run several client brands rent the platform; agency licence with a fixed fee, usage-based
production, early access scoped to one workflow). "Ta høyde for at UX mockupen der ikke er perfekt, f eks lå kunder i
side panelet isteden for client picker greia. Kanskje det er riktig for agencies, vet ikke." Product Vision v0.1
Mode 4 (private or agency workspace: a parent organisation with many brand workspaces) is the model. PROPOSED 20 Oct
2026 unless marked; the desktop customer app stays the priority.

## 24. Agencies

### 24.1 Who
- **An agency** is an Organisation of kind `agency`. Each **client brand** is a Workspace under it with its own Brand
  DNA, products, taste, campaigns and Fume conversation. Nothing crosses between clients (F-D018): Fume never uses one
  client's brand, products or decisions in another client's plan or chat.
- **Agency people** have one agency role across all its clients:
  - **Agency lead**: everything a creative does, plus clients (add, archive), the agency team, licence and usage.
  - **Creative** (designer, art director, producer): briefs and plans, the Studio and the Engine chat, checks; sends
    work to the client.
- **Client people** are the customer roles of §2 inside their own brand (owner, approver, member, viewer), invited by
  the agency. A client without an account reviews through a **client link**.
- Fume's own experts are not in an agency's work: the agency checks its own creatives. Fume answers the agency in the
  Fume chat and hands over to a named person at Fume inside it (§21).

### 24.2 Who decides what (the words, F-D077 kept)
| Step | Who | Words |
|---|---|---|
| The brief | the agency | "Send to Fume" |
| The plan (§22, §26.8) | Fume writes it; the agency changes lines, **checks** it and sends it; the client **approves** it, in Fume or through the client link (DECIDED by Marcus 23 Oct 2026; was: the agency approves) | "Send to Maja", "Approve the plan" |
| Each creative | the agency's creative **checks** it | "Checked by Nora", Amber on checked creatives as today |
| Each creative | the client **approves** it, in Fume or through the client link | "Maja approved", "Waiting on Maja" |
| An approval given outside Fume | the agency records it, with a note | "Maja approved · recorded by Nora" |
The agency never approves a creative itself: approving is the client's word. No Fume expert check sits in between.

### 24.3 Places
One sidebar with two scopes: **the agency** (every client) and **one client**.

Agency (routes under `/agency`):
| Place | Answers |
|---|---|
| Overview | The same page as Fume's studio Overview (§4.2; DECIDED by Marcus 20 Oct 2026: "Agency dashboard blir strengt tatt lik som vår, vi skal ha performance og alt sånt vi også"), with the agency's clients: the client brands as cards, what needs you (plans, checks, a client's answer), the Engine's runs, deliveries due, the team this week; what Fume's Overview gains later (performance), the agency's gains too |
| Clients | Every client brand: its campaigns, the next delivery, who it waits on, its people; **Add a client** (right panel: brand name, website, the client's people to invite; Fume starts the Brand DNA from the website) |
| Campaigns | Every campaign across clients, one table with a client column; the calendar |
| Check | Every creative waiting for the agency's check, across clients (the QA queue) |
| Team | The agency's people, their load this week and their role; invite |
| Settings | The agency, its people, **Licence and usage** (the fixed fee and production used per client this month) |

One client, e.g. LYSNE (the customer's own routes, as the agency sees them):
| Place | Answers |
|---|---|
| Home | What waits on the agency in this client (the plan to approve, a brief to send, products to confirm, creatives to check) and what waits on the client ("6 creatives with Maja") |
| Fume | This client's Fume conversation (one per client; Fume knows this brand only) |
| Campaigns | This client's campaigns, the plan, the creatives and **Send to client**; the delivery and the client link |
| Brand | Brand DNA, Products, Taste |
| Studio | The Studio and the Engine chat (§9, §19) |
| Check | This client's checks |

### 24.4 Choosing the client (DECIDED by Marcus 20 Oct 2026 12:41Z: the picker)
- **A client picker at the top of the sidebar, built exactly like Fume's own studio (§4.2)**: the Fume mark and "All
  clients" (with the number of clients), or the client's mark and name (with its market). Its menu lists All clients,
  then the clients (recent first, a search from 8 up), each with a dot when something waits on the agency. ⌘K also goes
  to a client. The places under it follow the scope.
- Marcus: "Ser ikke hvorfor det skulle vært designet annerledes enn sånn vi har for våre kunder. Agency dashboard blir
  strengt tatt lik som vår, vi skal ha performance og alt sånt vi også." So the agency's frame and dashboard are the same
  as Fume's own studio: what Fume's team gets (performance and the rest), an agency gets too. The client list in the
  sidebar (B, tried in the preview 20 Oct) is dropped.

### 24.5 Send to client, the client link and the client's view
- **Send to client** (a campaign's creatives, once checked): choose the creatives and the client people; they get
  "LYSNE: 8 creatives from Brygga Studio to approve". The panel also gives a **client link** for people without an
  account: it opens only those creatives, with Approve and Ask for changes, and expires after 30 days.
- A client's change request comes back to the agency's creative as a check item, with the client's words and pins.
- **Record an approval** given outside Fume: who approved, when and how (a note); it shows as "Maja approved · recorded
  by Nora".
- **The client's own view** is the customer app of §4.1 for their brand, with "Brygga Studio makes this brand's
  creatives with Fume" in the account menu. The agency decides whether the client also talks to Fume (off by default):
  without it the client's Fume place is gone and their comments go to the agency.

### 24.6 Licence and usage
The agency licence is a fixed platform fee; production is usage-based (creatives made, per client, this month); early
access is scoped to an agreed first workflow (Marcus's document). The app shows usage, never prices in the demo copy.

### 24.7 Built now, later
- In the app: Brand DNA, the Fume chat with its memory, the Engine with Product Truth, the Studio's canvas, models and
  references, boards, the calendar, review, delivery.
- Later rounds, not in the agency's places until built: the AI video editor, social publishing, the performance
  dashboard, Figma, the Claude and ChatGPT connectors, the Slack app.

### 24.8 The demo
Sign in as **Nora Vik, creative lead at Brygga Studio** (person menu, "Nora, agency lead (demo)"; `?as=nora`). In the
agency demo LYSNE is Brygga Studio's client: Maja and Jonas are its client people, and the checks are the agency's.
AURÉA, HALM and VEV are example clients at the agency level (cards, the client list, campaigns); only LYSNE has the full
example data, so their own places say so in the preview.

## 25. Round 12 (20 Oct 2026): one frame, one Check, sending

Fixes from the desktop UX check of the studio, the agency, the plan and the client (83 findings, 26 Must;
/mnt/project-files/app/ux-walkthrough-2026-10-20/oppsummering.md).

### 25.1 One frame for Fume's studio and an agency (follows Marcus's 20 Oct 12:41Z decision; names PROPOSED)
- One sidebar, one top bar (56 px, a back arrow that says where it goes, ⌘K) and one place list per scope:
  - All brands or all clients: Overview · Check · Campaigns · Deliveries · (Clients for an agency) · Team · Usage ·
    Quality log. Vera (admin) has no Check.
  - One brand or client: Home · Check · Campaigns · Brand (Models and references, Boards under it) · Studio · Engine
    (Engine output under it) · Fume for an agency · Customer view for Fume's people.
- Addresses name the brand or client: Fume's people `/studio/b/:workspaceId/…`, an agency `/agency/b/:workspaceId/…`.
  The address switches the session; an older or Fume address redirects to the right one; a client person who opens an
  agency address lands on her own page.
- Words: "Check" (was QA), "Home" (was Brand home), "Team" (was Team load), "All checks" (was Queue).

### 25.2 Check (PROPOSED)
- One workspace for Fume and the agency: the list | the creative fitted to the screen | a panel with the decision
  pinned. Keys on the pills (C checked, F Tell the Engine, S Studio, ← →). Every check has a toast with Undo, the list
  keeps its order, the next waiting creative opens, and the end of the queue says what comes next.
- `/studio/check/:id` and the queue redirect into it. A creative back from the Studio shows its new version.
- The expert's plan check: ⌘↵ marks it checked, held for 10 s with Undo.
- A batch made outside a plan lands in Check as "Product page".

### 25.3 Sending (OPEN with Marcus; working default)
Checked creatives reach the customer only when sent: Fume's "Send to Maja" (the old Release, ARCHITECTURE §5.2) and
the agency's "Send to Maja". Words: "N to send", "Checked, not sent", "With Maja". The customer and the client count
and see only what was sent. Marcus's card (20 Oct) asks whether they should rather reach the customer at once.

### 25.4 One status, one name
- `copy.campaignStatus(c, waits, { viewer })` gives one status sentence per reader (customer, staff, agency, client).
- `copy.creativeName` gives one name per creative everywhere ("Night Body Oil · Feed 3").
- One campaigns table and one Team table serve both frames.

### 25.5 The agency's client link
When an agency person opens a client link it is a read-only preview ("Preview of what Maja sees. Nothing you do here
counts."); the mock refuses an answer from her. Record an approval is a visible pill, and one Usage page serves Vera
and the agency.

## 26. Round 13 (22 Oct 2026): Marcus's 71 video comments

Marcus watched the full video walkthrough of v17 (67 min, 12 chapters) and pinned 71 comments to times and places; the
robots that recorded it wrote 65 notes. All of it was fixed in one round by six builders. Plan and answers:
/mnt/project-files/app/runde-13/plan.md. Everything here is PROPOSED unless it says DECIDED.

DECIDED by Marcus in this round:
- Campaign stages, his own order (#36, "Brief->Moodboard->Plan->Masters/Concept->Creatives->Delivery. Eller hva tenker du?";
  Claude agreed): Brief, Moodboard, Plan, Masters, Creatives, Delivery, from app/src/features/campaigns/stages.ts.
- Plans can be made without a designer (#25, "Planer skal kunne lages uten designer også"): the expert's check of a plan
  is optional. Creatives are still always checked.
- Review: one place to write (card 22 Oct 15:42Z, "Ett felt"). Comments go at once; a creative is marked Needs changes;
  "Start the changes" sends the set as one change request.
- Agencies (#70): like Fume's own studio, with their own role type: no Fume manpower by default, Fume decides their
  features; no API costs (#71).

Proposed by Claude where Marcus asked "hva tenker du": Render becomes Image (#58), so the desk reads Image · Design ·
Video and video renders inside Video; Check's tabs are Plans · Images · Designs (#53). A UI-only state green, Moss
#2F6B45 on #E6EFE2, for "Ready to download" (#39), like Rouge for errors.

### 26.1 The customer's Fume chat and Home (builder A)

- **Focus ring:** shows only while she moves with Tab. A pointer turns it off. Esc, Enter, arrows and typing never turn
  it on.
- **Selection:** neutral Focus 200 under Ink on the page, a light veil on Smoke glass. Amber means only "checked by
  an expert".
- **Bell:** unread rows have a veil, a dot and full-strength text. Read rows are plain.
- **Meeting:** a topic is required: six presets, and "Something else" asks for a few words.
- **Questions:**
  - Fume's suggestions show their own words.
  - When the brand's site said nothing, Fume says so in one line and offers templates for this kind of product, one
    claim per line, to keep only what is true.
- **Chat thumbs:** 64 px at their own ratio, at most 4 in a message, then +N (8 in the panel).
- **Product question:**
  - Collections come first: ticking one ticks its products.
  - Her answer is not echoed back. Fume's card shows the chosen product(s).
- **Panel (desk from 1280 px):**
  - Shows the brief, the plan, or what a link names.
  - Hide/show sits in the chat head and is remembered on the device. With the panel hidden, the chat is a centred
    column.
  - The panel head has "Open full page" and ✕.
  - A full page opened from the chat has "← Back to the conversation". Smaller screens go straight to the full page,
    with the same pill.
- **@ in the composer:** names a campaign, product, collection or creative. Fume answers in that campaign's thread
  with where it is, the numbers, what is next, and a link card.
- **Empty composer:** offers three asks: where is <campaign>, what waits on me, this month in numbers.
- **"Make a … campaign for …":** in the chat starts a new campaign brief.
- **Plan in the chat:**
  - `/fume?plan=<id>` sends what she writes to that plan.
  - Each change she asks for makes a new version: a line on what changed plus the plan card. Nothing is made before
    she approves.
  - Recognised: creatives, videos, carousels, dates. Anything else goes to the expert as a change request.
- **Product check lead:** names every campaign that waits on the product, newest first, the one she came from first.
- **Home:**
  - "N products to confirm" uses the same count as the check page.
  - "Fume learned N things" uses the same count as All lessons.


### 26.2 The campaign: stages, brief, plan, moodboard, calendar (builder B)

- **Campaign stages.** A campaign page has six tabs, always in this order: Brief, Moodboard, Plan, Masters, Creatives, Delivery (stages.ts). It opens on the current stage. Done stages carry a check; later stages are quiet but open. /campaigns/:id/<tab>: old /directions and /variants redirect to /masters and /creatives.
- **Brief tab.** The brief she sent, editable until the plan is approved. Sending it again writes a new plan version.
- **Moodboard (optional).** Fume proposes one from the brief and the Brand DNA (her references, the products, the pictures she liked). She adds to it and starts it, or presses "Skip the moodboard" (Campaign.moodboardSkipped). On the tab the board has a fixed height. "Open full screen" covers the whole app, with the toolbar pinned, and Esc closes it.
- **Plan without a designer.** Fume writes the plan and it is hers at once. She has three choices:
  - "Approve and start" (the primary action);
  - "Change it with Fume", which opens the chat with the plan in its panel;
  - "Ask Anna to check" (optional, quiet), which goes to the existing check and then back to her. Plan.checkAsked records who asked.
  
  Each new version lists what changed (CampaignPlan.versions: version, by, asked, changes). The History shows it.
- **Own look.** The plan's look holds for every creative. One creative can have its own light, light direction and camera, shown as an "Own look" line and changed in place (PlannedCreative.look).
- **Go-live days.** The plan's When shows a calendar strip of the days the creatives go live, and each creative's day. Whoever may change the plan can edit the days with a date picker (PlannedCreative.liveAt). "Open the content calendar" goes to /campaigns?show=calendar, which is also the studio's address for one brand.
- **Expert's mark.** A check by an expert is always the Focus pointer in Amber, with its words ("Checked by Anna", "Checked by you"). It never uses an avatar or Amber without the mark.
- **Brief form.**
  - "Start from" offers Fume's templates and hers, which Fume makes from her finished campaigns. Picking one fills the form.
  - "Alternatives" sits under Goal (the whole brief) and under Message. Each gives three options, with Warmer, Shorter, Bolder or her own words for new ones, and "Use this".
  - Inspiration (optional) holds board pictures, uploads and links. The pictures start the moodboard; the links go to Fume.
- **Calendar channels.** Instagram, Facebook, Meta ads, TikTok, Pinterest, and Email and web. Each channel has its own placements. A channel that isn't connected says so and offers "Connect".


### 26.3 Review and delivery (builder C)

**Review: one place to write, one way to send.** PROPOSED 22 Oct 2026.

- A comment, with or without a pin, posts at once. Her team and the expert see it.
- For each creative she answers Approve (A) or Needs changes (N).
  - Needs changes marks the creative. Its open comments are its change list, and the panel offers one more comment.
  - With no comment yet, the composer asks what should change, and her comment marks it.
  - "The product itself is off" is a tick on a marked creative. It costs no change request; it is Fume's (or the agency's) mistake.
  - Pressing N again takes the mark back.
- "Start the changes (N)" sends every marked creative as one change request: one of the package, with the last-one and none-left dialogs, then Undo.
- When every creative in the set has an answer, the page and the viewer say "Every creative has an answer", and "Start the changes" becomes the one primary action.
- The change request goes to whoever runs the brand: Fume, or the agency by name (§24.5).

**Review is a place.** The customer's sidebar order is Home, Review (count), Campaigns, Deliveries, Brand, Fume.

- Review lists every creative that waits on her, grouped by campaign, with the same grid, viewer and "Start the changes" per campaign.
- A campaign's own review lights Review. Deliveries is its own place, titled "Deliveries".
- On a phone, the tab bar keeps Home, Review, Campaigns, Brand and Fume; Deliveries is inside Campaigns.

**The review grid.** Every tile in a row is the same height. The creative is contained and centred in a 4:5 well, with the format under it.

- Only the corner circle (44 px hit area) selects. The rest of the tile opens the creative.

**The viewer.**

- ← → move whenever focus is not in a text field, or the field is empty. A "← →" keycap hint sits by the counter.
- Keycaps sit inside the buttons ("Needs changes N", "Approve A"), with a tooltip naming the key. C goes to the comment field. Keycaps hide on touch.
- Toasts land at the decision row's bottom-left, over the hint, never on the comments panel.
- Wherever the words say who checked a creative, the Amber Focus pointer stands beside them.

**State colour: Moss (PROPOSED).** A muted warm green, #2F6B45 on #E6EFE2, for "Ready to download" (and "Delivered" if wanted). UI only, like Rouge: never on a creative, a button or a check.


### 26.4 Brand, onboarding, products, settings (builder D)

- **Voice (#4).** Voice is five parts: Identity, How we speak, Rules, Audience and Examples.
  - The onboarding shows one card per part: what Fume found, then Confirm or Change. "Confirm all" confirms the voice.
  - Brand › Voice (/brand/voice) is the reading page with all five sections.
  - Each trait is a Do and Don't pair. Examples are tagged by language.
- **Taste (#5, #47).** The deck has two named parts with a counter:
  - "Part 1 of 2 · Which is closer to {brand}?" teaches what she prefers.
  - "Part 2 of 2 · Is this {brand}?" teaches where the edges are.
  - Pairs come first. A pair has "Neither feels like {brand}" (key N), with reason chips, and it saves as a pass.
  - The deck is the same in the onboarding and on /brand/taste.
- **Brand index (#40).** A click scrolls to the part and focuses it without a ring. The keyboard still shows the ring.
- **AI model (#41).** /brand/models/:id holds:
  - The sheet: four body angles, then three face angles, in a white studio and the same plain clothes.
  - The specs, where the model may and may never be used, "used in N creatives", and made by and decided by.
  - The "AI model" pill on every picture, always. An AI model is never shown as a real person.
- **Colour (#2, #42).** The hex field has a picker beside it, and the hex stays. Uses are chips: Buttons, Accent, Backgrounds, Text, Light, Packaging and UI/design system.
- **Imagery (#3).** Pictures are grouped Your look, Campaign looks (named), Product shots and Not used. A picture can be moved between groups.
- **Rules (#43).** Every rule is a Do or a Don't. The list filters All, Do, Don't. Add a rule asks Do or Don't, and Area starts empty with Fume's guess.
- **Products (#44, #45, #46).**
  - States: Confirmed, Not confirmed yet, and New (found since the last visit). The catalogue is grouped in that order: New first.
  - Add a product: the type select decides the measures, and a unit select comes with each measure, never typed.
  - The product page and the product check end with "Everything Fume holds": six blocks and the sources.
- **Settings and profiles (#48, #49).**
  - Settings › Profile edits name, title and email in place.
  - Fume's people have /studio/settings/profile, and an agency's people have /agency/settings/profile. Both use the same form.
  - For a brand run by an agency: Package names the agency as the licence holder, and Team lists the agency's people apart, read-only.
- **Staff voice (08).** Fume's people and an agency's people read "{brand}’s …" or a person's name on brand pages, never "your" or "you said".


### 26.5 Studio: Check, the desk, staff Campaigns (builder E)

- **Check.**
  - Tabs: Plans · Images · Designs (Video later), each with how many wait.
  - The panel reads: where it stands → what the Engine found → tell the Engine (words and numbered pins on the creative, in the customer's pin look) → actions.
  - Mark checked shows the Amber check, and a checked creative's head carries it.
  - A campaign filter is a chip with ×, and "Show all" is a quiet link.
  - The list keeps its order for the session.
- **Sending.**
  - Checked work reaches the customer only when it is sent.
  - In production the whole set waits. After a send, each new check waits in "To send" for the next "Send to {customer}".
  - Undo the check takes it out again.
- **One creative, one worker.**
  - While the Engine fixes a creative, the desk is locked: "The Engine is working on this", Wait or Take over. Take over stops the fix.
  - Telling the Engine to fix a creative a designer has open asks first.
- **The desk.**
  - A new creative starts with no product ("Pick a product").
  - The studio is called Image, not Render.
  - Scene is a short row per variable with "More…" into a library: templates, the brand's scenes, backgrounds and references, surfaces, props, search and upload.
  - Compare 2 to 4 versions side by side, or a version beside the real product's photo.
  - A mode switch asks first, says what carries over and what is set aside, and brings set-aside values back on a switch back.
  - Email formats sit in the format list.
- **Staff Campaigns.**
  - Board by default: a column per stage (stages.ts) and Done. List is the table.
  - In check is Check's own count. The run line names the run.
  - For Fume's admin nothing leads past the page.
- **Numbers say what they count**: "Creatives approved", not "Approved". Periods read the same everywhere: "1–31 Oct 2026".


### 26.6 Agencies (builder F)

- An agency is Fume's studio with its own role type. It has the same frame and pages: Overview, Check, Campaigns, Deliveries, Clients, Team, Usage, Quality log and Settings.
- Roles are Admin, Expert and Operator:
  - Admin: everything an expert does, plus clients, the team, the Fume plan and usage.
  - Expert: briefs, plans, the Studio, the Engine and checks, and sends to the client.
  - Operator: runs the Engine and the Studio; an expert checks the work.
- The agency checks, and only its client approves. In an agency's client the plan "waits for your check"; sending it to the client checks it (§26.8). After that it reads "Checked by you".
- Fume plan (Settings › Fume plan): Fume decides an agency's features and when updates reach it. The page lists In your plan, Coming (each with a when) and On request (Fume's people). Fume's people are not in an agency's plan.
- No API costs anywhere in the agency frame.
- Help from Fume has three ways:
  - Book a meeting: with the agency's producer at Fume.
  - Borrow Fume's people: client, campaign, checks/design/renders, how much, when.
  - Customer service.
  - They sit in the sidebar foot, the person menu, the Overview and Settings › Fume plan.
- The agency's bell has one number everywhere: a notification is read when it is read, or when Needs you (across every client) already asks for the same thing.
- Each place of an example client says what it holds and offers LYSNE's same place. A newly added client is "new: Fume is reading <site>", never an example.
- The Studio desk follows the person's frame: /agency/doc/:id for an agency, /studio/doc/:id for Fume.
- When an Engine fix comes back, a toast says the creative waits for a check again.

### 26.7 After the round: what the after pictures found (22 Oct 2026)
Every comment got a picture of the app as it is now. Where a picture showed the fix was not whole, it was fixed:
- Days and times are never the browser's inputs (#37: the browser marked the month in system blue). A day is a field
  that reads "Sat 17 Oct 2026" and opens the month in Smoke glass: Monday first, today a small dot, the chosen day the
  white pill, days outside the allowed range faded; arrows, Enter and Esc. A time is a select of 24-hour slots ("20:00")
  every 15 minutes. Used in the calendar's plan dialog, the plan's "When each creative goes live", Record an approval
  and the brief's "Goes live" (@fume/ui DateField, TimeField).
- Check's panel (#50): what was said to the Engine is one folded line under the Engine's findings ("Said to the Engine
  · 1"), so nothing sits hidden under the decision at the panel's foot.
- The sliding pill of tabs and segmented controls re-measures when it first shows and on every resize, so a count that
  arrives just after the tabs mount never leaves it short (#53).
- Compare (#59): side by side, a version's flag reads only what the Engine read ("Reads 200 ml"); the real product
  beside it shows what it should be.
- Do or don't (#43) is a segmented control, so on Smoke glass the chosen one is the white pill as everywhere on glass.
- Add a product (#45): the photos asked for follow the product type (a spray: front, back, side, cap off; a cap: front,
  side, detail), not the kind.
- The chat's plan card and "Open the plan" open the plan in the panel beside the talk, like every chat link (#15); on
  the plan's full page "Back to the conversation" sits above the page's footer.
- "The same as Night Body Oil" (#7) puts only the claim in the answer. "AI model" everywhere, never "AI person".

### 26.8 The client approves the plan (DECIDED by Marcus 23 Oct 2026, card "Klienten godkjenner")
When an agency works for a client, the agency checks the plan and the client approves it, in the same link where she
approves the creatives. Her approval starts the Engine.
- **The agency.** A ready plan reads "Waits for your check". The footer says "Check the plan, then send it to Maja.
  Fume starts on … once she approves it", with Change it with Fume and **Send to Maja** (⌘↵). The Send panel is the
  creatives' panel with the plan in place of the creatives: "The plan · version 2", the people, a note and the client
  link. Sending checks the plan ("Checked by you · With Maja; she approves it"); after that the agency cannot change
  it, and Fume's chat says so. The agency never approves the plan: "Only Maja approves the plan. Check it and send it
  to her."
- **The client.** Until the agency sends it, the plan is hidden: "Brygga Studio is checking the plan", with the steps
  (Fume writes it, Brygga Studio checks it and sends it to you, you approve it, then the Engine makes the masters).
  Once sent, Home reads "The plan for Black Friday is ready · Checked by Brygga Studio. Approve it and Fume starts."
  and the plan's footer has Ask for changes and **Approve and start**. Products waiting to be confirmed are the
  agency's to confirm, never the client's.
- **One link per campaign.** The plan and later the creatives go to the same client link (/c/:token). It shows "The
  plan · version N", the direction, "Checked by Brygga Studio", the idea, references, how it looks, what Fume makes
  and the dates, with Approve the plan and Ask for changes. The agency's own preview of the link has its buttons off.
- **Changes.** The client's ask goes to the agency ("Maja asked for changes to the plan"); Fume writes the next
  version, which waits for the agency's check again and is sent to the same link.
- **Approved.** "Maja approved it · through the client link" with "Checked by Brygga Studio"; the run's first step is
  "Plan approved by Maja", and the agency is told the masters are theirs to check before Maja sees them.
- **The demo.** Nora (?as=nora): LYSNE › Winter gifting waits for her check and Send to Maja. Maja (?agency&as=maja):
  Black Friday is checked and sent, Approve and start. The seeded link is /c/bfplan.

## 27. Video in the Studio (27 Oct 2026, PROPOSED)

Marcus, 27 Oct: build video into the app from the start, "litt sånn det ble designet i agency dokumentet" (Fume for
Agencies, page 4: "AI Video Editor", Video · Night ritual, Adapt for, the Video / Captions / Sound timeline). The
Engine makes shots with video models, cuts them, does the motion design from the brand's design system, and makes
the formats. A draft for UX; the backend calls are in the contract and the mock.

### 27.1 One creative, one edit
- A video is a creative document like an image (`studio: "video"`), with an **edit** (`CreativeDocument.video`): the
  shots in order, the brand's motion, the captions, the sound, one colour grade, the formats, the Engine's checks
  and asks. Its first frame stands for it where the app shows a picture (Studio home, Check).
- Three modes: **Product film** (shots the Engine makes from the campaign's masters, with the brand's footage),
  **Motion from a still** (one picked render that moves) and **Cut from footage** (the brand's own clips). Switching
  an image creative to Video starts Motion from a still with its picked render as the first shot's start frame.
- Named by the format it is cut for: "Night ritual · Reels 9:16".

### 27.2 The desk
- The same desk as Image and Design: the bar (Image · Design · Video, undo, Send to check), the two panels, the
  Engine bar under the board. The board is the **player**: the frame in the format's ratio, the shot at the playhead
  playing in it, the motion and the captions drawn over it in the creative's own type, the safe zones on the rail.
  Under it the transport: play (Space), the time as data, what the edit is made from, the grade.
- The **timeline** runs the whole width under the panels: a ruler in seconds with the music's beats and the Engine's
  flags (a Rouge dot), then four tracks: Motion, Shots (a strip of each shot's own frames), Captions, Sound. Click or
  drag the ruler to move the playhead; click an item to select it; a selected shot has handles to trim either end
  (the shots after it move up; an end near a beat snaps to it; arrow keys a tenth at a time).
- **Left panel, what it is made from:** the mode; the shots in order (a flag where the Engine found something); the
  campaign's checked masters (each starts a new shot); the brand's own footage (added as it is); the brand's motion
  (title, line, product line, offer, end card), added at the playhead.
- **Right panel, what is selected.** Nothing: the Engine's checks (a flag jumps to its moment), the format it is cut
  for and **Adapt for** the others (Feed 4:5, Story 9:16 6 s cut, Ads 1:1 6 s), and the mode's variables (pace, how
  shots meet, captions on, colour grade, music). A shot: its takes, what the Engine read on the picked take, how to
  make it again, and the cut (speed, how it comes in, earlier, later, remove). Motion, a caption or a sound: its own
  few controls (words, motion, how it comes in, place, timing; the level of a sound).
- Every change of hers is an undo step of the desk (⌘Z), saved after a pause. The takes, the Engine's asks and the
  formats' progress are the backend's; undo moves her cut, never those.

### 27.3 Shots and takes
- The Engine makes a shot from a **start frame** (a checked master, so the product is right from the first frame)
  with a video model: what moves, the camera (still, push in, pull out, orbit, pan, tilt, handheld) and how far, the
  length (5 or 10 s), and 1 to 4 takes. The model and the cost are Fume's people only ("The Engine picks" by
  default; Kling 3.0, Kling 4.0, Seedance 2.5, Cinema Studio 4.0, MiniMax H3, Wan 2.6).
- Takes are versions: nothing is overwritten, she picks one. The Engine reads each take frame by frame and records
  what looks wrong (`findings`: product, physics, people, text) and the clean stretch (`best`); picking a take cuts
  to its clean stretch. "Use take 2 from 1.4 s" is offered when another take is clean where this one is not.
- The brand's footage is a shot used as it is; the grade matches it to the Engine's shots.

### 27.4 Motion, captions, sound
- Motion comes from the brand's design system: the brand's display face, its colours, soft to sharp (blur 12 → 0, no
  bounce), a fade or a short rise. The end card is the brand's mark alone on its own ground.
- Captions are written by the Engine in the brand's voice ("The last light", "of the day", "kept for the night") and
  sit above the placement's bottom safe zone on a solid step, so they read on any frame. A changed caption is hers.
- Sound: licensed music with its beats, effects, levels. One grade over every shot.

### 27.5 The Engine bar on a video
- She says what to change: a length ("Cut it to 6 s on the beat"), the beat, a shot to slow or hold longer, no
  captions. The Engine shows the change on the timeline and the player, line by line ("Shot 2 ends on the beat at
  3.00 s"), before anything is kept: Undo (Esc) or Keep (Enter). Meanwhile the panels wait. What it cannot read it
  says, and nothing changes.

### 27.6 Checks before Check
- The Engine checks the whole edit before it goes to check: the product is correct in every frame (a finding inside
  the stretch the edit uses is a flag at its moment), hands and bodies look right, every shot has a take, the length
  fits the format, the music is licensed for paid social, and the video is marked as made with AI in its own data for
  every platform. Send to check waits until every shot has a take; a flag goes with it to the expert.
- The expert checks; only the customer approves.

### 27.7 The contract and the demo
- Entities in `contract/entities/video.ts` (VideoEdit, VideoClip, ShotTake, TakeFinding, ShotRecipe, MotionLayer,
  CaptionCue, SoundCue, VideoFormat, EditCheck, VideoEngineEdit, BrandFootage); calls `makeShot` and `adaptVideo`;
  `updateDocument` takes the edit; `engineEdit` and `decideEdit` take words on a video; `brandAssets` lists the
  brand's footage. The timeline's arithmetic and the checks are pure rules in `domain/video.ts` (tests in
  `test/domain/video.test.ts`), shared by the Studio and the renderer.
- The demo (?as=anna): LYSNE › Autumn launch › **Night ritual**, a 15 s Reel: LYSNE's footage of light on stone, then
  three shots made with Kling 3.0 from the 9 Oct masters (real takes in `public/demo/lysne/video/`). The drop's first
  take has oil running out of the bottle's base while the cap is on; the Engine flags it, and take 2 (the bottle
  turned in the light) is clean from 1.4 s.
- Open: real playback of a cut (the backend renders it; the player plays the shots in place), voice-over, music
  search, the formats' own review, video in Check (Check's Video tab), and the video model per shot learning from
  which takes are picked.

