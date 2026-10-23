# Components: shadcn/ui → Fume

Source: shadcn/ui new-york v4 (MIT), 61 components as of 12 Oct 2026 (`apps/v4/registry/new-york-v4/ui` in shadcn-ui/ui). Each one gets redesigned in the Fume brand and approved by Marcus. Status: ○ not started · ◐ in review · ● approved. Round 7 (13 Oct) put fifty components in review at once, in five families on the board: Fields, Choices and status, Glass layers, Cards and content, Navigation and data. Marcus approved choices, glass layers and navigation (F-D072); fields and content got the upload box and a warmer shimmer in round 8, which also added four families: Engine and chat, Charts and numbers, Layout and tools, Fume screens. Marcus approved fields, the four new families and the gate in round 8, and the icons and content in round 9, where he chose Warmer colour. Round 10 toned two places down and added shimmer text, made white light on dark words in round 11. On 13 Oct Marcus approved rounds 10 and 11 and with them everything on the board ("Alt ser bra ut"): design system v1 is decided. Small things get worked out in the real screen design, chat first.

## Wave 0: foundations
● colour roles and states (`--ui-*`, shadcn bridge; approved round 6, Rouge ● decided) · ● type scale (approved round 6) · ● shape and radius (approved round 7; pills ●, Rounder ● and the inset tab pill ● decided) · ● touch (44 px hit areas, pressed state, `base.css`; measured in CI; approved round 6) · ● focus ring from the keyboard only (`focus.js`: a clicked or tapped field shows its caret, not the ring; Marcus 13 Oct, measured in CI) · ● air (space and inset tokens, rule proximity; approved with round 7) · ● glass (Smoke ● decided; air approved round 7) · ● icons (filled Lucide, the checked triangle and the Engine; 60 approved round 7; 33 more from round 8, upload and download redrawn and approved in round 9) · ● rule gate (approved rounds 7 and 8; no exceptions to no-gradient again in round 9)

## Wave 1: core controls
● button (approved round 6) · ● button-group · ● input (`field.css`) · ● input-group · ● textarea (`field.css`) · ● label (`field.css`) · ● field · ○ form (React only: wiring, no look of its own) · ● checkbox · ● radio-group (`radio.css`) · ● switch · ● select · ● native-select (`select.css`) · ● slider · ● toggle · ● toggle-group (`toggle.css`) · ● badge · ● kbd · ● spinner · ● upload box (`dropzone.css`, Fume's own, round 8)

## Wave 2: floating surfaces (glass)
● dialog · ● alert-dialog (`dialog.css`) · ● sheet · ● drawer (`sheet.css`) · ● popover · ● hover-card (`popover.css`) · ● tooltip · ● dropdown-menu (`menu.css`) · ● context-menu · ● menubar (round 8) · ● command · ● combobox · ● sonner (`toast.css`)

## Wave 3: content and layout
● card · ● creative tile (`creative.css`, Fume's own) · ● item · ● alert · ● avatar · ● separator (space, not a line) · ● skeleton (round 7 pulse, back and approved in round 9) · ● shimmer text (`text-shimmer.css`, Fume's own, round 10, white in round 11, approved; the Engine's white too since 15 Oct) · ● progress · ● empty · ○ aspect-ratio (a CSS property, no look) · ● scroll-area · ● resizable (round 8) · ● collapsible (`accordion.css`) · ● accordion · ● data list (`data-list.css`, Fume's own)

## Wave 4: navigation and data
● tabs (`tabs.css`, on `segmented.css`) · ● navigation-menu (top bar, `nav.css`) · ● breadcrumb · ● pagination · ● sidebar (behind the page) · ● table · ● chart (`chart.css`, `chart.js`, `stat.css`, round 8; Amber for approved work decided with Warmer, round 9) · ● calendar (and date picker) · ● carousel · ● input-otp

## Wave 5: chat and AI (new in shadcn)
● message · ● bubble · ● message-scroller (all `message.css`) · ● attachment · ● marker · ○ direction (right-to-left, no look of its own)

## Wave 6: Fume's own (round 8, approved)
Engine and chat: ● brief composer (`composer.css`) · ● Engine run (`run.css`). Charts and numbers: ● stat tiles (`stat.css`). Layout and tools: ● toolbar and floating action bar · ● stepper · ● page header · ● settings layout · ● filter bar. Fume screens: ● Quality Gate review (`qg-review.css`) · ● creative viewer (`viewer.css`) · ● notifications (`notify.css`) · ● share dialog (`share.css`) · ● first run (`onboard.css`).
