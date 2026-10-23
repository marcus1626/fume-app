// Step 3, "Confirm what Fume found", and step 4, "Your taste" (FLOWS §7 steps 4, 6, 7; round 8, UX review ONB-5,
// ONB-6, ONB-9, ONB-10, ONB-11, ONB-13, ONB-14, ONB-19, LOAD-15).
// Step 3 goes through five parts, one at a time: Logo, Colour, Type, Imagery, Voice (products are not part of the
// onboarding: each is confirmed the first time it goes into a campaign). Every item is one compact row: the thing
// itself, where Fume found it, Confirm · Change · Remove. What Fume is not sure of is asked on its own card, with why,
// its answers on the right in line with the rows'. Confirm says nothing (the row says "Confirmed"); Remove has Undo
// and the row stays, dimmed, with "Put back".
// Round 9 (desktop review DTSK-5, DTSK-7, DLAY-12, DLAY-13, DLOAD-1, DLOAD-17, DTSK-22; PROPOSED 19 Oct 2026):
//   - One way forward per part, pinned bottom right: "Confirm all and go to Type" while finds are open (it confirms
//     every open find of the part, then moves on), "Next: Type" once nothing is open, and a quiet "Skip for now"
//     beside it. No second "Keep all" at the top, no "Keep it" pill for one logo. Enter presses the forward pill.
//   - Imagery is a grid of pictures big enough to judge (240 px at the least on a desk), Confirm · Remove under each.
//   - "You added this" only for what she uploaded; a website reading says "Found on lysne.no".
// Step 4 is one deck of six cards, saved on the tap (the three pairs: tap or swipe toward the picture you prefer;
// the three test directions: swipe a single picture, or the pills, or Y / N). After the last card, "What Fume
// understood" REPLACES the deck as its own view: five short lines she can Confirm or Change, the products in one
// sentence, how many finds are not confirmed yet ("creatives use only what you confirm", with Confirm them now),
// and at its foot Back one and Approve and start.
import { Button, Field, FieldLabel, FieldOptional, Icon, Input, TasteDeck, ToggleGroup, ToggleGroupItem, useToast, type TasteDeckAnswer, type TasteDeckCard } from "@fume/ui";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  useAnswerUnderstanding,
  useApproveBrandDna,
  useBrandBoard,
  useBrandDna,
  useBrandScan,
  useChooseTastePair,
  useDecide,
  useDecideVoicePart,
  useOnboardingProgress,
  usePassTastePair,
  useSaveOnboardingProgress,
  useSession,
} from "../../api/hooks";
import type { BrandColour, BrandDnaView, BrandIdentity, BrandImage, BrandScan, ColourUse, IdentityKind, Provenance, UnderstoodLine, VoicePartId } from "../../contract";
import * as copy from "../../copy";
import { Query } from "../../shell/Page";
import { brandFaces, colourRole, typeRole, vars } from "../brand/board";
import { roleAndUses } from "../brand/colour";
import { byGroup, campaignsOf, imageGroupLine, imageGroupTitle, MoveImage } from "../brand/imagery";
import { ChangeInline, changeField, ConfirmRow, DecisionActions, useDecision } from "../brand/decide";
import { confidence, useRole } from "../brand/parts";
import { understoodLines, type Understood } from "../brand/UnderstandingPage";
import { VoicePartCard, voicePartTitle, voiceParts } from "../brand/voice";
import { checkParts, StepFrame, stepPath, useEnterForward, type CheckPart } from "./frame";
import { finds, firstOpenPart, isOpen, openTotal } from "./found";

export { openIn } from "./found";

// ─── The items of a part ─────────────────────────────────────────────────────

interface CheckItem {
  kind: IdentityKind;
  id: string;
  name: string;
  /** A hex (data) or a role in words. */
  meta?: string;
  metaIsData?: boolean;
  detail?: string;
  /** The face the detail is set in (a typeface's own usage line). */
  detailFont?: string;
  /** What Change starts from. */
  value?: string;
  /** A colour's uses (#42), chosen as chips in its Change. */
  uses?: ColourUse[];
  /** A picture, for its group and its Move (#3). */
  image?: BrandImage;
  provenance: Provenance;
  /** The thing itself, small and sharp (none for a line of voice). */
  media: ReactNode;
  /** Fume is not sure: it says so, and comes first in its part. */
  unsure: boolean;
}

