# Fume app: architecture

Status: PROPOSED (14 Oct 2026). Drafted by Claude for Marcus. Nothing here is decided until Marcus approves it; where
a line rests on a decision that is already made, the decision is named (F-Dxxx, or the APPROVED document).

The architecture comes first and the UX follows from it: every screen in `app/` answers to an actor, an entity and a
state named here. The front end is built complete, on mock data behind a typed contract, before any backend work
starts. Backend work implements the contract (`app/src/contract/`) and never touches a screen.

Sources, highest first: Fume Source & Decision Register v0.4 (CURRENT), Product Definition v0.1 (APPROVED), Product
Execution Roadmap 2026 v1 (APPROVED, F-D029), Founding Design Partner Offer v0.1 (APPROVED), Business Model & GTM
v0.1 (APPROVED), Verbal Identity v0.1 (APPROVED), Product Vision, Architecture and Differentiation v0.1 (PROPOSED,
the richest architecture source), ICP v0.1 (PROPOSED), the design system v1 (DECIDED, F-D075) and the app demo on
the intro site (`website/src/partials/demo.html`).

---

## 1. What the app is

Fume owns the full path from creative request to approved, delivered and learned-from creative (Product Vision §1).
The customer buys an approved creative outcome inside an agreed scope and service level, not credits, prompts or seats
(Product Definition; F-D026). One sentence carries the whole product:

> The customer sees the decisions they need to make. Fume absorbs the production complexity.

So the app has three faces on one data model:

| Face | Who | What it is for | Release |
|---|---|---|---|
| **Workspace** | The customer's team | Teach Fume the brand, ask for work, make decisions, take deliveries | R0 → R3 |
| **Quality Gate** | Fume's experts | Check every creative before the customer sees it (F-D025) | R0 → R3 |
| **Operations** | Fume's operators and founders | Every customer, campaign, deadline, Engine run, cost and the quality log | R0 (lean) → R3 |

Operator Studio (models, prompts, seeds, masks, render branches) is an internal tool and its own later chapter
(Product Vision §4.7). This app links to it and shows its results; it does not rebuild it. The Engine itself, the
strategy agent and the evaluators live behind the contract as services.

### Principles (from APPROVED docs)
1. **One decision at a time; name the actor; show the status and the next action** (Roadmap UX principles; Verbal Identity).
2. **The customer never picks a model, reads a prompt or repairs a render** (Product Vision §4.1). No model names, seeds or candidates in the workspace.
3. **Every creative is checked by an expert before the customer sees it** (F-D025). **Only the customer approves** (F-D077).
4. **No creative exists outside a version chain**; a version and its approval are never silently overwritten (Roadmap §5.4, §11.3).
5. **Direction approval is a separate step from master approval**; masters are approved before Fume makes variants and formats (Product Definition §7; Product Vision §4.1).
6. **A correction is not a revision**: Fume's own fixes never use the customer's rounds (Product Definition Stage 8; BTL).
7. **Tenant separation, product evidence, lineage, review decisions, human final check and recovery are never cut** (Roadmap).
8. **Brand DNA shows what Fume understands, where it is unsure and what it needs**, never a static summary (Product Vision §4.2).
9. The workspace answers five questions (ICP, PROPOSED): what Fume needs, what is being made, what waits for a decision, what is approved, what Fume learned. Home is built on them.

---

## 2. Actors and roles

### People
| Role | Side | Can | Default name in the mock |
|---|---|---|---|
| **Owner** | Customer | Everything in the workspace: team, package, Brand DNA, campaigns, approval | Maja, Head of Marketing |
| **Approver** | Customer | Approve directions, creatives and the brief; request changes. The Offer asks for *one accountable approver* per campaign | Maja |
| **Member** | Customer | Write briefs, talk to Fume, comment and request changes, download approved creatives; cannot approve | Jonas, Performance Marketer |
| **Viewer** | Customer | See campaigns and deliveries | Ida, Finance |
| **Expert** | Fume | The Quality Gate: Mark checked, Request changes, Hold. Signs with real name and title (F-D040) | Anna, Designer (placeholder; Verbal Identity) |
| **Operator** | Fume | Runs the Engine for a campaign, plans scope, uploads replacements, releases checked work | Marcus |
| **Fume admin** | Fume | Operations: all workspaces, load by person, time and cost, quality log | Marcus, Kristian |

Customer roles map 1:1 onto the share dialog's roles that are already DECIDED in the design system (`share.css`:
Viewer, Can comment, Can approve) plus Owner. "Can approve" is the customer's right only.

