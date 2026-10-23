# Working in fume-app (for agents)

This repository is the Fume product: the web app now, its backend and the Engine next. Marcus (CEO) decides; agents
propose. Docs and UI copy are in English; Marcus talks to agents in Norwegian.

## Read first
1. `app/ARCHITECTURE.md`: actors, roles, entities and their states. Every screen answers to it.
2. `app/FLOWS.md`: every flow, with what Marcus decided and when. The newest section wins where two disagree.
3. `app/src/contract/`: the seam between the screens and everything behind them.

## The seam
- Screens read and write only through the hooks in `app/src/api/hooks.ts`, which call `FumeApi` (`app/src/contract/api.ts`).
  No screen imports from `app/src/mock/`. Keep it that way.
- The mock (`app/src/mock/`) holds the rules the real backend must keep (who may approve what, and when). Read it as
  the backend's specification; `app/test/mock.test.ts` tests those rules.
- Backend work implements `FumeApi`. It never changes a screen to suit itself; if the contract must change, change
  the contract, the mock and the screens together in one pull request.

## Rules that hold everywhere
- Words: "creative", never "file". The expert **checks** a creative ("Checked by Anna"); only the customer
  **approves** it. In agency work the agency checks and only its client approves, the plan included.
- The customer never sees a creative before an expert has checked it. The Engine never talks to customers.
- Never AI UGC, and AI models never pose as real people.
- The look lives only in the design system. The app and `@fume/ui` add no inline styles and no colours or sizes of
  their own; use `--ui-*` tokens and the design system's classes (`packages/ui/CONVENTIONS.md`).
- Amber only marks checked work. No gradients, no glow.
- `design-system/`, `tokens/`, `assets/`, `rules/` and `tools/{gate,tokens,icons}/` are shared with
  [marcus1626/Fume-Brand](https://github.com/marcus1626/Fume-Brand). Shared tokens and components are changed there
  first, then `npm run sync:design-system` (it never deletes a file that exists only here). Token changes: edit
  `design-system/tokens/*.tokens.json`, run `node tools/tokens/build.mjs`; icons: `node tools/icons/build.mjs`.

## Before you say done
- `npm ci` once at the repo root (lint and format tools) and in `app/`.
- `npm run check` from the repo root: lint, format, typecheck, tests, and the brand rule gate with 0 errors.
- `cd app && npm run e2e`: the main flows clicked through in a browser.
- Wiring the backend or the Engine: read `docs/WIRING.md` first.
- Run the app and look at what you changed (`cd app && npm run dev`); sign in as the person the change is for.
- Commit in small steps with clear messages. Never commit secrets or `.env` files.
