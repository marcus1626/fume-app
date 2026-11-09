# Round 15 (9 Nov 2026, PROPOSED): The Design studio, laid out like Figma

Spec text for FLOWS.md (a new part after §34; it builds on §34.5). Everything here is PROPOSED 9 Nov 2026: Marcus has
not chosen it yet.

Marcus: "Layers should be on the right, since people are used to Figma, with more control. Look at OpenPencil for
that." And: "'Show the logo' should not be a button, it is a layer, and we should keep control and logic." The design
thread then chose Figma's own order: the layers on the left, what is picked set on the right. The names and the
grouping are borrowed from Figma and OpenPencil (Layers; Text, Typography, Fill, Position; the page's properties when
nothing is picked), never their look: the panels are the desk's own.

Only Design changes. Image and Video keep their panels.

## The left panel: the frame and its layers

- **The frame on top.** The format picker sits first, compact: the format and its ratio, and under it only where
  words may go ("Keep words out of the top 250 px and bottom 340 px"). How a picture is rendered (the generator, the
  product, the output count) belongs to Image, not here.
- **Layers.** A title, and beside it whose layers they are: "By Fume · V5" on a version Fume designed, "4 layers" on a
  creative laid out by hand. Then the frame ("Frame · 1080 × 1350") and its layers a step in, as they stack, the top
  one first: the logo, the headline, the line under it, the call to action, the shade, the picture.
- **A row.** Its icon, its name, a second line (the words; the logo's version, "Wordmark, reversed"; the picture's
  version, "V3"; where the shade comes from), a lock and an eye. A click picks the layer, and the canvas shows it
  picked; a click on the canvas picks the row. Up and Down move through the rows. The frame row, Escape, or a click on
  the board outside the layers picks nothing.
- **The eye** hides a layer: its row goes quiet and the canvas leaves it out. **The lock** keeps a layer from being
  picked on the canvas; it is still picked in the list, as in Figma. A lock shows where a layer is locked, and on the
  row under the pointer or the keyboard. The picture and the shade come locked.
- **Every layer listed is on the canvas, or listed as hidden.** Fume keeps what it left out as a hidden layer: the
  call to action where the design system keeps it off the format (LYSNE: "Never on a feed picture"), the logo where
  the label shows the name. Before, the list said "Button: Se kveldsoljen" with no button on the picture.
- **The logo is a layer.** The "Show the logo" switch is gone from the Layout mode; its eye shows or hides it.
- While Fume designs a version, the list waits: "Fume is designing V5. Its layers come with it."

## The right panel: the properties of what is picked

The panel's title is the layer's name ("Headline", "Logo · hidden"), or "Frame". Every choice comes from the brand's
design system: its text styles, typefaces, colours, logo versions and its call to action. Nothing else is offered.

- **Words (headline, line, other text).** *Text*: Content. *Typography*: Text style (the design system's styles, with
  their size: "Heading 1 · 76"), Typeface (the brand's typefaces), Weight (the weights the typeface has), Size in px,
  Align (Left, Centre, Right). A new text style clears the typeface, weight and size set by hand. *Fill*: Colour, the
  brand's colours for words only. *Position*: X, Y and W in px of the frame (Up and Down step 1, with Shift 10).
- **The logo.** *Logo*: Version (Wordmark or Reversed), with what the design system says each is for and its rule for
  logos on a photograph. *Position*: X, Y, W, never under the design system's least width, with its clear space.
- **The call to action.** *Component*: the brand's call to action (its colours and rules, "Two words. Never on a feed
  picture."), and its Content. *Position*: X and Y; its width is its pill's.
- **The picture.** *Picture*: Version ("V3"); on Fume's design it stays the picture Fume designed on ("For another
  picture, design again from it in Image"). Fit: Fill (crops to the frame) or Fit (the whole picture).
- **The shade.** Where it comes from, and its strength.
- **Nothing picked: the frame.** *Layout*: on a creative laid out by hand, its template; on Fume's design, "Laid out by
  Fume · V5" and "Its checks" (the design sheet). Align (Top, Centre, Bottom) says where the headline and its line are
  on the canvas, and moves them inside the safe area; the call to action and the logo keep their place. Before, Align
  said Bottom while the words sat at the top. *Words*: one colour for every word layer ("Mixed" when they differ); the
  call to action keeps its own.
- **The words' source is gone** (Brand, Fume, Own, Engine). In Design every colour and type is the brand's design
  system's, so there is nothing left for it to choose between.

## The canvas

The frame is the format's ratio, and the picture fills it or fits in it. The layers are drawn as the creative will be:
the brand's typefaces (their stand-ins on Google Fonts), sizes in px at 1080 wide, its colours, its call to action as
its pill, its shade. The picked layer has the desk's selection ring. On a phone the canvas only shows.

## Names

A version is "V3" where it is short (rows, readouts) and "Version 3" in a sentence. The picture layer is "Picture",
never "Image v3". The generator ("Nano Banana Pro") shows only where a picture is generated, never on a layout.

## What is kept, and how

- **Layer** (contract) has new optional fields, kept as they are given; what is not set follows the design system:
  `locked`, `component` (headline, subline, cta, logo), `textStyle`, `font`, `weight`, `sizePx`, `align`, `colour`,
  `variant` (the logo's version), `fit`, `shade`, and `belongsTo` (the version a layer of Fume's design belongs to).
- **Fume's design as layers.** Until it is changed, a design's layers are read from the version Fume designed (its
  words and where it drew them). The first change keeps them in the creative's layers with `belongsTo` set to that
  version; hand layers have none. Undo and Redo hold every change, as before.
- The Layout mode's `align` and `textColour` follow the layers in the same step, so they never say one thing while the
  canvas shows another.
- **Send to check** sends the layers of the version sent: the hand layers on a picture; on Fume's design, its layers
  once changed, which then stand for Fume's drawing (no words twice). An edit in Check lands on the layers it carries
  and keeps the creative's others.
- **Demo.** The email header is a Story picture in a Story frame, its words at the top clear of the label, the logo
  reversed on the dark picture (as LYSNE's design system asks).

## Open

- Check draws changed layers in its own plain type, not yet the brand's typefaces and shade.
- The live backend keeps layers as given, but its Send to check still sends all of them (`api/live/production.ts`).
- Moving a layer by dragging it on the canvas; for now X, Y and W are typed.
- An eye-off and an unlocked icon: the hidden eye is dimmed. A new icon goes to Fume-Brand first.
