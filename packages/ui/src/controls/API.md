# @fume/ui controls: API

PROPOSED, 14 Oct 2026. One line per export. Every component also takes `className` (merged) and the native props of
its root element (`...props`); components marked *ref* forward a ref to that element. Words are yours to pass: say
"creative", never "file"; the expert's state is "In check" / "Checked by Anna"; "Approve" is only the customer's.
Import from `@fume/ui` (or `@fume/ui/src/controls`). Icons are `IconName`s from `../icons`.

## Buttons
- `Button` *ref button* — `variant?: "primary" (default) | "secondary" | "quiet" | "danger" | "link" | "glass-white" | "glass-clear" | "glass-danger"`, `size?: "sm" | "md" (default) | "lg"`, `iconOnly?: boolean` (circle; needs `aria-label`), `icon?: IconName` (before the label), `iconEnd?: IconName`, `loading?: boolean` (aria-busy, spinner replaces `icon`, label stays), `asChild?: boolean` (render the one child, e.g. a router Link, as the button), `type` defaults to `"button"`. Glass variants only inside a `.ui-glass` surface: one `glass-white` or `glass-danger` per surface, the rest `glass-clear`. Round 9 (DWAY-9; PROPOSED 19 Oct 2026): an `iconOnly` Button shows its `aria-label` in a tooltip, with `shortcut?: string` beside it (written the Mac way, `shortcut="⌘K"`, shown "Ctrl+K" off a Mac); `tooltip?: string | false` gives shorter words or none. Inside a `TooltipTrigger` / `WithTooltip` it does not add a second one.
- `buttonClass({ variant?, size?, iconOnly? })` — the class string alone, for an element that only needs the look.
- `ButtonGroup` *ref div* — `orientation?: "horizontal" (default) | "vertical"`, `size?: "sm" | "md"` (sm for small text segments). role="group": give it `aria-label`. Children are `Button`s; a split button is a `Button` plus an `iconOnly` chevron `Button` with `aria-haspopup="menu"` and `aria-expanded`.
- `ButtonGroupText` *ref span* — `numeric?: boolean` (data face). A sunken segment holding a value or a label.
- `ButtonGroupSeparator` *ref span* — no props; 8 of space between buttons, never a line.