### Non-human actors (they always speak under their own name; rule `name-the-actor`)
- **Fume**: the conversation partner (F-D040: no agent sub-brand, never "Fume Agent"). Forms the brief, asks what is missing, reports status, presents directions.
- **The Engine** (Fume Engine): plans, makes, evaluates and repairs creatives. Speaks with its own mark, never "I" (`message.css`).

---

## 3. Tenancy

```
Organisation ── Workspace (one brand) ── everything else
```

- **Organisation** is the paying customer. **Workspace** is one brand with its own Brand DNA, team and campaigns.
  v1 shows one workspace per organisation; the model has the level from day one so agency and multi-brand customers
  (Product Vision Mode 4) need no migration.
- Every record carries `workspaceId`. A user's access comes from a **Membership** (user × workspace × role). Fume's
  people have a **Staff** role across workspaces (expert, operator, admin) and see a workspace only through
  assignment or the admin role.
- Data boundary: customer data stays in its workspace (F-D018). Fume's learning across customers is a separate,
  anonymised record (later, LEGAL REVIEW).

---

## 4. Domains and entities

Eight domains. Names are the code names; the words on screen follow Verbal Identity (column "On screen").

### 4.1 Identity and workspace
| Entity | Key fields | On screen |
|---|---|---|
| `User` | id, name, title, email, avatar | the person |
| `Organisation` | id, name, package | (billing name) |
| `Workspace` | id, organisationId, brandName, brandMark, locale, market | the brand |
| `Membership` | userId, workspaceId, role (owner, approver, member, viewer) | Team |
| `Invitation` | email, role, invitedBy, state | Invite |
| `StaffAssignment` | userId, workspaceId, staffRole (expert, operator) | Your Fume team |

### 4.2 Brand DNA (customer word, F-D040; "Brand Brain" stays internal and never shows)
Brand DNA has four parts (Messaging v0.1): **Brand Rules, Product Truth, Taste Map, Creative Memory**. Every fact
carries where it came from, because the brand model separates known facts from inferences (Product Vision §4.2).

| Entity | Key fields |
|---|---|
| `BrandDna` | workspaceId, version, state (draft, in_review, approved), approvedBy, approvedAt, completeness |
| `BrandRule` | id, area (logo, colour, type, voice, layout, imagery, claims), statement, kind (rule, hard_constraint, preference), source, confidence |
| `Product` | id, name, variant, sku, state (draft, needs_you, verified), images, facts |
| `ProductFact` | id, productId, area (shape, colour, material, label, packaging, claim, never), statement, source, confidence, verifiedBy |
| `Reference` | id, image, verdict (liked, disliked), note |
| `TastePair` | id, a, b, chosen, reason |
| `MemoryEntry` | id, kind (approved, rejected, changed, caught), creativeId, lesson, at |
| `SourceAsset` | id, kind (logo, guideline, packshot, campaign, font, other), name, size, uploadedBy |
| `Understanding` | the comprehension check: summary, conflicts, unknowns, test directions, the customer's answers, version |

