// Brand › Confirm your brand (round 9, DLAY-10, DLOAD-13, DLOAD-1; round 8 WAY-6, LOAD-6, ONB-18): what Fume found and
// is not sure of, and the AI people waiting for her, in the SAME queue frame as the products: on a desk the finds on
// the left (the thing itself as a thumbnail, its name, its part, a tick once decided; ↑ ↓ move through them), the card
// on the right (the thing itself, big, one question, where Fume found it, Change and Remove on the card), and Later ·
// Confirm pinned at the bottom of the window, at the same place for every find. Change opens the value in place and
// Confirm then saves it; Remove sits apart and can be undone from its toast. ← → step, ⌘↵ confirms, Esc goes back.
// The find on the card is in the address (?p=colour:c-3); ?part=colour starts at that part (logo, colour, type,
// imagery, voice, taste, models).
// Round 13 (walk-through 21 Oct, #2, #42; PROPOSED 22 Oct 2026): a colour's card says what it is used for as chips
// (Buttons, Accent, Backgrounds, Text, Light, Packaging, UI and design system), saved on the tap, and its Change has
// a colour picker beside the hex.
import {
  Badge,
  Button,
  CheckCard,
  CheckEnd,
  CheckQueue,
  CheckQueueItem,
  CheckQueueList,
  Field,
  FieldDescription,
  FieldLabel,
  Icon,
  Input,
  PageHeader,
  Textarea,
  tokenMs,
  useToast,
} from "@fume/ui";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useBrandAssets, useBrandBoard, useDecide, useDecideModel, useSession, useSetColourUses } from "../../api/hooks";
import type { BoardItem, BrandColour, BrandIdentity, BrandImage, BrandLogo, BrandModel, BrandTypeface, BrandVoiceLine, Provenance } from "../../contract";
import * as copy from "../../copy";
import { Back, Nothing, Page, Query, useBack } from "../../shell/Page";
import { ColourUsesField, HexPicker } from "../brand/colour";
import { changeField } from "../brand/decide";
import { useModelsHeldBack, useRole } from "../brand/parts";
import { useQueueKeys } from "./queue";

const parts = ["logo", "colour", "type", "imagery", "voice", "taste", "models"] as const;
type Part = (typeof parts)[number];
const partName: Record<Part, string> = { logo: "Logo", colour: "Colour", type: "Type", imagery: "Imagery", voice: "Voice", taste: "Taste", models: "AI model" };

type Thing =
  | { part: "logo"; kind: "logo"; item: BrandLogo }
  | { part: "colour"; kind: "colour"; item: BrandColour }
  | { part: "type"; kind: "typeface"; item: BrandTypeface }
  | { part: "imagery"; kind: "image"; item: BrandImage }
  | { part: "voice"; kind: "voice"; item: BrandVoiceLine }
  | { part: "taste"; kind: "board_item"; item: BoardItem }
  | { part: "models"; kind: "model"; item: BrandModel };

type Verdict = "confirmed" | "changed" | "removed" | "later";
const verdictWord: Record<Verdict, string> = { confirmed: "Confirmed", changed: "Changed", removed: "Removed", later: "Later" };

const keyOf = (t: Thing) => `${t.kind}:${t.item.id}`;
const open = (p: Provenance) => p.state === "proposed";

/** Everything that waits, in the board's order. */
function things(identity: BrandIdentity, moodboard: BoardItem[], models: BrandModel[]): Thing[] {
  return [
    ...identity.logos.filter((x) => open(x.provenance)).map((item) => ({ part: "logo", kind: "logo", item }) as const),
    ...identity.colours.filter((x) => open(x.provenance)).map((item) => ({ part: "colour", kind: "colour", item }) as const),
    ...identity.typefaces.filter((x) => open(x.provenance)).map((item) => ({ part: "type", kind: "typeface", item }) as const),
    ...identity.imagery.filter((x) => open(x.provenance)).map((item) => ({ part: "imagery", kind: "image", item }) as const),
    ...identity.voice.filter((x) => open(x.provenance)).map((item) => ({ part: "voice", kind: "voice", item }) as const),
    ...moodboard.filter((x) => open(x.provenance)).map((item) => ({ part: "taste", kind: "board_item", item }) as const),
    ...models.filter((m) => m.state === "saved").map((item) => ({ part: "models", kind: "model", item }) as const),
  ];
}

