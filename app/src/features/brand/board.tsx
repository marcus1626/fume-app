// The parts of the Brand DNA board (FLOWS §0.3, §2): the logo on light and dark, every colour as a swatch, type
// specimens drawn in the customer's own face, voice lines with examples, imagery, and the rules for each area. The look
// is design-system/components/brand-board.css; the customer's own values (a hex, a font family, the logo's grounds)
// reach it as CSS custom properties, never as styles of our own.
// The board acts in place. What is settled is drawn compact; a find Fume is not sure of carries Confirm · Change ·
// Remove right where it is: a colour, a typeface or a line of voice as one row, a logo or a picture at its full size so
// it can be judged. Each part opens its details in place ("How it is used"). No counters per part, no blur as a status.
import {
  Badge,
  Button,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  Proposal,
} from "@fume/ui";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import type {
  BrandColour,
  BrandIdentity,
  BrandLogo,
  BrandRule,
  BrandTypeface,
  Provenance,
  RuleArea,
} from "../../contract";
import { roleAndUses, usesWords } from "./colour";
import { ConfirmRow, Provenanced } from "./decide";
import { byGroup, campaignsOf, imageGroupLine, imageGroupTitle, MoveImage } from "./imagery";
import { ruleKind, ruleLine, useRole } from "./parts";

/** A CSS custom property as a style: data values only (a hex, a family), so the look stays in the design system. */
export const vars = (v: Record<string, string | undefined>) => v as CSSProperties;

export const colourRole: Record<BrandColour["role"], string> = {
  primary: "Primary",
  accent: "Accent",
  ground: "Ground",
  text: "Text",
  support: "Support",
};

export const typeRole: Record<BrandTypeface["role"], string> = { display: "Display", body: "Body", accent: "Accent" };

const live = <T extends { provenance: { state: string } }>(list: T[]) =>
  list.filter((x) => x.provenance.state !== "removed");

/** decide: each item with its tag and, for a find, Confirm · Change · Remove. read: the brand as it is, no buttons. */
export type BoardMode = "decide" | "read";

/** The visit on the board: what was decided here keeps its place (and its new tag) until the next visit. */
export interface Visit {
  decided: ReadonlySet<string>;
  onDecided: (id: string) => void;
}

/** True while Fume waits for the customer on it, or once she decided it on this visit (it stays where it was). */
const isFind = (x: { id: string; provenance: Provenance }, visit: Visit) =>
  x.provenance.state === "proposed" || visit.decided.has(x.id);
/** What the board draws: every live item, plus one removed here (it stays, dimmed, with Put back). */
const drawn = <T extends { id: string; provenance: Provenance }>(list: T[], visit: Visit) =>
  list.filter((x) => x.provenance.state !== "removed" || visit.decided.has(x.id));

/** The customer's light ground, dark ink and display face, for the logo tiles and the specimens. */
export function brandFaces(identity: BrandIdentity) {
  const colours = live(identity.colours);
  const ground = colours.find((c) => c.role === "ground")?.hex;
  const ink = colours.find((c) => c.role === "text")?.hex;
  const display = live(identity.typefaces).find((t) => t.role === "display")?.cssFamily;
  return { ground, ink, display };
}

/**
 * A part of the board: its title and, when it has details, "How it is used" at the end of its title line, which opens
 * the part's details in place. The id sits on the section itself, so /brand#colour scrolls to and marks the whole part,
 * not only its heading.
 */
export function BoardPart({
  id,
  title,
  meta,
  span,
  open,
  onOpen,
  to,
  linkLabel,
  text,
  children,
}: {
  id: string;
  title: string;
  meta?: ReactNode;
  /** full: the part takes the board's whole width (Imagery) on a two-column board. */
  span?: "full";
  /** The details are open (controlled by the board). */
  open?: boolean;
  /** Present: the part has details, and this opens or closes them. */
  onOpen?: (open: boolean) => void;
  /** A way to a page of its own (kept for parts that have one). */
  to?: string;
  /** The words of that way; "Open <title>" when left out. */
  linkLabel?: string;
  text?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="ui-brand-part"
      id={id}
      aria-labelledby={`${id}-title`}
      data-span={span}
      data-open={open ? "" : undefined}
    >
      <div className="ui-brand-part-head">
        <h2 className="ui-brand-part-title" id={`${id}-title`}>
          {title}
        </h2>
        {meta !== undefined && <span className="ui-brand-part-meta">{meta}</span>}
        {onOpen && (
          <Button
            variant="quiet"
            size="sm"
            iconEnd={open ? "chevron-up" : "chevron-down"}
            className="ui-brand-part-more"
            aria-expanded={Boolean(open)}
            aria-controls={`${id}-details`}
            onClick={() => onOpen(!open)}
          >
            How it is used
          </Button>
        )}
        {to && (
          <Link to={to} className="ui-brand-part-link">
            {linkLabel ?? `Open ${title.toLowerCase()}`}
            <Icon name="arrow-right" />
          </Link>
        )}
      </div>
      {text && <p className="ui-brand-part-text">{text}</p>}
      {children}
    </section>
  );
}

