# Fume status

A small internal page for the team (Marcus, William, Kristian): roadmap and status of the Fume app and the Engine,
with a countdown to the deadline.

- **Update it:** edit `status.json` only (items, `status`: `done` | `now` | `next`, `updated`, `deadline`), commit,
  push. The page reads the file on every load.
- **Look:** Fume web kit (`fume-web.css`, `fume-kit.js`, copied from Fume-Brand `kit/dist`). The page's own CSS uses
  `--ui-*` tokens only. No Amber: nothing here is a checked creative.
- **Hosting:** Vercel team Fume, project `fume-status`, root directory `status`, no build step.
- **Password:** `middleware.js` asks for HTTP Basic auth; the password is the `STATUS_PASSWORD` env var in Vercel
  (never in the repo). Any user name works.
