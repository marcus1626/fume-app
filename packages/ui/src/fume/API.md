# @fume/ui · fume

Fume's own screens over `design-system/components` (DECIDED 13 Oct, round 8). One line per export. Unless a line says otherwise, every component takes `className` (joined with `cx()`) and spreads the rest of its props onto its root, and forwardRef components pass `ref` to that root. `?` marks an optional prop, and `=` gives its default.

## Message (message.css, message.js)

- `MessageList`: div.ui-message-list. HTML div props.
- `MessageGroup`: div.ui-message-group, for one author's messages in a row. HTML div props.
- `Message`: article.ui-message with data-align, data-state and aria-busy while streaming or thinking. `align?: "start" | "end"` = start, `state?: "streaming" | "thinking" | "error"`.
- `MessageHeader`: div.ui-message-header. `author: "person" | "engine" | "fume"`, `person?: PersonSign` (an avatar), `name?` (defaults to the person's name, "Engine" or "Fume"), `role?`, `time?`, `dateTime?`, `sign?: ReactNode` (replaces the avatar or the Engine mark; Fume has no sign by default).
- `MessageContent`: div.ui-message-content. HTML div props.
- `MessageText`: div.ui-message-text. A string child is wrapped in `<p>`. `streaming?: boolean` adds the caret.
- `MessageCaret`: span.ui-message-caret. No props.
- `MessageStatus`: p.ui-message-status (the "thinking" words). HTML p props.
- `MessageError`: div.ui-message-error[role=alert]. `title: ReactNode`, `text?`, `onRetry?`, `retryLabel?` = "Try again", `actions?: ReactNode`.
- `MessageReply`: div.ui-message-reply. `to: string`, `quote: string`.
- `MessageMention`: span.ui-message-mention. `children`, `className?`.
- `MessageFooter`: div.ui-message-footer. HTML div props.
- `MessageMeta`: span.ui-message-meta. `children`, `className?`.
- `MessageActions`: div.ui-message-actions[role=group]. `label: string` (aria-label).
- `MessageAction`: a quiet sm icon button. `icon: IconName`, `label: string` (aria-label), `disabled?`, plus HTML button props.
- `MessageCopyAction`: copies text and shows a check for 1.6 s. `text: string`, `label?` = "Copy", `copiedLabel?` = "Copied", `onCopied?()`.
- `MessageLikeAction`: a ui-toggle with aria-pressed. `pressed: boolean`, `onPressedChange(pressed)`, `label?` = "Good result".
- `Bubble`: div.ui-bubble with data-variant and data-align; children go inside .ui-bubble-content. `variant?: "default" | "muted" | "ghost"`, `align?: "start" | "end"`, `reactions?: ReactNode`.
- `BubbleGroup`: div.ui-bubble-group. HTML div props.
- `MessageScroller`: div.ui-message-scroller. It stays at the bottom while you read there, counts new messages while you are scrolled up, shows the glass jump pill (data-active) and has a live region. ref: `MessageScrollerHandle { scrollToEnd(smooth?), reveal(item, RevealOptions), announce(text), viewport }` (`reveal` shows an item from its top, e.g. Fume's new answer from its question, and keeps the jump pill away until she scrolls; PROPOSED 19 Oct 2026). `RevealOptions { smooth?, offset?, block?: "start" | "end", gap? }`: with `block: "end"` an item taller than the viewport shows its foot `gap` (16) above the bottom, so its action row is never under the composer (round 9, DTSK-3). Props: `label: string`, `fitHalf?` (sets --ui-message-scroller-height to stop on half a message), `jumpLabel?` = "Jump to latest", `newLabel?(n)`, `announcement?`, `children?`.
- `MessageScrollerItem`: div.ui-message-scroller-item. HTML div props.
- `useStreamedText(text, { delay?, stop? })`: returns `{ shown, done }`, the text word by word. Respects reduced motion.

## Marker (marker.css)

- `Marker`: div.ui-marker (`--new` with its dot) with data-variant, a time or "new" line in a thread. `variant?: "default" | "separator" | "border"`, `isNew?`, `count?: number`, `countLabel?`, `icon?: IconName`, `children`.
- `MarkerTime`: time.ui-marker-time. `children`.
- `MarkerCount`: span.ui-marker-count. `children`.

## Attachment (attachment.css)

- `Attachment`: div.ui-attachment[data-slot=attachment] with data-state, data-size and data-orientation. Props:
  - `title: string`, `meta?` (the data line), `description?: ReactNode` (replaces that line)
  - `media?: { kind: "image"; src?; alt?; format? } | { kind: "icon" }` = icon
  - `state?: "idle" | "uploading" | "processing" | "error" | "done"` = done, `size?: "default" | "sm"`, `orientation?: "horizontal" | "vertical"`
  - `progress?` (0 to 100), `error?`, `processingLabel?` = "Reading", `idleLabel?` = "Waiting"
  - `onOpen?`, `openLabel?`, `onRemove?`, `removeLabel?`, `onRetry?`, `glass?`
- `AttachmentGroup`: div.ui-attachment-group. `scroll?` adds `--scroll`.
- `attachmentMeta(name, bytes)`: returns a string such as "PDF · 240 KB".

## Composer (composer.css, composer.js)

- `Composer<F>`: div.ui-composer-dock > form.ui-composer with data-state running|idle and data-limit. Enter sends. Shift, Alt and IME composition do not; on a touch screen Enter makes a new line unless Cmd or Ctrl is held. The count shows from 80 % of the limit, data-near from 90 % and data-over past it. Props:
  - Text: `value`, `onValueChange(v)`, `onSubmit({ text, formats, brand?, count?, attachmentIds })`
  - State: `running?`, `onStop?`, `disabled?`, `placeholder?`, `limit?` = 2000
  - Labels: `label?`, `inputLabel?`, `inputId?`, `sendLabel?`, `stopLabel?`
  - Choices:
    - `brand?: { value, options: ComposerOption[], onChange, label? }`
    - `formats?: { value: F[], options: ComposerOption<F>[], onChange, label? }`
    - `count?: { value, options: number[], onChange, label?, format?(n) }`
  - Attachments: `attachments?: ComposerAttachment[]`, `onRemoveAttachment?(id)`, `onAttach?(files, "brief" | "image")`, `onMention?()`
  - Look: `error?`, `hint?: boolean`, `glass?`, `sticky?`, `inline?` (one line that grows, the circles inside it on the right; the Fume chat on a phone, PROPOSED 19 Oct 2026)
- `ComposerOption<V>`: `{ value: V; label; display?; initial? }`.
- `ComposerAttachment`: `{ id; name; meta?; media?; state?; progress?; error? }`.
- `ComposerSubmit<F>`: what onSubmit receives, as above.

## Engine run (run.css)

- `EngineRun`: div.ui-card.ui-run[data-state][role=group]. Props:
  - `title: string`, `description?`, `state: EngineRunState`, `time?` (data, from runClock)
  - `steps: EngineRunStepData[]`
  - `badge?: ReactNode` (replaces the status badge), `failedLabel?`, `actions?: ReactNode`
  - Round 9 (DLOAD-2, DLOAD-11): the running badge says "Under way"; a run whose state is done while a step still works or waits (the Quality Gate) shows as under way, never "Done" beside a spinner.
- `EngineRunStep`: li.ui-run-step[data-state]. `step: EngineRunStepData`.
- `EngineRunBadge`: a ui-badge with a dot or an icon, never Amber. `state: EngineRunState`, `label?`.
- `EngineRunAction`: a sm button in the run's foot. `variant?: "quiet" | "secondary" | "primary"` = quiet, `icon?`, `children`, `disabled?`, plus HTML button props.
- `runClock(seconds)`: returns "2:14".
- `EngineRunState`: "queued" | "running" | "paused" | "stopped" | "failed" | "done".
- `EngineStepState`: "pending" | "active" | "done" | "waiting" | "paused" | "stopped" | "failed".
- `EngineRunStepData`: `{ label; state; detail?; progress?: { made; total; label? }; tiles?: RunTileData[] }`.
- `RunTileData`: `{ state: "done" | "active" | "pending" | "failed"; src?; alt?; format?; check?: { state: "checked" | "in_check"; by?; time? } }`.

## Dropzone (dropzone.css, dropzone.js)

- `Dropzone`: div.ui-dropzone with its rows or grid. It checks type and size, keeps rows for rejected creatives that you can remove, announces "N creatives added to X." and moves focus on after a removal. ref: `DropzoneHandle { open(), element }`. Props:
  - Data and callbacks: `items: DropzoneItem[]`, `onFiles(files)`, `onReject?(rejections)`, `onCancel?(id)`, `onRetry?(id)`, `onRemove?(id)`
  - Rules: `accept?`, `maxBytes?`, `maxLabel?`, `target?`
  - Layout: `compact?`, `grid?`, `disabled?`, `pointer?: "touch" | "pointer"`
  - Words: `copy?`, `touchCopy?`, `moreCopy?`, `meta?`, `icon?`, `dropLabel?`, `gridLabel?`, `listLabel?`
- `DropzonePanel`: makes a whole panel take dropped creatives, with the drop veil. Props: `onFiles`, `onReject?`, `accept?`, `maxBytes?`, `maxLabel?`, `target?`, `dropLabel?`, `disabled?`, `as?: "section" | "div"`, `children`.
- `DropzoneItem`: `{ id; name; bytes; state: "uploading" | "done" | "error"; progress?; error?; retry?; src?; kind?: "image" | "video" }`.
- `DropzoneRejection`: `{ file; reason }`.
- `checkCreativeFile(file, { accept?, maxBytes?, maxLabel? })`: returns "" when the creative will do, otherwise the reason.
- `pickFiles(accept, multiple = true)`: opens the system picker and returns `Promise<File[]>`.
- `formatBytes(bytes)`: returns "2.4 MB".

## Quality Gate review (qg-review.css, qg-review.js)

- `QgScreen`: div.ui-qg > div.ui-qg-screen with data-state waiting|approved|changes and tabIndex -1. It holds the keys: C marks the creative checked, R requests changes, the arrows move to the previous or next creative, and Escape drops a draft pin. Keys are ignored in fields and in the format switch. After a decision, focus goes to Next creative; after Undo, back to Mark checked. Props:
  - State: `state: QgState`, `reviewer: string`, `checkedAt?`, `notesCount: number`, `label: string`
  - Decisions: `onMarkChecked()`, `onRequestChanges()` (only with a note; without one it opens the sheet and asks for one), `onUndo?()`
  - Moving and notes: `onPrev?()`, `onNext?()`, `onAddNote?({ text, x?, y?, number? })`
  - `children`
- `QgBar`: header.ui-qg-bar. Props:
  - `title`, `campaign?`, `eyebrow?` = "Quality Gate", `onBack?`, `backLabel?`
  - `formats?: QgFormatOption[]`, `format?`, `onFormatChange?`
  - `index`, `total` ("3 of 12", aria-live)
- `QgStage`: div.ui-qg-stage > figure.ui-qg-creative[data-format]. Pressing the creative places a draft pin (data-state=draft, is-new) and focuses the note field. The seal reads In check, Checked · Anna 14:32 or Changes requested, and lands (is-landing) once when the creative is checked. Props: `src`, `alt`, `format`, `pins?: QgPin[]`, `caption?`, `size?`.
- `QgPanel`: aside.ui-qg-sheet[data-snap=peek|full] with a handle and --qg-top when open. Props: `title`, `meta?`, `summary?`, `decision?` (defaults to QgDecision), `keys?` = true, `children`.
- `QgMetaItem`: span.ui-qg-meta-item. `icon: IconName`, `children`, `data?`.
- `QgChecklist`: section.ui-qg-section > ul.ui-qg-list. `title`, `count?`, `children` (QgCheckRow).
- `QgCheckRow`: li > div or button.ui-qg-row[data-result]. A note row lights its pin and the pin lights it (is-active). Props: `result: "pass" | "note" | "pending"`, `title?`, `text`, `pin?`, `by?: PersonSign`, `time?`.
- `QgNotes`: ol.ui-qg-notes, hidden when empty. `children?`, `label?` = "Notes".
- `QgCompose`: div.ui-qg-compose. Enter adds the note and Escape removes the draft pin. The label becomes "Note N, pinned to the creative" when a pin is waiting. Props: `label?` = "Add a note", `placeholder?`, `hint?`, `addLabel?` = "Add".
- `QgDecision`: the two decision rows. `.ui-qg-decision--waiting` has Request changes (R) and Mark checked (C). `.ui-qg-decision--done` has the outcome, Undo and Next creative. Props: `changesLabel?`, `checkLabel?`, `undoLabel?`, `nextLabel?`, `outcome?`.
- `QgSeal`: the seal on its own. `state: QgState`, `by?`, `time?`.
- `QgState`: "waiting" | "in_check" | "held" | "checked" | "changes_requested" (contract CheckState).
- `QgPin`: `{ number; x; y; text? }`, where x and y run from 0 to 1.
- `QgFormatOption`: `{ value: CreativeFormat; label; size? }`.
- `QgDraft`: `{ x; y; number }`.
- `QgNoteInput`: `{ text; x?; y?; number? }`.

## Creative viewer (viewer.css, viewer.js)

- `CreativeViewer`: div.ui-viewer with data-state, data-info, data-chrome, data-zoomed and data-dragging. By default it is modal on Radix Dialog; `inline` makes it a region in place. Behaviour:
  - Keys: the arrows move, + and - zoom, 0 fits, I shows the info, F expands, and Escape closes the modal (inline, it brings the tools back).
  - Touch and mouse: a swipe of --ui-viewer-swipe moves, a drag pans once zoomed, and a double press goes to 2x and back.
  - The info panel opens by default when the viewer is 720 px wide or more.
  - Props:
    - `items: ViewerItem[]`, `index`, `onIndexChange(i)`
    - `inline?`, `open?`, `onOpenChange?(open)`
    - `onDownload?(item)` (without it, the image is saved), `onShare?(item)` (shows the Share button)
    - Labels: `label?` = "Creative viewer", `closeLabel?`, `downloadLabel?`, `shareLabel?`, `infoLabel?`
- `ViewerItem`: `{ src; alt; name; campaign?; product?; format; size?; run?; check?: { state: "checked" | "in_check"; by?; time? }; facts?: ViewerFact[] }`.
- `ViewerFact`: `{ label; value; data? }`.
- `VIEWER_FORMAT_LABEL`: maps each format to its words: "Feed · 4:5", "Story · 9:16", "Banner · 1.91:1" and "Square · 1:1".

## Notifications (notify.css, notify.js)

- `NotificationBell`: span.ui-notify-bell > a quiet bell button ("Notifications, 3 unread") + span.ui-notify-count (9+ past nine). The ref and the props go to the button, so it can be a Radix trigger; `className` goes on the span. Props: `unread: number`, plus HTML button props.
- `NotificationPopover`: the bell and its Radix Popover (div.ui-glass.ui-popover.ui-notify-pop). It has the head, Mark all read, the list that stops on half a row (it sets --ui-notify-rows-visible), the empty state and Open the inbox. Props:
  - `items`, `open?`, `onOpenChange?`
  - `onRead?(id)`, `onReadAll?()`, `onSelect?(item, event)`, `onOpenInbox?()`
  - Words: `title?`, `readAllLabel?`, `inboxLabel?`, `emptyTitle?`, `emptyText?`
  - `align?` = end, `className?`
- `NotificationList`: div.ui-notify > section.ui-notify-section > h5.ui-notify-group + ul.ui-notify-rows. Arrow Up and Down, Home and End move between rows. Props: `items`, `filter?: NotificationFilter` = all, `onRead?(id)`, `onSelect?(item, event)`, `full?` (adds quotes and creatives), `glass?`.
- `NotificationItem`: a.ui-notify-item with data-state read|unread, data-kind, and "Unread. " for screen readers. `item: NotificationData`, `full?`, plus HTML a props.
- `NotificationEmpty`: div.ui-notify-empty. `title?` = "You are all caught up", `text?`.
- `Inbox`: div.ui-inbox, with the All · Unread · Mentions filter and ui-empty when nothing matches. Props:
  - `items`, `onRead?`, `onReadAll?`, `onSelect?`
  - `title?`, `owner?`, `filter?`, `onFilterChange?`
  - Words: `readAllLabel?`, `emptyTitle?`, `emptyText?`, `showAllLabel?`
- `NotificationData`: Fields:
  - `id`, `kind` (the contract NotificationKind; "mention" feeds the Mentions filter), `unread`, `group`
  - `time`, `dateTime?`
  - Content: `text: ReactNode`, `quote?`, `thumbs?: { src; alt? }[]`, `more?`
  - `actor: { kind: "person"; person: PersonSign } | { kind: "engine" } | { kind: "fume" }`, `href?`
- `NotificationFilter`: "all" | "unread" | "mentions".

## Share (share.css, share.js)

- `ShareDialog`: div.ui-glass.ui-dialog.ui-share[data-link=on|off] over div.ui-dialog-overlay (Radix Dialog). Behaviour:
  - It checks the invite address and gives the reason in words.
  - Rows arrive with is-new and leave with is-leaving; onRemove fires after --ui-motion-base, and focus moves to the next remove button.
  - Copy link shows Copied for --ui-share-copied.
  - Props:
    - `open`, `onOpenChange`
    - `campaign`, `title?`, `description?`
    - People: `people: SharePerson[]`, `onInvite({ email, role })`, `onRoleChange?(id, role)`, `onRemove?(person)`, `inviteRole?` = member
    - Link: `link?: { on; url; onChange(on); onCopy?(url) }`, `linkOnHint?`, `linkOffHint?`
    - `emailPlaceholder?`, `closeLabel?`
- `ShareRoleSelect`: Radix Select with the ui-select markup and a glass listbox (Viewer, Can comment, Can approve). `value: ShareGrant`, `onValueChange(r)`, `label`, `disabled?`.
- `checkInviteEmail(value, people)`: returns null, or the words: empty, not an email yet, or already has access.
- `SharePerson`: `{ id; name; email?; line?; role: ShareRole; you?; avatar?; initials?; ink? }`.
- `ShareRole`: "owner" | "approver" | "member" | "viewer" (contract CustomerRole).
- `ShareGrant`: ShareRole without owner.
- `SHARE_ROLE_LABEL`: owner "Owner", approver "Can approve", member "Can comment", viewer "Viewer".

## Onboarding (onboard.css)

- `Onboarding`: div.ui-onboard > div.ui-onboard-screen. It holds the welcome ("Welcome to Fume, LYSNE", or "You are set up, LYSNE" when every step is done), the progress (n / 3 as data) and the steps. Props: `workspace`, `person?`, `workspaceSign?: PersonSign`, `title?`, `lede?`, `steps: OnboardingStepData[]`, `children?`.
- `OnboardingSteps`: ol.ui-onboard-steps; the states are worked out from `done`. `steps`, `className?`.
- `OnboardingStep`: li.ui-card.ui-onboard-step with data-state done|current|todo. Its button is primary when current, secondary when to do, and the quiet doneAction when done. Props: `number`, `state`, `title`, `text`, `action: { label; icon?; onClick }`, `doneAction?: { label; more?; icon?; onClick }`, `stateLabel?`.
- `OnboardingSection`: section.ui-onboard-section with a head and meta (data). `title`, `meta?`, `children`.
- `EmptyCampaigns`: div.ui-empty.ui-empty--surface with the Engine mark. `title?` = "No campaigns yet", `text?`, `actionLabel?` = "Write your first brief", `onAction?`.
- `onboardingStates(steps)`: returns `OnboardingStepState[]`.
- `OnboardingStepData`: `{ id; title; text; done; action; doneAction? }`.
- `OnboardingStepState`: "done" | "current" | "todo".

## Shared types

- `PersonSign`: `{ name; avatar?; initials?; ink? }` (`ink` gives Anna's Ink avatar).
- `CreativeFormat` (internal, not re-exported because content/ already exports a narrower one): "feed" | "story" | "banner" | "square". Square sets `--ratio: 1` inline, because the CSS has no square token.

## Product pick (product-pick.css, PROPOSED 15 Oct 2026)

- `PickGrid`: ul.ui-pick-grid; `size?: "md" | "sm"` (sm: smaller tiles for a chat card or a popover).
- `PickTile`: li.ui-pick, a square picture (or a mosaic of up to four `images`, or the `icon` on the sunken surface) with `title`, `line?`, `note?` under it. Modes: `selected` + `onSelectedChange` (the picture toggles, aria-pressed; Ink ring and badge), `included` (picked through a collection: quiet badge, not a target), `onOpen` (the picture is a button), `flag` (a calm label on the picture, e.g. "Verify first", not a target; `flagIcon?` = "clock", "lock" for "Needs facts") with `action` (a small secondary Button under the words). `label?` names the picture for assistive tech.
- `ProductTile`: PickTile for a product: `name`, `variant?` (or `line`), the package icon when there is no picture.
- `ProductSheet` (product-sheet.css, PROPOSED 15 Oct): "All products", every product in one opaque sheet (Dialog on a desk, Drawer on a phone): search, filter chips, the picture grid, a lock on `locked` products. `open`, `onOpenChange`, `products: SheetProduct[]` ({ id, name, variant?, src?, tags?, locked?, note?, action? }), `filters?: { label, options: { id, label }[] }[]`, `multiple?` (tick several, confirm with the main button; else a tap picks and closes), `value?: string[]`, `onPick(ids)`, `title?` = "All products", `description?`, `doneLabel?(n)`, `lockedLabel?` = "Needs facts".
- `ProductSheetButton`: "View all products (N)" under a picker's few tiles. `count`, `onClick`, `label?`, `glass?` (inside a popover), `disabled?`.
- `PickTrigger`: button.ui-pick-trigger that opens a grid of tiles in a popover (`label`, `name`, `src?`, `icon?`); use as a PopoverTrigger's asChild child. The popover takes `className="ui-pick-popover"`.

## What the Engine found (found-review.css, PROPOSED 16 Oct 2026, round 7)

- `FoundReview`: section.ui-found, the one review for everything the Engine reads in (products from a website, CSV or zip; the brand read again). Header with `title`, `summary?` and the one main action "Approve all (N)" (N = items not kept); filter chips All / New / Changed / Unsure with counts (a Seg; hidden when only one status is found, or with `hideFilter`); the items as picture tiles marked New / Changed / Unsure (or Kept), grouped under `group` names when items carry one. A tile opens in place across the grid (focus pull from blur): picture, where it was read, how sure, the Engine's `note`, Now / The Engine read side by side for a change, `detail`, and Keep · Fix · the item's own `actions` · Remove ("Keep the new" / "Keep the old" for a change). Props: `items: FoundItem[]`, `onApproveAll()`, `onKeep(id)`, `onFix?(id)` (left out: no Fix), `onRemove(id)`, `filter?` + `onFilterChange?` (controlled when both; `filter` alone is the start), `hideFilter?`, `busy?`, `approveLabel?` = "Approve all", `footer?` (what was set aside, a link to a cross-find), `headingLevel?` = 2, `className?`.
- `FoundItem`: `{ id; status: "new" | "changed" | "unsure"; title; subtitle?; image?; images? (a group: up to four as a mosaic); icon?; group?; before?; after?; confidence?: "high" | "medium" | "low"; source?; note?; kept?; actions?: FoundAction[]; detail? }`.
- `FoundAction`: `{ id; label; icon?; onSelect }` (Merge, Split).
- `FoundFields`: dl.ui-found-fields for before and after: `rows: { label; value; changed? }[]` (a changed row is set in medium weight).
- `FOUND_STATUS_LABEL`: new "New", changed "Changed", unsure "Unsure". Types `FoundStatus`, `FoundFilter` ("all" or a status).
