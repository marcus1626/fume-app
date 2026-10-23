# @fume/ui overlays: API

Status: PROPOSED (14 Oct 2026). Everything that floats over the page, all of it Smoke glass. Import from
`@fume/ui` (or `./overlays`). Every part takes `className` (merged) and the native props of its root;
parts marked *Radix* take that Radix part's props too (`asChild`, `forceMount`, event hooks). Words are props or
children: say "creative", never "file"; no exclamation marks.

**Glass rule (glass-one-white):** on any glass surface at most one `ui-btn--glass-white` or `ui-btn--glass-danger`
button; every other button is `ui-btn--glass-clear` (Button `variant="glass-clear"`). No stroke on glass.
Put the main action last in a footer (it lands nearest the thumb when the footer stacks on a phone).

**Round 9 (PROPOSED 19 Oct 2026), the desktop review:**
- *The Smoke glass everywhere (round 10, Marcus 20 Oct).* Round 9 made dialogs, sheets, menus and the rest solid
  (`--ui-glass-bg-solid`, Ink at 94 %); that broke the DECIDED Smoke and is undone. Every floating layer is the Smoke
  glass again; the solid fill is only the fallback when blur is missing or transparency is reduced.
- *Focus goes back (DWAY-8).* Every dialog, alert dialog, sheet, drawer and the palette gives focus back to what had
  it when it opened, also when it was opened from code (a menu row, a shortcut); when that element is gone, to the one
  focused just before it. When the layer's choice went to another page, nothing is given back: the app's Root puts
  focus on the new page's h1. Menus and popovers do the same.
- *⌘↵ submits (DTSK-20).* Inside DialogContent and SheetContent, ⌘↵ / Ctrl+↵ submits the form that holds the focus
  (`form.requestSubmit()`), so wrap the body and footer in a `<form onSubmit>` with the main button `type="submit"`.
- *Dialog height (DWAY-4).* At most the screen minus 24 above and below; a dialog with a `DialogBody` scrolls only the
  body, with the header and the footer fixed, the footer parted by one hairline.

## Glass (`glass.tsx`, glass.css)
- `Glass` — div.ui-glass. `variant?: "panel" | "small" | "bar"` (default panel: radius 32; small: radius 22 and small blur; bar: pill). `data-state?: "open" | "closed"` ("open" plays the arrival). Only for floating things (a floating toolbar, a bar over a creative).
- `Scrim` — div.ui-scrim, aria-hidden, for a custom layer (Dialog, Sheet, Drawer bring their own).

## Dialog (`dialog.tsx`, dialog.css, Radix Dialog)
- `Dialog` — root. `open?`, `defaultOpen?`, `onOpenChange?(open)`, `modal?` (default true). Type `DialogProps`.
- `DialogTrigger` — *Radix* button that opens it; use `asChild` around a Button.
- `DialogContent` — the glass dialog with its scrim, in a portal. `size?: "sm" | "md" | "lg"` (400 / 480 default / 640), `showClose?: boolean` (default true; the clear close circle), `closeLabel?: string` (default "Close"), `container?: HTMLElement | null`; *Radix* `onOpenAutoFocus`, `onCloseAutoFocus`, `onEscapeKeyDown`, `onPointerDownOutside`, `onInteractOutside`, `forceMount`. First focus: `[data-ui-autofocus]`, else the first control (never the close).
- `DialogHeader` — div.ui-dialog-header: title and description as one group.
- `DialogTitle` — *Radix* h2.ui-dialog-title. Required (Radix warns without one).
- `DialogDescription` — *Radix* p.ui-dialog-description. Without one, pass `aria-describedby={undefined}` to DialogContent.
- `DialogBody` — div.ui-dialog-body: the work between the words and the actions.
- `DialogFooter` — div.ui-dialog-footer: actions right-aligned, stacked full width on a phone. After a `DialogBody` it stays in view under the scrolling body, parted by one hairline (round 9).
- `DialogClose` — *Radix* closes it; `asChild` around a footer button (`<DialogClose asChild><Button variant="glass-clear">Not yet</Button></DialogClose>`).
- `DialogOverlay` — *Radix* div.ui-dialog-overlay (already inside DialogContent; for custom layouts).
- `DialogPortal` — *Radix* portal (already inside DialogContent).
- Type `DialogSize = "sm" | "md" | "lg"`.