/** The thing's name in words, for the list, the toast and the read-aloud line. */
function nameOf(t: Thing): string {
  switch (t.kind) {
    case "voice":
      return `“${t.item.statement}”`;
    case "image":
      return t.item.caption;
    case "board_item":
      return "A moodboard picture";
    default:
      return t.item.name;
  }
}

/** The one question each card asks. */
function questionOf(t: Thing, brand: string): string {
  switch (t.kind) {
    case "logo":
      return `Is “${t.item.name}” one of your logos?`;
    case "colour":
      return `Is ${t.item.name} one of your colours?`;
    case "typeface":
      return `Do you use ${t.item.name}?`;
    case "image":
      return `Is this picture ${brand}?`;
    case "voice":
      return `Does this sound like ${brand}?`;
    case "board_item":
      return "Does this belong on your moodboard?";
    case "model":
      return `Meet ${t.item.name}`;
  }
}

/** What Change edits: a hex, a name or the line itself, in the board's own words (brand/decide.tsx changeField), so the
 *  queue and the board say the same. Pictures and AI people have nothing to rename. */
const changeOf: Partial<Record<Thing["kind"], { label: string; help: string; hex?: boolean; long?: boolean }>> = {
  colour: changeField.colour,
  typeface: changeField.typeface,
  logo: changeField.logo,
  voice: changeField.voice && { ...changeField.voice, long: true },
};
const valueOf = (t: Thing) => (t.kind === "colour" ? t.item.hex : t.kind === "voice" ? t.item.statement : t.kind === "typeface" || t.kind === "logo" ? t.item.name : "");
const HEX = /^#[0-9a-f]{6}$/i;
/** The value she typed, as it would be saved ("5c1f2a" → "#5C1F2A"). */
const cleaned = (t: Thing, text: string) => (changeOf[t.kind]?.hex ? (text.trim().startsWith("#") ? text.trim() : `#${text.trim()}`).toUpperCase() : text.trim());
const isValid = (t: Thing, text: string) => (changeOf[t.kind]?.hex ? HEX.test(cleaned(t, text)) : cleaned(t, text).length > 0);

const vars = (v: Record<string, string | undefined>) => v as CSSProperties;

/** The logo's ground and ink from the brand's own colours. */
function logoColours(t: Extract<Thing, { kind: "logo" }>, identity: BrandIdentity) {
  const ground = identity.colours.find((c) => c.role === "ground" && c.provenance.state !== "removed")?.hex;
  const ink = identity.colours.find((c) => c.role === "text" && c.provenance.state !== "removed")?.hex;
  const dark = t.item.ground === "dark";
  return { dark, ground: dark ? ink : ground, ink: dark ? ground : ink };
}

