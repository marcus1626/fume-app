# Internal MVP, 26–30 October 2026

The week's goal (Marcus's plan, Google Doc "Fume — Internal MVP Execution Plan"): by Friday the Fume team completes
one creative cycle with real data, production, expert checks, customer approval and downloads, and work persists
across sign-ins.

| File | What it holds |
| --- | --- |
| [code-map.md](code-map.md) | Entry points, the MVP cycle traced from screen to contract call, mock dependencies, contract gaps |
| [acceptance-script.md](acceptance-script.md) | The scenario (LYSNE, Night Body Oil), the people, Friday's acceptance script |
| [domain-model.md](domain-model.md) | Minimum objects reconciled with the contract, lifecycles, transition table, rules, negative tests |
| [library.md](library.md) | Blueprints B01–B14 and templates T01–T08, narrow v0.1 |

## Decisions this week

| Date | Decision | State |
| --- | --- | --- |
| 26 Oct | Backend: Supabase (WIRING §3 option A), EU region, in Fume's own Supabase organisation, never Stolon's | DECIDED (Marcus) |
| 26 Oct | Supabase project `fume-app` (ref `vkusmctftfzsrxbcxtdz`), organisation Fume, Frankfurt (eu-central-1), Free plan | DONE (Marcus) |
| 26 Oct | Rules live in the database: tables are read-only to signed-in people; every change is a Postgres command (`supabase/migrations/*_commands.sql`) that checks role, version and rules, is idempotent by key and writes the record | PROPOSED (Claude) |
| 26 Oct | Scenario, people, counts in `acceptance-script.md` | PROPOSED |
| 26 Oct | Domain model and contract changes in `domain-model.md` | PROPOSED |

## Build log

### Mon 26 Oct
- Build: `main` at `b7b340a`. `npm run check`: lint 0 errors (11 warnings), format OK, typecheck OK, 17 unit tests
  pass, brand gate 0 errors. `npm run e2e`: 12 of 12 pass (in the cloud container Chromium is at
  `/opt/pw-browsers/chromium`; the pinned headless shell is missing there, so the run used `launchOptions.executablePath`
  from a local, uncommitted config).
- Done: code map, scenario and acceptance script, domain model with transitions and negative tests, working library.
- Defects: none new. Known: two check models (`Check`, `QaItem`); delivery points at creatives, not versions; plan
  approval has no version (code-map §5).
- Waiting on: Fume's Supabase organisation (Marcus); confirmation of the people in the scenario (Marcus).
- Afternoon (Tuesday's first half, started early): `supabase/` holds the schema (identity, Product Truth, campaign,
  brief, plan, jobs, creative versions, checks, approvals, change requests, deliveries, record), 28 commands, the
  private bucket and the LYSNE seed. `npm run db:test` runs the whole cycle and its negative tests on plain Postgres
  (54 checks pass; CI job `db`). Applied to `fume-app` in Frankfurt; the function bodies match the tested ones
  (one differs by a comment only). Security advisor: search paths pinned, Supabase's `rls_auto_enable` closed to the
  API; the remaining notice (commands are SECURITY DEFINER and callable when signed in) is the design.
- Known, not urgent: performance advisor lists unindexed foreign keys and one per-row `auth.uid()` in `profiles_read`;
  fine at this size, revisit before pilots.
- Next (Tue): Auth settings (site URL, redirect URLs, email link), `app/src/api/http.ts` for the cycle's calls behind
  `VITE_FUME_API`, sign-in screen, upload and signed download, then the manual cycle in the app.