const unsureOf = (p: Provenance) => p.origin === "engine" && p.confidence === "low";

function itemsOf(identity: BrandIdentity, part: CheckPart): CheckItem[] {
  const faces = brandFaces(identity);
  const base = (p: Provenance) => ({ provenance: p, unsure: unsureOf(p) });
  switch (part) {
    case "logo":
      return identity.logos.map((l) => ({
        ...base(l.provenance),
        kind: "logo",
        id: l.id,
        name: l.name,
        meta: l.ground === "dark" ? "On dark grounds" : "On light grounds",
        value: l.name,
        media: (
          <span
            className="ui-ob-media"
            data-kind="logo"
            aria-hidden="true"
            style={vars({
              "--brand-ground": l.ground === "dark" ? faces.ink : faces.ground,
              "--brand-ink": l.ground === "dark" ? faces.ground : faces.ink,
              "--brand-display": faces.display,
            })}
          >
            {l.image ? <img src={l.image} alt="" /> : l.wordmark}
          </span>
        ),
      }));
    case "colour":
      return identity.colours.map((c) => ({
        ...base(c.provenance),
        kind: "colour",
        id: c.id,
        name: c.name,
        meta: c.hex.toUpperCase(),
        metaIsData: true,
        detail: roleAndUses(colourRole[c.role], c.uses),
        value: c.hex,
        uses: c.uses ?? [],
        media: <div className="ui-brand-swatch-colour" style={vars({ "--swatch": c.hex })} role="img" aria-label={`${c.name}, ${c.hex}`} />,
      }));
    case "type":
      return identity.typefaces.map((t) => ({
        ...base(t.provenance),
        kind: "typeface",
        id: t.id,
        name: t.name,
        meta: typeRole[t.role],
        detail: t.usage,
        detailFont: t.cssFamily,
        value: t.name,
        media: (
          <span className="ui-brand-type-aa" aria-hidden="true" style={vars({ "--brand-font": t.cssFamily })}>
            Aa
          </span>
        ),
      }));
    case "imagery":
      return identity.imagery.map((m) => ({
        ...base(m.provenance),
        kind: "image",
        id: m.id,
        name: m.caption,
        image: m,
        media: (
          <span className="ui-ob-media" data-kind="image">
            <img src={m.image} alt={m.caption} />
          </span>
        ),
      }));
    default:
      // Round 13 (#4): the voice's five parts, each one find
      if (identity.voiceBook)
        return identity.voiceBook.parts.map((v) => ({ ...base(v.provenance), kind: "voice", id: v.id, name: voicePartTitle[v.id], detail: v.found, media: null }));
      return identity.voice.map((v) => ({
        ...base(v.provenance),
        kind: "voice",
        id: v.id,
        name: v.statement,
        detail: `“${v.example}”`,
        value: v.statement,
        media: null,
      }));
  }
}

/**
 * Where an item came from, in her words: "Found on lysne.no, product pages". "You added this" only when she gave Fume
 * material; from a website alone, what the brand already had reads "Found on lysne.no" (DLOAD-17).
 */
function sourceWords(p: Provenance, scan: BrandScan | null | undefined): string {
  if (p.origin === "customer") return scan && scan.files.length === 0 && scan.url ? `Found on ${scan.url}` : "You added this";
  return p.evidence ? `Found on ${p.evidence}` : "Fume found this";
}

/** Two sources that disagree on a colour: what the reading found against what the Brand DNA holds. */
function colourConflicts(scan: BrandScan | null | undefined, colours: BrandColour[]) {
  if (!scan) return [];
  return scan.finds
    .filter((f) => f.kind === "colour")
    .flatMap((f) => {
      const c = colours.find((x) => x.name === f.label && x.provenance.state !== "removed");
      return c && c.provenance.state === "proposed" && c.hex.toUpperCase() !== f.value.toUpperCase() ? [{ find: f, colour: c }] : [];
    });
}

