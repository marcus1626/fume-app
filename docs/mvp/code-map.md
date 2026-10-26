# Code map for the internal MVP

Status: written 26 Oct 2026 for the internal MVP week (plan: "Fume — Internal MVP Execution Plan — 26–30 October
2026", Google Doc). It describes `main` at `b7b340a` (cleanup PR #1 merged). The mock is being flattened in a separate
pull request; line numbers below will move, the shape will not.

## 1. Build status

| Step | Result |
| --- | --- |
| `npm ci` (root and `app/`) | OK |
| `npm run check` (lint, format, typecheck, unit tests, brand gate) | see the build log in `docs/mvp/README.md` |
| `cd app && npm run e2e` (8 Playwright specs, one per role) | see the build log |

## 2. Entry points

| File | What it is |
| --- | --- |
| `app/src/main.tsx` | Mounts React, the query client and the router. |
| `app/src/App.tsx` | Every route. Three frames: the customer workspace (`/`), Fume's studio (`/studio/...` and `/studio/b/:ws/...`), the agency (`/agency/...`). |
| `app/src/api/client.tsx` | Builds the one `FumeApi` the app uses. Today always `createMockApi()`; reads `?as=` to sign in as a demo person. This is the only switch to a real backend. |
| `app/src/api/hooks.ts` | 279 React Query hooks, one per contract call. Every mutation invalidates every query (fine for the mock; events will replace it). |
| `app/src/contract/` | The seam: `entities/`, `views/`, `api/` (15 domain interfaces, about 170 calls), `events.ts`, `errors.ts`. |
| `app/src/mock/` | The in-memory LYSNE world, one module per domain (`campaigns.ts`, `production.ts`, `delivery.ts`, …) with its data in `seed/`. About 16,800 lines. |
| `app/src/domain/` | The rules as pure functions (`permissions.ts`, `creatives.ts`, `plan.ts`, `products.ts`, `dates.ts`), used by the mock; the database commands must agree with them. |
| `app/test/` | Vitest: the domain rules, and a golden master of every `FumeApi` call against the mock (`test/golden/`). |
| `app/e2e/` | Playwright, one spec per role: `maja` (approver), `jonas` (member), `ida` (viewer), `anna` (expert), `nora` (agency), `agency-client`, `client-link`, `first-run`. |

## 3. The MVP cycle, screen to operation

The week's cycle (one brand, one product, one campaign, one master, a small family) traced through the screens that
exist today. "Who" is the role that does it; "Call" is the contract call the screen makes.

| # | Step | Who | Screen (route) | Hook → call |
| --- | --- | --- | --- | --- |
| 1 | Sign in | everyone | none yet; the mock picks a person from `?as=` | `useSession` → `session()` |
| 2 | Register the product and its facts | customer / operator | Brand → Products (`/brand/products/:id`), Product check (`/check/products`) | `useProduct`, `useVerifyFact`, `useCorrectFact`, `useVerifyProduct`, `useUploadShot` → `product()`, `verifyFact()`, `correctFact()`, `verifyProduct()`, `uploadShot()` |
| 3 | Write and send the brief | customer | New campaign (`/campaigns/new`), Brief tab | `useOrderBrief`, `useSendBrief`, `useChangeBrief` → `orderBrief()`, `sendBrief()`, `changeBrief()` |
| 4 | Fume writes the plan | Fume (LLM) + operator | Plan tab, staff plan (`/studio/b/:ws/campaigns/:id/plan`) | `usePlan`, `useChangePlan`, `useChoosePlanDirection` → `plan()`, `changePlan()`, `choosePlanDirection()` |
| 5 | Expert checks the plan (optional, FLOWS §26.2) | expert | Check → Plans tab (`/studio/qa`), staff plan | `useAskPlanCheck`, `useCheckPlan` → `askPlanCheck()`, `checkPlan()` |
| 6 | Customer approves the plan | approver | Plan tab | `useApprovePlan`, `useUndoApprovePlan` → `approvePlan(campaignId)`, `undoApprovePlan()` |
| 7 | Produce the master (Engine or manual) | operator | Studio desk (`/studio/b/:ws/studio`, `/studio/doc/:id`); older session desk (`/studio/b/:ws/studio/session/:id`) | `useOpenDocument`, `useRender`, `usePickVersion`, `useDocumentToCheck` → `openDocument()`, `render()`, `pickVersion()`, `documentToCheck()`; or `startBatch()` |
| 8 | Expert checks the creative | expert | Check → Images (`/studio/qa`) | `useQaQueue`, `useQaCheck`, `useQaFeedback`, `useQaToStudio` → `qaQueue()`, `qaCheck()`, `qaFeedback()`, `qaToStudio()` |
| 9 | Send checked work to the customer | operator | Staff Campaigns (`/studio/campaigns`) | `useRelease` → `release(campaignId)` |
| 10 | Customer reviews: approve or ask for changes | approver | Review (`/review`, `/review/:campaignId`), viewer (`/review/:campaignId/c/:creativeId`) | `useApprove`, `useUnapprove`, `useAddReviewComment`, `useSendChanges` → `approve(versionIds)`, `unapprove()`, `addReviewComment()`, `requestChangeRound()` |
| 11 | New version after a change | operator → expert | Check → Studio → Check (`qaToStudio`, `documentToCheck`) | as 7–8 |
| 12 | Variants and formats from the approved master | operator | Studio desk → Formats | `useMakeFormats` → `makeFormats(documentId, placementIds)` |
| 13 | Make the delivery and download | customer / operator | Campaign → Delivery tab, Deliveries (`/deliveries/:id`) | `useMakeDelivery`, `useDeliveryDownload`, `useConfirmLive` → `makeDelivery()`, `downloadUrl()`, `confirmLive()` |

Every step has a screen. No new screen is needed for the MVP cycle.

## 4. What the backend must replace (mock dependencies)

These live only in the browser today. Each is something the server has to own for the week's acceptance script.

| Today (mock) | Why it matters for the MVP | Where |
| --- | --- | --- |
| Identity from `?as=` and `signInAs()` | No real sign-in; anyone is anyone. | `api/client.tsx`, `shell/people.ts` |
| Role checks (`canApprove`, `canCheckPlan`, …) run in the browser | Access must be enforced on the server (plan, Tue §1). | `domain/permissions.ts`, `domain/creatives.ts` |
| Engine runs, batches and "fixes" on `setInterval` | A job dies with the tab; the plan needs jobs that survive a closed browser (Wed §3). | `mock/production.ts` `startBatch` |
| Uploads take `{ name, bytes }` only | No file is stored; the MVP needs private storage and signed URLs. | `uploadShot`, `uploadSourceAssets`, `uploadProductFile` |
| `downloadUrl()` returns a picture address | Must be a signed URL to exactly the approved file. | `mock/delivery.ts` |
| Record events pushed into an array | The history behind "who checked and who approved". | `db.record` |

## 5. Gaps between the contract and the MVP rules

What the contract cannot express today. These become contract changes (contract, mock and screens together, per
`AGENTS.md`), kept to the minimum the cycle needs. Details and the rule each one serves: `domain-model.md`.

1. **Two check models.** `Check` (per version, `checkQueue`/`markChecked`) and `QaItem` (per creative, `qaQueue`/
   `qaCheck`) both exist; the screens use `QaItem`. The MVP needs one `ExpertCheck` tied to one `CreativeVersion`.
2. **Delivery points at creatives, not versions.** `Delivery.creativeIds`. The plan requires the delivery to name the
   exact approved version (and its file).
3. **Plan approval has no version.** `approvePlan(campaignId)` approves whatever is current, so a stale screen can
   approve a newer plan it never saw. Needs `approvePlan(campaignId, version)` and a `conflict` on mismatch.
4. **No production job in the contract.** `EngineRun`, `Batch`, `StudioSession` and `CreativeDocument` all describe
   making things; none records attempts, provider, inputs, cost or an idempotency key. The MVP needs `ProductionJob` +
   `JobAttempt` + `ContextSnapshot` behind the existing desk and run cards.
5. **No manual candidate.** Nothing lets an operator upload an image they made elsewhere as a candidate with its
   provenance (Tue §3).
6. **Product evidence does not block anything.** `ProductFact.verifiedBy` exists, but no call refuses production when
   a required fact is unverified.
7. **No idempotency.** Repeating `approve`, `markChecked` or a production start creates a second decision or job.
8. **Change classification is a tag.** `requestChanges` infers "correction" from the `product` tag; the plan wants an
   explicit cause (correction, revision, changed brief) recorded before production continues.

## 6. Reuse

- The contract's entities already carry most of the ontology (Workspace, Membership, StaffAssignment, Product,
  ProductFact with source, Campaign, Brief with version, CampaignPlan with version and notes, Creative with a version
  chain, Check with items against Product Truth and Brand Rules, Decision, Delivery, RecordEvent).
- The rules the mock keeps (only checked versions can be approved; only the customer approves; a change request makes
  a new version in `making`; Fume's corrections use no round) are the server's rules. Once the other pull request
  moves them into `app/src/domain/`, the server imports them.
- The screens need no redesign for the cycle; the work is behind the seam.
