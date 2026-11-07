# Vaskeladden brand capture — 2026-11-07

Internal design reference for a Fume concept document. Not for publication. Captured from public pages with curl (desktop Chrome UA) and headless Chrome (Playwright, system Chrome). Cookie banner declined ("Avslå").

## Redirects
- vaskeladden.no → 302 → https://vaskeladden.com/api/country-entry/NO → https://vaskeladden.com/ (Norwegian homepage)
- vaskeladden.se → 301 → https://vaskeladden.com/sv/sverige
- Swedish homepage: https://vaskeladden.com/sv

## site/ — raw HTML (server-rendered React/Vite SPA, built on Databutton, Tailwind v4)
home, om-oss, partnere, help-about (help.vaskeladden.com/kunde/about-vaskeladden), sv, sv-sverige, tilbud, tilbud-flyttevask, priser, privat, bedrift, teknologi, flyttevask. `site/rendered-images.json` = every image/bg/video seen in the rendered DOM per page. `site/main.js` = tiny entry loader.
`site/css/` — main-GaKxGNJw.css (marketing site), help-index-DZbzvONK.css (help centre).

## tokens.md / links.md
Colours, fonts, radii, shadows, button styles / footer social links.

## assets/logo/
- `Splitt-wordmark.png` (751×98, transparent) — the header/footer wordmark "Vaske" in off-white #FFFAEF + "ladden" in neon #CFFF04, with a thin vertical bar in front. Made for dark backgrounds (light theme presumably inverts/filters it via CSS).
- `og-image.png` (1200×630) — wordmark on #0A0A09.
- `apple-touch-icon.png`, `android-chrome-192/512.png`, `favicon*.png/.ico` — "|V" monogram in neon on black. `help-android-chrome-512x512.png` from the help centre.
- `site.webmanifest` (theme #CFFF04, bg #0A0A09; tagline "AI-drevet renholdsplattform. Last opp plantegning, få tilbud på 3 minutter.")
- No inline SVG logo exists: the ~366 inline SVGs on the homepage are UI icons (Lucide-style).

## assets/images/
Most prominent first:
1. `home_hero-poster.webp` + `hero-video-frame.png` — hero background (cleaner at work, dark overlay); full clip in `assets/video/hero-background-720p.mp4`.
2. `home_reviews-bg.webp` — office landscape behind the dark reviews band.
3. `privat_hero.webp`, `privat_flyttevask-hallway.webp` (bright hallway with moving boxes), `bedrift_segment-kontorrenhold.webp`.
4. `team_*.webp/png` — 7 team portraits from /om-oss (Jacob also on /partnere).
5. `partner-story_carlos-poster.jpg` — poster frame of the partner-story video on /partnere.
6. `customer-logos/` (14: Rema 1000, Coop, Aker Property, Filetfabrikken, A-Møbler etc.), `payment-logos/` (Stripe, Visa, Mastercard, Apple/Google Pay, Vipps, Klarna).
7. `app-ui-frames/` — frames extracted from the "website stories" videos (see below).

## assets/video/
`nb-booking-desktop/mobile.mp4`, `nb-cleaning-plan-desktop/mobile.mp4`, `sv-booking-desktop.mp4` (16 s each), `hero-background-720p.mp4`.

## Real app UI?
**No real app or product screenshots are published.** The "how it works" section uses the booking and cleaning-plan videos, which are **stylised illustrated UI mockups**: a lavender panel, a flat line illustration (house, envelope, checklist, calendar, floor plan) and a white card with bullet steps and a neon pill CTA ("Be om tilbud", "Velg dato og tidspunkt", "Meld fra"). They show the product concept (quote → accept → cleaning calendar → room-by-room floor-plan cleaning plan → report a deviation) but not the actual interface. The closest thing to real UI is the live quote form itself (shots/flow-02).

## shots/
- Full-page 1440px: home, om-oss, partnere, tilbud, privat, bedrift, teknologi, priser, sv. Mobile 390px (@2x): home-390.
- Quote flow: `flow-01-home-postcode` (Oslo postcode 0150 typed into the hero field), `flow-02-after-postcode` (lands on /tilbud: Flyttevask page with a single long form — country, private/business, address search, then contact details).
- Stopped there: the next fields require an address and name/e-mail/phone, so nothing further was entered and nothing was submitted.

## Blocked / not done
- help.vaskeladden.com timed out in headless Chrome (never reached network-idle), so no screenshot of it; raw HTML + CSS were saved with curl.
- No TikTok or Facebook links exist on the site. Social media not scraped.
- Image count is lower than 40 because the site uses few photos; logos and video frames make up the rest.