## Alert dialog (`alert-dialog.tsx`, dialog.css, Radix Dialog with role="alertdialog")
- `AlertDialog` — root. `open?`, `defaultOpen?`, `onOpenChange?(open)`. Type `AlertDialogProps`.
- `AlertDialogTrigger` — *Radix* the asking button (a danger button, a danger menu row); `asChild`.
- `AlertDialogContent` — div.ui-glass.ui-dialog.ui-dialog--sm[role=alertdialog], scrim, portal. `size?: DialogSize` (default "sm"), `container?`. No close button; the scrim does not close it; Escape cancels; focus starts on AlertDialogCancel.
- `AlertDialogHeader` — div.ui-dialog-header.
- `AlertDialogTitle` — h2.ui-dialog-title ("Delete 3 creatives?").
- `AlertDialogDescription` — p.ui-dialog-description ("They leave the campaign. Anna's checks go with them.").
- `AlertDialogFooter` — div.ui-dialog-footer: Cancel first, Action last.
- `AlertDialogCancel` — *Radix Close* button.ui-btn.ui-btn--glass-clear, gets the first focus ("Keep them").
- `AlertDialogAction` — *Radix Close* button.ui-btn.ui-btn--glass-danger. `variant?: "danger" | "white"` (default danger: Rouge glass; white: ui-btn--glass-white), `icon?: IconName` (e.g. "trash"). `event.preventDefault()` in `onClick` keeps it open while work runs.