/** The finds "Confirm all" confirms in a part: every open one with one value (a conflict needs her pick). */
function confirmableIn(identity: BrandIdentity, part: CheckPart, scan: BrandScan | null | undefined): CheckItem[] {
  const conflicted = new Set(part === "colour" ? colourConflicts(scan, identity.colours).map((c) => c.colour.id) : []);
  return itemsOf(identity, part).filter((x) => isOpen(x) && !conflicted.has(x.id));
}

// ─── One item ────────────────────────────────────────────────────────────────

function Decided({ provenance }: { provenance: Provenance }) {
  if (provenance.state === "proposed" || provenance.state === "removed") return null;
  if (provenance.origin === "customer" && provenance.state === "approved") return null;
  return (
    <span className="ui-ob-kept">
      <Icon name="check" />
      {provenance.state === "changed" ? "Changed" : "Confirmed"}
    </span>
  );
}

/** Confirm · Change · Remove (or Put back, or the state) for one item, and Change opening in place under it. */
function useItemActions(item: CheckItem, root: RefObject<HTMLElement | null>) {
  const { canApprove } = useRole();
  const d = useDecision(item.kind, item.id, item.name);
  const [changing, setChanging] = useState(false);
  const st = item.provenance.state;
  const field = changeField[item.kind];
  const actions =
    st === "removed" ? (
      canApprove && (
        <Button size="sm" variant="secondary" icon="undo-2" onClick={d.putBack} disabled={d.pending} aria-label={`Put back ${item.name}`}>
          Put back
        </Button>
      )
    ) : st === "proposed" ? (
      canApprove && (
        <DecisionActions
          name={item.name}
          onKeep={d.keep}
          onChange={field && item.value !== undefined ? () => setChanging(true) : undefined}
          onRemove={d.remove}
          disabled={d.pending}
        />
      )
    ) : (
      <Decided provenance={item.provenance} />
    );
  const change =
    changing && field && item.value !== undefined ? (
      <div className="ui-ob-change">
        <ChangeInline
          kind={item.kind}
          id={item.id}
          name={item.name}
          value={item.value}
          field={field}
          onDone={() => {
            setChanging(false);
            // focus goes back to the item, never to the page
            requestAnimationFrame(() => root.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus());
          }}
        />
      </div>
    ) : null;
  return { hidden: st === "removed" && !d.removedHere, actions, change };
}

/** What the brand already had before this reading: it is in use, so it has no answers to give. */
const settledOf = (x: CheckItem) => x.provenance.origin === "customer" && x.provenance.state === "approved";

/** Beside the name: a hex in the data face, or a role in words, as the board writes them. */
const metaOf = (x: CheckItem) => (x.meta ? <span className={x.metaIsData ? "ui-brand-hex" : "ui-brand-caption-meta"}>{x.meta}</span> : undefined);

const detailOf = (x: CheckItem) =>
  x.detail && x.detailFont ? (
    <span className="ui-brand-type-inline" style={vars({ "--brand-font": x.detailFont })}>
      {x.detail}
    </span>
  ) : (
    x.detail
  );

/**
 * A find of a list part (logo, colour, type, voice): BRAND's ConfirmRow, so step 3 and the Brand DNA board look the
 * same (round 9, DLAY-19): the thing small and sharp, where Fume found it, "Fume is not sure" when it is not, and
 * Confirm · Change · Remove right after the words. Decided here, it stays in its place with its new tag.
 */
function FindRow({ item }: { item: CheckItem }) {
  return (
    <li className="ui-ob-find">
      <ConfirmRow
        kind={item.kind}
        id={item.id}
        name={item.name}
        provenance={item.provenance}
        value={item.value}
        uses={item.uses}
        media={item.media ?? undefined}
        meta={metaOf(item)}
        text={detailOf(item)}
      />
    </li>
  );
}