`source` is one of: `supplied` (the customer gave it), `verified` (the customer confirmed it), `inferred` (Fume read
it from earlier work), `learned` (from the customer's decisions), `campaign` (true for one campaign only). The UI
shows it on every fact, and `unknown` facts become questions in "What Fume needs".

### 4.3 Package and scope
| Entity | Key fields |
|---|---|
| `Package` | kind (launch, core, growth), creativeCap (18, 27, 54), directionRounds, productionRounds, cycle period, price (EXPERIMENT, internal only) |
| `Usage` | creativesUsed, campaignsActive, roundsUsed per campaign |
| `ServiceClock` | campaignId, stage (directions, masters, variants), dueAt, state (running, paused_waiting_on_you, met, missed), pausedReason |

The Offer's SLAs drive the clock: directions within 5 business days of a complete brief (3 on Growth), masters within
5 days of direction approval, variants within 3 days; the clock stops while Fume waits for the customer, and the
customer gives feedback within 2 business days. The customer sees dates and "waiting on you", never hours.

### 4.4 Campaign (the customer's word for the order; Verbal Identity)
| Entity | Key fields |
|---|---|
| `Campaign` | id, workspaceId, name, productIds, state (§5.1), approverId, channels, formats, market, language, dueAt, createdBy |
| `Brief` | campaignId, version, state (drafting, ready, approved), objective, audience, offer, message, mandatory, never, channels, formats, references, missing[] |
| `Direction` | id, campaignId, letter (A, B, C), name, insight, hook, message, visualIdea, whyItFits, risks, plannedOutputs, cover, state (§5.3) |
| `Master` | id, directionId, name, versions |
| `Creative` | id, campaignId, directionId, masterId (null for a master itself), kind (master, variant), format (feed 4:5, square 1:1, story 9:16), channel, name, currentVersionId |
| `CreativeVersion` | id, creativeId, number, image, width, height, state (§5.2), madeAt, lineageRef (internal), checkId, decisionId |

Formats come from the Offer: 1:1, 4:5, 9:16 (the design system also carries Banner 1.91:1 for later). Creative names
follow the delivery naming (`brand_campaign_direction_master_variant_format_v#`).

### 4.5 Production (the Engine)
| Entity | Key fields |
|---|---|
| `EngineRun` | id, campaignId, purpose (directions, masters, variants, correction), state (queued, running, paused, failed, done), steps[], made, total, startedAt |
| `EngineStep` | label, state (pending, active, done, waiting, paused, stopped, failed), detail |
| `Lineage` | internal: provider, model, prompt, seed, references, repairs, cost. Never sent to the workspace (Roadmap §8.2) |

The workspace sees an Engine run as the `run.css` card: steps in words, "4 of 9" as data, creatives sharpening in.

### 4.6 Quality Gate
| Entity | Key fields |
|---|---|
| `Check` | id, creativeVersionId, expertId, state (waiting, in_check, checked, changes_requested, held), items[], notes[], startedAt, checkedAt |
| `CheckItem` | area (product truth, brand rules, claims, channel, artifacts, naming), label, result (pass, note), noteId |
| `CheckNote` | id, number, x, y (pin on the creative, 0–1), text, author, at, resolved |
| `QualityLogEntry` | id, checkId, severity (critical, major, minor), what, fixed, at |

The gate list is the Roadmap's §11.2 list. Each checklist item is checked against the workspace's Product Truth and
Brand Rules, so a check always names what it was checked against.

### 4.7 Review and decisions (the customer)
| Entity | Key fields |
|---|---|
| `Decision` | id, subject (brief, direction, creative), subjectId, versionId, by, verdict (approved, changes_requested, passed), reason, tags[], at |
| `ChangeRequest` | id, creativeVersionId, by, pins[] (x, y, text), tags[] (product, colour, text, composition, mood, other), text, state (open, in_progress, done), isCorrection (Fume's fault, does not use a round) |
| `Comment` | id, subject, by, text, at |

### 4.8 Delivery, conversation and record
| Entity | Key fields |
|---|---|
| `Delivery` | id, campaignId, creativeVersionIds, state (preparing, ready, downloaded, confirmed_live), rightsNote, createdAt |
| `Thread` / `Message` | the conversation with Fume per campaign (and one general thread): author (person, fume, engine), text, attachments, cards (brief, directions, run, decision) |
| `Notification` | id, userId, kind, text, subject, read, at |
| `RecordEvent` | append-only: who did what to which version, when. The record behind "who checked and who approved each creative" (Marcus 3 Oct, from R1) |

---

## 5. State machines

### 5.1 Campaign (order states, DECIDED in the Roadmap)
```
draft ─► awaiting_input ─► scoped ─► in_production ─► in_review ─► approved ─► delivered ─► closed
                ▲                          ▲   │            │
                └──────── (Fume needs something) ◄──────────┘ revision ◄─┘
```
| State | Means | Customer sees | Next action shown |
|---|---|---|---|
| `draft` | The brief is being formed with Fume | Drafting the brief | Continue with Fume |
| `awaiting_input` | Fume needs something from the customer; the service clock is paused | **Waiting on you** | Answer Fume |
| `scoped` | Brief approved, scope and dates set | Brief approved · directions by 21 Oct | (none, Fume works) |
| `in_production` | The Engine and the expert are working | In production | (none) |
| `in_review` | Checked work waits for the customer | **Ready for you** | Review |
| `revision` | The customer asked for changes; Fume is making them | Changes under way | (none) |
| `approved` | Every creative in scope is approved | Approved | Get the delivery |
| `delivered` | The delivery is ready or taken | Delivered | Download · confirm it is live |
| `closed` | Done, learning recorded | Closed | Start the next campaign |

A campaign moves through `in_production → in_review` more than once: once for directions, once for masters, once
for variants and formats. Its **stage** (`brief`, `directions`, `masters`, `variants`, `delivery`) is a second field,
so "In review · masters" is exact and the four-step strip of the app demo (brief, Engine, check, approve) reads from it.

### 5.2 Creative version (where the Quality Gate lives)
The order states have no check state (Fact Brief conflict 5). Proposal: the check is a state of each **creative
version**, not of the campaign. The campaign stays `in_production` while its creatives are in check, and becomes
`in_review` when the operator releases a checked set to the customer.

```
making ─► in_check ─► checked ─► approved ─► delivered        the main line
in_check ─► correcting ─► in_check                             expert: Request changes (Fume's own fix, no round used)
in_check ─► held ─► in_check                                   expert: Hold (stops it; the customer sees why)
checked ─► changes_requested ─► new version ─► making          customer: Request changes (uses a round)
```

| State | Seen by | Words on screen (Verbal Identity; F-D077) | Check mark (F-D069, rule check-states) |
|---|---|---|---|
| `making` | Fume only | The Engine is making it | (skeleton) |
| `in_check` | Fume; the customer only as a count | In check | grey triangle |
| `correcting` | Fume; the customer as a count | Anna is fixing it | grey triangle |
| `held` | Both | Held back. Anna is fixing it, and the corrected version will be in review today. | grey triangle |
| `checked` | Both | Checked by Anna · 14:26 | **Amber triangle** |
| `changes_requested` | Both | You asked for changes | grey, with the request |
| `approved` | Both | Approved by Maja · Checked by Anna | Amber triangle |
| `delivered` | Both | In the delivery | Amber triangle |

The customer never sees a creative before it is `checked` (F-D025). Amber appears only on checked work.

### 5.3 Direction
`proposed → chosen | passed`. A campaign shows three directions (Offer: 3 directions, 1 route); the customer
chooses one with a reason, or tells Fume why none fits (a new direction round, counted against `directionRounds`).

### 5.4 Brand DNA
`draft → in_review → approved (v1) → updated (v2 draft) …`. The first approval is the end of onboarding. A change
after that is a new version the customer approves; the old version stays readable. A campaign records which Brand
DNA version it was made and checked against.

---

## 6. The flows

### 6.1 Onboarding (Roadmap: account, brand, product; the comprehension check)
1. **Sign in** (Google or email link) → **Welcome to Fume, LYSNE** (`onboard.css`, three steps).
2. **Add your Brand DNA**: website address, guidelines, logos, earlier campaigns (dropzone). Fume reads them.
3. **Products**: add a product (URL, upload, manual); Fume extracts the Product Truth; **you verify every line** before production (Product Vision §4.3: "a URL scraper alone does not establish product truth").
4. **Show what Fume understood** (the comprehension check): Fume's summary, conflicts, what it does not know, then three deliberately different test directions; the customer picks, rejects and says why; Fume updates. The customer **approves Brand DNA v1**.
5. **Invite your team**, with roles; name the approver.
6. **Write your first brief** → the campaign flow.

### 6.2 A campaign (the core loop; the app demo's four steps)
1. **Tell Fume what you need** (composer). Fume asks one question at a time ("Which market is this for? It decides the language and the claims we can use.") and shows what is missing.
2. **The brief**: Fume shows the brief card; the approver approves it or changes a line. Scope and dates are set (`scoped`).
3. **Directions**: the Engine makes directions; Anna checks them; the customer gets "Three directions are ready. Pick one to take forward, or tell us why none fits." Each direction card shows the idea, the hook, why it fits the brand and what it will make (strategy agent output, Product Vision §4.5).
4. **Masters**: the Engine makes masters on the chosen direction (run card), every master goes through the Quality Gate, the customer reviews checked masters, approves or asks for changes with pins.
5. **Variants and formats**: only after masters are approved; same gate, same review, usually in bulk ("Approve 3").
6. **Delivery**: approved creatives grouped by direction, master, variant and format, named, with the rights note; download all or by format; confirm when it is live.
7. **Learning**: what was approved, changed and caught goes into Creative Memory; the next campaign starts from it.

### 6.3 The Quality Gate (Anna)
Queue (by deadline and risk) → open a creative (`qg-review.css`): the creative large, the format switch, the Brand
DNA checklist against the Product Truth, pins for notes → **Mark checked** (C) or **Request changes** (R) or **Hold**
→ next creative (arrow keys). Toast: "Checked. Maja can approve it now." The record keeps who, when and against which
Brand DNA version.

### 6.4 A change request (the customer)
In review, press the creative to drop a pin, write what is off, pick a tag. Fume says whether it uses a round
("This uses round 1 of 2") or is Fume's own correction ("This one is on us; it does not use a round"). The new
version goes through the Quality Gate again before the customer sees it.

---

## 7. Information architecture

### 7.1 Workspace (app.fumecreatives.com, PROPOSED host)
The Roadmap's DECIDED v1 navigation is Home, Fume, Brand & Product, Orders, Review, Deliveries. With the customer
words (Verbal Identity: Campaign; F-D040: Brand DNA, Fume) that becomes:

| Nav | Route | What it answers |
|---|---|---|
| **Home** | `/` | What waits for you, what is being made, what Fume needs, what was approved and delivered, what Fume learned |
| **Fume** | `/fume` | The conversation: ask for work, ask about status; one thread per campaign plus a general one |
| **Campaigns** | `/campaigns`, `/campaigns/:id` | Every campaign with its state, stage and date; inside, the brief, directions, creatives, run, record |
| **Review** | `/review`, `/review/:campaignId` | Everything waiting for your decision, one decision at a time |
| **Deliveries** | `/deliveries`, `/deliveries/:id` | Approved creatives ready to take, by campaign, direction and format |
| **Brand DNA** | `/brand`, `/brand/rules`, `/brand/products/:id`, `/brand/taste`, `/brand/memory` | What Fume knows, where it is unsure, what it needs |
| Settings (footer) | `/settings/:page` | Workspace, team, package and usage, notifications, profile |

Plus everywhere: the notification bell, the command palette (⌘K), the creative viewer (`/c/:creativeId` overlay),
the share dialog. First run: `/welcome`, `/welcome/:step`.

### 7.2 Quality Gate and Operations (same app, staff roles; `/studio/...`)
| Nav | Route | For |
|---|---|---|
| **Queue** | `/studio` | The expert's creatives in check, by due date and risk |
| **Check** | `/studio/check/:versionId` | The Quality Gate review screen |
| **Campaigns** | `/studio/campaigns`, `/studio/campaigns/:id` | Every campaign across workspaces, its stage, clock, runs, who is on it; release checked work |
| **Workspaces** | `/studio/workspaces/:id` | One customer: Brand DNA state, team, package and usage |
| **Quality log** | `/studio/quality` | What was caught, by severity, fixed or not |
| **Team load** | `/studio/team` | Load per expert and operator (4 Core-equivalents each, Business Model) and time and cost |

Fume's people switch between Studio and a customer's workspace from the workspace switcher; they see a workspace the
way its customer does, marked "Fume view".

---

## 8. Front end

Decided by Marcus 14 Oct: **React + TypeScript**.

```
app/
  ARCHITECTURE.md        this document; FLOWS.md, the screens and flows by round of decisions
  index.html, vite.config.ts, tsconfig.json, package.json, vercel.json, middleware.ts (the preview's password)
  src/
    contract/            the data contract, one file per domain: entities/, views/ (what a screen reads), api/ (the
                         FumeApi interface, one interface per domain), events.ts, errors.ts. No React.
    mock/                the mock backend: the seeded LYSNE workspace in memory, with a simulated Engine and Quality Gate
    api/                 client.tsx builds the FumeApi the app uses (today always the mock); hooks.ts, the React Query
                         hooks every screen reads and writes through
    shell/               the frames: workspace, studio and agency sidebars, page, notifications, who is signed in
    features/            one folder per domain: brand, products, campaigns, plan, review, deliveries, fume, studio, check,
                         agency, onboarding, settings …
    copy/                sentences the customer reads more than once, checked by the gate's copy rules
    lib/                 small helpers with no React and no data (time)
  test/                  vitest: the mock behind the contract
  e2e/                   Playwright: the main flows clicked through in a browser, per role
```

Rules for the code:
- **Styles come only from the design system.** `app/` loads `design-system/` CSS (tokens, ui.css, components) as it
  is and adds no colours, sizes or radii. Layout glue for a screen uses `--ui-*` tokens only. CI runs the brand rule
  gate on the design system and `@fume/ui` (`npm run gate`); `app/` is not gated yet. Components keep the markup
  their CSS header documents.
- **Screens never fetch.** A screen reads data through `api/` hooks typed by `contract/`. Swapping the mock for the
  real backend happens in `api/client.tsx` and nowhere else (`docs/WIRING.md`).
- **Words follow the brand's copy rules** (say-creative, expert-checks, name-the-actor, words-avoid, no-exclamation;
  `fume_check` on the Fume Brand connector). Sentences used in more than one place live in `copy/`.
- **The main flows run in CI**: the Playwright tests in `e2e/` click through each role at 1440 px and fail on any
  console error. Desktop comes first; the phone layout follows later.
- Accessibility: every interactive part from the design system already has its keyboard behaviour and ARIA; React
  components keep it.

---

## 9. The data contract (what backend implements)

`app/src/contract/` is the whole surface: `FumeApi` (in `api/index.ts`) extends one interface per domain
(`IdentityApi`, `BrandApi`, `CampaignsApi`, `PlanApi`, `QualityApi`, `ReviewApi`, `DeliveryApi`, `AgencyApi` …), each in
its own file next to that domain's entities and views. Every call is scoped to the signed-in user's workspace and
checked against their role on the server. The table is the overview; the files are the truth.

| Group | Calls |
|---|---|
| Session | `me()`, `workspaces()`, `switchWorkspace(id)` |
| Home | `home()` → waiting on you, in production, Fume needs, recently approved, deliveries, learned, usage |
| Brand DNA | `brandDna()`, `updateRule()`, `products()`, `product(id)`, `verifyFact()`, `correctFact()`, `addReference()`, `chooseTastePair()`, `understanding()`, `answerUnderstanding()`, `approveBrandDna()`, `uploadSourceAssets()` |
| Campaigns | `campaigns(filter)`, `campaign(id)`, `brief(campaignId)`, `approveBrief()`, `changeBrief()`, `directions()`, `chooseDirection()`, `passDirections()`, `creatives(campaignId, filter)`, `creative(id)`, `runs(campaignId)` |
| Review | `reviewQueue()`, `approve(versionIds)`, `requestChanges(versionId, pins, tags, text)`, `comment()` |
| Deliveries | `deliveries()`, `delivery(id)`, `downloadUrl(deliveryId, format?)`, `confirmLive()` |
| Fume | `threads()`, `messages(threadId)`, `send(threadId, text, attachments)`; replies stream as events |
| Team | `members()`, `invite(email, role)`, `changeRole()`, `remove()`, `setApprover(campaignId, userId)` |
| Notifications | `notifications()`, `markRead()` |
| Studio | `checkQueue()`, `check(versionId)`, `markChecked()`, `requestCorrection()`, `hold()`, `addNote()`, `release(campaignId, versionIds)`, `studioCampaigns()`, `qualityLog()`, `teamLoad()` |
| Events | `subscribe(handler)`: `run.progress`, `version.state`, `message.new`, `notification.new`, `campaign.state` |

The mock implements all of it in memory with a believable timeline (an Engine run that makes creatives one by one, a
check that lands), so every screen can be designed in every state: empty, loading, in progress, waiting on you,
error, done.

---

## 10. Releases (Roadmap R0–R3) and the screens they need

| Release | Date (Roadmap) | Workspace | Quality Gate / Operations |
|---|---|---|---|
| R0 internal slice | weeks 2–3 | Home, Fume (brief), campaign, directions, review, delivery; Brand DNA read and verify | Queue, check, release |
| R1 founder alpha | ~6 Nov | + first run, comprehension check, team and roles, notifications, the record | + campaigns across workspaces |
| R2 pilot beta | week 8 | + change requests with pins, rounds, service clock, deliveries by format | + quality log, team load, time and cost |
| R3 limited availability | ~21–24 Dec | + settings, package and usage, share | everything above, hardened |

The UX in `app/` is built complete for R3 now, so backend work can follow the releases without design work.

---

## 11. Choices made here that Marcus has not decided (PROPOSED defaults)
1. The check is a state of each creative version; the campaign states stay as DECIDED (§5.2).
2. The customer never sees a creative before it is checked, including directions.
3. Navigation: Home, Fume, Campaigns, Review, Deliveries, Brand DNA; Settings in the footer.
4. Studio lives in the same app under `/studio` for Fume's people.
5. Organisation → Workspace in the data model from day one.
6. The expert can Hold a creative; the customer sees it as "Held back. Anna is fixing it."
7. Fume's own corrections never use a round; the app says which kind a change is.
8. Mock names: LYSNE (demo brand), Maja (approver), Jonas (member), Anna (expert, placeholder).

## 12. Open questions (asked one at a time)
1. Who is the expert on screen at launch: Marcus as Designer, Tore, or someone else? (F-D040 needs a real name and title.)
2. Is there ever a tier without the expert check (F-O016)? The architecture assumes no.
3. Which delivery destination after download comes first: Drive, Dropbox, Figma or Canva?
4. Host: app.fumecreatives.com?