/** The thing itself, large: the colour, a specimen, the logo on its ground, the picture or the AI person. */
function Visual({ t, identity }: { t: Thing; identity: BrandIdentity }) {
  switch (t.kind) {
    case "colour":
      return <div className="ui-check-swatch" style={vars({ "--swatch": t.item.hex })} role="img" aria-label={`${t.item.name}, ${t.item.hex}`} />;
    case "typeface":
      return (
        <div className="ui-check-specimen" style={vars({ "--specimen-family": t.item.cssFamily })}>
          <span className="ui-check-specimen-big" aria-hidden="true">
            Aa
          </span>
          <span className="ui-check-specimen-line">{t.item.sample}</span>
        </div>
      );
    case "logo": {
      const c = logoColours(t, identity);
      const display = identity.typefaces.find((f) => f.role === "display")?.cssFamily;
      return (
        <div className="ui-check-logo" style={vars({ "--brand-ground": c.ground, "--brand-ink": c.ink, "--brand-display": display })} role="img" aria-label={`${t.item.name}, on a ${c.dark ? "dark" : "light"} ground`}>
          {t.item.image ? <img src={t.item.image} alt="" /> : <span>{t.item.wordmark}</span>}
        </div>
      );
    }
    case "image":
      return <img className="ui-check-picture" src={t.item.image} alt={t.item.caption} />;
    case "board_item":
      return t.item.image ? <img className="ui-check-picture" src={t.item.image} alt={t.item.note ?? "A picture Fume found for your moodboard"} /> : null;
    case "model":
      return <img className="ui-check-picture" src={t.item.image} alt={`${t.item.name}, an AI model`} />;
    default:
      return null;
  }
}

/** The thing as a small thumbnail in the list. */
function Thumb({ t, identity }: { t: Thing; identity: BrandIdentity }) {
  switch (t.kind) {
    case "colour":
      return <span className="ui-check-queue-swatch" style={vars({ "--swatch": t.item.hex })} />;
    case "logo": {
      if (t.item.image) return <img src={t.item.image} alt="" />;
      const c = logoColours(t, identity);
      return <span className="ui-check-queue-swatch" style={vars({ "--swatch": c.ground })} />;
    }
    case "typeface":
      return <Icon name="type" />;
    case "voice":
      return <Icon name="message-square" />;
    case "image":
    case "board_item":
    case "model":
      return t.item.image ? <img src={t.item.image} alt="" loading="lazy" /> : <Icon name="image" />;
  }
}

