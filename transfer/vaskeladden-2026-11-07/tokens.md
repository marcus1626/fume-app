# Vaskeladden design tokens (from public CSS, 2026-11-07)

Sources: `site/css/main-GaKxGNJw.css` (vaskeladden.com, Tailwind v4.3.3, shadcn-style HSL variables) and `site/css/help-index-DZbzvONK.css` (help centre, same token set). Usage counts are utility-class occurrences across the 13 saved HTML pages.

## Brand colours
| Token | Value | Where it is used |
|---|---|---|
| `--color-neon` | **#CFFF04** (acid lime) | Primary CTA buttons (`bg-neon text-dark`, 53×), accent text (`text-neon`, 323×), focus rings, loader mark, glow shadows (`0 0 6px #cfff04b3`), manifest `theme_color`. Second half of the wordmark ("ladden"). |
| `--color-purple` | **#ACA8DF** (soft lavender) | Secondary accent text (`text-purple`, 206×), outline/icon buttons, card hover borders (`hover:border-purple/50`), tinted chips (`bg-purple/10–20`), header highlight in dark mode, cookie-banner button, illustration panels in the story videos. |
| `--brand-purple-dark` | **#3D2FA3** (hover #5044BD) | Light-theme replacement for purple: header highlight, eyebrow labels ("RENHOLD FOR HJEMMET"), progress fills, loader. |
| `--color-dark` | **#0A0A09** (near-black) | Dark-theme background, text on neon buttons, hero overlay, manifest `background_color`, review band. |
| `--color-light` | **#FFFAEF** (warm off-white) | Dark-theme foreground, text on dark hero. First half of wordmark ("Vaske"). |
| `--light-bg-dark` | #F5F0E6 | Light-theme warm cream section background. |
| `--proposal-navy / -purple` | #10192F / #6D67B8 | Only in help-centre CSS (proposal/quote documents). |

## Semantic theme (HSL channels)
| Var | Dark theme | Light theme (what the site renders by default) |
|---|---|---|
| background | 0 0% 4% (#0A0A0A) | 40 20% 97% (warm cream) |
| foreground | 40 100% 97% (#FFFAEF) | 0 0% 12% (#1F1F1F) |
| card | 0 0% 5% | 0 0% 100% (white) |
| primary / accent / ring | 243 44% 70% (≈ #ACA8DF lavender) | same |
| secondary | 68 100% 51% (≈ #CFFF04 neon) | same |
| muted / muted-fg | 0 0% 15% / 0 0% 64% | 40 15% 95% / 0 0% 38% |
| border / input | 0 0% 20% | 40 12% 86% |

Status colours: warning #F59E0B family, danger #EF4444 / #B91C1C, success #22C55E / #0F766E, info #3B82F6 / #1D4ED8 (all as ~10–30 % alpha surfaces + borders). Gamification extras: gold metal gradient (#AB7F2C → #F5DF9D), silver gradient, rainbow bar `#fa8b8b, #fbc938, #68e696, #7ab5fc, #b6a0fc`.

Most frequent raw hex values in CSS: #0000001a (shadows), #115E59, #78350F, #134E4A, #ACA8DF (+alphas), #3D2FA3, #CFFF04 (+alphas, ~40 total), #FFFAEF.

## Typography
- **Poppins** 400/600/700 — `--font-heading` (`font-heading`, 433×). Headlines, buttons, CTAs. Self-hosted woff2 under `/assets/poppins-*`.
- **Sora** 400/600 — `--font-sans` body (326×) and `--font-subheading` (20×). Self-hosted `/assets/sora-*`.
- Weights in use: semibold 321×, medium 285×, bold 163×. Uppercase tracked eyebrow labels in brand purple. Tailwind default type scale (xs .75rem … 5xl 3rem+); lots of `text-[11px]` micro-labels.
- Wordmark is a separate humanist serif-ish lettering (PNG), not Poppins/Sora.

## Radii
`--radius` .75rem. Usage: `rounded-sm` .25rem (396×), `rounded-full` pills (277×), `rounded-2xl` 1rem (163×), `rounded-lg` .75rem, `rounded-3xl` 1.5rem (feature cards), `rounded-t-[2.5rem]` big section tops (content sheet overlapping the hero).

## Shadows
Tailwind defaults (`shadow-sm` … `shadow-2xl`, mostly on card hover); neon glow `0 0 6px/15px rgba(207,255,4,.4–.7)` on active dots/badges.

## Button styles
1. **Primary CTA** — pill, `bg-neon text-dark font-heading font-bold`, `px-6–8 py-3–4`, min-h 48px, hover `scale(1.02)` or `bg-neon/90`, focus ring neon w/ offset. ("Be om tilbud", "Få tilbud")
2. **Header CTA** — small pill, lavender bg in light mode ("Få tilbud"), neon in dark.
3. **Secondary / lavender pill** — `bg-purple` with dark text ("Få tilbud på flyttevask").
4. **Ghost pill on dark** — `border-light/15 bg-light/[0.06] text-light/80 backdrop-blur` ("Se hvordan det funker").
5. **Icon button** — 44px circle, `border-border text-purple hover:bg-purple/10`.
6. **Segmented control** — joined pills, `first:rounded-l-full last:rounded-r-full`, active `hover:bg-neon/10 text-neon`.
7. **Feature card link** — `rounded-3xl border bg-card p-7/9`, hover lift `-translate-y-1.5` + `shadow-2xl` + lavender border.