/** The part's details, under its items: shown only while open, named for its toggle. */
function Details({ id, open, children }: { id: string; open?: boolean; children: ReactNode }) {
  return (
    <div className="ui-brand-part-details" id={`${id}-details`} hidden={!open}>
      {open && children}
    </div>
  );
}

interface PartProps {
  identity: BrandIdentity;
  rules: BrandRule[];
  visit: Visit;
  open: boolean;
  onOpen: (open: boolean) => void;
}

// ─── Logo ───────────────────────────────────────────────────────────────────

function LogoFace({ logo, identity }: { logo: BrandLogo; identity: BrandIdentity }) {
  const f = brandFaces(identity);
  const dark = logo.ground === "dark";
  return (
    <>
      <div
        className="ui-brand-logo-tile"
        data-ground={logo.ground}
        style={vars({
          "--brand-ground": dark ? f.ink : f.ground,
          "--brand-ink": dark ? f.ground : f.ink,
          "--brand-display": f.display,
        })}
        role="img"
        aria-label={`${logo.name}, on a ${dark ? "dark" : "light"} ground`}
      >
        {logo.image ? <img src={logo.image} alt="" /> : <span className="ui-brand-logo-word">{logo.wordmark}</span>}
      </div>
      <div className="ui-brand-caption">
        <span className="ui-brand-caption-title">{logo.name}</span>
        <span className="ui-brand-caption-meta">{dark ? "On dark" : "On light"}</span>
      </div>
    </>
  );
}

export function LogoPart({ identity, rules, visit, open, onOpen }: PartProps) {
  return (
    <BoardPart id="logo" title="Logo" open={open} onOpen={onOpen}>
      <div className="ui-brand-logos" data-mode="board">
        {drawn(identity.logos, visit).map((l) =>
          isFind(l, visit) ? (
            <Provenanced
              key={l.id}
              kind="logo"
              id={l.id}
              name={l.name}
              provenance={l.provenance}
              value={l.name}
              bare
              className="ui-brand-logo"
              onDecided={visit.onDecided}
            >
              <LogoFace logo={l} identity={identity} />
              {open && <p className="ui-brand-caption-text">{l.use}</p>}
            </Provenanced>
          ) : (
            <Proposal key={l.id} state={l.provenance.state} bare className="ui-brand-logo">
              <LogoFace logo={l} identity={identity} />
              {open && <p className="ui-brand-caption-text">{l.use}</p>}
            </Proposal>
          ),
        )}
      </div>
      <Details id="logo" open={open}>
        <AreaRules rules={rules} areas={["logo"]} />
      </Details>
    </BoardPart>
  );
}

// ─── Colour ─────────────────────────────────────────────────────────────────

function SwatchColour({ colour }: { colour: BrandColour }) {
  return (
    <div
      className="ui-brand-swatch-colour"
      style={vars({ "--swatch": colour.hex })}
      role="img"
      aria-label={`${colour.name}, ${colour.hex}`}
    />
  );
}