/** The quiet facts under the question: where Fume found it, its role, its hex. */
function Facts({ t }: { t: Thing }) {
  const where = "provenance" in t.item ? t.item.provenance.evidence : undefined;
  const rows: { label: string; value: string; data?: boolean }[] = [];
  if (t.kind === "colour") rows.push({ label: "Hex", value: t.item.hex.toUpperCase(), data: true }, { label: "Where", value: t.item.usage });
  if (t.kind === "typeface") rows.push({ label: "Weights", value: t.item.weights.join(", ") }, { label: "Use", value: t.item.usage });
  if (t.kind === "logo") rows.push({ label: "Use", value: t.item.use });
  if (t.kind === "image") rows.push({ label: "What it shows", value: t.item.caption });
  if (t.kind === "model") rows.push({ label: "Look", value: t.item.look });
  if (where) rows.push({ label: "Where Fume found it", value: where });
  if (!rows.length) return null;
  return (
    <dl className="ui-check-facts">
      {rows.map((r) => (
        <div key={r.label} className="ui-check-fact">
          <dt>{r.label}</dt>
          <dd className={r.data ? "ui-check-fact-data" : "ui-check-fact-value"}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A colour's uses as chips (#42), saved on the tap. */
function CheckColourUses({ colour }: { colour: BrandColour }) {
  const save = useSetColourUses();
  const toast = useToast();
  const [uses, setUses] = useState(colour.uses ?? []);
  return (
    <ColourUsesField
      id={`check-uses-${colour.id}`}
      value={uses}
      onChange={(next) => {
        setUses(next);
        save.mutate({ colourId: colour.id, uses: next }, { onError: (error) => toast.error("That wasn’t saved", { description: error.message }) });
      }}
    />
  );
}

/** One card: the thing, the question, Change in place and Remove apart. Confirm is the queue's foot. */
function ThingCard({
  t,
  identity,
  brand,
  leaving,
  busy,
  changing,
  text,
  tried,
  onChanging,
  onText,
  onConfirm,
  onRemove,
}: {
  t: Thing;
  identity: BrandIdentity;
  brand: string;
  leaving: boolean;
  busy: boolean;
  changing: boolean;
  text: string;
  tried: boolean;
  onChanging: (open: boolean) => void;
  onText: (text: string) => void;
  onConfirm: () => void;
  onRemove: () => void;
}) {
  const field = changeOf[t.kind];
  const unsure = "provenance" in t.item && t.item.provenance.confidence === "low";
  const visual = t.kind !== "voice";
  const bad = tried && !isValid(t, text);

  function save(e: FormEvent) {
    e.preventDefault();
    onConfirm();
  }
  // Esc in the field puts the value back and the focus on Change (the queue's own Esc then leaves).
  function cancel(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== "Escape") return;
    e.preventDefault();
    onChanging(false);
    window.requestAnimationFrame(() => document.getElementById("check-change-open")?.focus());
  }

  return (
    <CheckCard media={visual} leaving={leaving} tabIndex={-1} aria-labelledby="check-question">
      {visual && (
        <figure className="ui-check-media">
          <Visual t={t} identity={identity} />
        </figure>
      )}
      <div className="ui-check-body">
        <header className="ui-check-head">
          {unsure && <p className="ui-check-ask-eyebrow">Fume is not sure</p>}
          {t.kind === "model" && (
            <p className="ui-check-ask-eyebrow">
              <Badge>AI model</Badge>
            </p>
          )}
          <h2 className="ui-check-name" id="check-question">
            {questionOf(t, brand)}
          </h2>
          {t.kind === "model" ? (
            <p className="ui-check-lead">
              {t.item.name} is an AI model Fume made for {brand}, never shown as a real one. Confirm {t.item.name}, and Fume may cast {t.item.name} in your creatives.
            </p>
          ) : t.kind === "board_item" ? (
            <p className="ui-check-lead">What you confirm here teaches Fume your taste.</p>
          ) : null}
        </header>

        {t.kind === "voice" && !changing && (
          <blockquote className="ui-check-quote">
            {t.item.statement}
            {t.item.example && <span className="ui-check-quote-example">For example: {t.item.example}</span>}
          </blockquote>
        )}

        <Facts t={t} />
        {t.kind === "colour" && !changing && <CheckColourUses key={t.item.id} colour={t.item} />}

        {changing && field ? (
          // Change opens the value in place; the foot's Confirm saves it (Enter and ⌘↵ here too), Cancel or Esc puts it back.
          <form className="ui-check-change" onSubmit={save}>
            <Field invalid={bad}>
              <FieldLabel htmlFor="check-change">{field.label}</FieldLabel>
              {field.long ? (
                <Textarea id="check-change" rows={2} value={text} onChange={(e) => onText(e.target.value)} onKeyDown={cancel} aria-invalid={bad || undefined} autoFocus />
              ) : field.hex ? (
                <div className="ui-colour-hex">
                  <HexPicker value={text} onChange={onText} label={`Pick ${nameOf(t)}’s colour`} />
                  <Input id="check-change" value={text} onChange={(e) => onText(e.target.value)} onKeyDown={cancel} aria-invalid={bad || undefined} autoFocus />
                </div>
              ) : (
                <Input id="check-change" value={text} onChange={(e) => onText(e.target.value)} onKeyDown={cancel} aria-invalid={bad || undefined} autoFocus />
              )}
              <FieldDescription>{bad ? (field.hex ? "Six digits after the #, for example #5C1F2A." : "Write it first, then confirm.") : `${field.help} Confirm saves it.`}</FieldDescription>
            </Field>
            <div className="ui-check-actions">
              <Button type="button" variant="quiet" size="sm" onClick={() => onChanging(false)} disabled={busy}>
                Cancel the change
              </Button>
            </div>
          </form>
        ) : (
          <div className="ui-check-actions">
            {field && (
              <Button id="check-change-open" variant="quiet" icon="pencil" onClick={() => onChanging(true)} disabled={busy}>
                Change
              </Button>
            )}
            <span className="ui-check-actions-end">
              <Button variant="quiet" icon="trash" onClick={onRemove} disabled={busy}>
                Remove
              </Button>
            </span>
          </div>
        )}
      </div>
    </CheckCard>
  );
}

export function BrandCheckPage() {
  const board = useBrandBoard();
  const assets = useBrandAssets();
  const held = useModelsHeldBack();
  const { canApprove } = useRole();
  const [params] = useSearchParams();
  const back = useBack({ to: "/brand", label: "Brand" });
  const [keys, setKeys] = useState<string[] | null>(null);
  // The finds as they were when it opened: a find she just decided still shows in the list and while it slides away.
  const [snapshot, setSnapshot] = useState<Map<string, Thing>>(new Map());

  const all = useMemo(
    () => (board.data ? things(board.data.identity, board.data.moodboard.items, held ? [] : (assets.data?.models ?? [])) : []),
    [board.data, assets.data, held],
  );

  // The finds are set once, when it opens, so deciding one never reshuffles the rest. ?part= starts at that part.
  useEffect(() => {
    if (keys || !board.data || !assets.data) return;
    const part = params.get("part") as Part | null;
    const list = all.map(keyOf);
    const from = part && parts.includes(part) ? all.findIndex((t) => parts.indexOf(t.part) >= parts.indexOf(part)) : 0;
    setKeys(from > 0 ? [...list.slice(from), ...list.slice(0, from)] : list);
    setSnapshot(new Map(all.map((t) => [keyOf(t), t])));
  }, [keys, board.data, assets.data, all, params]);

  return (
    <Page title="Confirm your brand · Brand">
      <PageHeader title="Confirm your brand" back={<Back to="/brand" label="Brand" />} />
      <Query query={board} loading="Loading your brand">
        {(view) =>
          !canApprove ? (
            <Nothing icon="palette" title="Your brand’s approver confirms these" text={`Fume found ${copy.count(view.open, "thing")} it is not sure of. They wait for your brand’s approver.`} />
          ) : keys === null ? null : keys.length === 0 ? (
            <CheckQueue>
              <CheckEnd
                title="Nothing to confirm"
                text="Everything in your Brand DNA is yours. When Fume finds something new, it waits here."
                actions={
                  <Button icon="arrow-left" onClick={back.back}>
                    Back to {back.label}
                  </Button>
                }
              />
            </CheckQueue>
          ) : (
            <Queue keys={keys} snapshot={snapshot} all={all} identity={view.identity} />
          )
        }
      </Query>
    </Page>
  );
}

function Queue({ keys, snapshot, all, identity }: { keys: string[]; snapshot: Map<string, Thing>; all: Thing[]; identity: BrandIdentity }) {
  const session = useSession().data!;
  const decide = useDecide();
  const decideModel = useDecideModel();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const back = useBack({ to: "/brand", label: "Brand" });
  const [results, setResults] = useState<Record<string, Verdict>>({});
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [live, setLive] = useState("");
  const [changing, setChanging] = useState(false);
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);
  // A Remove waits a moment before it is sent, so Undo in its toast can take it back; leaving sends it at once.
  const pending = useRef<{ t: Thing; timer: number } | null>(null);
  const brand = session.workspace.brandName;

  const byKey = new Map(all.map((t) => [keyOf(t), t]));
  const asked = params.get("p");
  const key = asked && keys.includes(asked) ? asked : keys[0];
  const at = keys.indexOf(key);
  const total = keys.length;
  const current = byKey.get(key) ?? snapshot.get(key);
  // Decided here, or somewhere else meanwhile (the board, another person): no longer open.
  const verdict = (k: string): Verdict | undefined => results[k] ?? (byKey.has(k) ? undefined : "confirmed");

  function sendRemove(t: Thing) {
    if (t.kind === "model") decideModel.mutate({ modelId: t.item.id, verdict: "decline" });
    else decide.mutate({ kind: t.kind, id: t.item.id, verdict: "remove" });
  }
  function flush() {
    if (!pending.current) return;
    window.clearTimeout(pending.current.timer);
    sendRemove(pending.current.t);
    pending.current = null;
  }
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stepping with ← → from the card (or from nowhere): the next card takes the focus, so it is never lost on the body.
  const cardFocus = useRef(false);
  useEffect(() => {
    if (!cardFocus.current) return;
    cardFocus.current = false;
    document.querySelector<HTMLElement>(".ui-check-queue-stage > .ui-check-card")?.focus({ preventScroll: true });
  }, [key]);
  function show(k: string) {
    const at = document.activeElement;
    cardFocus.current = at === document.body || Boolean(at?.closest(".ui-check-card"));
    setFinished(false);
    setChanging(false);
    setTried(false);
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.set("p", k);
        n.delete("part");
        return n;
      },
      { replace: true, preventScrollReset: true },
    );
  }
  const step = (by: 1 | -1) => {
    const next = keys[at + by];
    if (next) show(next);
  };

  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  function advance(k: string, v: Verdict, said: string) {
    const after = { ...results, [k]: v };
    setResults(after);
    const next = [...keys.slice(at + 1), ...keys.slice(0, at)].find((x) => !(after[x] ?? (byKey.has(x) || x === k ? undefined : "confirmed")));
    setLive(`${said}${next ? ` Next: ${nameOf((byKey.get(next) ?? snapshot.get(next))!)}.` : ""}`);
    setLeaving(true);
    timer.current = window.setTimeout(
      () => {
        setLeaving(false);
        setBusy(false);
        if (next) show(next);
        else setFinished(true);
        document.querySelector(".ui-sidebar-inset")?.scrollTo({ top: 0 });
      },
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : tokenMs("--ui-motion-slow", 480),
    );
  }

  /** Confirm: as Fume found it, or with her change when Change is open. Never greyed out: an invalid change says so. */
  function confirm() {
    const t = current;
    // Once per find: not while one slides away, not again once it is decided (a find left for Later can be confirmed).
    const was = verdict(key);
    if (!t || busy || finished || leaving || (was && was !== "later")) return;
    const fail = (error: Error) => (setBusy(false), toast.error("That wasn’t saved", { description: error.message }));
    if (changing && t.kind !== "model") {
      if (!isValid(t, text)) {
        setTried(true);
        document.getElementById("check-change")?.focus();
        return;
      }
      const value = cleaned(t, text);
      if (value !== valueOf(t)) {
        flush();
        setBusy(true);
        decide.mutate({ kind: t.kind, id: t.item.id, verdict: "change", value }, { onSuccess: () => advance(key, "changed", `${nameOf(t)} changed.`), onError: fail });
        return;
      }
    }
    flush();
    setBusy(true);
    const done = () => advance(key, "confirmed", `${nameOf(t)} confirmed.`);
    if (t.kind === "model") decideModel.mutate({ modelId: t.item.id, verdict: "approve" }, { onSuccess: done, onError: fail });
    else decide.mutate({ kind: t.kind, id: t.item.id, verdict: "keep" }, { onSuccess: done, onError: fail });
  }

  function later() {
    if (!current || busy || finished || leaving) return;
    advance(key, "later", `${nameOf(current)} left for later.`);
  }

  function remove() {
    const t = current;
    if (!t || busy || leaving) return;
    flush();
    const k = key;
    const timer = window.setTimeout(flush, 8000);
    pending.current = { t, timer };
    toast.done(`${nameOf(t)} removed.`, {
      description: t.kind === "model" ? "Fume will not use this AI model." : "Fume will not use it.",
      action: {
        label: "Undo",
        onClick: () => {
          if (!pending.current || pending.current.t !== t) return;
          window.clearTimeout(pending.current.timer);
          pending.current = null;
          setResults((r) => {
            const { [k]: _, ...rest } = r;
            return rest;
          });
          show(k);
        },
      },
    });
    advance(k, "removed", `${nameOf(t)} removed.`);
  }

  useQueueKeys({ onPrev: () => step(-1), onNext: () => step(1), onClose: () => (flush(), back.back()), onConfirm: finished ? undefined : confirm });

  const counted = (["confirmed", "changed", "removed"] as const).map((v) => [v, keys.filter((k) => results[k] === v).length] as const).filter(([, n]) => n > 0);
  const left = keys.filter((k) => results[k] === "later");
  const decided = current ? verdict(key) : undefined;

  const list =
    total > 1 ? (
      <CheckQueueList label="Finds to confirm">
        {keys.map((k) => {
          const t = byKey.get(k) ?? snapshot.get(k);
          if (!t) return null;
          const v = verdict(k);
          const unsure = "provenance" in t.item && t.item.provenance.confidence === "low";
          return (
            <CheckQueueItem
              key={k}
              current={!finished && k === key}
              done={v !== undefined && v !== "later"}
              media={<Thumb t={t} identity={identity} />}
              title={nameOf(t)}
              detail={v ? verdictWord[v] : `${partName[t.part]}${unsure ? " · Fume is not sure" : ""}`}
              onClick={() => show(k)}
            />
          );
        })}
      </CheckQueueList>
    ) : undefined;

  return (
    <CheckQueue
      list={list}
      live={live}
      step={
        !finished && total > 1 ? (
          <>
            <Button variant="quiet" size="sm" iconOnly icon="chevron-left" aria-label="Previous find" shortcut="←" disabled={at <= 0} onClick={() => step(-1)} />
            <span className="ui-check-queue-count">
              {at + 1} of {total}
            </span>
            <Button variant="quiet" size="sm" iconOnly icon="chevron-right" aria-label="Next find" shortcut="→" disabled={at >= total - 1} onClick={() => step(1)} />
          </>
        ) : undefined
      }
      foot={
        !finished && current && (!decided || leaving) ? (
          <>
            <Button variant="quiet" onClick={later} disabled={busy}>
              Later
            </Button>
            <Button icon="check" onClick={confirm} loading={busy}>
              {current.kind === "model" ? `Confirm ${current.item.name}` : "Confirm"}
            </Button>
          </>
        ) : undefined
      }
    >
      {finished ? (
        <CheckEnd
          title={counted.length ? "Your brand is up to date" : "Nothing confirmed yet"}
          text={
            counted.length
              ? `${counted.map(([v, n]) => `${n} ${v}`).join(", ")}${left.length ? `, ${left.length} for later` : ""}. Fume uses it from the next creative on.`
              : "They wait here until you have a minute. Nothing is used until you confirm it."
          }
          actions={
            <>
              <Button icon="arrow-left" onClick={() => (flush(), navigate("/brand"))}>
                Back to Brand
              </Button>
              {left.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    // Once more through the ones left for later: they are open again.
                    setResults((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== "later")));
                    show(left[0]);
                  }}
                >
                  Go through the {left.length === 1 ? "one" : left.length} left
                </Button>
              )}
            </>
          }
        />
      ) : current && decided && decided !== "later" && !leaving ? (
        <CheckEnd
          key={key}
          title={`${nameOf(current)}: ${verdictWord[decided].toLowerCase()}`}
          text={decided === "removed" ? "Fume will not use it. Undo it from the message, or go on with the next." : "It is part of your Brand DNA now."}
        />
      ) : current ? (
        <ThingCard
          key={key}
          t={current}
          identity={identity}
          brand={brand}
          leaving={leaving}
          busy={busy}
          changing={changing}
          text={text}
          tried={tried}
          onChanging={(o) => {
            setChanging(o);
            setTried(false);
            setText(valueOf(current));
          }}
          onText={setText}
          onConfirm={confirm}
          onRemove={remove}
        />
      ) : null}
    </CheckQueue>
  );
}
