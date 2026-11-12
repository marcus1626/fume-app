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
  - Tabs: Plans · Images · Designs · Video (§34.7), each with how many wait.
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

## 27. Video in the Studio (27 Oct 2026; DECIDED 10 Nov 2026 as amended by §34–§36)

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

## 29. The Engine in the Studio and Check: a failed version, the prompt behind a version, teaching the Engine, the Engine's findings (4 Nov 2026; DECIDED 10 Nov 2026 as amended by §34–§36)

Status: PROPOSED (design thread, from the Engine v1 handover: docs/mvp/engine.md, "Not yet"). Numbered 29 so it does not
clash with §27 (video) and §28 (empty pages) on their own branches.

### 29.1 A version that did not render

- **In the strip.** A render that never reached the image model still becomes a version, so nothing is lost and the
  numbers stay true. Its tile has no picture: the sunken ground holds a quiet picture mark. The line says what was asked
  (or "From the variables"); under it, Rouge only on the mark: "Stopped by 2 rules" (the prompt worked against them
  three tries in a row), "Waits for a person" (the checks could not tell; a person decides) or "Not rendered".
- **It still opens.** A tap opens the right panel (a peek, the board stays live; ?prompt=<version>): "Version 4 didn't
  render", the reason in one sentence, What was asked, and **Write a new instruction**, which closes the panel and puts
  the cursor in the Engine bar. A failed version is never picked and never compared.
- **Never charged.** No picture was made, so the version costs nothing; the prompt's own cost shows to Fume's people.

### 29.2 The prompt behind a version (Fume's own people only)

- **Who.** Fume's own people. Never an agency's people, never a customer (engine_prompts is staff only; the live API
  sends `prompt` only to them, and the app hides it too).
- **Where.** The board's rail has "The Engine's prompt and checks" for the shown version; a failed version's panel
  shows the same for its last try. One panel for both.
- **What.** For a rendered version, the prompt first (data face, Copy), then **What the prompt had to carry**: every
  fact and rule as one line, marked carried (a check), works against it (the solid Rouge disc cut with Porcelain, as an
  error on glass), not visible in a picture, or sent to a person, with the checker's note. Then **The code's checks**
  (no printed words, no equipment, no file names, no forbidden words, locked parts unchanged) and **About this prompt**:
  status, why it stopped, image model, method, tries "n of 3", and what writing and checking it cost.
- **For a failed version** the order is what was asked, what it had to carry (the two against first), then "The last
  try, never sent".
- **Never Amber.** Nothing here is a person's check.

### 29.3 Teaching the Engine

- **Where.** Engine output (/studio/b/:ws/output) has **Teach the Engine · 6** at the head of the page (Fume's own
  people), counting the pictures nobody has answered yet; with none left it reads All taught.
- **The deck.** The same deck as Brand › Taste, on its own screen: one picture at a time, "Is this right for LYSNE?",
  the campaign above it, **No** and **Yes** (swipe, the pills, or N and Y). After an answer, chips say why: on No, The
  product is off, The light, The composition, Not LYSNE, Artefacts, Text in the picture; on Yes, The product is right,
  The light, The composition, Feels like LYSNE; or Write…. Every answer saves at once; the why updates the same answer.
- **No bias.** The card does not show the Engine's own evaluation, so the person judges the picture, not the Engine.
- **What it teaches.** Each answer becomes a lesson for the brand (engine_lessons: do or avoid, the why, the picture
  it came from). Only people's answers teach. The end card: "The Engine keeps 4 answers as lessons for LYSNE and uses
  them from the next render."

### 29.4 The contract

- `RenderVersion.failure` (one sentence for everyone) and `RenderVersion.prompt` (`EnginePrompt`: status validated,
  escalated or blocked, reason, model, method, text, tries, findings with carried, against, not_visible or person,
  codeChecks, llmUsd), sent only to Fume's own people.
- `Generation.taught` ("yes" or "no") and `teachEngine({ generationId, verdict, why })`: Fume's own people only.
- The demo: LYSNE › Autumn launch › Master 3 has V4, stopped by two rules ("Add a glossy reflection on the cap");
  V1 to V3 carry their prompts.

### 29.5 What the Engine had for a prompt (the ledger; Fume's own people only)

- **Where.** In the prompt panel of §29.2, after what the prompt had to carry and before the code's checks: **What
  the Engine had · 17 of 26 went in**, and "· 2 not found" when the check missed something that went in.
- **Groups.** Product facts, Brand rules, Taste, Brand Brain, Lessons, Pictures and examples: one quiet row each, its
  count after the title ("3 of 6 in", "all 3 in"), folded. A group with a piece that went in but was not found opens by
  itself and says "1 not found" first.
- **Each piece.** What it is, then how it went in (Word for word, By meaning, Read by the writer, Sent as a picture)
  and whether the check found it, or why it was left out ("A scent fact is for the words, not the picture.",
  "Not sure enough yet (48 %)", "Proposed, not confirmed by the brand."). In first; a piece that went in and was not
  found carries the Rouge disc; one left out steps back to secondary.
- **Why.** So Fume's people can see that the brand and the product were in the prompt, and what was cut, instead of
  taking it on trust (plan, part 1).

### 29.6 The Engine's findings in Check

- **What.** The Engine's picture check becomes findings on the version (findings with method automated: product,
  brand and brief, artefacts, printed words). In Check they lead **What the Engine found**, before the lines that hold;
  an area a finding speaks to drops its summary line ("Product Truth is off"), so nothing is said twice.
- **Each finding.** The finding, then what it is about and how much it weighs (Product · stops the check, Brand ·
  minor), then **Should be** and **In the picture** when the check said them. Two quiet answers:
  - **Add to the note**: the finding, with what it should be, goes into Tell the Engine; the button reads **In the
    note** (pressed) and takes it out again. Sending the note tells the Engine which findings it takes up; when the
    fix is back they read "fixed by the Engine".
  - **Not a problem**: sets it aside here (resolve_finding, accepted): "Brand · not a problem, said you, 14:32", with
    Undo while the creative is not checked.
- **What stops the check.** A critical finding that is open: Mark checked is disabled, and one line over it says
  "The product finding stops the check." C says the same in a toast. Major and minor findings never stop it: the
  expert decides. Proposed: the Engine's product finding is critical, so a wrong product never reaches the customer
  unless an expert says it is not a problem.
- **Who.** Everyone who checks (Fume's experts, an agency's people). Customers never read the Engine's findings.
- **Colour.** Only an open finding that stops the check carries Rouge, on its mark. No boxes: space between findings.
- **The contract.** `QaItem.findings` (`QaFinding`: dimension, severity, finding, expected, observed, status open,
  accepted or resolved, by, at), `qaSettleFinding(itemId, findingId, "accepted" | "open")`, and `qaFeedback(…,
  findingIds)`. `EnginePrompt.ledger` (`PromptLedgerEntry`: source, what, used, how, passed, why).
- **The demo.** Check › LYSNE › Night Body Oil · Feed 8: the cap is glossy (stops the check), the light comes from
  above, a smeared edge. Master 3's prompts carry their ledgers; V4's shows the cap and the rule against gloss went in
  and were not found.

