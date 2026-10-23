# Fume app

The web app Fume's customers, Fume's experts and agencies use: briefs, plans, the Engine's work, the Quality Gate,
review and delivery. React + TypeScript on Fume's design system.

Today the whole front end runs on a mock backend (the LYSNE demo, in memory) behind one typed contract. The backend
and the Engine come next; they implement `app/src/contract/` and never change a screen.

## Run it

```sh
cd app
npm ci
npm run dev          # http://localhost:5173
```

Sign in as anyone in the demo from the person menu, or with `?as=` on the first load (see `app/README.md`).

## Check it

```sh
npm run check        # from the repo root: typecheck, tests and the brand rule gate
```

CI (`.github/workflows/ci.yml`) runs the same on every push and pull request.

## Where things are

| Path | What |
|---|---|
| `app/` | The app. Start with `app/ARCHITECTURE.md` (actors, entities, states) and `app/FLOWS.md` (every flow). |
| `app/src/contract/` | The data contract: entities and `FumeApi`. The backend's whole job. |
| `packages/ui/` | `@fume/ui`: React components that render the design system's classes. |
| `design-system/`, `tokens/`, `assets/`, `rules/`, `tools/gate/` | Copies from the brand repository, [marcus1626/Fume-Brand](https://github.com/marcus1626/Fume-Brand). Change them there, then run `npm run sync:design-system`. |

## The preview

The Vercel project `fume-app` (team Fume) deploys `app/` from `main`. `app/middleware.ts` asks for a password on every
request; the password is the project's `PREVIEW_PASSWORD` environment variable.