## Status and loading
- `Badge` *ref span* — `variant?: "neutral" (default) | "ink" | "secondary" | "danger"`, `count?: boolean` (20 px, tabular; add `aria-label` like "2 new"), `check?: "waiting" | "approved"` (grey or Amber checked triangle before the words: "In check", "Checked by Anna", "Approved"), `dot?: "on" | "live" | "idle" | "danger"` (dot before the label), `icon?: IconName`, `asChild?: boolean` (a link or button badge; gets hit area, hover, press, focus).
- `BadgeDot` *ref span* — `kind?: "on" (default) | "live" | "idle" | "danger"`. The dot alone, decorative.
- `DotBadge` *ref span* — no props. `.ui-badge--dot`: a dot at the corner of an icon button or avatar (inside a positioned wrapper); put the meaning in the button's `aria-label`.
- `Kbd` *ref kbd* — children: the key ("⌘K", "Esc"). Not a button.
- `KbdGroup` *ref kbd* — children: `Kbd`s pressed together.
- `shortcutLabel(shortcut: string, mac?: boolean): string` (round 9) — a shortcut written the Mac way ("⌘B", "⇧⌘Z") as this keyboard says it: unchanged on a Mac, "Ctrl+B", "Ctrl+Shift+Z" elsewhere. `isMacPlatform(): boolean`.
- `Spinner` *ref svg* — `size?: "sm" | "md" (default) | "lg" | "xl"`, `label?: string` (default "Loading"), `decorative?: boolean` (aria-hidden, when words beside it say what is happening).
- `SpinnerLabel` *ref span* — `stack?: boolean` (spinner above the words, centred), `size?: SpinnerSize` (default md, xl when stacked); children: what is happening ("Generating 12 creatives"). role="status".
- `Progress` *ref div* — `value?: number | null` (omit or null = indeterminate), `max?: number` (default 100), `glass?: boolean`. Sets role="progressbar", aria-value*, data-state loading|complete|indeterminate and `--value`. Label it with `aria-label` or `aria-labelledby`.
- `ProgressField` *ref div* — `glass?: boolean`. Wraps a `ProgressHead` and a `Progress` or `Steps`, 8 apart.
- `ProgressHead` *ref div* — `label: ReactNode`, `labelId?: string` (for aria-labelledby), `num?: ReactNode` (value as data: "7 / 12"), `hint?: ReactNode` ("A few seconds", "Step 2 of 4").
- `Steps` *ref ol* — children: `StepsItem`s (sets `--steps` when there are not 4). Label it with `aria-labelledby`.
- `StepsItem` *ref li* — `state: "complete" | "active" | "upcoming"`, `value?: number` (0 to 100, how far the active stage is); children: the stage name ("Brief", "Generate", "Quality Gate", "Delivered"). Complete shows a check; active sets aria-current="step".
- `Skeleton` *ref span* — `shape?: "text" | "title" | "pill" | "circle" | "media" | "creative" | "thumb" | "card"`, `index?: number` (`--i`, staggered breath), `width?: string` (`--w`, text/title/pill), `size?: string` (`--s`, circle/media/thumb), `ratio?: string` (`--ratio`, creative, e.g. "9 / 16"), `height?: string` (`--h`, card), `onSurface?: boolean`, `onGlass?: boolean`. aria-hidden unless it has children; put `aria-busy` and a label on the loading container.
- `SkeletonEngine` *ref span* — `meta: ReactNode` ("Generating · 4 of 12"). The Engine and its progress, as the child of a `Skeleton shape="creative"`.
- `TextShimmer` *ref span* — white light through dark words (the Engine's words too; the Amber variant was removed 15 Oct). Children: words under way right now. At most one per view; never on a decision, check or the upload box.

## People and space
- `Avatar` *ref span* — `size?: "sm" | "md" (default) | "lg"`, `ink?: boolean` (the person who decides), `src?: string`, `alt?: string`, `initials?: string` (fallback, shown beneath the image and when it fails), `status?: "here" | "away"`; children are extra parts. Not a control; for an avatar that names someone add `role="img"` and `aria-label`, otherwise `aria-hidden`.
- `AvatarImage` *ref img* — native img props; removes itself if it fails to load.
- `AvatarFallback` *ref span* — children: initials.
- `AvatarBadge` *ref span* — `status?: "here" (default) | "away"`. Status dot cut out of the avatar.
- `AvatarGroup` *ref span* — children: `Avatar`s and an `AvatarGroupCount`; give it `role="img"` and an `aria-label` naming everyone.
- `AvatarGroupCount` *ref span* — children: "+3".
- `Separator` *ref div* — `orientation?: "horizontal" (default) | "vertical"`, `size?: "sm" | "md" (default) | "lg"`, `decorative?: boolean` (default true → role="none"; false → role="separator"). Space, never a line.

## Fields
- `Input` *ref input* — `size?: "sm" | "md" (default) | "lg"`, `type` defaults to "text"; native input props. Errors: `aria-invalid` plus a `FieldError`.
- `Textarea` *ref textarea* — native textarea props; grows with its text (CSS field-sizing, or JS fallback).
- `growTextarea(el)` — the JS fallback, for a textarea you render yourself.
- `Label` *ref label* — native label props (`htmlFor`). A label on its own.
- `FieldLabel` *ref label|span* — `as?: "label" (default) | "span"` (span for a group or a Select; point `aria-labelledby` at its `id`), `htmlFor`.
- `FieldOptional` *ref span* — children default "Optional"; goes inside a `FieldLabel`.
- `Field` *ref div* — `orientation?: "vertical" (default) | "horizontal" | "responsive"` (responsive: horizontal once its `FieldGroup` is 560 wide), `invalid?: boolean` (data-invalid), `disabled?: boolean` (data-disabled; disable the control too). role="group".
- `FieldContent` *ref div* — label and description together beside a control (horizontal fields, choice cards).
- `FieldTitle` *ref span* — a title that is not a label.
- `FieldControl` *ref div* — a control with its error under it, in the right column of a horizontal field.
- `FieldDescription` *ref p* — help under the field; give it an `id` for the control's `aria-describedby`.
- `FieldError` *ref p* — children, or `errors?: ReactNode[]` (several become a list); renders nothing when empty; role="alert"; the circle-alert icon comes first.
- `FieldFoot` *ref div* — a description or error and a `FieldCount` on one line.
- `FieldCount` *ref span* — `count: number`, `max?: number` ("n / max", Ink from 90 %).
- `FieldGroup` *ref div* — fields 24 apart, sets 32; the container for responsive fields.
- `FieldSet` *ref fieldset* — native fieldset props.
- `FieldLegend` *ref legend* — `variant?: "legend" (default) | "label"`.
- `FieldSeparator` *ref div* — children optional ("or"); space, never a line.
- `FileInput` *ref input* — `placeholder: string` (required: what to choose), `icon?: IconName` (default paperclip, image once chosen), `actionLabel?: string` (default "Browse"), `replaceLabel?: string` (default "Replace"), `onFilesChange?: (files: File[]) => void`; native file input props (`accept`, `multiple`, `id`, `aria-invalid`, `disabled`, `onChange`). Shows the creative's name (or "n creatives") and size.
- `FieldChoices` *ref div* — role="group" (label it); children: `FieldChoice`s, cards side by side once there is room.
- `FieldChoice` *ref input* — `type?: "checkbox" (default) | "radio"`, `title: ReactNode`, `description?: ReactNode` (data: "1080 × 1350"), `ratio?: string` ("4 / 5", the format's shape), `tall?: boolean`; native input props (`name`, `value`, `checked`, `defaultChecked`, `onChange`, `disabled`).

## Input group
- `InputGroup` *ref div* — `size?: "sm" | "md" (default) | "lg"`, `invalid?: boolean`, `disabled?: boolean` (both also follow the control inside). Add `role="search"` for search.
- `InputGroupAddon` *ref div* — `align?: "inline-start" (default) | "inline-end" | "block-start" | "block-end"`. A click on it (not on a button) focuses the control.
- `InputGroupText` *ref span* — quiet words: "https://", "kr".
- `InputOTP` *ref input* — `value: string`, `onChange(value)`, `onComplete?(value)` when every slot is filled, `length?: number` (default 6, two groups), `invalid?: boolean`. A sign-in code: one real input (`autocomplete="one-time-code"`) over the slots, digits only (input-otp.css). Give it an `aria-label`.
- `InputGroupInput` *ref input* — native input props; `onClear?: () => void` (Escape while it holds text). Needs a `placeholder` for the clear button to hide when empty.
- `InputGroupTextarea` *ref textarea* — native textarea props; grows. Buttons go under it in an `align="block-end"` addon.
- `InputGroupButton` *ref button* — all `Button` props (variant defaults to "quiet"; "primary" for the Ink send button), `clear?: boolean` (circle-x, shown only while the field holds text, refocuses the field; you empty the value in `onClick`). Icon-only automatically when `clear`, or `icon` without children: give it `aria-label`.

## Select
- `Select` — Radix Select.Root props (`value`, `defaultValue`, `onValueChange(value: string)`, `open`, `defaultOpen`, `onOpenChange`, `name`, `required`, `disabled`, `dir`, `form`, `autoComplete`) plus `className` for the `.ui-select` wrapper. Not a ref component.
- `SelectTrigger` *ref button* — `size?: "sm" | "md" (default)`; Radix Trigger props (`aria-labelledby`, `aria-invalid`, `disabled`, `id`). Children: a `SelectValue`. Adds the chevrons-up-down icon.
- `SelectValue` *ref span* — `placeholder?: ReactNode` ("Choose a brand"); Radix Value props.
- `SelectContent` *ref div* — Radix Content props (`position?: "popper" (default) | "item-aligned"`, `sideOffset` default 8, `align` default "start", `side`, `collisionPadding`, `onCloseAutoFocus`, `onEscapeKeyDown`), `container?: Element | DocumentFragment | null` (portal target). The glass listbox.
- `SelectGroup` *ref div* — Radix Group props; children: a `SelectLabel` and items.
- `SelectLabel` *ref div* — a group's quiet title.
- `SelectItem` *ref div* — `value: string` (required, not ""), `disabled?: boolean`, `textValue?: string` (typeahead when children are not text), `meta?: ReactNode` (data beside the option, mono). Children: the option's words. The check shows when chosen.
- `SelectSeparator` *ref div* — space between groups.
- `NativeSelect` *ref select* — `size?: "sm" | "md" (default)`, `wrapperClassName?: string`; native select props and `<option>` children (`<option value="">` chosen reads as placeholder).

## Day and time (round 13, #37; PROPOSED 22 Oct 2026; never a native date or time input)
- `DateField` *ref button* — `value: string` ("YYYY-MM-DD" or ""), `onChange(value: string)` ("" after Clear), `size?: "sm" | "md" (default) | "lg"`, `min?`/`max?: string` ("YYYY-MM-DD"; days outside fade and cannot be picked), `required?: boolean` (aria-required, no Clear), `placeholder?: string` (default "Pick a day"), `today?: string` (the dot; default this device's day, the app passes the demo's), `container?`; button props (`id` for a `FieldLabel htmlFor`, `aria-label`, `aria-describedby`, `aria-invalid`, `disabled`, `data-ui-autofocus`). The field's look, the day as "Sat 17 Oct 2026", the calendar icon; opens the month in a glass popover (Monday first, today a dot, the chosen day the white pill; arrows, Home/End, PageUp/PageDown; Enter or Space picks; Esc closes back to the field).
- `TimeField` — `value: string` ("HH:MM", 24-hour, or ""), `onChange(value: string)`, `step?: number` (minutes, default 15: "00:00" … "23:45"; a value between slots is listed too), `id?`, `size?: "sm" | "md"`, `disabled?`, `required?`, `aria-labelledby?` (a `FieldLabel as="span"`, as for Select), `aria-label?`, `aria-describedby?`, `aria-invalid?`, `placeholder?` (default "Pick a time"), `className?`, `container?`. The glass Select with the slots. Not a ref component.

## Choices
- `Checkbox` *ref button* — Radix Checkbox props: `checked?: boolean | "indeterminate"`, `defaultChecked`, `onCheckedChange(checked: CheckedState)`, `disabled`, `required`, `name`, `value`, `aria-invalid`, `aria-label`/`id`.
- `CheckedState` — type: `boolean | "indeterminate"`.
- `Choice` *ref label* — `end?: boolean` (control at the end of the row, for switches in settings), `disabled?: boolean`. Children: the control and a `ChoiceText`.
- `ChoiceText` *ref span* — `label?: ReactNode`, `hint?: ReactNode`, `error?: ReactNode` (Rouge words with the alert icon), `errorId?: string` (for the control's `aria-describedby`); extra children after them.
- `ChoiceLabel` *ref span*, `ChoiceHint` *ref span* — the label and hint lines alone, for custom `ChoiceText` content.
- `ChoiceGroup` *ref div* — `legend?: ReactNode` (title 8 above the rows; labels the group). role="group". For checkbox rows.
- `RadioGroup` *ref div* — Radix RadioGroup props (`value`, `defaultValue`, `onValueChange(value: string)`, `name`, `required`, `disabled`, `orientation?: "horizontal" | "vertical"`, `loop`, `aria-label`/`aria-labelledby`, `aria-invalid`), `cards?: boolean` (a grid of `RadioCard`s).
- `RadioGroupItem` *ref button* — `value: string`, `disabled?: boolean`; in a `Choice` its words label it, alone give it `aria-label`.
- `RadioCard` *ref button (the radio)* — `value: string`, `title: ReactNode`, `meta?: ReactNode` (data: "1080 × 1350 · 4:5"), `preview?: ReactNode`, `disabled?: boolean`, `itemLabel?: string` (radio's name, default the title when it is a string). Inside `<RadioGroup cards>`.
- `RadioCardPreview` *ref span* — the preview slot for a hand-built card.
- `Switch` *ref button* — Radix Switch props (`checked`, `defaultChecked`, `onCheckedChange(checked: boolean)`, `disabled`, `required`, `name`, `value`, `aria-invalid`), `size?: "sm" | "md" (default)`, `glass?: boolean`.

## Toggles, segmented control, tabs
- `Toggle` *ref button* — `pressed?: boolean`, `defaultPressed?: boolean`, `onPressedChange?: (pressed: boolean) => void`, `variant?: "default" | "outline"`, `size?: "sm" | "md" (default) | "lg"`, `iconOnly?: boolean` (circle; needs `aria-label`), `icon?: IconName`.
- `ToggleGroup` *ref div* — `type: "single" | "multiple"` (required). Single: `value?: string`, `defaultValue?: string`, `onValueChange?: (value: string) => void`, `allowEmpty?: boolean` (let the last one go off; value ""). Multiple: `value?: string[]`, `defaultValue?: string[]`, `onValueChange?: (value: string[]) => void`. Both: `variant?`, `size?` (passed to items), `loose?: boolean` (8 apart), `orientation?: "horizontal" | "vertical"`, `disabled?: boolean`. Label it with `aria-label`.
- `ToggleGroupItem` *ref button* — `value: string`, `iconOnly?: boolean`, `icon?: IconName`, `disabled?: boolean`.
- `SegmentedControl` *ref div* — `value?: string`, `defaultValue?: string`, `onValueChange?: (value: string) => void`; `aria-label` required. role="tablist"; the white pill slides; arrows, Home, End choose.
- `SegmentedOption` *ref button* — `value: string`, `count?: ReactNode` (after the label, tertiary).
- `Tabs` *ref div* — `value?: string`, `defaultValue?: string`, `onValueChange?: (value: string) => void`, `orientation?: "horizontal" (default) | "vertical"` (vertical for settings pages).
- `TabsList` *ref div (the tablist)* — `scroll?: boolean` (horizontal only, default true: wraps it in `.ui-tabs-scroll`); `aria-label` required.
- `TabsTrigger` *ref button* — `value: string`, `icon?: IconName` (vertical), `count?: ReactNode` (horizontal), `hint?: ReactNode` (vertical, at the row's end), `disabled?: boolean`.
- `TabsContent` *ref div* — `value: string`, `forceMount?: boolean` (keep mounted and hidden while inactive; default unmounted).

## Helpers
- `Slot` *ref* — renders its one child with merged props (classes joined, handlers chained, refs composed); the `asChild` engine for non-Radix controls.
- `composeRefs(...refs)` — one callback ref that sets them all.
- `useSlidingIndicator(listRef, indicatorRef, selectedKey, axis?: "x" | "y")` → `{ ready, placing }` — places `--x/--w` or `--y/--h` on an indicator; add `is-ready` / `is-placing` to the track.
