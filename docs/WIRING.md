# Wiring the Fume app: backend and Engine

Status: PROPOSED by Claude, 23 Oct 2026. The plan for turning the front end into a working product. The stack
choices in §3 are Marcus's to make; nothing here is decided until he says so.

## 1. What exists

- **The whole front end**, on an in-memory mock backend with the LYSNE demo. Every screen in every state.
- **One contract**, `app/src/contract/`: the entities, the `FumeApi` interface (one interface per domain), events
  and errors. Screens call it only through the hooks in `app/src/api/hooks.ts`. Nothing else in the app knows where
  data comes from.
- **The mock**, `app/src/mock/`: the LYSNE demo in memory, behind `createMockApi()`. It is the backend's
  specification in running code: when this document and the mock disagree, the mock shows what the screens expect.
  It still carries layers from the design rounds; a follow-up pull request flattens it into one module per domain
  and moves the rules (who may do what in which state: approve, check, send, undo) into pure functions in
  `app/src/domain/`, which the server should then import instead of rewriting.
- **Tests**: `app/test/` (the mock behind the contract) and `app/e2e/` (the main flows clicked through in a browser,
  per role).

## 2. The seam: one switch

`app/src/api/client.tsx` builds the `FumeApi` the app uses. Today it is always the mock. Wiring adds:

- `app/src/api/http.ts`: `createHttpApi(baseUrl)`, an implementation of `FumeApi` that calls the server. One
  method per contract call; errors come back as `FumeError` with the contract's codes (`not_found`, `forbidden`,
  `conflict`, `invalid`, `unavailable`).
- `VITE_FUME_API`: `mock` (the default, for the demo, the previews and the tests) or the server's URL.
- Events: `subscribe(handler)` over server-sent events (or the database's realtime channel). The hooks then refresh
  only the queries an event touches, instead of everything after each write.
- The demo's sign-ins (`?as=`, the person menu's "Sign in as someone else", `useDemoSignIn`) exist only with the
  mock. With `http` the session comes from real sign-in.

A screen never changes to suit the backend. If the contract must change, change the contract, the mock, the
screens and the server in one pull request.

## 3. The server (OPEN: Marcus decides)

Recommendation: **one TypeScript backend**, so `app/src/domain/` is imported by the server and never rewritten, and
the contract types are shared. Two shapes that fit:

| | A. Supabase | B. Vercel Functions + Postgres |
|---|---|---|
| Data | Postgres with row-level security per workspace | Postgres (Neon) with the checks in code |
| Sign-in | Supabase Auth (magic link, Google) | An auth provider (Clerk or Auth.js) |
| Files | Supabase Storage, signed upload URLs | Vercel Blob, signed upload URLs |
| Events | Realtime channels | Server-sent events from a function |
| Jobs (the Engine) | Edge functions + a queue table | Vercel Queues or a job table + cron |

Either way: EU hosting (the customers' data), and Fume's own accounts. The Supabase organisation that exists today is
named Stolon; Fume's data must live under Fume, never Stolon (IP and data stay separate).

## 4. Order of work (follows the Roadmap's R0 internal slice)

1. **Identity and tenancy**: sign-in, Organisation → Workspace → Membership (role), Fume's staff roles, agencies and
   their clients. Every record carries `workspaceId`; every call is checked against the caller's role on the
   server, never only in the app (ARCHITECTURE §3).
2. **Campaigns, brief and plan**: create a campaign, send the brief, Fume writes the plan, the plan's check and
   approval (FLOWS §22, §26.8).
3. **The Engine** (§5): runs that make masters, then variants and formats, as jobs with progress events.
4. **The Quality Gate**: the expert checks each creative version; only checked work is released to the customer.
5. **Review and decisions**: approve, ask for changes with pins, rounds, undo.
6. **Delivery**: deliveries, downloads by format, usage.
7. Then: Brand DNA and products, the Fume chat with handoff to a named person, the agency's client link, the
   calendar.

Each step: implement its domain's calls in the server and in `http.ts`, run the same tests against both
implementations, and flip the domain on in a preview before the next.

## 5. The Engine

- A service of its own behind the contract. The app never calls an image model; it calls contract calls that start
  an `EngineRun` and receives `run.progress` events.
- What the Engine makes lands as a creative version in check. Only the Quality Gate releases it to the customer.
- The Engine never talks to customers. Customers talk to Fume; designers use the Engine chat.
- Model names, prompts, seeds and candidates never reach the customer's screens (ARCHITECTURE §1, principle 2).
- Which models and vendors the Engine uses is OPEN (Marcus decides); keep them behind one interface so they can
  change.

## 6. Rules the server must keep

Once the follow-up lands, the functions in `app/src/domain/` are the list, each with its rule in one line. The ones
that must never break:

- An expert checks every creative before the customer sees it. Only the customer approves; in agency work the agency
  checks and only its client approves, the plan included (FLOWS §26.8).
- A correction by Fume never uses one of the customer's rounds.
- A version and its approval are never silently overwritten; every creative sits in a version chain.
- Customer data stays in its workspace.

## 7. Before a pull request

- `npm run check` from the repo root (lint, format, typecheck, tests, the brand rule gate).
- `cd app && npm run e2e` (the flows in a browser, against the mock).
- With the server: the same contract tests against `http`.
