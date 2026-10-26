# Weekly scenario and acceptance script

Status: PROPOSED by Claude, 26 Oct 2026. Marcus decides the people and owns the release decision on Friday 30 Oct.

## 1. The scenario

| Part | Choice (default) | Why |
| --- | --- | --- |
| Brand | **LYSNE** (the demo brand), workspace `lysne` under organisation `LYSNE` | Internal and fictional: no customer data, no rights question. Its Brand DNA, rules and product facts already exist in the seed. Internal only: LYSNE is not checked against LYS Beauty for public use. |
| Product | **Night Body Oil · 100 ml** (`LYS-NBO-100`) | Six facts already written (bottle, cap, label, oil colour, never, claims). Four are required for production (bottle, cap, label, oil colour). |
| Sources | The LYSNE brand guide, the packshot and two earlier campaign pictures from the seed, stored as real files | Each fact names one of them as its source. |
| Channel and formats | Instagram feed: master 4:5; family: 1:1 and 9:16 | The Offer's three formats; small enough for one day. |
| Campaign | **"The hour before sleep"**, evening ritual, one message, one claim from the approved list | The product's only approved claim. |
| Plan | One recommended direction plus two considered (words and references only, FLOWS §22.1) | As decided. |
| Counts | 1 master, then 2 formats (1:1, 9:16) and 1 variant. Up to 4 candidates per production attempt. | The plan's "small family". |
| Seed and test data | `supabase/seed.sql` (to come) holds LYSNE, the product, its facts and sources. Two test-only users: a member and a user in a second workspace (`solv`) for the boundary tests. | Repeatable; nothing personal. |

## 2. The people (DECIDED by Marcus, 26 Oct)

Fume's roles are designer, account manager and admin, and one person may hold several. A designer makes the work:
the plan, the Engine runs, the candidates. Only a designer with the right to check may check and sign a creative
("Checked by …"), and nobody checks work they made themselves. The account manager (sales, CSM) talks with the
customer and never checks. Only the customer approves.

| Role in the app | Who (default) | Signs in as |
| --- | --- | --- |
| Designer, Fume admin | Marcus | marcus@fumecreatives.com |
| Designer who may check (signs "Checked by …"), Fume admin | Kristian | kristian@ (Fume address) |
| Account manager (sales, CSM), never checks | William | william@ (Fume address) |
| Internal customer, LYSNE approver | Marcus's test address | marcus+lysne@fumecreatives.com |
| Member (cannot approve), test only | test account | member+lysne@fumecreatives.com |
| Another workspace, test only | test account | user+solv@fumecreatives.com |

Sign-in: Supabase Auth email link (magic link) to these addresses. No passwords. Google sign-in later.

## 3. Acceptance script (Friday)

Each line names who does it, what they press, and what must exist afterwards. A line passes only when the "Evidence"
is seen in the app or the database, not assumed.

| # | Who | Does | Evidence |
| --- | --- | --- | --- |
| 1 | Marcus | Signs in, opens LYSNE, opens Night Body Oil | Product with 6 facts; sources open as files |
| 2 | Approver | Verifies the four required facts | Each fact shows "Verified by …" with time; RecordEvent rows |
| 3 | Approver | New campaign "The hour before sleep": writes the brief, sends it | Brief v1 `ready`; plan `writing` |
| 4 | Fume (LLM) + Marcus | Fume proposes the brief's gaps and the plan; Marcus edits one line | Plan v1 then v2; claim lines reference fact `f6`; unknowns stay listed |
| 5 | Kristian | Checks the plan (asked by the approver) | "Checked by Kristian" on plan v2; Marcus, who wrote it, is refused |
| 6 | Approver | Approves plan v2 | Plan `approved` v2; a stale approve of v1 is refused |
| 7 | Marcus | Starts the master job | Job `queued` with a ContextSnapshot (brief v1, plan v2, Brand DNA vN, facts f1–f6, recipe vN) |
| 8 | Marcus | Closes the browser during the job, reopens | Job still `running` or `succeeded`; nothing duplicated |
| 9 | Marcus | Picks a candidate, sends it to Check | Creative version 1 `in_check`; the approver cannot fetch it, by screen or by file URL |
| 10 | Kristian | Checks version 1, Marcus sends it | "Checked by Kristian"; visible to the approver. William, the account manager, is refused the check |
| 11 | Approver | Asks for a change ("cap reads glossy"), classified as a correction | ChangeRequest cause `correction`, no round used; version 2 `making` |
| 12 | Marcus | Makes version 2 (Engine or recorded manual fix), sends to Check | Version 2 has no check and no approval of its own yet; version 1 keeps its history |
| 13 | Kristian, approver | Kristian checks v2; the approver approves v2 | Approval names v2; approving v1 is refused |
| 14 | Marcus | Makes the 1:1 and 9:16 formats and one variant from the approved master | Each has `masterId` and its own check; the approver approves them |
| 15 | Approver | Makes the delivery and downloads it | Files' checksums match the approved versions |
| 16 | Approver | Confirms it is live; starts a new draft | Delivery `confirmed_live`; the new brief opens with LYSNE's context |
| 17 | test member, test solv user | Try to approve; try to open LYSNE by id | `forbidden`; `not_found` |

## 4. Release decision (Marcus)

READY FOR INTERNAL USE when lines 1–17 pass, no critical access or data-integrity defect is open, and every failure
seen can be found and handled without hidden database edits. Record: build (commit), date, participants, known
limitations, manual steps. Otherwise HOLD or narrow, per the plan.
