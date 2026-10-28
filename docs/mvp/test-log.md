# Test log: the MVP week

Status: kept by Claude. The rules are tested twice: on a throwaway database in CI (`tools/db/test.sh`) and on the
live database in one transaction that is rolled back (`tools/db/rehearsal.sh`, nothing is kept). Readiness of the
live data for Friday: `tools/db/preflight.sql`.

## Runs

| Date | Build | Where | Result |
| --- | --- | --- | --- |
| 27 Oct 2026 | `61785c8` | Live, rolled back | 133 passed |
| 28 Oct 2026 | `c78dde3` | Live, rolled back | 141 passed (file checks added) |
| 28 Oct 2026 | `cf1698a` | Live, rolled back | 147 passed (product pictures added) |

## The acceptance script, line by line

Each line of `acceptance-script.md` §3 and the test that shows its rule. The rehearsal on Friday shows the same in the
app, with the people named there.

| # | Rule | Test (file: what it says) |
| --- | --- | --- |
| 1 | The product, its facts and its picture | 90: the customer adds the product's front picture, kept with who added it |
| 2 | Facts are verified by the customer, by name | 10: a member cannot verify a fact; SOLV cannot verify a LYSNE fact |
| 3 | A brief is complete before it is sent | 10: an incomplete brief names what is missing |
| 4 | Fume writes the plan; claims only from verified facts | 70: a claim must be a verified claim of the product; two failures leave the plan from the brief |
| 5 | The plan is checked by someone who did not write it | 20: the designer who changed the plan cannot check it |
| 6 | Only the current plan version is approved | 10: approving a stale plan version is refused; app: approvePlan names the version read |
| 7 | Production waits for the approved plan and verified facts | 10: production waits for the approved plan; unverified required facts block the plan |
| 8 | A job survives a closed browser; a repeat makes no duplicate | 30: the same key adds one candidate; 10: the same key with another body is refused |
| 9 | The customer never sees an unchecked version, by screen or file | 10: the customer cannot approve an unchecked version; cannot read its bytes from storage |
| 10 | The account manager never checks; the maker never checks | 10: the account manager never checks a creative; 30: the maker cannot check it |
| 11 | A change names what to change and its cause | 40: a change request names at least one creative |
| 12 | A new version starts without checks or approvals | 10: an old version cannot be checked |
| 13 | Approval names the version | 10: approving version 1 after version 2 exists is refused |
| 14 | Formats come from an approved master and get their own check | 30: formats wait for the customer; 10: a format from an unapproved master version is refused |
| 15 | The delivery is exactly the approved files | 40: a second delivery never packs the same versions; the customer reads the delivered file and nothing unregistered |
| 16 | Live is confirmed by the customer | 40: a member does not confirm it is live |
| 17 | Roles and brands are kept apart | 10: a member cannot approve; 30: another brand cannot open LYSNE |

## Thursday's failure cases

| Case | How it shows | Test |
| --- | --- | --- |
| Duplicate submission | The same key answers the first result; the same key with another body is refused | 10, 30, 90 |
| Provider failure (the language model) | The run is kept as failed with its error and cost; two failures leave the plan from the brief | 70 |
| A run that never came back | Counts as failed after four minutes and is taken again | 70 |
| Stale approval | Refused as a conflict; the app reads the plan again and says why | 10, app test `mock.test.ts` |
| Missing inputs | Refused as invalid, naming what is missing | 10, 30, 40, 70 |
| Wrong workspace | Refused as not found; nothing of the other brand can be read | 10, 30, 90 |
| A wrong file | Flagged in Check for the expert (kind, shape, size, weight), never shown to the customer | 80 |
| Facts or Brand DNA changed since a version was made | Flagged in Check for the expert | app (live Check) |

## Friday's record (to fill in)

Build (commit): · Date: · Participants: · Passed lines: · Defects (severity, owner, next action): · Known limitations:
· Manual steps: · Release decision (Marcus):