## Sheet and drawer (`sheet.tsx`, sheet.css, Radix Dialog)
**The right panel (round 9, DLAY-15; PROPOSED 19 Oct 2026).** On a desk a form, a check or a detail opens as a panel at
the right, not as a centred dialog: `SheetContent side="right"`, 440 wide (`size="md"`, the default) or 520
(`size="lg"`: a form with a picture, the product check), the full height of the screen less 12 all round, its body
scrolling on its own and its footer pinned under it (one hairline above). Under 640 px the same panel opens from the
bottom as a sheet. The page beside it stays as it was; put the panel's state in the address (`?check=<id>`) so Back
and a link open it again. A panel that sits beside work the person keeps using (a peek) takes `modal={false}` on
`Sheet`: no scrim, the page stays live, Esc still closes it.
```tsx
<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="right" size="lg">
    <form className="ui-sheet-form" onSubmit={save}>          {/* ⌘↵ submits it */}
      <SheetHeader><SheetTitle>Change the brief</SheetTitle><SheetDescription>…</SheetDescription></SheetHeader>
      <SheetBody>… fields …</SheetBody>
      <SheetFooter>
        <SheetClose asChild><Button variant="glass-clear">Cancel</Button></SheetClose>
        <Button variant="glass-white" type="submit">Save</Button>
      </SheetFooter>
    </form>
  </SheetContent>
</Sheet>
```
- `Sheet` — root. `open?`, `defaultOpen?`, `onOpenChange?(open)`, `modal?` (default true; false for a peek beside the page). Type `SheetProps`.
- `SheetTrigger`, `SheetClose` — *Radix* trigger and close (`asChild`).
- `SheetContent` — div.ui-glass.ui-sheet[data-side][data-size], scrim, portal. `side?: "right" | "left" | "top" | "bottom"` (default right), `size?: "md" | "lg"` (right and left: 440 default / 520), `showClose?` (default true), `closeLabel?` (default "Close"), `container?`; *Radix* content props. Gives focus back to its opener; ⌘↵ submits the form inside.
- `SheetHeader` — div.ui-sheet-header. `SheetTitle` — *Radix* h2.ui-sheet-title. `SheetDescription` — *Radix* p.ui-sheet-description.
- `SheetBody` — div.ui-sheet-body: scrolls on its own. `SheetFooter` — div.ui-sheet-footer: actions at the foot, pinned under the body.
- `.ui-sheet-form` — the class for a `<form>` that wraps header, body and footer: it takes no box of its own, so the body still scrolls and the footer stays pinned.
- Type `SheetSize = "md" | "lg"`.
- `Drawer` — root for the phone drawer. `open?`, `defaultOpen?`, `onOpenChange?(open)`, `modal?`. Type `DrawerProps`. (Holds the state so a drag down can close it.)
- `DrawerTrigger`, `DrawerClose` — *Radix* trigger and close.
- `DrawerContent` — div.ui-glass.ui-drawer[data-snap][data-dragging] with button.ui-drawer-handle first, scrim, portal. `handleLabel?: string` (default "Resize: drag, or press to open fully"), `container?`; *Radix* content props. Opens at the first snap (`--ui-drawer-snap`), drags by the handle or the header, snaps to full or away; the handle's click, ArrowUp and ArrowDown move between snaps.
- `DrawerHeader` (div.ui-drawer-header, drags too), `DrawerTitle` (*Radix* h2.ui-drawer-title), `DrawerDescription` (*Radix* p.ui-drawer-description), `DrawerBody` (div.ui-drawer-body), `DrawerFooter` (div.ui-drawer-footer, buttons share the width).
- `useNarrowScreen(query?: string): boolean` — true at max-width 600px: render Drawer there, Sheet on a desk (shadcn's responsive pattern).
- Type `SheetSide`.

## Popover (`popover.tsx`, popover.css, Radix Popover)
- `Popover` — root. `open?`, `defaultOpen?`, `onOpenChange?(open)`, `modal?` (default false). Type `PopoverProps`.
- `PopoverTrigger` — *Radix* toggle button (aria-haspopup, aria-expanded, data-state); `asChild`.
- `PopoverAnchor` — *Radix* places it against something other than the trigger.
- `PopoverContent` — div.ui-glass.ui-popover[role=dialog][data-side][data-align] in a portal. `side?: "top" | "right" | "bottom" | "left"` (default bottom), `align?: "start" | "center" | "end"` (default center), `sideOffset?` (default `--ui-overlay-offset`, 8), `collisionPadding?` (default `--ui-overlay-margin`, 16), `container?`; *Radix* content props. Name it: `aria-labelledby` = the PopoverTitle's id.
- `PopoverHeader` — div.ui-popover-header. `PopoverTitle` — h3.ui-popover-title ("Share with Anna"). `PopoverDescription` — p.ui-popover-description.
- `PopoverRow` — div.ui-popover-row: an `input.ui-input` and its one white button on a line.
- `PopoverClose` — *Radix* closes and returns focus; `asChild`.
- `.ui-popover--list` (round 9, DWAY-11) — className on PopoverContent for a popover that holds a whole list (the bell): `div.ui-popover-head` (title + one clear button), `div.ui-popover-tabs[role=tablist] > button.ui-popover-tab[role=tab][aria-selected]`, `div.ui-popover-scroll` (scrolls on its own). Up to 70 % of the screen's height.

## Tooltip (`tooltip.tsx`, tooltip.css, Radix Tooltip)
- `TooltipProvider` — once near the app root. `delayDuration?` (default `--ui-tooltip-delay`, 500), `skipDelayDuration?` (default `--ui-tooltip-skip-delay`, 300), `disableHoverableContent?`, `children`.
- `Tooltip` — root. `open?`, `defaultOpen?`, `onOpenChange?(open)`, `delayDuration?`. Adds the touch long press (`--ui-tooltip-long-press`): shows for a moment, the ending tap does not act.
- `TooltipTrigger` — *Radix* the control it names; `asChild` around a Button. The Button keeps its own `aria-label`.
- `TooltipContent` — div.ui-glass.ui-glass--small.ui-tooltip in a portal: span.ui-tooltip-label (children) + span.ui-tooltip-kbd. `shortcut?: string` ("⌘D"), `side?` (default top), `sideOffset?` (default 8), `collisionPadding?` (default 16), `container?`. One short line; repeat the trigger's label, never add information only here.
- `WithTooltip` — shorthand. `label: ReactNode`, `shortcut?: string`, `side?`, `children: ReactElement` (one element that takes a ref). Brings its own TooltipProvider when none is above.
- Round 9 (DWAY-9): an icon-only `Button` names itself (see controls/API.md: `shortcut`, `tooltip`); you only need `WithTooltip` for other icon-only controls. Shortcuts are written the Mac way (`"⌘B"`) and shown as the keyboard says it (`shortcutLabel`: "Ctrl+B" off a Mac). A tooltip opens on keyboard focus only, not when a closing layer hands focus back after a click.
- `useInTooltipTrigger(): boolean` — true inside a TooltipTrigger (Button reads it, so it does not wrap twice).

## Dropdown menu (`dropdown-menu.tsx`, menu.css, Radix DropdownMenu)
- `DropdownMenu` — root. `open?`, `defaultOpen?`, `onOpenChange?(open)`, `modal?` (default true), `dir?`. Type `DropdownMenuProps`.
- `DropdownMenuTrigger` — *Radix* button (aria-haspopup="menu", aria-expanded, data-state); `asChild`.
- `DropdownMenuContent` — div.ui-glass.ui-menu[role=menu] in a portal, rows edge to edge. `side?` (default bottom), `align?` (default start), `sideOffset?` (default 8), `collisionPadding?` (default 16), `container?`; *Radix* `loop`, `onCloseAutoFocus`, `onEscapeKeyDown`, ….
- `DropdownMenuItem` — *Radix* div.ui-menu-item[role=menuitem]. `icon?: IconName`, `danger?: boolean` (.ui-menu-item--danger: neutral at rest, Rouge when reached), `onSelect?(event)`, `disabled?`, `textValue?`, `asChild?` (an `<a>` row; put the icon inside the child).
- `DropdownMenuCheckboxItem` — *Radix* row[role=menuitemcheckbox] with svg.ui-menu-check at the end. `checked?: boolean | "indeterminate"`, `onCheckedChange?(checked)`, `icon?`, `disabled?`, `onSelect?` (call `event.preventDefault()` to keep the menu open).
- `DropdownMenuRadioGroup` — *Radix* `value?`, `onValueChange?(value)`.
- `DropdownMenuRadioItem` — *Radix* row[role=menuitemradio] with the check at the end. `value: string` (required), `icon?`, `disabled?`.
- `DropdownMenuLabel` — *Radix* div.ui-menu-label: a group's name.
- `DropdownMenuSeparator` — *Radix* div.ui-menu-sep[role=separator]: space between groups, never a line.
- `DropdownMenuGroup` — *Radix* role=group wrapper.
- `DropdownMenuShortcut` — kbd.ui-menu-shortcut, last in a row ("⌘D", "↵").

## Command palette (`command.tsx`, command.css, Radix Dialog)
- `CommandPalette` — the ⌘K palette as one component. Props:
  `items: CommandPaletteItem[]`; `open?`, `defaultOpen?`, `onOpenChange?(open)`;
  `hotkey?: boolean` (default true: ⌘K / Ctrl+K toggles; one per page);
  `label?: string` (default "Command palette"), `inputLabel?: string` (default "Search creatives, campaigns and actions"),
  `placeholder?: string` (default "Search creatives, campaigns and actions");
  `emptyTitle?: (query: string) => ReactNode` (default Nothing matches “query”), `emptyHint?: ReactNode` (default "Try a campaign, a format such as Story, or Anna.");
  `footer?: ReactNode | false` (default the Move / Open / Close key hints; hidden on touch by the CSS); `className?`, `container?`.
- `CommandPaletteItem` (type) — `{ id: string; label: string; group?: string; icon?: IconName; shortcut?: string[]` (one kbd each, e.g. `["⌘", "G"]`)`; meta?: string` ("Approved", "12 creatives", "After the check"; shortcut wins when both)`; keywords?: string; disabled?: boolean; onSelect: () => void }`. Groups keep the order they first appear in; an item without a group sits in a group with no heading. Choosing closes the palette, then runs `onSelect`.
- `normalizeSearch(s: string): string` — the matcher's lower-case, accent-free form.
- Round 9 (DWAY-8, DWAY-10): closing gives focus back to what had it when the palette opened, unless the choice went to another page; the list is `min(600px, 70vh)` on a desk.

## Toast (`toast.tsx`, toast.css)
- `ToastProvider` — renders section.ui-toaster once (portal) and provides `useToast()`. `label?: string` (default "Notifications (Alt+T)"), `container?`, `children`.
- `useToast(): ToastApi` — throws outside a ToastProvider. The `ToastApi`:
  - `toast(options: ToastOptions | string): ToastHandle` — a string is a done toast's title.
  - `done(title, options?)`, `error(title, options?)`, `loading(title, options?)`, `info(title, options?)` — options are ToastOptions without title and type.
  - `promise(promise, { loading: string, done: string | (value) => Partial<ToastOptions>, error: string | (error) => Partial<ToastOptions> }): ToastHandle`.
  - `dismiss(id?)` — one toast, or all.
- `ToastOptions` (type) — `{ title: string; description?: string; type?: "done" | "error" | "loading" | "info"` (default done)`; meta?: string` (a count in the data type, "4 of 12")`; action?: { label: string; onClick?: (event) => void }` (one clear button, e.g. Undo; the toast leaves after it runs)`; duration?: number` (ms; default 5000, 8000 with an action or for an error, loading stays)`; id?: string | number }`. The toast is one line: a `description` is joined to the title as a second sentence on it.
- `ToastHandle` (type) — `{ id; update(changes: Partial<ToastOptions>): ToastHandle; dismiss(): void }` (a loading toast becomes done with `update({ type: "done", title: "12 creatives ready" })`).
- Types `ToastType`, `ToastAction`, `ToastApi`, `ToastProviderProps`.
- Undo: `toast({ title: "3 creatives approved", action: { label: "Undo", onClick: undo } })`.
- `leave()` — the page changed: toasts raised more than a moment ago leave (one raised with the move, one with an action and a loading one stay). The app's Root calls it.
- Round 9 (DTSK-19): at 1024 px and wider toasts sit at the bottom left of the main column (`.ui-sidebar-inset`), 24 in. A screen can name another place: `data-ui-toast-anchor` on a column puts them at its bottom left, `data-ui-toast-anchor="top"` at its top left (the viewer's comments panel); the last one shown wins. Up to three show; the same title (or id) raised while it shows refreshes that toast instead of stacking a second. A toast rises above what sits at the foot under it ([data-ui-foot], a composer, a footer) and above the control with focus when it is low on the screen.

## Helpers
- `tokenPx(name, fallback)`, `tokenMs(name, fallback)` — read a `--ui-*` token at run time (px or ms).
- `currentOpener(): HTMLElement | null` and `returnFocusTo(opener, layer?): boolean` (round 9, DWAY-8) — for a custom layer: note `currentOpener()` when it opens (in `onOpenAutoFocus`), and in `onCloseAutoFocus` call `if (returnFocusTo(opener, layerEl)) event.preventDefault()`. It skips an opener that is gone or inside the layer (then the element focused just before it), and gives nothing back when the page changed.
- `submitOnModEnter(event)` (dialog.tsx, round 9) — an `onKeyDown` handler: ⌘↵ / Ctrl+↵ submits the form around the focus (DialogContent and SheetContent use it already).
- `useNarrowScreen()` — see Sheet and drawer.