export function ColourPart({ identity, rules, visit, open, onOpen }: PartProps) {
  const list = drawn(identity.colours, visit);
  const settled = list.filter((c) => !isFind(c, visit));
  const finds = list.filter((c) => isFind(c, visit));
  return (
    <BoardPart id="colour" title="Colour" open={open} onOpen={onOpen}>
      {open ? (
        // the details: each colour with its role and its use, one row each
        <ul className="ui-brand-colour-list" aria-label="Your colours and their use">
          {settled.map((c) => (
            <li key={c.id} className="ui-brand-colour-row">
              <SwatchColour colour={c} />
              <div className="ui-brand-colour-text">
                <p className="ui-brand-colour-name">
                  <span className="ui-brand-caption-title">{c.name}</span>
                  <span className="ui-brand-hex">{c.hex.toUpperCase()}</span>
                  <span className="ui-brand-caption-meta">{colourRole[c.role]}</span>
                </p>
                <p className="ui-brand-caption-text">{c.usage}</p>
                {usesWords(c.uses) && <p className="ui-brand-caption-meta">Used for: {usesWords(c.uses)}</p>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="ui-brand-swatches" data-mode="board">
          {settled.map((c) => (
            <Proposal key={c.id} state={c.provenance.state} bare className="ui-brand-swatch">
              <SwatchColour colour={c} />
              <span className="ui-brand-caption-title">{c.name}</span>
              <span className="ui-brand-hex">{c.hex.toUpperCase()}</span>
            </Proposal>
          ))}
        </div>
      )}
      {finds.map((c) => (
        <ConfirmRow
          key={c.id}
          kind="colour"
          id={c.id}
          name={c.name}
          provenance={c.provenance}
          value={c.hex}
          media={<SwatchColour colour={c} />}
          meta={<span className="ui-brand-hex">{c.hex.toUpperCase()}</span>}
          text={open ? c.usage : roleAndUses(colourRole[c.role], c.uses)}
          uses={c.uses ?? []}
          onDecided={visit.onDecided}
        />
      ))}
      <Details id="colour" open={open}>
        <AreaRules rules={rules} areas={["colour"]} />
      </Details>
    </BoardPart>
  );
}

// ─── Type ───────────────────────────────────────────────────────────────────

function Aa({ face }: { face: BrandTypeface }) {
  return (
    <span className="ui-brand-type-aa" style={vars({ "--brand-font": face.cssFamily })} aria-hidden="true">
      Aa
    </span>
  );
}

export function TypePart({ identity, rules, visit, open, onOpen }: PartProps) {
  const list = drawn(identity.typefaces, visit);
  const settled = list.filter((t) => !isFind(t, visit));
  const finds = list.filter((t) => isFind(t, visit));
  return (
    <BoardPart id="type" title="Type" open={open} onOpen={onOpen}>
      <div className="ui-brand-types" data-mode="board">
        {settled.map((t) => (
          <Proposal key={t.id} state={t.provenance.state} bare className="ui-brand-type">
            <div className="ui-brand-type-face" style={vars({ "--brand-font": t.cssFamily })}>
              <span className="ui-brand-type-aa" aria-hidden="true">
                Aa
              </span>
              <p className="ui-brand-type-sample">{t.sample}</p>
            </div>
            <div className="ui-brand-caption">
              <span className="ui-brand-caption-title">{t.name}</span>
              <span className="ui-brand-caption-meta">{typeRole[t.role]}</span>
            </div>
            {open && (
              <p className="ui-brand-caption-text">
                {t.usage} {t.weights.join(", ")}.
              </p>
            )}
          </Proposal>
        ))}
      </div>
      {finds.map((t) => (
        <ConfirmRow
          key={t.id}
          kind="typeface"
          id={t.id}
          name={t.name}
          provenance={t.provenance}
          value={t.name}
          media={<Aa face={t} />}
          meta={<span className="ui-brand-caption-meta">{typeRole[t.role]}</span>}
          text={
            <span className="ui-brand-type-inline" style={vars({ "--brand-font": t.cssFamily })}>
              {open ? t.usage : t.sample}
            </span>
          }
          onDecided={visit.onDecided}
        />
      ))}
      <Details id="type" open={open}>
        <AreaRules rules={rules} areas={["type"]} />
      </Details>
    </BoardPart>
  );
}

// ─── Voice ──────────────────────────────────────────────────────────────────

export function VoicePart({ identity, rules, visit, open, onOpen }: PartProps) {
  const list = drawn(identity.voice, visit);
  const settled = list.filter((v) => !isFind(v, visit));
  const finds = list.filter((v) => isFind(v, visit));
  return (
    <BoardPart id="voice" title="Voice" open={open} onOpen={onOpen} to="/brand/voice" linkLabel="The whole voice">
      <div className="ui-brand-voice" data-mode="board">
        {settled.map((v) => (
          <Proposal key={v.id} state={v.provenance.state} bare className="ui-brand-voice-line">
            <p className="ui-brand-voice-statement">{v.statement}</p>
            <p className="ui-brand-voice-example">“{v.example}”</p>
          </Proposal>
        ))}
      </div>
      {finds.map((v) => (
        <ConfirmRow
          key={v.id}
          kind="voice"
          id={v.id}
          name={v.statement.replace(/[.\s]+$/, "")}
          provenance={v.provenance}
          value={v.statement}
          title={v.statement}
          text={`“${v.example}”`}
          onDecided={visit.onDecided}
        />
      ))}
      <Details id="voice" open={open}>
        <AreaRules rules={rules} areas={["voice", "claims"]} />
      </Details>
    </BoardPart>
  );
}

// ─── Imagery ────────────────────────────────────────────────────────────────

/** The pictures in Fume's groups (Your look, Campaign looks, Product shots, Not used), each group a row with its title
 *  and line; a picture moves to another group from its Move menu. */
export function ImageryPart({ identity, rules, visit, open, onOpen }: PartProps) {
  const { canEdit } = useRole();
  const campaigns = campaignsOf(identity.imagery);
  return (
    <BoardPart id="imagery" title="Imagery" span="full" open={open} onOpen={onOpen}>
      {byGroup(drawn(identity.imagery, visit)).map((g) => (
        <section key={g.group} className="ui-image-group" aria-labelledby={`brand-group-${g.group}`}>
          <div className="ui-image-group-head">
            <h3 className="ui-image-group-title" id={`brand-group-${g.group}`}>
              {imageGroupTitle[g.group]} <span className="ui-image-group-count">{g.items.length}</span>
            </h3>
            <p className="ui-image-group-line">{imageGroupLine[g.group]}</p>
          </div>
          <div className="ui-brand-images" data-mode="board">
            {g.items.map((i) => {
              const body = (
                <>
                  <div className="ui-brand-image-media">
                    <img src={i.image} alt={i.caption} loading="lazy" />
                  </div>
                  <span className="ui-brand-caption-title">{i.caption}</span>
                  {i.group === "campaign" && i.campaign && <span className="ui-brand-caption-meta">{i.campaign}</span>}
                  {canEdit && i.provenance.state !== "removed" && (
                    <span className="ui-image-move">
                      <MoveImage image={i} campaigns={campaigns} />
                    </span>
                  )}
                </>
              );
              return isFind(i, visit) ? (
                <Provenanced
                  key={i.id}
                  kind="image"
                  id={i.id}
                  name={i.caption}
                  provenance={i.provenance}
                  bare
                  className="ui-brand-image"
                  onDecided={visit.onDecided}
                >
                  {body}
                </Provenanced>
              ) : (
                <Proposal key={i.id} state={i.provenance.state} bare className="ui-brand-image">
                  {body}
                </Proposal>
              );
            })}
          </div>
        </section>
      ))}
      <Details id="imagery" open={open}>
        <AreaRules rules={rules} areas={["imagery", "layout"]} />
      </Details>
    </BoardPart>
  );
}

// ─── The rules for one area (in a part's details) ───────────────────────────

/** The rules for one area, in a part's details: the statements, a "Never broken" badge, and a way to all rules. */
export function AreaRules({ rules, areas }: { rules: BrandRule[]; areas: RuleArea[] }) {
  const list = rules.filter((r) => areas.includes(r.area));
  const id = `rules-${areas.join("-")}`;
  return (
    <div className="ui-brand-part-rules">
      {list.length > 0 && (
        <ItemGroup as="ul" aria-label="Its rules" id={id}>
          {list.map((r) => (
            <Item key={r.id} as="li" variant="muted" size="sm">
              <ItemContent>
                <ItemTitle>{r.statement}</ItemTitle>
                {ruleLine(r) && <ItemDescription>{ruleLine(r)}</ItemDescription>}
              </ItemContent>
              {r.kind === "hard_constraint" && (
                <ItemActions>
                  <Badge variant="ink">{ruleKind.hard_constraint}</Badge>
                </ItemActions>
              )}
            </Item>
          ))}
        </ItemGroup>
      )}
      <Button asChild variant="quiet" size="sm" iconEnd="arrow-right" className="ui-brand-part-rules-all">
        <Link to="/brand/rules">{list.length ? "All rules" : "Add a rule"}</Link>
      </Button>
    </div>
  );
}