/** What the brand already had: the same row, still, saying where it came from ("Found on lysne.no", DLOAD-17). */
function SettledRow({ item, scan }: { item: CheckItem; scan: BrandScan | null | undefined }) {
  return (
    <li className="ui-ob-find">
      <div className="ui-brand-confirm" data-state={item.provenance.state} data-media={item.media ? undefined : "none"}>
        {item.media && <div className="ui-brand-confirm-media">{item.media}</div>}
        <div className="ui-brand-confirm-body">
          <p className="ui-brand-confirm-title">
            <span>{item.name}</span>
            {item.meta && <span className="ui-brand-confirm-meta">{metaOf(item)}</span>}
          </p>
          <div className="ui-brand-confirm-line">
            {item.detail && <p className="ui-brand-confirm-text">{detailOf(item)}</p>}
            <p className="ui-brand-confirm-tags">
              <span className="ui-proposal-tag">
                <Icon name="check" />
                {sourceWords(item.provenance, scan)}
              </span>
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}

/** A picture big enough to judge (DLAY-12): the picture, its name and source, Confirm · Remove under it. */
function CheckTile({ item, scan, campaigns }: { item: CheckItem; scan: BrandScan | null | undefined; campaigns: string[] }) {
  const root = useRef<HTMLLIElement>(null);
  const a = useItemActions(item, root);
  const { canEdit } = useRole();
  if (a.hidden) return null;
  const st = item.provenance.state;
  return (
    <li ref={root} className="ui-ob-tile" data-state={st}>
      {item.media}
      <div className="ui-ob-text">
        <p className="ui-ob-name">{item.name}</p>
        {item.image?.group === "campaign" && item.image.campaign && <p className="ui-ob-campaign">{item.image.campaign}</p>}
        <p className="ui-ob-source">
          <span className="ui-proposal-tag">{st === "removed" ? "Removed. Fume will not use it." : sourceWords(item.provenance, scan)}</span>
          {item.unsure && st === "proposed" && <span className="ui-proposal-tag">{confidence.low}</span>}
        </p>
      </div>
      <div className="ui-ob-actions">
        {a.actions}
        {item.image && st !== "removed" && canEdit && <MoveImage image={item.image} campaigns={campaigns} />}
      </div>
    </li>
  );
}

/** Two values for one colour: both shown plainly, and she picks the right one (on the right, like every answer). */
function ConflictCard({ find, colour }: { find: BrandScan["finds"][number]; colour: BrandColour }) {
  const decide = useDecide();
  const toast = useToast();
  const { canApprove } = useRole();
  const ours = colour.provenance.evidence ?? "your Brand DNA";
  function pick(hex: string) {
    decide.mutate(hex === colour.hex ? { kind: "colour", id: colour.id, verdict: "keep" } : { kind: "colour", id: colour.id, verdict: "change", value: hex }, {
      onError: (error) => toast.error("That wasn’t saved", { description: error.message }),
    });
  }
  return (
    <div className="ui-ob-ask" data-state={colour.provenance.state}>
      <span className="ui-ob-media" data-kind="colour" aria-hidden="true" style={vars({ "--swatch": colour.hex })} />
      <div className="ui-ob-text">
        <p className="ui-ob-ask-eyebrow">Two values for one colour</p>
        <p className="ui-ob-ask-title">
          {ours} says {colour.hex.toUpperCase()} for {colour.name}; {find.evidence} uses {find.value.toUpperCase()}. Which is right?
        </p>
        <p className="ui-ob-ask-why">Fume matches every accent to this colour, so it needs one value.</p>
      </div>
      <div className="ui-ob-actions">
        {canApprove && colour.provenance.state === "proposed" ? (
          [colour.hex, find.value].map((hex) => (
            <Button key={hex} size="sm" variant="secondary" onClick={() => pick(hex)} disabled={decide.isPending}>
              <span className="ui-ob-choice-swatch" style={vars({ "--swatch": hex })} aria-hidden="true" />
              {hex.toUpperCase()}
            </Button>
          ))
        ) : (
          <Decided provenance={colour.provenance} />
        )}
      </div>
    </div>
  );
}

// ─── Step 3 ──────────────────────────────────────────────────────────────────

const partLede: Record<CheckPart, string> = {
  logo: "Your logo is placed as it is, never redrawn.",
  colour: "Creatives use only the colours you confirm.",
  type: "Layouts use only the typefaces you confirm.",
  imagery: "Fume sorted the pictures it found. Your look steers every creative; a campaign’s look only its campaign.",
  voice: "Every word on a creative is held against your voice. Here is each of its five parts in short; the whole voice is in Brand › Voice.",
};

/** Fume is not sure first, then the other finds, then what the brand already had: a fixed order, so a decision never
 * moves a row under the mouse. */
const rank = (x: CheckItem) => (settledOf(x) ? 2 : x.unsure ? 0 : 1);

function PartBody({ part, identity, scan }: { part: CheckPart; identity: BrandIdentity; scan: BrandScan | null | undefined }) {
  const label = checkParts.find((p) => p.id === part)!.label;
  const conflicts = part === "colour" ? colourConflicts(scan, identity.colours) : [];
  const conflicted = new Set(conflicts.map((c) => c.colour.id));
  const items = itemsOf(identity, part)
    .filter((x) => !conflicted.has(x.id))
    .map((x, i) => ({ x, i }))
    .sort((p, q) => rank(p.x) - rank(q.x) || p.i - q.i)
    .map((p) => p.x);

  return (
    <section className="ui-ob-part" aria-label={label}>
      {conflicts.map((c) => (
        <ConflictCard key={c.find.id} find={c.find} colour={c.colour} />
      ))}
      {items.length > 0 &&
        (part === "voice" && identity.voiceBook ? (
          // #4: the voice's five parts in a fixed order, each with Confirm · Change
          <ul className="ui-ob-finds" aria-label="Voice: what Fume found">
            {voiceParts.map((id) => (
              <li key={id} className="ui-ob-find">
                <VoicePartCard book={identity.voiceBook!} id={id} />
              </li>
            ))}
          </ul>
        ) : part === "imagery" ? (
          // #3: Fume sorted the pictures into groups; she moves one with its Move menu
          byGroup(items.map((x) => ({ ...x.image!, x }))).map((g) => (
            <section key={g.group} className="ui-image-group" aria-labelledby={`ob-group-${g.group}`}>
              <div className="ui-image-group-head">
                <h2 className="ui-image-group-title" id={`ob-group-${g.group}`}>
                  {imageGroupTitle[g.group]} <span className="ui-image-group-count">{g.items.length}</span>
                </h2>
                <p className="ui-image-group-line">{imageGroupLine[g.group]}</p>
              </div>
              <ul className="ui-ob-tiles" aria-labelledby={`ob-group-${g.group}`}>
                {g.items.map(({ x }) => (
                  <CheckTile key={x.id} item={x} scan={scan} campaigns={campaignsOf(identity.imagery)} />
                ))}
              </ul>
            </section>
          ))
        ) : (
          <ul className="ui-ob-finds" aria-label={`${label}: what Fume found`}>
            {items.map((x) => (settledOf(x) ? <SettledRow key={x.id} item={x} scan={scan} /> : <FindRow key={x.id} item={x} />))}
          </ul>
        ))}
    </section>
  );
}

export function CheckFound() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const board = useBrandBoard();
  const scan = useBrandScan();
  const decide = useDecide();
  const decideVoice = useDecideVoicePart();
  const toast = useToast();
  const { canApprove } = useRole();
  const [busy, setBusy] = useState(false);
  const raw = params.get("part");
  const part: CheckPart = checkParts.some((p) => p.id === raw) ? (raw as CheckPart) : "logo";
  const index = checkParts.findIndex((p) => p.id === part);
  const next = checkParts[index + 1];
  const prev = checkParts[index - 1];
  const go = (p: CheckPart) => setParams(p === "logo" ? {} : { part: p });
  const identity = board.data?.identity;
  const label = checkParts[index].label;

  const parts = identity
    ? checkParts.map((p) => ({ id: p.id, label: p.label, done: itemsOf(identity, p.id).every((x) => !isOpen(x)), current: p.id === part, onSelect: () => go(p.id) }))
    : undefined;

  // One way forward (DTSK-5, DTSK-7): confirm what is open and move on, or move on.
  const confirmable = identity && canApprove ? confirmableIn(identity, part, scan.data) : [];
  const goNext = () => (next ? go(next.id) : navigate("/welcome/taste"));
  async function confirmAllAndGo() {
    setBusy(true);
    try {
      for (const x of confirmable)
        await (part === "voice" && identity?.voiceBook
          ? decideVoice.mutateAsync({ part: x.id as VoicePartId, verdict: "keep" })
          : decide.mutateAsync({ kind: x.kind, id: x.id, verdict: "keep" }));
      goNext();
    } catch (error) {
      toast.error("Not everything was confirmed", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  }
  const confirming = confirmable.length > 0;
  const forward = confirming ? confirmAllAndGo : goNext;
  useEnterForward(busy || !identity ? undefined : forward);
  const nextWords = next ? next.label : "your taste";

  return (
    <StepFrame
      step="review"
      title={`${label} · Confirm what Fume found`}
      parts={parts}
      part={part}
      foot={
        <>
          {prev ? (
            <Button variant="quiet" icon="arrow-left" onClick={() => go(prev.id)}>
              {prev.label}
            </Button>
          ) : (
            <Button asChild variant="quiet" icon="arrow-left">
              <Link to="/welcome/scan">Fume reads it</Link>
            </Button>
          )}
          <div className="ui-welcome-foot-go">
            {confirming && (
              <Button variant="quiet" onClick={goNext} disabled={busy}>
                Skip for now
              </Button>
            )}
            <Button iconEnd="arrow-right" onClick={forward} loading={busy} disabled={!identity}>
              {confirming ? `Confirm all and go to ${nextWords}` : `Next: ${next ? next.label : "Your taste"}`}
            </Button>
          </div>
        </>
      }
    >
      <header className="ui-welcome-head">
        <h1 className="ui-welcome-title">{label}</h1>
        <p className="ui-welcome-lede">
          {partLede[part]}
          {index === 0 ? " Confirm what is right, change what is close, remove what is wrong. Nothing is used until you confirm it." : ""}
        </p>
      </header>
      <Query query={board} loading="Loading what Fume found">
        {(view) => <PartBody key={part} part={part} identity={view.identity} scan={scan.data} />}
      </Query>
    </StepFrame>
  );
}

// ─── Step 4 ──────────────────────────────────────────────────────────────────

const pairReasons = ["Warmer", "Calmer", "More air", "The product is clearer"];
const yesReasons = ["The light", "The calm", "The colours", "The setting"];
const noReasons = ["Too cold", "Too busy", "Too staged", "Not our colours"];
const neitherReasons = ["Both too cold", "Both too busy", "Both too staged", "Not our colours"];
export const tasteReasons = (card: TasteDeckCard, answer: TasteDeckAnswer) =>
  card.kind === "pair" ? (answer === "neither" ? neitherReasons : pairReasons) : answer === "no" ? noReasons : yesReasons;

/**
 * Round 13 (Marcus's video comments #5, #47; PROPOSED 22 Oct 2026): the deck in two named parts, each with one line on
 * what it teaches, so the two kinds of card are not a puzzle: "Part 1 of 2 · Which is closer to LYSNE?" (the pairs:
 * what she prefers; "Neither feels like LYSNE" when neither is), then "Part 2 of 2 · Is this LYSNE?" (single pictures:
 * where the edges are). A part with no cards drops out, and one part alone is not numbered. The same on Brand › Taste.
 */
export function tasteParts(brand: string, pairs: TasteDeckCard[], singles: TasteDeckCard[]): TasteDeckCard[] {
  const groups = [
    { cards: pairs, question: `Which is closer to ${brand}?`, line: "Teaches Fume what you prefer." },
    { cards: singles, question: `Is this ${brand}?`, line: "Teaches Fume where the edges are." },
  ].filter((g) => g.cards.length > 0);
  return groups.flatMap((g, i) =>
    g.cards.map((c) => ({ ...c, question: g.question, part: { label: groups.length > 1 ? `Part ${i + 1} of ${groups.length}` : "", line: g.line } })),
  );
}

/** The deck's cards: the pairs (part 1), then the test directions (part 2). */
function deckOf(view: BrandDnaView, brand: string): TasteDeckCard[] {
  const pairs: TasteDeckCard[] = view.tastePairs.map((p) => ({ id: p.id, kind: "pair", question: p.question, a: p.a, b: p.b, answer: p.neither ? "neither" : p.chosen }));
  const singles: TasteDeckCard[] = view.understanding.testDirections.map((d) => ({
    id: d.id,
    kind: "single",
    eyebrow: d.name,
    question: `Is this ${brand}?`,
    a: d.image,
    altA: `A test direction: ${d.name}`,
    answer: d.verdict,
  }));
  return tasteParts(brand, pairs, singles);
}

function TasteDeckStep({ cards, index, onIndexChange, brand }: { cards: TasteDeckCard[]; index: number; onIndexChange: (i: number) => void; brand: string }) {
  const { canEdit } = useRole();
  const choose = useChooseTastePair();
  const answerU = useAnswerUnderstanding();
  const pass = usePassTastePair();
  const toast = useToast();
  const failed = (e: Error) => toast.error("That answer wasn’t saved", { description: e.message });

  function save(card: TasteDeckCard, answer: TasteDeckAnswer, reason?: string) {
    if (card.kind === "pair" && answer === "neither") pass.mutate({ pairId: card.id, reason }, { onError: failed });
    else if (card.kind === "pair") choose.mutate({ pairId: card.id, chosen: answer as "a" | "b", reason }, { onError: failed });
    else answerU.mutate({ directionId: card.id, verdict: answer as "yes" | "no", reason }, { onError: failed });
  }

  return (
    <TasteDeck
      label={`Your taste: is it ${brand}?`}
      cards={cards}
      index={index}
      onIndexChange={onIndexChange}
      onAnswer={(c, a) => save(c, a)}
      reasons={tasteReasons}
      onReason={(c, a, r) => save(c, a, r)}
      neitherLabel={`Neither feels like ${brand}`}
      disabled={!canEdit}
    />
  );
}

/** One line of What Fume understood: Confirm, or Change (one field: what is right), saved on the tap. */
function SummaryLine({ line, saved, canEdit }: { line: Understood; saved?: UnderstoodLine; canEdit: boolean }) {
  const save = useSaveOnboardingProgress();
  const toast = useToast();
  const [verdict, setVerdict] = useState<"" | UnderstoodLine["verdict"]>(saved?.verdict ?? "");
  const [reason, setReason] = useState(saved?.reason ?? "");
  const failed = (e: Error) => toast.error("That wasn’t saved", { description: e.message });
  const fieldId = `line-${line.id}`;

  function mark(value: string) {
    const v = value as "" | UnderstoodLine["verdict"];
    setVerdict(v);
    if (v) save.mutate({ line: { id: line.id, verdict: v, reason: v === "not_quite" ? reason.trim() || undefined : undefined } }, { onError: failed });
  }

  return (
    <li className="ui-ob-line" data-verdict={verdict || undefined}>
      <div className="ui-ob-line-text">
        <p className="ui-ob-line-label">{line.label}</p>
        <p className="ui-ob-line-words">{line.text}</p>
      </div>
      {canEdit && (
        <ToggleGroup type="single" variant="outline" size="sm" className="ui-ob-line-actions" value={verdict} onValueChange={mark} aria-label={`${line.label}: did Fume read it right?`}>
          <ToggleGroupItem value="right" icon="check">
            Confirm
          </ToggleGroupItem>
          <ToggleGroupItem value="not_quite">Change</ToggleGroupItem>
        </ToggleGroup>
      )}
      {canEdit && verdict === "not_quite" && (
        <Field>
          <FieldLabel htmlFor={fieldId}>
            What is right? <FieldOptional />
          </FieldLabel>
          <Input
            id={fieldId}
            value={reason}
            autoFocus={!saved?.reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => reason.trim() !== (saved?.reason ?? "") && save.mutate({ line: { id: line.id, verdict: "not_quite", reason: reason.trim() || undefined } }, { onError: failed })}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            placeholder="In your words; Fume asks before it guesses"
          />
        </Field>
      )}
    </li>
  );
}

/**
 * What Fume understood, its own view once the deck is done (DLOAD-17, DLAY-12, DTSK-5, DTSK-22): the lines, the
 * products in one sentence, what is not confirmed yet, and at its foot Back one and Approve and start (not pinned:
 * she reaches it by reading down).
 */
function Summary({ view, brand, onBack }: { view: BrandDnaView; brand: string; onBack?: () => void }) {
  const scan = useBrandScan();
  const board = useBrandBoard();
  const progress = useOnboardingProgress();
  const approve = useApproveBrandDna();
  const navigate = useNavigate();
  const toast = useToast();
  const { canEdit, canApprove } = useRole();
  const identity = board.data?.identity;
  const open = identity ? openTotal(identity) : 0;
  const first = identity ? firstOpenPart(identity) : undefined;
  const approved = view.dna.state === "approved";
  const products = view.products.length;
  const saved = new Map((progress.data?.lines ?? []).map((l) => [l.id, l]));

  function approveAndStart() {
    approve.mutate(undefined, {
      onSuccess: () => {
        toast.done("Your Brand DNA is approved", {
          description: open > 0 ? `Creatives use what you confirmed. ${finds(open)} wait for you on Brand.` : "Every creative is made and checked against it.",
        });
        navigate("/");
      },
      onError: (error) => toast.error("Brand DNA wasn’t approved", { description: error.message }),
    });
  }

  return (
    <section className="ui-ob-understood" aria-label="What Fume understood">
      {progress.data && (
        <ul className="ui-ob-lines" aria-label="What Fume understood">
          {understoodLines(view, scan.data).map((l) => (
            <SummaryLine key={l.id} line={l} saved={saved.get(l.id)} canEdit={canEdit} />
          ))}
        </ul>
      )}
      {products > 0 && <p className="ui-ob-note">Fume also found {copy.count(products, "product")}. You confirm each one the first time it goes into a campaign.</p>}
      {open > 0 && !approved && (
        <div className="ui-ob-open">
          <p className="ui-ob-open-text">
            {finds(open)} {open === 1 ? "is" : "are"} not confirmed yet; creatives use only what you confirm.
          </p>
          {canApprove && (
            <Button asChild variant="secondary" size="sm" iconEnd="arrow-right">
              <Link to={stepPath("review", first)}>Confirm them now</Link>
            </Button>
          )}
        </div>
      )}
      <div className="ui-ob-understood-foot">
        {onBack ? (
          <Button variant="quiet" icon="undo-2" onClick={onBack}>
            Back one
          </Button>
        ) : (
          <span />
        )}
        {approved ? (
          <Button iconEnd="arrow-right" onClick={() => navigate("/")}>
            Go to Home
          </Button>
        ) : canApprove ? (
          <Button icon="check" onClick={approveAndStart} loading={approve.isPending}>
            Approve and start
          </Button>
        ) : (
          <span className="ui-welcome-note">An owner or an approver at {brand} approves your Brand DNA.</span>
        )}
      </div>
    </section>
  );
}

export function TasteStep() {
  const brand = useBrandDna();
  const scan = useBrandScan();
  const session = useSession().data!;
  const name = session.workspace.brandName;
  const view = brand.data;
  const cards = useMemo(() => (view ? deckOf(view, name) : []), [view, name]);
  // Open on the first card not answered yet; every card answered: What Fume understood.
  const [index, setIndex] = useState<number | null>(null);
  useEffect(() => {
    if (index === null && view) {
      const i = cards.findIndex((c) => !c.answer);
      setIndex(i < 0 ? cards.length : i);
    }
  }, [index, view, cards]);
  const atEnd = index !== null && cards.length > 0 && index >= cards.length;

  // A new view opens at its top with focus on its title, like a new step.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    document.querySelector<HTMLElement>(".ui-welcome-title")?.focus({ preventScroll: true });
  }, [atEnd]);

  return (
    <StepFrame
      step="taste"
      title={atEnd ? "What Fume understood · Your taste" : "Your taste"}
      footPinned={false}
      foot={
        atEnd ? undefined : (
          <Button asChild variant="quiet" icon="arrow-left">
            <Link to="/welcome/review?part=voice">Confirm what Fume found</Link>
          </Button>
        )
      }
    >
      <header className="ui-welcome-head">
        <h1 className="ui-welcome-title" tabIndex={-1}>
          {atEnd ? "What Fume understood" : "Your taste"}
        </h1>
        <p className="ui-welcome-lede">
          {atEnd
            ? `From ${scan.data?.url ?? "what you gave us"} and your answers. Confirm each line, or change what is not quite right.`
            : "Two short parts, one card at a time. There is no wrong answer."}
        </p>
      </header>
      <Query query={brand} loading="Loading the pictures">
        {(v) =>
          index === null ? null : atEnd ? (
            <Summary view={v} brand={name} onBack={cards.length ? () => setIndex(cards.length - 1) : undefined} />
          ) : (
            <TasteDeckStep cards={cards} index={index} onIndexChange={setIndex} brand={name} />
          )
        }
      </Query>
    </StepFrame>
  );
}
