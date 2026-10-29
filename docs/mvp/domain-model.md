# Minimum domain model, transitions and negative tests

Status: PROPOSED by Claude, 26 Oct 2026, for the internal MVP week. Marcus decides. It reconciles the MVP plan's
"minimum objects" with the existing contract (`app/src/contract/`) so no agent has to invent a meaning or a rule.
Where this document and a DECIDED line in `app/FLOWS.md` disagree, FLOWS wins and this document is fixed.

Principle: the relational database is the knowledge graph. Objects are rows, typed relationships are foreign keys,
facts and decisions are rows with who, when and against which version. No graph database or rule language this week.
The LLM proposes; a domain command validates schema, access and rules, then writes.

## 1. Objects (plan name → contract name)

`New` marks what the contract does not have yet. Everything else exists in `app/src/contract/entities/`.

| Plan object | Contract | MVP note |
| --- | --- | --- |
| Organisation, Workspace, User, Membership, StaffAssignment | same names (`identity.ts`) | Membership role: owner, approver, member, viewer. Staff role: designer, account_manager, admin; a person may hold several, and a designer may carry the right to check (DECIDED 26 Oct). |
| Source, Asset | `SourceAsset` (`brand.ts`), `ProductFile` (`products.ts`) | Must hold a real stored file (bucket path, checksum, uploader). |
| BrandProfileVersion, BrandRule | `BrandDna` (version, state), `BrandRule` | A campaign records which Brand DNA version it used. |
| Product, ProductTruthVersion, FactAssertion | `Product`, `ProductFact` (source, confidence, verifiedBy) | MVP: a fact's `source` = `verified` means a named person confirmed it. `required` is **New** (which facts production depends on). |
| Campaign, BriefVersion | `Campaign`, `Brief` (version, state) | Brief versions are kept, never overwritten. |
| Direction, PlanVersion, Scope | `PlanDirection`, `CampaignPlan` (version, state, briefVersion, versions[]) | Plan approval names the plan version (**gap 3**, closed 27 Oct: `approvePlan(campaignId, version)`; a newer version is a conflict). |
| ProductionJob, JobAttempt | `EngineRun` / `Batch` (no attempts) | **New** server tables behind the run card: job, attempt, provider id, status, inputs, cost, error, idempotency key. |
| ContextSnapshot | none | **New**: frozen ids + versions of brief, plan, Brand DNA, product facts, recipe, references at job start. |
| Recipe | `Recipe` (`studio.ts`) | Add a version number. |
| Creative, CreativeVersion | same (`review.ts`) | Each version stores its file (bucket path, checksum, width, height) and the job or manual upload it came from. |
| Evaluation, Finding | `Evaluation` (`quality.ts`), `QaFeedback` | Automated findings are evidence, never a check. |
| ExpertCheck | `Check` and `QaItem` (two models, **gap 1**) | One row per creative version: expert, state, items, notes, decided at. |
| Comment, ChangeRequest | `ReviewComment`, `ChangeRequest` | ChangeRequest gets an explicit `cause`: correction, revision, changed_brief (**gap 8**). |
| Approval | `Decision` / version fields `approvedBy`, `approvedAt` | One row per customer decision on one version. |
| Delivery, DeliveryItem | `Delivery` (`creativeIds`, **gap 2**) | DeliveryItem **New**: delivery × creative version × file. |
| UsageRights, DeploymentConfirmation | `Delivery.rightsNote`, `confirmLive()` | Enough for the MVP. |
| Method, BlueprintVersion, TemplateVersion, RuleVersion, TaskRun, Outcome | none | MVP: blueprints are versioned Markdown in `docs/mvp/library/`; a job records which blueprint and recipe version it ran. Tables later. |
| RecordEvent | `RecordEvent` | Append-only. Every command writes one. |

## 2. Lifecycles

Each object has its own state; none borrows another's.

### Plan (`PlanState`, FLOWS §22.3, §26.2)
`writing → ready → approved`, with `ready → in_check → ready` when someone asks the expert, and
`ready → changes_asked → writing` when the customer asks for changes. A change to the plan or a resent brief writes
a new plan version in `writing`/`ready`; an approval belongs to one version.

### Production job (**New**; maps onto `RunState` for the run card)
`queued → running → succeeded | failed | cancelled`. A failed attempt may be retried as a new `JobAttempt` on the same
job. `unknown` (provider timed out) must be reconciled with the provider before another paid attempt.

### Creative version (`VersionState`, ARCHITECTURE §5.2)
`making → in_check → checked → (sent) → approved → delivered`, with `in_check → correcting → in_check` (expert asks
for a fix, no round used), `in_check → held → in_check`, and `checked → changes_requested` (customer), which closes
that version and starts version n+1 in `making`.

### Expert check (one per version)
`waiting → checked | changes_requested | held`. Undo returns `checked → waiting` only while the version is not yet
approved.

### Customer approval (one per version)
`approved`, or `changes_requested`. Undo removes an approval only while nothing has been delivered from it.

### Delivery
`preparing → ready → downloaded → confirmed_live`.

## 3. Transition table (commands)

Every command: the caller's role on the workspace is checked on the server, the object belongs to that workspace, the
version named is the current one, and the command carries an idempotency key. "Blocked" returns the contract's
`FumeError` code.

