# @fume/ui studio: API

PROPOSED, 15 Oct 2026 (FLOWS §9.3). The Studio's small control library: when an agent makes a new mode, it writes a
schema and picks a control for each variable from this list; the Studio renders every variable through
`ModeControl`. Styles: `design-system/components/studio-controls.css` (the controls, folding sections, mode grid) and
`studio-desk.css` (the full-screen desk the app draws around them). Import from `@fume/ui`.

The shapes mirror the app contract (`app/src/contract/entities/studio.ts` and `production.ts`: `ModeVariable`, `VarValue`, `LightAngle`, `Lens`)
structurally, so a backend mode can be passed straight in and packages/ui never imports app code.

## Shapes (`types.ts`)
- `StudioControlKind` — `"slider" | "segmented" | "select" | "swatch" | "toggle" | "angle" | "lens" | "chips" | "text" | "number" | "lightboard"`.
- `StudioVariable` — `{ key, label, control: StudioControlKind, section, default: StudioValue, min?, max?, step?, unit?, options?: StudioOption[], brandPreset?: "background" | "colour" | "light", help? }` (= the contract's `ModeVariable`).
- `StudioValue` — `string | number | boolean | string[] | StudioLightAngle | StudioLensValue | StudioLightRig` (= `VarValue`).
- `StudioLightAngle` — `{ azimuth, elevation }`: degrees around the subject (0 from the camera, 90 from the right, -90 from the left) and above the horizon (0–90).
- `StudioLensValue` — `{ focal, height, tilt }`: mm, cm from the surface, degrees (negative looks down).
- `StudioLight` — `{ id, kind: "key" | "fill" | "rim" | "practical", x, y, height, warmth, strength, softness }`: one light on the advanced board. `x`/`y` 0–1 on the board seen from above (0,0 back left; the camera at the foot, y = 1), `height` 0–90°, `warmth` in K, `strength` and `softness` 0–100. `StudioLightRig` — `{ lights: StudioLight[] }` (= the contract's `LightRig`).
- `StudioLookSource` — `"brand" | "fume" | "own" | "engine"` (= the contract's `LookSource`): where a look section comes from (FLOWS §18).
- `StudioOption` — `{ value, label, hex? }`.
- `StudioPreset` — `{ name, hex?, brand }`: one of the brand's chosen colours or settings (FLOWS §9.4); `brand` is the brand's name shown on it ("LYSNE").
- `StudioControlProps<V>` — what every control takes: `value: V`, `onChange(value: V)`, `label: string`, `disabled?`, `id?` (default from the label).

## The dispatcher
- `ModeControl` — `variable: StudioVariable`, `value: StudioValue | undefined` (the default when undefined), `onChange(value)`, `presets?: StudioPreset[]` (the brand's presets of the variable's `brandPreset` kind), `disabled?`. Renders the control the variable's `control` names, with its label, readout and help.
- `studioValueWords(variable, value)` — a value in words for a change line: "Hair length 40 → 65", "70° from the right, 20° up", "Wavy".

## Controls (each in a `StudioRow`: a 12 px label, the value as data at the end of the label line, the control under it)
- `StudioSlider` — `min?` (0), `max?` (100), `step?` (1), `unit?` ("%", "K", "mm", "°", "years"), `help?`, `format?(value) => string` (the readout in words), `bare?` (the track alone, inside another control). The design system's slider (slider.css): drag anywhere on the track; arrows, Page Up/Down, Home/End. `withUnit(value, unit)` writes "60 %", "2700 K", "20°".
- `StudioSegmented` — `options`, `help?`. One of a few; the SegmentedControl made full width.
- `StudioSelect` — `options`, `presets?`, `placeholder?`, `help?`. One of many, on the small Select. Options whose label is a preset's name come first under "LYSNE’s choice", marked with the brand.
- `StudioSwatch` — `options`, `presets?`, `help?`. Round swatches, a radio group (arrow keys). The brand's chosen colours lead in a sunken pill named by the brand, then the mode's other colours. The colour is data: `style="--swatch: #F4EFE8"`.
- `StudioToggle` — `help?`. A small Switch on the label line.
- `StudioChips` — `options`, `help?`. Several of a few: small outline pills that wrap (ToggleGroup multiple); the readout counts them ("2 of 5").
- `StudioText` — `placeholder?`, `rows?: 1 | 2 | 3` (2), `help?`. Words: a direction, what to make.
- `StudioNumber` — `min?`, `max?`, `step?`, `unit?`, `help?`. A count with a minus and a plus pill.
- `StudioAngle` — `step?` (5), `help?`. The light direction dial: a sunken disc seen from above, the subject in the middle and the camera at its foot; drag the Ink light point round it (azimuth), set its height with the small slider beside it (elevation). Arrow keys turn it. `angleWords(value)` → "70° from the right".
- `StudioLens` — `focal?: [min, max]` ([14, 200]), `height?` ([0, 200]), `tilt?` ([-45, 45]), `help?`. Focal length, camera height and tilt as three small sliders under one label.

- `StudioLightboard` — `selected?` / `onSelect?(id)` (the chosen light; kept inside when not given), `onDragging?(dragging, id)` (a light is dragged or let go: the desk draws it on the creative), `preview?: ReactNode` (a slot beside the board for a 3D view; the app lazy-loads its three.js view there so the library stays free of three.js), `max?` (6), `help?`. Advanced light (FLOWS §18): a square sunken board seen from above (the subject in the middle, the camera at the foot); each light a white dot named by its first letter, the chosen one Ink; drag a dot, or press the empty board to bring the chosen light there; arrow keys move the focused dot (Shift for bigger steps). Under it the chosen light in a segmented control, a plus to add a light (the next missing kind) and a bin to remove the chosen one (one always stays), the chosen light's kind, and its warmth (2000–6500 K), strength, softness and height as small sliders. Readout: "2 lights". Through `ModeControl` it renders without the 3D slot.
- `StudioLightOverlay` — `rig`, `selected?`, `active` (shown while true, fades when false). The lights drawn on the creative while one is dragged: a white disc blurred with `filter: blur` (never a gradient) where each light falls on the frame (`lightOnFrame(light)`), wider when soft, stronger when strong, with a sharp pin on the dragged one. Put it inside the creative's frame (a `position: relative` box over the image).
- Helpers: `kelvinToRgb(kelvin) → [r, g, b]` (for a 3D preview of the warmth), `lightNames(rig)` ("Key", "Fill", "Fill 2"), `lightKindNames`, `lightOnFrame(light) → { x, y }`.

## Look sources and presets (FLOWS §18, `source.tsx`, `camera-presets.tsx`; styles in `studio-light.css`)
Every section that sets a look (Light, Camera, any section with a `brandPreset`) puts `StudioSource` at its head. Brand and Fume show the presets and their values read-only (`StudioPresetPicker` or `StudioCameraPresets`, then `StudioSummary` with Adjust, which switches to Own starting from the preset); Own shows the section's controls as before; Engine shows `StudioEngineNote` and no controls. The app keeps the choice in `document.sources[section]` (`useSetSource`).
- `StudioSource` — `value: StudioLookSource`, `onChange(source)`, `label` (the section: names it "Light comes from"), `brand?` (said in the Brand option's title: "LYSNE’s own"), `campaign?` (v5: the creative's campaign when it has a look of its own, e.g. "Black Friday": adds Campaign as the first option, each option then as wide as its word), `unavailable?: StudioLookSource[]` (shown, not choosable: no brand preset yet), `disabled?`. (Campaign ·) Brand · Fume · Own · Engine as a small full-width segmented control. `lookSourceNames` gives the words. `StudioPreset.brand` names whose a swatch is: `StudioSwatch` groups presets by it, so a campaign's colours lead under its name and the brand's follow.
- `StudioPresetPicker` — `items: StudioPresetItem[]` (`{ id, name, line?, meta?, image?, hex? }`), `value?` (the preset in force), `onPick(id)`, `label` (names the radio group: "LYSNE’s light"), `disabled?`. Rows on the sunken surface: a picture or a colour, the name, data at the end of the name line ("85 mm"), one line under it; the one in force lifts onto the surface with an Ink ring (never Amber). Arrow keys move.
- `StudioCameraPresets` — `presets: StudioCameraPresetData[]` (`{ id, name, body, lens: StudioLensValue, image, note? }`, = the contract's `CameraPreset`), `value?`, `onPick(preset)`, `label`, `disabled?`. The brand's named camera specs ("LYSNE close · 85 mm") or Fume's camera presets as small cards with the picture of the camera, its name with the focal length, and its body and lens line ("Hasselblad X2D 100C · XCD 90 mm"); the chosen one's note under them. Picking one sets the lens (the app writes `preset.lens` to the `lens` variable).
- `StudioSummary` — `rows: { label, value }[]`, `onAdjust?`, `disabled?`. The section's values in words, read-only, and an Adjust pill (secondary, sliders icon).
- `StudioEngineNote` — children: the quiet line with the Engine's icon, "The Engine decides the light".

## Desk parts
- `StudioFolds` — `sections: StudioFold[]` (`{ id, title, meta?, children }`), `label` (names the group), `initialOpen?: string[]` (first = most wanted; default all), `newest?` with `newestKey?` (a section that just grew or was just used, e.g. advanced light turned on: it opens and becomes the newest, so the others fold first; it takes effect whenever either changes). A panel's folding sections, like Photoshop's: the panel never scrolls; when the open sections no longer fit its height, the one opened longest ago folds (one always stays open). Give it a flex parent with a fixed height.
- `StudioModeGrid` — `modes: StudioModeTileData[]` (`{ id, name, description, available, output: "creative" | "model" | "reference", icon? }`), `value?` (the mode in use, marked), `onPick(id)`, `disabled?`, `compact?` (two columns, for a popover), `large?` (big tiles for a first choice: Render, Design, Video). A mode that is not built (`available: false`) is dimmed and says "Coming later". Inside a glass popover the tiles take the glass look.
- `StudioRow` — `label`, `htmlFor?`, `labelId?`, `readout?`, `inline?` (a control on the label line), `help?`, `disabled?`. The row every control sits in; use it for a custom control so it lines up.

## How an agent adds a mode
1. In the backend (today the mock: `modes` in `app/src/mock/seed/studioModes.ts`), write a `StudioMode`: `id`, `studio` ("render" | "design" | "video"), `name`, a one-line `description`, `output` ("creative", "model" or "reference"), `sections` (the right panel's order), `uses` (which left-panel specs it needs: "product", "model", "reference", "count") and `available`.
2. For each variable the Engine needs to write the prompt, add a `ModeVariable`: a `key` (the JSON name the Engine reads), a `label` in plain words, the `section` it sits in, a `default`, and the `control` from the list above with what it needs: `min`/`max`/`step`/`unit` for a slider or number, `options` for segmented, select, chips and swatch (with `hex` for a swatch), `brandPreset` when the brand's chosen colours or light should lead.
3. Nothing else: the desk shows the mode in the picker, its variables in folding sections through `ModeControl`, only the specs it `uses`, and the Engine bar can change any of its variables by key. A planned mode is `available: false` and shows "Coming later".
4. A control that is not in the library is a design-system change: propose it in studio-controls.css and here first.
