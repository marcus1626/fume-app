// StudioModeGrid: the mode picker as a grid menu (FLOWS §9.1). Each mode is a tile with its icon, name and one line;
// a mode that is planned but not built is dimmed and says "Coming later". On the page (the Studio's start) the tiles
// are cards; inside a glass popover (the desk's picker) they take the glass look (.ui-glass .ui-sc-modes).
//   <StudioModeGrid modes={modes} value={doc.modeId} onPick={(id) => setMode(id)} />
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";

export interface StudioModeTileData {
  id: string;
  name: string;
  description: string;
  available: boolean;
  /** What a render in the mode makes: picks the icon. */
  output: "creative" | "model" | "reference";
  /** Overrides the icon the output and name pick. */
  icon?: IconName;
}

export interface StudioModeGridProps {
  modes: StudioModeTileData[];
  /** The mode in use (marked). */
  value?: string;
  onPick: (id: string) => void;
  /** Busy while a pick opens. */
  disabled?: boolean;
  /** Two columns (the popover) or as many as fit (the page). */
  compact?: boolean;
  /** Big tiles, for a first choice (Render, Design, Video). */
  large?: boolean;
  className?: string;
  "aria-label"?: string;
}

const iconFor = (m: StudioModeTileData): IconName =>
  m.icon ?? (m.output === "model" ? "user" : m.output === "reference" ? "image-plus" : /packshot/i.test(m.name) ? "package" : /layout/i.test(m.name) ? "type" : /motion/i.test(m.name) ? "play" : /free/i.test(m.name) ? "pencil" : "image");

export function StudioModeGrid({ modes, value, onPick, disabled, compact, large, className, ...props }: StudioModeGridProps) {
  return (
    <ul className={cx("ui-sc-modes", compact && "ui-sc-modes--compact", large && "ui-sc-modes--large", className)} aria-label={props["aria-label"] ?? "Modes"}>
      {modes.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            className="ui-sc-mode"
            aria-current={m.id === value ? "true" : undefined}
            aria-disabled={!m.available || undefined}
            disabled={disabled}
            onClick={() => m.available && onPick(m.id)}
          >
            <Icon name={iconFor(m)} className="ui-sc-mode-icon" />
            <span className="ui-sc-mode-name">{m.name}</span>
            <span className="ui-sc-mode-text">{m.available ? m.description.replace(/ Coming later\.?$/, "") : "Coming later"}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