## 30. The brand's books (4 Nov 2026, PROPOSED)
Every customer has two books Fume writes from what it knows about the brand (docs/mvp/brand-books.md): a long
**Tone of Voice** and a full **design system** for its campaign creatives. Fume writes a version, Fume's expert checks
it, and only the customer's owner or approver approves it or asks for a change. Both live under Brand: the Voice part
of the board opens Brand › Tone of Voice (/brand/voice), the Type part opens Brand › Design system (/brand/design).
- **One frame for both.** The header names the book and says, in one line, which version is shown and where it
  stands: "Version 2 · Draft · waits on your check", "Version 1 · Checked by Anna · waits on Maja" (to Maja: "· yours
  to approve"), "Version 1 · Approved by Maja, 8 Oct · in use", "Replaced by version 2". The newest version with a
  body is shown; ?v=2 shows another, and **Versions** at the foot lists them all.
- **Notes above the book** say what else is true: Fume writing the next version ("Fume is writing version 3… about a
  minute", with a turning mark), a version that failed and why ("Try again"), "Version 1 stays in use until Maja
  approves this one: Fume writes every word from it" (the design system: "the Engine lays out every creative from
  it"), and the words the version was written for: "Written for Maja's words: “…”".
- **The step's foot.** Anna on a draft: "Marked checked, Maja reads version 2 and approves it." with **Mark checked**.
  Maja on a checked version: "Anna checked it. Approved, Fume writes every word from it." with **Ask for a change**
  and **Approve**. Approving replaces the version in use. On the version in use, **Ask for a change** sits in the
  header for Maja; Fume's people have **Write a new version** there. Both open one box: "What should change?"
- **The Tone of Voice** starts with its summary and the five parts the brand confirmed (identity, how it speaks,
  rules, audience, examples), then the voice at work: the tone on five scales, mechanics (casing, punctuation,
  numbers, emoji, names), its own words, each channel (how, how long, an example), headline patterns and calls to
  action, on brand and off brand pairs with why, what Fume still needs to know, and where each part comes from.
- **The design system** starts with **In use**: examples of graphic design drawn on the brand's own photographs,
  each layer where the book puts it, in the brand's own faces and colours, at the frame's true shape (one row height
  for every format), with what the picture shows and why the words sit where they do. Then colour (one swatch per
  colour with every role it plays, and the contrast of every pair that carries words, measured by code), type (the
  faces, and every style in proportion to a frame 1080 wide), layout (each format's margins and the space the
  platform covers), the logo, words on photographs, components, rules, the tokens as CSS with **Copy**, what Fume
  still needs to know, and where it comes from.
- **Who sees what.** A customer never reads a version being written, one that failed, or a draft no expert checked:
  Maja reads version 1 of the Tone of Voice while Anna has version 2 in check. She only learns that one is on its way,
  by its number: "Anna is checking version 2. You read it once it is checked." or, after she asked for a change, "Fume
  is writing version 3. Anna checks it before you read it." The brand's colours and faces are the
  customer's data, drawn inline; nothing of Fume's own look (Amber, Smoke glass) is used on them.
- **The demo.** Anna (?as=anna): LYSNE › Brand › Tone of Voice, version 2 waits on her check; the design system is
  checked and waits on Maja. Maja (/brand/design): Approve or Ask for a change.

## 31. The copy check on a plan (4 Nov 2026, PROPOSED)
Fume writes the plan's words in the brand's Tone of Voice and reads every line it has the brand say before the expert
does: each claim (a result, health, best or most, better than, a price, an offer, where it is from, an award) and
whether the line sounds like the voice (docs/mvp/brand-books.md, the copy lane). A claim nothing backs sends the plan
back to Fume once. What the check found reaches Fume's own expert on the plan she checks; the customer, an agency and
its client never see it.
- **On the line.** Under a line of the plan's words, or under a master's words, a quiet note per finding. A claim no
  verified fact backs is Rouge with its alert mark: "No verified fact says this: “roligere søvn”. A health claim needs
  one." Off the voice ("Off the voice. An exclamation mark and “nå”: LYSNE never hurries the reader.") and a word the
  voice avoids ("The voice avoids “luxury”.") are secondary. A claim a fact backs ("100 ml") or one the brand's own
  words make (the brief's offer) is only counted, never flagged.
- **In the aside.** Above the customer's brief: **The words, checked**, "6 lines read · 1 claim nothing backs · 1 off
  the voice · 1 word the voice avoids", each finding a link that glides to its line, "Written again once, for a claim
  nothing backed: “Norges beste kveldsolje, nå i et sett.”" and "Written in the Tone of Voice, version 1 (approved)".
  When the words could not be read, it says so and asks her to read them herself.
- **She changes the words in place**, as any line. A line changed after the check keeps its notes, muted, under "You
  changed this line after the check."
- **It never blocks.** A machine's reading never stops the check on its own: Mark checked stays as it is, and while a
  claim nothing backs is still on a line nobody changed, the foot says "1 claim nothing backs is still in the plan."
  Nothing here is Amber: nothing in it is checked.
- **The demo.** Anna (?as=anna): LYSNE › Black Friday › Plan, in check because Maja asked.

## 32. The Look Book (4 Nov 2026, PROPOSED)
Beside the Tone of Voice and the design system, every brand has a third book: its **photography**, read from its own
pictures (docs/mvp/look-book.md), so every picture the Engine makes is shot the way the brand shoots. Marcus, 4 Nov:
"Smak fra brands handler om alle detaljene, kamera, grain, lys, komposisjon, alt." The Imagery part of the board opens
Brand › Look Book (/brand/look) with "The Look Book".
- **The same frame as the other two (§30).** Version and where it stands in the header, the notes above the book, the
  Versions list, Anna's **Mark checked** on a draft, Maja's **Approve** and **Ask for a change** on a checked version,
  and Fume's people's **Write a new version**. What it is for, in the foot and the notes: "Approved, the Engine shoots
  every picture from it." A customer never reads a draft; she only learns its number is on its way.
- **The book.** A summary a photographer could shoot from, then **The signature**: four to six things that make a
  picture the brand's at a glance. **Read from your pictures** shows the pictures Fume read (at most twelve), each
  with the number the book calls it by, where it comes from (Brand DNA, the website, liked or turned down in Taste,
  the turned-down ones dimmed) and what it shows of the look.
  Then **Camera** (the capture, each lens in millimetres and what it is for, aperture, height, distance, motion),
  **Light** (key, quality, direction, colour temperature in kelvin, contrast, time of day, rules), **Colour** (the
  grade, the palette as swatches with their hex, saturation, blacks, highlights, white balance), **Texture** (grain on
  a scale of none, fine, medium, heavy, sharpness, surfaces, the lens), **Composition**, **Styling**, **People** (who,
  how they move, real skin; "Your pictures show no people." when there are none), **Retouching**, **Never**, and
  **Recipes**, one per kind of scene, each with camera, light, grade and composition: the Engine takes the one closest
  to the picture the plan asks for. What Fume still needs to know and where each part comes from close it, as in the
  other books ("The brand's pictures" is a source of its own).
- **Who sees what.** As §30. The brand's palette is the customer's data, drawn inline.
- **The demo.** LYSNE's Look Book, version 1, read from twelve pictures, is checked by Anna and waits on Maja. Maja
  (/brand/look): Approve or Ask for a change. Anna (?as=anna): "Checked by you · waits on Maja".

## 33. Graphic design by Fume (4 Nov 2026; DECIDED 10 Nov 2026 as amended by §34–§36)
Fume lays the plan's approved words on a picture the Engine made, in the brand's design system, measures the layout
by code and has its review look at it as a designer would (docs/mvp/design-layer.md). Only Fume's people see any of
it: the customer, an agency and its client never do. Only a Fume designer asks for it.
- **Where it lives.** Under the strip, beside "Add a picture made by hand": **Add graphic design to V3**, on the
  picked version. On a designed version it reads **Design again from V3**; while Fume works on that picture,
  **Fume is designing on V3**, and it cannot be asked twice. A video or design creative has no such action.
- **The dialog** says what Fume will do and with what, before anything starts: "Fume lays the plan's words on V3 in
  the brand's design system and checks the layout by code. It comes back as a new version with a design file you can
  change by hand; V3 stays as it is." Then **The words, from the approved plan** (headline, supporting line, call to
  action, word for word), **The design system** ("Version 1 · checked · the customer has not approved it yet, so Fume
  uses the checked one · Open it"), and an optional box, "Anything Fume should know (if anything)". When it cannot be
  asked, the box gives way to why: "Graphic design goes on a picture.", "The brand has no design system yet. Ask Fume
  to write one first." or "The approved plan has no headline to set on this creative."
- **While Fume works** a new version's tile reads "Fume is designing", over the picture it designs on, and the board
  shows that picture with "Fume is designing version 5 on V3". The toast: "Fume is designing version 5 · On V3, in the
  design system. V3 stays as it is."
- **The result** is a version of its own, picked: its tile reads "Designed from V3 · Ready for check" or with what
  was found ("1 flag · 1 design note"), and the board draws the words on it. A layer that failed is a failed version
  ("Not designed"); its panel says why and offers **Design again**.
- **The panel**, from the rail's **The graphic design and its checks**: what Fume's review found (its verdict, then
  each finding by severity: "Minor · Fume's review"), **What code measured · 6 of 8 passed** (failed hard checks
  first, a soft one "Said to the expert; it does not rule the layout out.", and "no layout passed every check; this
  is the closest one" when none did), the words, about this design (the picture under it, the design system, where
  the words sit, how many layouts code tried, what was asked, what Fume's review cost), and the design file:
  **Download the design file** (a .fig whose words stay text) and **Design again**.
- **In Check**, a designed version shows its words on the creative and, after what the Engine found, **The graphic
  design · design system version 1 · checked**: the review's verdict and findings, failed checks, then the passed ones
  summed up in one line. It is read-only there and never stops a check: the expert decides, as always.
- **The demo.** Anna (?as=anna): LYSNE › Autumn launch › Master 3 (/studio/doc/doc-autumn-m3), Add graphic design to
  V3; the second try moves the words to the foot, where the review says it needs work. In Check, Night Body Oil ·
  Feed 9 (?item=qa-8) is a designed version 2 waiting for a check.

## 34. Round 14 (9 Nov 2026; DECIDED 10 Nov 2026): Marcus's comments on the approval videos
Marcus watched the walkthroughs of PR #6, #8, #10 and #11 and left ten comments (9 Nov). He chose to see these changes
before any of the four is wired live.

### 34.1 The Engine never stops the designer
Marcus: "Å flagge er en ting. Men jeg synes ikke at Engine sin evaluering skal stoppe designeren fra å bruke den.
Designer har alltid siste ord." Under the bar it is not "Stopped": the designer must see it before the customer does,
with a clear warning, and a score board in a side panel shows the product's score and the Engine's.

- **Rendered, always.** A prompt that works against a rule (often the designer's own ask, "Add a glossy reflection on
  the cap") goes to the image model anyway, as `EnginePrompt.status` `warned`; `blocked` is no longer used. Only a
  picture that could not be made at all (the image model did not answer) is a failed version.
- **Two scores, one bar.** `Evaluation.scores`: the product (against its photographs and verified facts) and the
  Engine (the brand's rules, taste and the planned scene), 0 to 100, with one short line on why a score is low. The
  bar is 80, the Engine's own pass line for a check (`domain/scores.ts`).
- **The Studio.** The board shows the whole picture; above it, never over it, a Smoke pill: "Version 4 is under
  LYSNE's bar · Engine 58 · Product 64". The strip's tile says "Under the bar". The left panel opens with Scores: each
  score's number (Rouge under the bar), a meter with the bar on it, the why, and (Fume's people) the Engine's checks.
- **Before anyone else sees it.** Send to check asks once: "Version 4 is under the bar. Engine 58 · Product 64, the
  bar is 80. … It's your call: the expert sees the warning in Check." Later, or Send anyway. The customer never sees a
  creative before it is checked (F-D025), so the expert in Check is the next person to see it.
- **Check.** Scores come first in the panel, on a sunken step, titled "Under the bar" (and who sent it) when one is.
  A clear product fault still waits for the expert's word (DECIDED 6 Nov): it now says "decide first", never "stops
  the check".

### 34.2 Clearer order and fewer words in Check
Marcus: "vet ikke helt hvor jeg skal se, mye tekst overalt." The panel reads top to bottom: where it stands, the
scores, what is "To decide" (each finding: what is wrong, what it should be, a quiet kind line, two small buttons),
then what holds folded into one line ("3 checks hold"), the Brand DNA list folded, the note to the Engine, and the
decision at the foot. Part titles are the rows' size in Ink, so they are read first; "In the picture" is gone.

The same order holds in the plan and the drawers ("gjennomgående"):
- **The plan's aside:** "The words, checked" is its clearest title, then one quiet line ("3 to look at, in 6 lines")
  and the findings that glide to their lines. The Tone of Voice it wrote in and the rewrite Fume made fold under
  "How Fume wrote them".
- **The graphic design drawer and its dialog:** part titles at the rows' size in the glass's own colour. What code
  measured shows only what did not pass, one by one, and the rest in one row ("6 checks passed: inside the safe area ·
  contrast 6.2:1 and 5.1:1 · calm under the words"); no check repeats that it does not rule the layout out. The
  dialog says what happens in one sentence ("Fume lays the plan's words on V3 and checks the layout. You get a new
  version, with a file you can change by hand; V3 stays as it is.") and the design system in a line ("Version 1 ·
  checked, not approved yet · Open it").

### 34.3 The Tone of Voice is written in place, and copy is a big part of it
Marcus: the Tone of Voice "føles som click to open edit", static and cold; "ToV og copy trenger en mye større del,
copy har blitt en stor del av det vi løser".

- **A book reads like documentation.** Its index sits on the left on a desk (as brand.fumecreatives.com and shadcn's
  docs): three groups with small titles, **Voice** (Identity, How we speak, Where we sit, Rules, Audience), **Copy**
  (Try a line, Headlines, Calls to action, Channels, On brand off brand, Examples, Our words, Mechanics) and **This
  version** (Still to know, Where it comes from, Versions). The part in view is lit; a press glides to it. Under 1100 px
  the index goes and the book is one column. Each group opens with the page's biggest title and one line.
- **Every line is its own field.** Nothing opens: she clicks a line, writes, and it is kept when she leaves it (Enter
  or Tab; Escape puts the words back). A list has "Add a line" at its end and × beside a line; an emptied line goes.
  Words are chips with × and "Add a word". A changed line keeps a dotted underline and says who changed it and what it
  said before. No colour of its own: Amber stays for a person's check, Rouge for what works against a rule.
- **Who writes, and where it goes.**
  - Fume's people write straight into a draft; each line saves with Undo in the toast. On the version in use, when
    no draft is open, the first change starts the next version, a draft the expert checks
    (`editBrandBook`, `BrandBook.edits`).
  - The brand's owner or approver writes into the version that waits on her, or the one in use, the same way. Her
    lines wait on the page, marked hers, and the foot says "You changed 2 lines. Fume writes version 3 with them; Anna
    checks it before you approve it", with **Send 2 lines** and Discard. Fume keeps her lines as she wrote them
    (`askBrandBookChange` with `edits`). The expert still checks every version; only the customer approves.
  - Nobody else writes in a book, and nobody writes in a version that is replaced.
- **Copy, bigger.** Headlines read at body-large with their pattern under them; calls to action are cards with the
  words big and when each is used; each channel shows its example first, then how and how long.
- **Try a line.** At the top of Copy: write a headline, a call to action or a caption, pick where it runs, and Fume
  holds it against this Tone of Voice, as the plan's copy check does (§31): the words the voice avoids, a claim no
  verified fact backs, the mechanics (no exclamation marks, sentence case), and the channel's length ("12 of 6 words").
  With something found, Fume's version of the line and "Use it". A reading only; it changes nothing
  (`checkCopyLine`).

### 34.4 The design system reads like a component library
Marcus: the design system page "føles som et rotete Word-dokument"; he wants it like shadcn or
brand.fumecreatives.com, with a part for components (buttons and the rest).

- **The same index as the Tone of Voice** (§34.3), in five groups: **Overview** (In use), **Foundations** (Colour, Type,
  Layout, Logo, Words on photographs), **Components** (one entry per component the book has: Headline, Subline, Price,
  Call to action, Badge, Product name, Small print, Logo), **Rules and code** (Do and don't, CSS) and **This version**
  (Still to know, Where it comes from, Versions). The index scrolls on its own when it is longer than the window.
- **Every component is shown live**, in the brand's own colours and type, at the size it has on a frame 1080 wide:
  the words an example uses it with ("Se settet"), on the brand's wall, or **On a photograph** of the brand's where an
  example has one. **Preview | CSS** sits above it: the CSS is the component on the brand's tokens
  (`.brand .cta { font-family: var(--font-label); … background: var(--color-cta); border-radius: var(--radius-pill) }`)
  with Copy. Under it, what it is made of as a row of small facts (Style, Words, Ground, Corners and padding, colours
  as a dot with the code), then its rules.
- **Colour** shows each colour's token beside its code (`--color-cta`). **CSS** at the end holds the tokens and every
  component, so a designer or developer takes the whole system in one copy.
- The page reads; it is not edited in place yet. A change still goes through "Ask for a change" or "Write a new
  version" (§30). The component CSS is built by code from the book (the mock builds it in the page; live, the API
  builds it with `css`).

### 34.5 Fume designs in Design, and its design is checked in Designs
Marcus: "litt rart at man fortsatt er på Image-fanen og ikke Design-fanen når Fume/Engine gjør designen", and "hvorfor
sjekker man design inne på Images-siden?"

- **The Studio.** "Add graphic design to V3" stays under Image's strip, and the dialog is the same; once Fume starts,
  the Studio goes to Design (with no hand-made layers in the way). Design's strip holds what Fume designed ("V5 ·
  Designed from V3"), Image's strip holds the pictures, and in Image a picked design shows the picture under it.
  A creative laid out by hand, with nothing designed by Fume, shows every version in Design as before.
- **Layers.** Design's left panel lists the design's layers, "By Fume · V5": the button, the line and the headline,
  each with its words, then the picture under them, locked. The words are the plan's; the design file is where they
  move.
- **Check.** A creative Fume designed waits in Designs, not Images, beside the creatives laid out by hand.

### 34.6 The video editor: Edit and Motion, Storyboard and Timeline
Marcus, 9 Nov: "Sørg for at den er logisk", like CapCut; existing video as well as the Engine's shots; pure motion in
its own mode, with predefined styles; a Storyboard; the Engine as a bar and as a conversation; precomps, the brand's
CTA, keyframes and easing. The proposal (artifact "Video-editoren") holds the reasoning and what was looked at; this is
what the mock does. The engine that plays and renders the motion is not chosen (Marcus 9 Nov: motion.dev and Anime.js
are references for when that engine is built). Fume owns the motion as data, so the engine can change.

- **Two modes, one video.** Edit is footage first: her uploads and the Engine's shots on the main track, with text and
  the brand's components over them. Motion is graphics first: the styles, and a track for each layer, as in After
  Effects. The mode changes the panels, never the edit: the switch says so ("Nothing in the edit changes").
- **Shots and takes.** A shot is a place in the cut with takes. It is named by its take, plainly: "Shot 3 · Take 1 of
  2", with what it is and where it came from under it ("The bottle in the hand · made by the Engine"). An upload is a
  clip used as it is ("Upload · LYSNE's footage") until she asks the Engine for takes of it.
- **The library** (left, Edit): Shots, Uploads, Masters and Brand. Brand holds the brand's components (its call to
  action, its end card) and its text (title, line, product line, offer), from its design system; each is added at the
  playhead, on the shot there.
- **The call to action** is a locked component: its words change (the plan's CTA), its pill and colours are the
  design system's (LYSNE: Burgundy cap, Linen words). It sits on the Brand track with the end card.
- **Tracks** (Edit): Text, Brand, Main, Captions, Sound. A layer follows the shot it was added on (a small link on its
  item, "Follows" in the inspector): trim or move the shot and the layer moves with it. "The video's own time" unlinks
  it.
- **Motion on a layer.** In, While on (still, drift, breathe) and Out, each from the brand's choices; Easing from the
  brand's motion (Soft out, Settle, In and out, Even; never a bounce). **Keyframes** on Across, Up and down, Size and
  Opacity: a diamond sets or takes out the key at the playhead, the value there is a field, and the layer's own short
  track shows its keys (press one to go there). Keys live on the layer in its own seconds, so they move with it. The
  player draws every layer from the clock, so a paused frame is the film's frame.
- **Motion mode's styles**: Product showcase, Explainer, SaaS demo, Kinetic type, Stats, Logo sting. A style is a set
  of motion (in, out, while on, easing) with Energy (how far words travel) and Pace (how quickly they come and go).
  Trying another keeps the words, the timing and the keys.
- **Storyboard** sits in the timeline's place, switched in its corner: a card per shot in order, its picture with the
  other takes stacked behind it, "Take 1 of 2" or "Upload", its length and its camera, and a flag where the Engine
  found something. Picking a card picks the shot; a change shows in both views.
- **The Engine, three ways in, one context.** The bar under the player takes one change, shown before it is kept. The
  **video conversation** opens from the bar's end and takes the inspector's place: one conversation per creative, the
  same changes (kept or undone show as such), and chips for what the Engine sees (what is picked, the playhead, the
  format, the mode), each removable. In the tools: Make it again on a shot. Staff only.
- **3D** is a track behind a flag (`?flags=3d`), off in production until it works: the product's 3D model with a camera
  move.
- **Not yet**: groups and components she makes herself (precomps), split and roll edits, speed ramps, masks, a curve
  editor, export of the project as one file. They come with the engine.

### 34.7 Video in Check

A video is checked the same way as a picture, on a clock. It waits in Check's **Video** tab with how many wait, like
the others; nothing else about Check changes.

- **The well** plays the video, fitted like a picture of its format. Under it: play (Space), the time as data, and
  **one strip of its shots** in order, each with its frames and its name. The strip is the scrubber. The tracks stay in
  the Studio: Check is for looking, deciding and saying what is wrong.
- **What the Engine found** lies over the strip as marks on the stretch it is on (Rouge for one that stops the check,
  grey for a small one). A mark, or the time on a finding in the panel ("0:00.0 to 0:02.9"), takes the playhead
  there, past the way in, so the frame shown is the one with the fault.
- **The panel** is Check's panel: findings first (a critical one stops Mark checked until it is decided), then the
  Engine's checks on the edit (the product in every frame, hands, every shot has a take, the length for the format,
  the music's licence, made with AI), folded where they hold; a flag carries its second.
- **Pins** go on the frame where the playhead stands: the video stops while she writes. A pin shows on the frame
  around its second, and on the strip at its second; in the panel it carries its time. Tell the Engine sends the pins
  with their seconds.
- **Open in Studio** opens the video in the Video studio, where she picks another take, trims or tells the Engine.
- Seeded: LYSNE's "Night ritual · Story 9:16", the Story the Engine cut from the film's shots (6 s). Its first shot is
  the take with oil running from the closed bottle (critical); its button comes in a quarter second after the beat
  (minor).

## 35. Round 15 (9 Nov 2026; DECIDED 10 Nov 2026): Marcus's 22 comments on the round 14 walkthrough
Marcus watched the round 14 walkthrough and left 22 comments (9 Nov). Under them lay four patterns: panels that say too
much at once (Check), things that are fixed where they should be open (components, Tone of Voice blocks, the logo as a
switch, two scores), the Engine in too many places (a bar, a chat and a conversation per desk), and scores that came
before anything was made. He chose to wire the brand books live now (card, 9 Nov) and to see the rest first. He approved it
all on 10 Nov 2026 (§36).

### 35.1 Check is a comment thread, like the customer's viewer
Marcus: "kan ikke designeren sin sjekk her være litt som kunden sin, et kommentarfelt og sånt som i Frame.io" and "hele
panelet her er rotete … 'Mark checked' 'Tell the Engine' og 'Open in Studio' er fine".

- **The panel is one thread.** Its head: the title, the brand and campaign (and "3 formats"), the due and risk badges
  and the score chip (§35.3). Then **Comments** with a count, a numbered list, and a comment box at the foot. The
  decision at the foot does not change: Mark checked (C), Tell the Engine · n (F), Open in Studio (S).
- **The Engine's findings are its comments.** Each is numbered, signed "Engine" with its mark, and tagged with its kind
  and weight ("Product · decide first" with a small Rouge mark only when it stops the check). Then what it saw, one
  quiet "Should be" line, and two words: **Fix with the Engine** (it goes with Tell the Engine; it says "Goes to the
  Engine" once chosen) and **Not a problem**. A finding with a place on the creative is a numbered pin there; a pin and
  its comment light up together. Pin numbers stay put when a comment is settled. On a video the strip under it marks each
  finding's stretch in a quiet grey; the one that stops the check carries a small Rouge dot, never a red bar. A link to
  one moment ("0:04.0") takes the playhead to that moment; a stretch lands a little inside it.
- **Her own comments.** She writes in the box at the foot (Enter adds it, Cmd+Enter tells the Engine at once) or clicks
  the creative to pin one; on a video the pin carries its second. Each says "You", its format and time, and can be
  taken out. They go with Tell the Engine.
- **What is settled folds away.** "n earlier comments" (fixed or not a problem, each with Undo), "n checks hold ·
  Brand DNA v3", the graphic design and the words on the creative each fold into one line. Nothing is repeated.
- **Mark checked** with a finding still to decide opens that comment instead of a note.
- **Toasts** rise in the panel above the comment box, next to the decision that made them, never over the creative.

### 35.2 An ad's formats are one ad in Check
Marcus: "Hvis denne annonsen har flere formater (1x1, 4x5, etc) kommer de opp som forskjellige annonser inne på check
her? De burde komme opp som en annonse, så går man inn å checker de forskjellige formatene."

- One row in the list per ad, with "3 formats". Under the creative a strip of its formats (Feed 4:5 · Master, Square
  1:1 · Cropped, Story 9:16 · Extended), each a small picture in its own ratio; the shown one is lifted.
- A pin belongs to the format it was put on, and says so in its comment. Mark checked checks the ad with all its
  formats (they were made from the checked master, §28).
- `QaItem.formats?: QaFormat[]` (placement, format, picture, how it was made: native, crop or expand); `QaPin.format`.

### 35.3 Scores are typed per studio, and live in the Studio
Marcus: "Må ha flere scores. Kvalitet. Product fidelity. On brand … en mini scoreboard under Product … per produkt
dataen", "Hvorfor … endrer image scores seg inne på Design? … Kontrast, on brand", "Scoreboardet er litt off brand. Og
burde være synlig inne i Studio", and "score kommer etter man har laget noe".

- **Each studio has its own measures.** A picture: Product (part by part from the product's verified facts: label,
  cap, glass, size), Brand, Craft. A design: Readability (contrast, a calm ground), Design system, Placement (inside
  the safe area, clear of the product), Words. A video: Product, Brand, First second, Rhythm, Text on screen.
  `Scores.measures?: ScoreMeasure[]`; the two old numbers still read as Product and Brand where a version has nothing
  more. The bar stays 80 (`domain/scores.ts`).
- **A design is never scored as a picture.** Words over the product are measured ("covers") and cost Placement, and
  come to Check as the Engine's comment ("The headline sits over the bottle's label").
- **The board looks like Fume.** It answers in words first ("Under the bar on Brand and Product"), then one row per
  measure: the name, the number in GT Standard with tabular figures, a thin Ink meter with a tick at the bar, and one
  line on why when it is under. A small warning mark, never Rouge (a low score is the Engine's view, not an error),
  never Amber, never Mono. The product opens part by part, by itself when a part is under the bar; the product scores as its weakest part.
- **In the Studio** the scores come once a version is made: "Scores" on the board's rail opens the shown version's
  board at the board's right edge, and the warning above a version under the bar opens the same board. The picture
  makes room; nothing floats over it. Every made version is scored, a picture made by hand too. The side panel never
  starts with Scores.
- **In Check** the scores are a chip in the head ("Under the bar · Product 52", "Over the bar · lowest 86") that opens
  the board under the head. Check's version numbers are the Studio's ("Before · V3", "After · V5").

### 35.4 Smaller things
- The video's keys are named as in After Effects' Transform: Position X, Position Y, Scale, Rotation (new) and
  Opacity; the easing shows its numbers (cubic-bezier) beside its name. Custom curves, text animators and presets
  come with the video editor round (round 16), with the storyboard as its own canvas and the timeline as layers.
- In the brand books a toast rises at the foot of the reading column, never over the page index.
- Check's tab pill re-places on every resize; a new word we avoid is a chip, with no focus ring left behind.

### 35.5 The Design studio, laid out like Figma

It builds on §34.5.

Marcus: "Layers should be on the right, since people are used to Figma, with more control. Look at OpenPencil for
that." And: "'Show the logo' should not be a button, it is a layer, and we should keep control and logic." The design
thread then proposed Figma's own order, and Marcus chose it on 9 Nov (DECIDED): the layers on the left, what is
picked set on the right. The names and the
grouping are borrowed from Figma and OpenPencil (Layers; Text, Typography, Fill, Position; the page's properties when
nothing is picked), never their look: the panels are the desk's own.

Only Design changes. Image and Video keep their panels.

#### The left panel: the frame and its layers

- **The frame on top.** The format picker sits first, compact: the format and its ratio, and under it only where
  words may go ("Keep words out of the top 250 px and bottom 340 px"). How a picture is rendered (the generator, the
  product, the output count) belongs to Image, not here.
- **Layers.** A title, and beside it whose layers they are: "By Fume · V5" on a version Fume designed, "4 layers" on a
  creative laid out by hand. Then the frame ("Frame · 1080 × 1350") and its layers a step in, as they stack, the top
  one first: the logo, the headline, the line under it, the call to action, the shade, the picture.
- **A row.** Its icon, its name, a second line (the words; the logo's version, "Wordmark, reversed"; the picture's
  version, "V3"; where the shade comes from), a lock and an eye. A click picks the layer, and the canvas shows it
  picked; a click on the canvas picks the row. Up and Down move through the rows. The frame row, Escape, or a click on
  the board outside the layers picks nothing.
- **The eye** hides a layer: its row goes quiet and the canvas leaves it out. **The lock** keeps a layer from being
  picked on the canvas; it is still picked in the list, as in Figma. A lock shows where a layer is locked, and on the
  row under the pointer or the keyboard. The picture and the shade come locked.
- **Every layer listed is on the canvas, or listed as hidden.** Fume keeps what it left out as a hidden layer: the
  call to action where the design system keeps it off the format (LYSNE: "Never on a feed picture"), the logo where
  the label shows the name. Before, the list said "Button: Se kveldsoljen" with no button on the picture.
- **The logo is a layer.** The "Show the logo" switch is gone from the Layout mode; its eye shows or hides it.
- While Fume designs a version, the list waits: "Fume is designing V5. Its layers come with it."

#### The right panel: the properties of what is picked

The panel's title is the layer's name ("Headline", "Logo · hidden"), or "Frame". Every choice comes from the brand's
design system: its text styles, typefaces, colours, logo versions and its call to action. Nothing else is offered.

- **Words (headline, line, other text).** *Text*: Content. *Typography*: Text style (the design system's styles, with
  their size: "Heading 1 · 76"), Typeface (the brand's typefaces), Weight (the weights the typeface has), Size in px,
  Align (Left, Centre, Right). A new text style clears the typeface, weight and size set by hand. *Fill*: Colour, the
  brand's colours for words only. *Position*: X, Y and W in px of the frame (Up and Down step 1, with Shift 10).
- **The logo.** *Logo*: Version (Wordmark or Reversed), with what the design system says each is for and its rule for
  logos on a photograph. *Position*: X, Y, W, never under the design system's least width, with its clear space.
- **The call to action.** *Component*: the brand's call to action (its colours and rules, "Two words. Never on a feed
  picture."), and its Content. *Position*: X and Y; its width is its pill's.
- **The picture.** *Picture*: Version ("V3"); on Fume's design it stays the picture Fume designed on ("For another
  picture, design again from it in Image"). Fit: Fill (crops to the frame) or Fit (the whole picture).
- **The shade.** Where it comes from, and its strength.
- **Nothing picked: the frame.** *Layout*: on a creative laid out by hand, its template; on Fume's design, "Laid out by
  Fume · V5" and "Its checks" (the design sheet). Align (Top, Centre, Bottom) says where the headline and its line are
  on the canvas, and moves them inside the safe area, clear of a shown logo or call to action (those keep their
  place); the shade turns to come from the words' side. While Fume is still laying out, the frame says so. Before, Align
  said Bottom while the words sat at the top. *Words*: one colour for every word layer ("Mixed" when they differ); the
  call to action keeps its own.
- **The words' source is gone** (Brand, Fume, Own, Engine). In Design every colour and type is the brand's design
  system's, so there is nothing left for it to choose between.

#### The canvas

The frame is the format's ratio, and the picture fills it or fits in it. The layers are drawn as the creative will be:
the brand's typefaces (their stand-ins on Google Fonts), sizes in px at 1080 wide, its colours, its call to action as
its pill, its shade. The picked layer has the desk's selection ring. On a phone the canvas only shows.

#### Names

A version is "V3" where it is short (rows, readouts) and "Version 3" in a sentence. The picture layer is "Picture",
never "Image v3". The generator ("Nano Banana Pro") shows only where a picture is generated, never on a layout.

#### What is kept, and how

- **Layer** (contract) has new optional fields, kept as they are given; what is not set follows the design system:
  `locked`, `component` (headline, subline, cta, logo), `textStyle`, `font`, `weight`, `sizePx`, `align`, `colour`,
  `variant` (the logo's version), `fit`, `shade`, and `belongsTo` (the version a layer of Fume's design belongs to).
- **Fume's design as layers.** Until it is changed, a design's layers are read from the version Fume designed (its
  words and where it drew them). The first change keeps them in the creative's layers with `belongsTo` set to that
  version; hand layers have none. Undo and Redo hold every change, as before.
- The Layout mode's `align` and `textColour` follow the layers in the same step, so they never say one thing while the
  canvas shows another.
- **Send to check** sends the layers of the version sent: the hand layers on a picture; on Fume's design, its layers
  once changed, which then stand for Fume's drawing (no words twice). An edit in Check lands on the layers it carries
  and keeps the creative's others.
- **Demo.** The email header is a Story picture in a Story frame, its words at the top clear of the label, the logo
  reversed on the dark picture (as LYSNE's design system asks).

#### Open

- Check draws changed layers in its own plain type, not yet the brand's typefaces and shade.
- The live backend keeps layers as given, but its Send to check still sends all of them (`api/live/production.ts`).
- Moving a layer by dragging it on the canvas; for now X, Y and W are typed.
- An eye-off and an unlocked icon: the hidden eye is dimmed. A new icon goes to Fume-Brand first.

### 35.6 The brand books are open and the brand's own

Marcus watched the round 14 walkthrough and asked about the brand books (9 Nov): "Confusing: what is the difference
between Design system and Brand DNA? Logo is in both? Are the components hard-coded? Can the Engine add components to
the design system? Like drop badge, and make a 'Wheel'…" and, of the Tone of Voice, "Can you add more blocks? Or only
control the four?" The pattern behind both: hard-coded structures should be open and the brand's own. Everything here
is an addition to the contract (new optional fields, one new call), so the live wiring of today's books still holds.

#### Brand DNA and the design system, apart
- **One line on each page says what it is for.** Brand DNA: "LYSNE's facts and files, as found: the logo, colours,
  type, voice and pictures. The design system sets how creatives use them." The design system: "The rules for using
  LYSNE's Brand DNA in creatives. The Engine lays out every creative from it." (For the customer: "Your …".)
- **The logo is shown once as a file, once as a use.** Brand DNA's Logo part keeps the wordmark tiles (the files, with
  where Fume found them) and gains a way, "How creatives use it", to the design system's logo part. The design
  system's Logo (under Foundations) never shows the tiles again: it shows where the logo goes on each format, as small
  frames in the brand's ground with the wordmark at its place and width, then each version's use, the clear space, the
  smallest size and the rules. Its first line links back: "How a creative uses the logo. The file itself is in Brand
  DNA." The logo component is folded in here and is not listed again under Components.

#### The design system's components are the brand's own
- **Fume writes nine, the brand adds its own.** The nine the design engine places words with (headline, subline,
  body, call to action, price, badge, product name, small print, logo) keep their role (`DesignComponent.role`, or the
  role they are named by). The brand's people add components of their own under Components, each built from a base:
  text, button, badge, shape, image or logo (`DesignComponent.base`).
- **Adding one.** "Add a component" opens a small form on the card surface: Built from (a segmented control, one line
  on what that base is) and Name, then **Add the component**. A name that is taken says so ("There is a component
  called Headline already."). The new component starts in the brand's own tokens (the first fitting colour, style and
  spacing step it has) and the page glides to it, with "You added this" under its purpose.
- **Setting one.** Each component shows its settings as the brand's tokens only: Placed by (a role, or "A designer"),
  Style, Words, Ground or Fill (or None), Corners, Padding (the brand's spacing steps) and Size. Each is a native
  select, saved as it changes, with Undo in the toast. A brand-made component's name and the words in its preview are
  written in place like a line. The preview draws it live in the brand's colours and type, on the wall or on a
  photograph; the CSS tab shows it as code, and the book's CSS gains its class (`.brand .wheel`).
- **Taking one out.** The bin at a component's head takes it out; Undo puts it back where it was with its marks.
- **Who.** Fume's people edit the design system in place on a draft (as the Tone of Voice, §34.3); the first change on
  the version in use starts the next draft. The customer reads it and approves the version the expert checked.

#### The Engine proposes a component
- The Engine may propose a component from the brand's own material. It shows on the draft, in Components, as a panel
  on the card surface: "The Engine proposes this, from the set's offer story and 3 past offers", the component drawn
  live with its settings and rules, then why in one sentence and **Add it** / **Not now**. Words and depth, never a
  stroke, never Amber.
- **Add it** puts it into the draft as the last component, marked "You added this from the Engine's proposal"; the
  toast says "In version 2 now. It reaches creatives once the version is checked." with Undo. **Not now** sets it
  aside for this version. The check foot says "The Engine's proposal stays out of it unless you add it."
- A proposal never reaches a creative before it is added and its version is checked. It lives outside the book's body
  (`BookVersion.proposals`), so the design engine never reads it; the customer never sees one; once a version is
  checked, what was not added is gone. Seeded for LYSNE: **Wheel**, a round Burgundy offer mark ("25 % av").

#### The Tone of Voice's blocks are open
- How we speak holds as many blocks as the brand wants. **Add a block** at the end asks for its name ("Name the block";
  "What it means, a do and a don't come next."); the block appears with the cursor in its first line.
- A block's head has, on hover or focus, move up, move down and take out. Taking out has Undo, which puts the block
  back in its place with its changed lines still marked. Empty do and don't lines are hidden when reading.
- The Engine may suggest a block the same way as a component (seeded: **Giving**, "In the gift season we give time,
  never things."), with **Add it** / **Not now** on the draft.

#### The contract (additions only)
- `DesignComponent`: optional `role`, `base`, `sizePx`, `sample`; `name` also takes the brand's own names.
- `BookVersion.proposals?: BookProposal[]` (`component` or `block`, `why`, `from`, `state` open, added or set_aside).
- `BookEdit`: optional `item` (put a whole block in), `moveTo` (move it), `marks` (an undo's marks); `to: null` on a
  block path takes it out. Settings take words: a token's name, figures, or "none". `BookEditMark.proposal`.
- `answerBookProposal({ bookId, proposalId, answer: "add" | "not_now" | "open" })`; "open" is the undo of either.
  Fume's people only, on a draft only.
- One rule for the page, the mock and the server: `domain/designComponents.ts` (a role is held by one component, every
  setting is one of the brand's tokens, names are unique) and `domain/bookEdits.ts`.

### 35.7 One Engine, in one panel on the right

Marcus, on the video editor showing the Engine bar and a conversation at once: "Either or. Ideally the right side
should be a panel that can be opened and closed for the whole app, tied to the main Engine chat. With a choice of a
global session or a project session, so the thread continues the next time we come back to it." And on the plan:
"Every field should have a button where you can ask the Engine to write it. Then perhaps also open a chat (a mini chat
by the field, or the right-side panel with a reference to the field)."

Decided 10 Nov 2026 with the round (§36). Only Fume's people and an agency's designers have the
Engine. A customer never sees the panel, its button or a field's Engine buttons: customers talk to Fume, never to the
Engine (and neither does Fume's person while she looks through Customer view).

#### The Engine panel
- **One button, one panel.** The Engine's button sits at the end of the staff bar, before Search, and at the end of
  the Studio's top bar. It opens and closes a panel on the right; ⌘J (Ctrl+J off a Mac) does the same from anywhere.
  It stays open from page to page until she closes it, and opens as she left it next time, per person on this
  computer (a convenience; losing it only closes the panel).
- **The same conversation as the Engine page.** The panel is the Engine chat (§19), not a second chat: the same
  messages, widgets (products to tick, a question, the run, a creative, the creatives in Check) and composer. The
  Engine page is its full-screen view: the expand button opens it on the same thread (`?thread=campaign:c-winter`).
  On the Engine page itself the button and the panel step aside.
- **Threads.** One "Everything" thread per brand, and one thread per project: a campaign, or a Studio document. On a
  project's page the panel opens on that project's thread; the thread's name is the panel's title and a quiet switch
  to the others (Everything, this page's project, then every other thread, latest first, with how many turns it
  holds). A switch holds until she goes to another project's page, which opens its own thread again. A thread keeps
  its history, so coming back to a project continues it.
- **What the Engine sees.** One line of small chips under the title: the brand (Everything), what the page shows ("The
  plan", "Its creatives in review", "What waits in Check"), on the desk the picked version and the mode, on a video the
  picked shot or layer, the playhead while it stands still, the format and the mode, and the field she asked about.
  Each chip but the brand has an ×: she can leave it out. Nothing the Engine reads is hidden.
- **Under 1024 px** the panel floats over the page's right edge instead of narrowing it.

#### The Studio talks to the Engine in the panel
- **No Engine bar under the board, no conversation in the video's inspector.** Both are gone; their work goes through
  the panel, in the creative's own thread. The panel knows the open document (its name, version, mode; the video's
  playhead) and lends the desk's hands to the change card.
- **A change is still shown before it is kept.** She says what to change in the panel; the change lands on the board
  (a picture) or the timeline and the player (a video) as before, and the panel shows it as a card: each part of what
  she said, what it changed, and for a part it did not read, why and the change it would make if asked (Yes); Undo
  (Esc) and Keep and render (Enter) for a picture, Undo and Keep for a video. Once decided the card stays in the thread
  as one quiet line ("Kept, and rendered as a new version.", "Kept in the edit.", "Undone."), so the thread reads as a
  record. While a change waits and the panel is closed, the Engine button on the desk says "A change waits".
- **Render moved to the desk's top bar**, beside Make formats: it was the Engine bar's second button and must work
  with the panel closed. It saves the desk's changes first and waits while a version renders.
- **While the Engine fixes a creative from Check**, the lock bar (Wait · Take over) still lies under the board, and
  the panel's composer waits too.
- "Write a new instruction" on a version that did not render now opens the panel with its composer ready.

#### Write with Engine, and Ask about this
- **Two small buttons by each field** Fume's people may change: every line of the plan (the look, the products,
  formats and words), each master's scene and its words, and every line of a brand book that is edited in place
  (Editable, where Fume's people edit directly). On a desk they show with the row's hover and keyboard focus, like the
  plan's pencil; always on a touch screen.
- **Write with Engine** asks the Engine to write the field from what it knows (the brief, the plan, the Brand DNA, the
  Tone of Voice). While it writes, the field says "The Engine is writing the light" in the text shimmer. Its words come
  under the field, never in it: "The Engine suggests", the words, and what it wrote them from, with **Keep it** (saved
  as if she wrote it, through the field's own save, with its toast) and **Drop**. When it would not change a word, it
  says so ("The Engine would keep it as it is") with Close. The products, formats and language lines are facts it does
  not write; they have Ask about this only.
- **Ask about this** opens the panel on the page's thread with the field as context (a chip "Light · Winter gifting's
  plan"). Her message carries the field; in the thread it reads "About Light, in the plan" above her words. Asked to
  write ("Write it shorter"), the Engine answers with a card of its words for the field and **Put it by the field**,
  which puts them under the field to keep or drop there (and **Go to the field** from another page). Asked a question
  ("Is it on brand?"), it answers in words. The field leaves the context when she takes its chip off or leaves the page.

#### The contract (all new calls fall back to the mock until the live API has them)
- `engineChat(workspaceId, topic?)`: a thread's messages; no topic is Everything.
- `engineSay(workspaceId, text, { topic?, field? })`: her message in a campaign's thread, about a field.
- `engineThreads(workspaceId)`: Everything first, then the campaign and document threads, latest first.
- `engineWrite(field)`: the Engine's words for one field and what it wrote them from; nothing is saved.
- `EngineTopic` (campaign or document), `EngineThread`, `EngineField` (a plan line, a planned creative's scene or words,
  a book line by path), `EngineWriting`, and the widget `suggestion`. A document's thread is its Engine edits.

#### Defaults to confirm
- ⌘J for the panel; 360 px wide; closed until she first opens it.
- The panel's Everything thread follows the address's brand, else the person's current brand.
- Leaving a chip out lasts while she is on the page; it is not remembered.
- The mock writes in LYSNE's voice from a few lines per kind of field; live, the Engine writes with the brand's context.

## 36. Round 16 (9 Nov 2026; DECIDED 10 Nov 2026): Marcus's 11 comments on the round 15 walkthrough
Marcus watched the round 15 walkthrough and left 11 comments (9 Nov, evening). Under them lay four things. The design
studio must be a pro tool: the brand's choices first, but presets, previews and a value of her own always there, as in
Figma and OpenPencil ("designer har alltid siste ord"). The Engine must be at hand without opening its panel, and keep a
chat per web session while remembering earlier ones. "Noted for round 16" read as dropped: the video editor he described
in round 14 is built now (§36.4). And a button outside its card's padding should never reach him again: a test looks for
it.

**Decided.** Marcus approved the design rounds on 10 Nov 2026 ("Godkjent", after the round 16 walkthrough and the dev
thread's ask for a yes on the design PRs): §27, §29, §33 and §34 to §36, as the later rounds amended them, which is
what the branch of PR #13 holds (it contains #6, #8, #11 and #12; the brand books, #10, were wired live on 9 Nov). The
empty pages (#7) are not part of it. The defaults named in each section were shown in the walkthroughs and are decided
with them; the dev thread wires all of it live, statics and design first, video after.

### 36.1 The design studio as a pro tool
- **Size** is a number with presets, as in Figma's and OpenPencil's font size: the brand's sizes first (each named by
  its text style: "76 · Heading 1"), then a type scale (12 to 240). She types it, nudges it with the arrow keys (Shift
  for ten), drags its handle, or picks from the list; minus and plus step to the next preset. A size set by hand says
  so: "Set by hand; Heading 1 is 76 px."
- **Text style, Typeface and Weight** are lists that show each choice as itself: a style at its size and case, a typeface
  in its face, each weight in the layer's face at that weight, the value as data beside it ("Medium 500"). The closed
  field stays in the interface's type.
- **Fill** keeps the brand's colours first and ends with a plus: a colour of her own (a picker and a hex field). One not
  among the brand's shows as its own swatch, "Custom · #HEX", and its help says the design check counts it under
  Design system. Hers to choose.
- **Align is a box of nine places**, not tabs: top left to bottom right, inside the design system's safe area. On a layer
  (Position) it places the layer; words take the side's alignment. On the frame (Layout) it places the block of words,
  clear of a shown logo and call to action, the shade following. A layer between places marks none ("Between
  places"). Text alignment is its own three icons (Text align).
- **A layout grid** (Frame · Layout grid), as Figma's: shown and hidden from the panel, the board's rail, or Shift+G
  anywhere in Design. Templates per format: the brand's grid from its design system ("LYSNE's grid · 4:5", 6 columns,
  24 gutter, 72 margin), thirds, 4 and 12 columns (story: 4 and 6). Or her own values (columns, rows, gutter, margin):
  change one and the grid is hers ("Custom"). Columns are drawn as a light tint over the picture, a grid without
  gutters as lines. The grid lives in the creative's variables (`grid`, `gridCustom`); whether it shows and whether
  layers snap are remembered on this computer.
- **On the canvas** a layer is dragged with the mouse and snaps to the grid's columns, the safe area and the frame's
  middle, by its start, middle or end, within 8 px; the line it snapped to shows as a guide. Cmd held places it freely;
  Shift keeps it on one axis. The picked layer has a handle on each side for its width. The arrow keys nudge it a pixel,
  Shift ten. A locked layer only shows. Each drag is one undo step.
- **The letters beside X, Y, W and the grid's values are handles**: drag right or up for more, a step for every two
  pixels, Shift for ten. The field stays the keyboard's and the screen reader's control.
- **A hidden layer's eye is struck through** (eye-off), as well as going quiet; an unlocked layer's lock is open.
- **The section she works in stays open.** A panel's sections fold the one opened longest ago when they no longer fit
  (§9.1); now using a section (a press or focus inside it, its popovers too) also makes it the newest, so picking a
  colour of her own no longer folds Fill away under her.
- New icons, decided with the round: eye-off, lock-open, text-align-start, text-align-center, text-align-end.

### 36.2 The Engine at hand, and a chat per web session
- **"Tell the Engine" while the panel is closed.** In the Studio a field lies right under the board (under the player
  and its transport in Video), where the Engine bar was: "Tell the Engine what to change in Master 3 · Feed 4:5", with ⌘J beside it. It is the page's own thread's
  composer, with the same draft: sending opens the panel on that thread, where the answer and its change card are, and
  ⌘J opens it with what she has written. While the panel is open the field steps aside (one composer). While the Engine
  fixes the creative from Check, or a change waits for her, it says so and does not take more. In the staff frame the
  Engine button at the bar's end says "Tell the Engine" while the panel is closed.
- **A web session keeps its chat.** Within one session (this browser tab: a reload keeps it, leaving Fume ends it) the
  panel shows the conversation as it was. A new session starts each thread empty: "A new chat about Winter gifting. The
  Engine remembers your earlier chats about it."
- **Earlier chats are listed, and remembered.** At the top of the thread, under Earlier: one row per earlier chat, named
  by what it was about and the day ("The plan · Yesterday") with her first words under it; a row opens to read it. A
  chat is messages close in time from one part of the project: a new one begins after three quiet hours, or when she
  writes from another part. "Sees" carries "Your 2 earlier chats": the Engine reads them with what she asks, unless she
  takes the chip off. A Studio creative's thread works the same way with its changes; a change that still waits for her
  stays in the new chat, whenever it was asked for.
- **Asked back, it answers from them.** "What did we say about the hook?" gets "Yesterday, in the plan, you asked
  “Is the hook on brand?” I said: …", with its own words from then. Without the chip, it answers from this chat only
  (live wiring: the mock does not yet know the chip is off).
- **A change card takes the keyboard without covering its words.** When a change comes, Enter keeps it and Esc undoes
  it, as before; the Keep button's tooltip no longer opens over the change on that focus (a Tab to it still shows it).
- **For the dev thread:** an Engine message carries the part of the project it was written from (`page`, "The plan",
  "Tone of Voice"; `engineSay` takes it in `about`). The session's start is kept per thread in sessionStorage
  (`fume.engine.session`). Wiring the memory live means the Engine's context for a thread gets a summary of its earlier
  chats when the chip is on. The full-screen Engine page still shows a thread's whole history.

### 36.3 Nothing leaves its card
- The chosen "Goes to the Engine" pill sat past the comment card's padding (a negative margin meant to line up a quiet
  button's text). The comment's buttons now sit inside its padding.
- An end-to-end test (`e2e/layout.spec.ts`) looks, at 1440 × 900, for any button, link, field or tab whose box goes past
  the nearest ancestor that draws a surface, on Check (a comment answered, designs, video), the three studios, a plan
  (with the Engine open) and the brand books. What a scroller clips away is left out.

### 36.4 The video editor: tracks as layers, a storyboard of its own, and motion as After Effects has it (DECIDED 10 Nov 2026)

Marcus on the round 14 walkthrough: the storyboard need not sit where the timeline sits ("en egen side, med et board,
som dekker hele siden, litt som et lite figma canvas"); no manual motion control, no ease in and ease out numbers;
better controls, as in After Effects (transform, opacity, rotate) and text of its own (presets, typewriter); and on the
timeline: how many tracks, zoom across and up, markers, more audio tracks, more videos over each other, why the
captions lie under Main ("Tidslinjen sin høyde burde representere hva som er over hverandre, som layers"). Round 16
answers each. The editor stays CapCut-logical: one magnetic main track of shots, everything else on tracks above or
below it, Edit and Motion modes as before, one Engine panel (no chat in the editor), takes, Follows and the video's
Check as they were.

**The tracks are the frame's layers.** The timeline lists its tracks top to bottom in the order they lie in the frame:
Brand (the brand's components, such as the locked call to action and the end card), Captions, Text, the video tracks
over Main, then Main. Under a short "Audio" heading: Music, Effects, and Voice when there is one. The captions no
longer lie under Main. The player draws the tracks in the same order, so what is higher on the timeline is higher in
the frame. A track's head has a grip (drag it up or down, or Alt and the arrow keys), its name (click picks the track,
double-click renames), and its switches: the eye (hide) and the lock for a visual track; mute and solo ("S") for an
audio track. Its "…" menu has Rename, Move up, Move down and "Remove the track". A visual track never goes under the
audio, and Main cannot be removed. "+ Track" adds "Video, over the shots" (a video track straight over Main), "Text"
(over the top text track) or "Audio" (at the bottom), named by kind and number: "Video 2", "Text 2", "Audio 3". There
is no limit on the number of tracks. A picked track shows in the inspector with its name, its switches, Up, Down and
"Remove the track"; removing a track removes what lies on it.

**Things on one track never overlap.** As in CapCut, a thing that would lie over another goes on a track above it, so
the timeline's height always says what lies over what. A dragged caption, text layer, sound or clip stops against its
neighbour on the track; when there is no room near, it keeps its last place. Anything added at the playhead (a text
layer, a component, a text preset's line, a sound, an upload laid over the video) goes on the first free track of its
kind, and a new track is made above the others of its kind when none is free. The inspector's "Track" select offers
only the tracks where the thing's time is free.

**Moving things.** Every item except a shot can be dragged along its track and onto another track of its kind (words
on a text or brand track, captions on a captions track, sound on an audio track, a clip over the video on a video
track other than Main). Its ends snap to the playhead, the markers, the shots' cuts, the music's beats and the other
items' ends. A text layer that follows a shot follows the shot under its new start. A locked track's items do not
move. Shots stay magnetic on Main and are trimmed by their handles, as before.

**Zoom, height and markers.** The toolbar over the tracks has the two views (Timeline and Storyboard), "+ Track",
"Markers", and on the right the zoom (Zoom out, a slider, Zoom in, "Fit") and the tracks' height (S, M, L). Zoom goes
from the whole film across the width up to twelve times that, and keeps the moment under the pointer (or the
playhead) in place; ⌘ or Ctrl and the wheel zoom, = and − zoom from the keyboard, \ fits. The heads stick to the left
and the ruler to the top while the tracks scroll under them. M puts a marker at the playhead and picks it: the
inspector has its Name, its time ("At"), "Go to it" and "Remove". A marker is a small bookmark on the ruler with its
name beside it while it is picked; drag it along the ruler. The "Markers" menu adds one, goes to the one before (⌘⇧M)
or the next (⇧M), and lists them all. Delete or Backspace removes what is picked (not the music, not Main); Escape
lets go of it; Space plays and pauses.

**Video over video, and more sound.** In Uploads, each upload has a second button: lay it over the video at the
playhead. It lands on the top free video track over Main ("Video 2" is made when there is none), as a picture in
picture. The inspector has its picture, Size ("The whole frame" or "Picture in picture"), Opacity, and its timing
within the take. The library's new "Sounds" fold adds a sound at the playhead on an audio track other than the music's.

**The storyboard is a page of its own.** "Storyboard" (next to "Timeline" over the tracks) covers the whole desk with
a board, as a small Figma canvas: the player, the library and the inspector make way for it. The shots stand as cards
in sections, in the film's order: Hook, Story and End card by default (one section, Story, for a film of fewer than
three shots). A card shows the picture with its takes stacked behind it, the shot's number, its length and camera move,
a flag when the Engine found something, and the words on screen. Drag a card to another place or section and the film
changes with it; the first shot always starts on a cut. A picked card has "Earlier", "Later" and "Open in the edit"
(back to the timeline with the shot picked; a double-click does the same). Sections are added ("Section"), renamed (a
double-click on the name) and taken out (their shots join the section before). Notes can lie anywhere on the board:
the Note tool, then a click; drag one by its top; its × takes it away. The tools at the board's foot: Pointer (V),
Hand (H, or hold Space), Note (N), Section, the zoom with its per cent, and "Fit" (⇧1). The wheel pans; ⌘ or Ctrl and
the wheel zoom around the pointer. Undo works on the board as everywhere in the editor.

**Transform, as After Effects lays it out.** A text layer's inspector has a Transform fold: the anchor point (X and Y,
in per cent of the layer), then a row each for Position X, Position Y, Scale, Rotation and Opacity. Each row has its
stopwatch, its name and its value. Drag the name sideways to change the value (Shift for ten times, Alt for a tenth),
or type it; the arrow keys step it. The stopwatch off: the value is the layer's own, whatever the time. Turning it on
puts a key at the playhead with the value there; from then on a change puts a key where the playhead is. Turning it
off takes the keys out and keeps the value at the playhead. An animated row has the key navigator (the key before, a
key here or not, the key after) and the property's keys on a short track under it; press one to go to it.

**Easing with its numbers and its curve.** The Motion fold keeps In, While on and Out, and has an "Easing" part: the
brand's easings as choices (Soft out, Settle, In and out, Even), "Easy ease" as in After Effects, and the curve itself:
time across, progress up, with two handles to drag. Under it, the four numbers (x1, y1, x2, y2, as CSS writes them)
and After Effects' influence in per cent ("Ease out" of the first key, "Ease into" the next; Easy ease is 33 and 33).
A curve of her own reads "Custom". "Try it" runs a dot along the curve. A curve that goes past its mark and back is a
bounce: allowed, with the line "This curve goes past its mark and back: a bounce. LYSNE's motion never bounces, so
keep it only if you mean it."

**Text of its own: animators and presets.** A text layer's "Animate" fold has None and six animators: Typewriter, Fade
up by word, Blur in by letter, Slide up by line, Tracking in, Scale down by word. With one on: "By" (Letters, Words,
Lines), and a "Range" as After Effects' text animator has it: Start, End and Offset, which choose the units that move,
and "Over", the time from the layer's start until the last unit is in. An animator is the layer's way in while it is
on. The library has "Text presets": on the picked words, the preset goes on them; with nothing picked, it adds a line
at the playhead with the preset on. Motion mode's library shows Styles, Layers, Text presets and Brand; Edit mode's
shows Shots, Masters, Uploads, Brand, Text presets and Sounds. In Motion mode the text and brand tracks open into one
row per layer, and the captions row is hidden.

**Contract.** All optional, so an edit from before round 16 reads as it did (it gets the default tracks, and every
item lies on its kind's first track): `VideoEdit.tracks` (`VideoTrack`: id, kind brand, captions, text, video or
audio, name, hidden, locked, muted, solo), `VideoEdit.markers` (`VideoMarker`: id, at, name), `VideoEdit.overlays`
(`VideoOverlay`: a clip over the video with its takes, in, out, speed, start, track, size "full" or "inset", opacity),
`VideoEdit.board` (`Storyboard`: sections with their shots, and notes with their place); `trackId` on a motion layer,
a caption and a sound; on a motion layer `transform` (a property's value while its stopwatch is off), `anchor`,
`curve` (a cubic-bezier of her own) and `animate` (`TextAnimator`: preset, by, start, end, offset, over). The demo's
"Night ritual" has two markers ("Words in", "Product") and a board with a note.

**Defaults to confirm.** The track order front to back (Brand, Captions, Text, video tracks, Main; then Music,
Effects, Voice). Audio always under the visual tracks. The anchor point does not animate. An animator replaces the
layer's In. A bounce is allowed with a note rather than blocked. The board hides the player and the panels rather than
sharing the desk. Delete also removes shots and tracks, but never the music or Main. The demo plays no sound, so mute
and solo only dim their lanes. The four sounds in "Sounds" stand in for a real library.

**Open.** Precomps (a group of layers as one item, opened in its own timeline) are not built. The Timing sliders in
the inspector can still stretch a thing over its neighbour on the same track. The 3D track stays behind its flag.


## Words on the picture or in their own area — PROPOSED (12 Nov 2026)

Marcus, 12 Nov: “det burde være en egen variabel, om teksten skal stå på bildet, eller på eget design separat fra bildet”.
Each planned creative may set `words: on_picture | own_area`; absent means `on_picture` for older data. A Fume designer
can change this in Studio beside the graphic design ask; starting the design saves an override on that creative,
without editing the approved plan. `own_area` asks the Engine for a complete photograph, with no room-for-words or
room-calm checklist or room remake. The design puts the approved words in a separate area below the picture, coloured
from the brand's design tokens. The photo, words area and editable text remain separate layers in the `.fig`.
