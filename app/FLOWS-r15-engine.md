## Round 15 (9 Nov 2026, PROPOSED): one Engine, in one panel on the right

Marcus, on the video editor showing the Engine bar and a conversation at once: "Either or. Ideally the right side
should be a panel that can be opened and closed for the whole app, tied to the main Engine chat. With a choice of a
global session or a project session, so the thread continues the next time we come back to it." And on the plan:
"Every field should have a button where you can ask the Engine to write it. Then perhaps also open a chat (a mini chat
by the field, or the right-side panel with a reference to the field)."

Everything here is PROPOSED 9 Nov 2026 until Marcus chooses. Only Fume's people and an agency's designers have the
Engine. A customer never sees the panel, its button or a field's Engine buttons: customers talk to Fume, never to the
Engine (and neither does Fume's person while she looks through Customer view).

### R15.1 The Engine panel
- **One button, one panel.** The Engine's button sits at the end of the staff bar, before Search, and at the end of
  the Studio's top bar. It opens and closes a panel on the right; ⌘J (Ctrl+J off a Mac) does the same from anywhere.
  It stays open from page to page until she closes it, and opens as she left it next time, per person on this
  computer (a convenience; losing it only closes the panel).
- **The same conversation as the Engine page.** The panel is the Engine chat (§19), not a second chat: the same
  messages, widgets (products to tick, a question, the run, a creative, the creatives in Check) and composer. The
  Engine page is its full-screen view: the expand button opens it on the same thread (`?thread=campaign:c-winter`).
  On the Engine page itself the button and the panel step aside.
- **Threads.** One "Everything" thread per brand, and one thread per project: a campaign, or a Studio document. On a
  project's page the panel opens on that project's thread; the thread's name is the panel's title and a quiet switch
  to the others (Everything, this page's project, then every other thread, latest first, with how many turns it
  holds). A switch holds until she goes to another project's page, which opens its own thread again. A thread keeps
  its history, so coming back to a project continues it.
- **What the Engine sees.** One line of small chips under the title: the brand (Everything), what the page shows ("The
  plan", "Its creatives in review", "What waits in Check"), on the desk the picked version and the mode, on a video the
  picked shot or layer, the playhead while it stands still, the format and the mode, and the field she asked about.
  Each chip but the brand has an ×: she can leave it out. Nothing the Engine reads is hidden.
- **Under 1024 px** the panel floats over the page's right edge instead of narrowing it.

### R15.2 The Studio talks to the Engine in the panel
- **No Engine bar under the board, no conversation in the video's inspector.** Both are gone; their work goes through
  the panel, in the creative's own thread. The panel knows the open document (its name, version, mode; the video's
  playhead) and lends the desk's hands to the change card.
- **A change is still shown before it is kept.** She says what to change in the panel; the change lands on the board
  (a picture) or the timeline and the player (a video) as before, and the panel shows it as a card: each part of what
  she said, what it changed, and for a part it did not read, why and the change it would make if asked (Yes); Undo
  (Esc) and Keep and render (Enter) for a picture, Undo and Keep for a video. Once decided the card stays in the thread
  as one quiet line ("Kept, and rendered as a new version.", "Kept in the edit.", "Undone."), so the thread reads as a
  record. While a change waits and the panel is closed, the Engine button on the desk says "A change waits".
- **Render moved to the desk's top bar**, beside Make formats: it was the Engine bar's second button and must work
  with the panel closed. It saves the desk's changes first and waits while a version renders.
- **While the Engine fixes a creative from Check**, the lock bar (Wait · Take over) still lies under the board, and
  the panel's composer waits too.
- "Write a new instruction" on a version that did not render now opens the panel with its composer ready.

### R15.3 Write with Engine, and Ask about this
- **Two small buttons by each field** Fume's people may change: every line of the plan (the look, the products,
  formats and words), each master's scene and its words, and every line of a brand book that is edited in place
  (Editable, where Fume's people edit directly). On a desk they show with the row's hover and keyboard focus, like the
  plan's pencil; always on a touch screen.
- **Write with Engine** asks the Engine to write the field from what it knows (the brief, the plan, the Brand DNA, the
  Tone of Voice). While it writes, the field says "The Engine is writing the light" in the text shimmer. Its words come
  under the field, never in it: "The Engine suggests", the words, and what it wrote them from, with **Keep it** (saved
  as if she wrote it, through the field's own save, with its toast) and **Drop**. When it would not change a word, it
  says so ("The Engine would keep it as it is") with Close. The products, formats and language lines are facts it does
  not write; they have Ask about this only.
- **Ask about this** opens the panel on the page's thread with the field as context (a chip "Light · Winter gifting's
  plan"). Her message carries the field; in the thread it reads "About Light, in the plan" above her words. Asked to
  write ("Write it shorter"), the Engine answers with a card of its words for the field and **Put it by the field**,
  which puts them under the field to keep or drop there (and **Go to the field** from another page). Asked a question
  ("Is it on brand?"), it answers in words. The field leaves the context when she takes its chip off or leaves the page.

### R15.4 The contract (all new calls fall back to the mock until the live API has them)
- `engineChat(workspaceId, topic?)`: a thread's messages; no topic is Everything.
- `engineSay(workspaceId, text, { topic?, field? })`: her message in a campaign's thread, about a field.
- `engineThreads(workspaceId)`: Everything first, then the campaign and document threads, latest first.
- `engineWrite(field)`: the Engine's words for one field and what it wrote them from; nothing is saved.
- `EngineTopic` (campaign or document), `EngineThread`, `EngineField` (a plan line, a planned creative's scene or words,
  a book line by path), `EngineWriting`, and the widget `suggestion`. A document's thread is its Engine edits.

### R15.5 Defaults to confirm
- ⌘J for the panel; 360 px wide; closed until she first opens it.
- The panel's Everything thread follows the address's brand, else the person's current brand.
- Leaving a chip out lasts while she is on the page; it is not remembered.
- The mock writes in LYSNE's voice from a few lines per kind of field; live, the Engine writes with the brand's context.
