# Fume app

The Fume app: the customer's workspace, the Quality Gate and Operations, in one React + TypeScript app.
**PROPOSED** (14 Oct 2026). The architecture is in [ARCHITECTURE.md](ARCHITECTURE.md); read it first.

The front end is built completely before any backend. It runs on a mock backend (the LYSNE demo workspace, in
memory) that implements the same contract the real backend will. Backend work implements `src/contract/`; it never
designs a screen or a button.

## Run it

```sh
cd app
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm test           # the contract rules, against the mock
npm run build
npm run build:preview  # the same app with the route in memory and relative links, for a hosted preview
```

Sign in as anyone in the demo with a query string on the first load:

| URL | Who | What you see |
|---|---|---|
| `/` | Maja Lind, LYSNE owner | The workspace; she approves |
| `/?as=jonas` | Jonas, member | Can brief and ask for changes, not approve |
| `/?as=ida` | Ida, viewer | Sees, never acts |
| `/?as=anna` | Anna, expert at Fume | The studio and the Quality Gate |
| `/?as=sander` | Sander, operator at Fume | Campaigns across workspaces, release |
| `/?fresh` | A new customer | The first run |
| `?latency=800` | | Slower mock, to see loading states |

## Where things are

| Folder | What |
|---|---|
| `src/contract/` | The data contract: entities, view models, `FumeApi`. The backend's whole job. |
| `src/mock/` | The LYSNE seed and the in-memory `FumeApi`, with the same rules the server will enforce. |
| `src/api/` | `ApiProvider` and one typed hook per call. Screens never fetch. |
| `src/copy/` | Every state word, so the Words rules can be checked in one place. |
| `src/shell/` | The workspace and studio shells, the page frame, people and notification helpers. |
| `src/features/<domain>/` | The screens, one folder per place in the navigation. |
| `../packages/ui/` | `@fume/ui`: React components that render the design system's classes. No CSS of its own. |
| `../design-system/` | The look (tokens and components). `components/app.css` is the page frame. |

## Rules that hold here

- The look lives only in `design-system/`. The app and `@fume/ui` add no CSS and no inline styles; run
  `npm run gate` from the repo root after any design-system change.
- Words: "creative", never "file". The expert checks ("In check", "Checked by Anna"); only the customer approves.
- The customer never sees a creative before the expert has checked it. The mock enforces it; the backend must too.