| Command (contract call) | Who may | Requires | Result | Blocked with |
| --- | --- | --- | --- | --- |
| `sendBrief(campaignId)` | owner, approver, member | brief has what, for whom, product, format, count | brief vN `ready`; plan `writing` | `invalid` (lists what is missing) |
| `changePlan` / `choosePlanDirection` | approver; designer | plan not `approved` | new plan version | `conflict` |
| `askPlanCheck` → `checkPlan` | approver asks; a designer who may check, and not the one who wrote it | plan `ready` | plan `in_check` → `ready`, checked by named expert | `forbidden`, `conflict` |
| `approvePlan(campaignId, version)` | approver (in agency work: the client) | plan `ready`, version = current; every **required** product fact verified | plan `approved`; production may start | `conflict` (stale version), `invalid` (unverified facts listed), `forbidden` |
| `startJob(input, idempotencyKey)` **New** | designer | plan approved; for variants: master approved; inputs exist | job `queued` + ContextSnapshot | `invalid`, `conflict`; same key returns the same job |
| `addManualCandidate(jobId, file, note)` **New** | designer | job exists | candidate file stored with provenance "manual" | `invalid` |
| `sendToCheck(candidate)` (`documentToCheck`) | designer | candidate from a job | creative version n `in_check`, ExpertCheck `waiting` | `invalid` |
| `markChecked(checkId)` (`qaCheck`) | a designer who may check, never the maker; in agency work the agency | version `in_check`; no open critical finding | version `checked`, check by named expert | `forbidden`, `conflict` |
| `requestCorrection` / `hold` | a designer who may check | version `in_check` | `correcting` / `held` | `conflict` |
| `release(campaignId)` (send) | account manager or designer | at least one `checked` version | those versions become visible to the customer | `conflict` |
| `approve(versionIds)` | approver (client in agency work) | each version `checked` and sent, id = current version | `approved` by named person | `forbidden`, `conflict` (stale or unchecked) |
| `requestChanges(versionId, cause, ...)` | approver, member | version `checked` and sent | version n `changes_requested`, version n+1 `making`; revision uses a round, correction does not | `conflict` (no rounds left) |
| `makeFormats(masterVersionId, placements)` | designer | master version `approved` | variant creatives in `making`, each with `masterId` | `invalid` (master not approved) |
| `makeDelivery(campaignId)` | approver, account manager or designer | every included version `approved`; no open critical finding | Delivery with one DeliveryItem per approved version | `invalid` |
| `downloadUrl(deliveryId, format?)` | anyone in the workspace who can see deliveries | delivery `ready` or later | short-lived signed URL to exactly the delivered files | `forbidden` |

## 4. Rules (the plan's critical MVP rules, made concrete)

| Rule | Where it is enforced |
| --- | --- |
| Access | Row-level: every row has `workspace_id`; reads and writes require a Membership or StaffAssignment. Commands check the role. |
| Product evidence | `approvePlan` and `startJob` refuse while a fact marked required for the campaign's products is not verified. |
| Plan approval | `startJob` for a campaign needs its plan `approved`, and records the plan version in the snapshot. |
| Master approval | `makeFormats` and variant jobs need the master version `approved`. |
| Expert check | The customer's queries return only versions that are `checked` and sent, or later. File URLs are signed only for those. |
| New version | A new version starts with no check and no approval; nothing is copied from the version before. |
| Delivery | `makeDelivery` needs every item `approved` and no open critical finding; items point at version ids and file checksums. A later version never replaces a delivered item. |
| Idempotency | Every command takes a key; the same key and body returns the first result; the same key with another body is `conflict`. |

## 5. Negative tests (first set)

Each is a test against the server (and, where the mock can keep it, against the mock too).

1. A member calls `approve` → `forbidden`.
2. An expert (staff) calls `approve` → `forbidden`. Only the customer approves.
3. The approver calls `approve` on a version in `in_check` → `conflict`.
4. The approver fetches an unchecked version's file by its storage path or signed URL → refused.
5. A user of workspace A reads or writes any object of workspace B by id → `not_found` (never reveals it exists).
6. `approvePlan(campaignId, 2)` while version 3 is current → `conflict`.
7. `approvePlan` while a required product fact is unverified → `invalid`, naming the fact.
8. `startJob` before the plan is approved → `invalid`.
9. `makeFormats` on a master that is checked but not approved → `invalid`.
10. `approve` on version 1 after version 2 exists → `conflict`.
11. After `requestChanges`, version 2 has no check and no approval.
12. `startJob` twice with the same key → one job. With the same key and another body → `conflict`.
13. `approve` twice with the same key → one Approval row, one RecordEvent.
14. `makeDelivery` with an open critical finding → `invalid`.
15. A downloaded file's checksum equals the approved version's checksum.
16. A provider timeout leaves the job `unknown`/`failed` with the attempt recorded, never silently `succeeded`.

## 6. Contract changes this needs (smallest set)

To do with the contract, the mock and the screens in one pull request each, after the mock refactor lands:

- `approvePlan(campaignId, version)`.
- `Delivery.items: { creativeId, versionId, fileId }[]` (keep `creativeIds` until screens move).
- One check model per version (fold `QaItem` onto `Check`, or give `QaItem` a `versionId`, whichever the refactor makes
  smaller).
- `ProductFact.required?: boolean`.
- `ChangeRequest.cause: "correction" | "revision" | "changed_brief"`.
- Production: `startJob`, `job(id)`, `addManualCandidate`, plus `job.progress` events; the run card reads them.
- Uploads: `createUpload({ kind, name, bytes, contentType }) → { uploadUrl, fileId }`, then the existing calls take
  `fileId`.
- An optional `idempotencyKey` on every mutating call (the http client adds it; screens do not change).
