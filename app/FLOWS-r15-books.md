# Round 15 · books (9 Nov 2026, PROPOSED): the brand books become open and brand-owned

Marcus watched the round 14 walkthrough and asked about the brand books (9 Nov): "Confusing: what is the difference
between Design system and Brand DNA? Logo is in both? Are the components hard-coded? Can the Engine add components to
the design system? Like drop badge, and make a 'Wheel'…" and, of the Tone of Voice, "Can you add more blocks? Or only
control the four?" The pattern behind both: hard-coded structures should be open and the brand's own. Everything here
is an addition to the contract (new optional fields, one new call), so the live wiring of today's books still holds.

## 1. Brand DNA and the design system, apart
- **One line on each page says what it is for.** Brand DNA: "LYSNE's facts and files, as found: the logo, colours,
  type, voice and pictures. The design system sets how creatives use them." The design system: "The rules for using
  LYSNE's Brand DNA in creatives. The Engine lays out every creative from it." (For the customer: "Your …".)
- **The logo is shown once as a file, once as a use.** Brand DNA's Logo part keeps the wordmark tiles (the files, with
  where Fume found them) and gains a way, "How creatives use it", to the design system's logo part. The design
  system's Logo (under Foundations) never shows the tiles again: it shows where the logo goes on each format, as small
  frames in the brand's ground with the wordmark at its place and width, then each version's use, the clear space, the
  smallest size and the rules. Its first line links back: "How a creative uses the logo. The file itself is in Brand
  DNA." The logo component is folded in here and is not listed again under Components.

## 2. The design system's components are the brand's own
- **Fume writes nine, the brand adds its own.** The nine the design engine places words with (headline, subline,
  body, call to action, price, badge, product name, small print, logo) keep their role (`DesignComponent.role`, or the
  role they are named by). The brand's people add components of their own under Components, each built from a base:
  text, button, badge, shape, image or logo (`DesignComponent.base`).
- **Adding one.** "Add a component" opens a small form on the card surface: Built from (a segmented control, one line
  on what that base is) and Name, then **Add the component**. A name that is taken says so ("There is a component
  called Headline already."). The new component starts in the brand's own tokens (the first fitting colour, style and
  spacing step it has) and the page glides to it, with "You added this" under its purpose.
- **Setting one.** Each component shows its settings as the brand's tokens only: Placed by (a role, or "A designer"),
  Style, Words, Ground or Fill (or None), Corners, Padding (the brand's spacing steps) and Size. Each is a native
  select, saved as it changes, with Undo in the toast. A brand-made component's name and the words in its preview are
  written in place like a line. The preview draws it live in the brand's colours and type, on the wall or on a
  photograph; the CSS tab shows it as code, and the book's CSS gains its class (`.brand .wheel`).
- **Taking one out.** The bin at a component's head takes it out; Undo puts it back where it was with its marks.
- **Who.** Fume's people edit the design system in place on a draft (as the Tone of Voice, §34.3); the first change on
  the version in use starts the next draft. The customer reads it and approves the version the expert checked.

## 3. The Engine proposes a component
- The Engine may propose a component from the brand's own material. It shows on the draft, in Components, as a panel
  on the card surface: "The Engine proposes this, from the set's offer story and 3 past offers", the component drawn
  live with its settings and rules, then why in one sentence and **Add it** / **Not now**. Words and depth, never a
  stroke, never Amber.
- **Add it** puts it into the draft as the last component, marked "You added this from the Engine's proposal"; the
  toast says "In version 2 now. It reaches creatives once the version is checked." with Undo. **Not now** sets it
  aside for this version. The check foot says "The Engine's proposal stays out of it unless you add it."
- A proposal never reaches a creative before it is added and its version is checked. It lives outside the book's body
  (`BookVersion.proposals`), so the design engine never reads it; the customer never sees one; once a version is
  checked, what was not added is gone. Seeded for LYSNE: **Wheel**, a round Burgundy offer mark ("25 % av").

## 4. The Tone of Voice's blocks are open
- How we speak holds as many blocks as the brand wants. **Add a block** at the end asks for its name ("Name the block";
  "What it means, a do and a don't come next."); the block appears with the cursor in its first line.
- A block's head has, on hover or focus, move up, move down and take out. Taking out has Undo, which puts the block
  back in its place with its changed lines still marked. Empty do and don't lines are hidden when reading.
- The Engine may suggest a block the same way as a component (seeded: **Giving**, "In the gift season we give time,
  never things."), with **Add it** / **Not now** on the draft.

## 5. The contract (additions only)
- `DesignComponent`: optional `role`, `base`, `sizePx`, `sample`; `name` also takes the brand's own names.
- `BookVersion.proposals?: BookProposal[]` (`component` or `block`, `why`, `from`, `state` open, added or set_aside).
- `BookEdit`: optional `item` (put a whole block in), `moveTo` (move it), `marks` (an undo's marks); `to: null` on a
  block path takes it out. Settings take words: a token's name, figures, or "none". `BookEditMark.proposal`.
- `answerBookProposal({ bookId, proposalId, answer: "add" | "not_now" | "open" })`; "open" is the undo of either.
  Fume's people only, on a draft only.
- One rule for the page, the mock and the server: `domain/designComponents.ts` (a role is held by one component, every
  setting is one of the brand's tokens, names are unique) and `domain/bookEdits.ts`.
