// The design system's CSS, in its load order: fonts (self-hosted stand-ins, F-D084), brand primitives, UI tokens,
// the foundations (base, glass), then every component. Import once, at the app's entry: import "@fume/ui/styles".
// Nothing here adds a look; it only loads design-system/ as it is.
import "../../../assets/fonts/fume-fonts.css";
import "../../../tokens/fume-tokens.css";
import "../../../design-system/tokens/ui.css";
import "../../../design-system/components/base.css";
import "../../../design-system/components/glass.css";

// Every other component stylesheet, in name order (the design system's own load order on the review board).
import.meta.glob(["../../../design-system/components/*.css", "!**/base.css", "!**/glass.css"], { eager: true });

// The two foundation scripts work on the whole document and never touch what React renders: the pressed state on
// iPhones (touch.js) and the focus ring only from the keyboard (focus.js, F-D076).
import "../../../design-system/components/touch.js";
import "../../../design-system/components/focus.js";
