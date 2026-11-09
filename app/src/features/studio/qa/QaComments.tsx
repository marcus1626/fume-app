// Check's comment thread (FLOWS §35.1, PROPOSED 9 Nov 2026). Marcus, round 15: "kan ikke designeren sin sjekk her være
// litt som kunden sin, et kommentarfelt og sånt som i Frame.io", and the panel was "rotete" with much scrolling. So the
// panel is one thread, like the customer's viewer:
// - What the Engine found is a comment from the Engine, pinned where it is on the creative (or at its second on a
//   video), with what it should be and two answers: Fix with the Engine, or Not a problem.
// - Her own comments are written in the field at the panel's foot, or pinned with a click on the creative. They go to
//   the Engine together with Tell the Engine, with the Engine's comments she chose.
// - What was settled or said before folds into one line; what holds folds into one line with what it is checked
//   against; the graphic design's checks and the words on the creative fold the same way.
// - The scores are a chip in the head that opens the board, never the first thing in the panel.
// The look is qa.css (.ui-qa-c).
import {
  Avatar,
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Icon,
  TextShimmer,
} from "@fume/ui";
import type { ReactNode } from "react";
import type { Evaluation, Format, Id, QaFeedback, QaFinding, QaFormat, QaItem, QaView, User } from "../../../contract";
import * as copy from "../../../copy";
import { measuresOf, underBar } from "../../../domain/scores";
import { timecode } from "../../../domain/video";
import { fixer } from "../../../lib/fixer";
import { time } from "../../../lib/time";
import { sign } from "../../../shell/people";
import { ScoreBoard, scoreChip } from "../doc/scores";
import { landOn, stretch } from "./QaVideo";

/** What a finding is about, in a word. */
export const findingKind: Record<QaFinding["dimension"], string> = {
  product: "Product",
  brand_brief: "Brand",
  artefacts: "Artefact",
  text_claims: "Printed words",
  design: "Design",
};
export const severityOrder: Record<QaFinding["severity"], number> = { critical: 0, major: 1, minor: 2 };
const severityWords: Record<QaFinding["severity"], string> = {
  critical: "decide first",
  major: "major",
  minor: "minor",
};

/** A finding as the line it puts in the note to the Engine. */
export const findingLine = (f: QaFinding) =>
  `${f.finding.replace(/[.\s]+$/, "")}.${f.expected ? ` It should be: ${f.expected.replace(/[.\s]+$/, "")}.` : ""}`;

const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One of her comments, before it goes to the Engine: pinned on the creative, or on a video at its second. */
export interface QaNote {
  id: number;
  text: string;
  spot?: { x: number; y: number };
  at?: number;
  /** On an ad with several formats: the format it is pinned on, when not the master. */
  format?: Format;
}

/** A line the Engine flagged without a finding of its own (a note, a check on a video's edit). */
export interface QaFlag {
  text: string;
  at?: number;
}

/** What the Engine said of a creative, split: what it flagged, what holds, and whether it looked at all. */
export function engineRows(evaluation: Evaluation, findings: QaFinding[], more: QaFlag[] = []) {
  // Not evaluated yet (made by hand): nothing is said to hold or to be off; the expert checks by eye.
  const byEye = evaluation.evaluated === false;
  // An area the Engine's findings speak to is said by them; its summary line and the notes go.
  const covered = new Set(findings.map((f) => f.dimension));
  const rows: { result: "pass" | "flag"; text: string; at?: number }[] = byEye
    ? []
    : [
        ...(covered.has("product")
          ? []
          : [
              {
                result: evaluation.productTruth,
                text: evaluation.productTruth === "pass" ? "Product Truth holds" : "Product Truth is off",
              },
            ]),
        ...(covered.has("brand_brief")
          ? []
          : [
              {
                result: evaluation.brandRules,
                text: evaluation.brandRules === "pass" ? "Brand rules hold" : "A brand rule is broken",
              },
            ]),
        ...(covered.has("artefacts")
          ? []
          : [
              {
                result: evaluation.artefacts === "none" ? ("pass" as const) : ("flag" as const),
                text:
                  evaluation.artefacts === "none"
                    ? "No artefacts"
                    : evaluation.artefacts === "minor"
                      ? "A minor artefact"
                      : "A major artefact",
              },
            ]),
      ];
  const notes = findings.length
    ? []
    : evaluation.notes.map((n) => ({ result: byEye ? ("pass" as const) : ("flag" as const), text: n }));
  // A note says what the summary line only names ("A minor artefact" → "A soft edge on the left cup"), so the
  // summary line goes when a note speaks for it.
  const all: { result: "pass" | "flag"; text: string; at?: number }[] = [
    ...(notes.some((n) => n.result === "flag") ? rows.filter((r) => r.result === "pass") : rows),
    ...notes,
    ...(evaluation.checks ?? []),
    ...more.map((m) => ({ result: "flag" as const, ...m })),
  ];
  return {
    byEye,
    flags: all.filter((r) => r.result === "flag").map(({ text, at }) => ({ text, at })),
    holds: all.filter((r) => r.result === "pass").map((r) => r.text),
  };
}

// ─── The head's score chip ───────────────────────────────────────────────

/** The scores as a chip in the head ("Under the bar · Product 52"); it opens the board under the head. */
export function ScoreChip({
  id,
  evaluation,
  open,
  onToggle,
}: {
  id: string;
  evaluation: Evaluation;
  open: boolean;
  onToggle: () => void;
}) {
  if (!measuresOf(evaluation).length) return null;
  const under = underBar(evaluation).length > 0;
  return (
    <button
      type="button"
      className="ui-badge ui-qa-score-chip"
      data-under={under ? "" : undefined}
      aria-expanded={open}
      aria-controls={`${id}-scores`}
      onClick={onToggle}
    >
      {under && <Icon name="triangle-alert" />}
      {scoreChip(evaluation)}
      <Icon name={open ? "chevron-up" : "chevron-down"} />
    </button>
  );
}

export function ScorePanel({ id, evaluation }: { id: string; evaluation: Evaluation }) {
  return (
    <div className="ui-qa-scores" id={`${id}-scores`}>
      <ScoreBoard id={id} evaluation={evaluation} why />
    </div>
  );
}

// ─── Comments ────────────────────────────────────────────────────────────

function EngineAvatar() {
  return (
    <span className="ui-avatar ui-avatar--sm ui-qa-c-engine" aria-hidden="true">
      <Icon name="fume-engine" />
    </span>
  );
}

function PersonAvatar({ user }: { user?: User }) {
  return (
    <Avatar
      size="sm"
      src={user?.avatar}
      initials={sign(user).initials}
      ink={user?.staffRole === "expert"}
      alt=""
      aria-hidden="true"
    />
  );
}

/** A second on a video, as a link that takes the playhead there. */
function Time({ at, label, onSeek }: { at: number; label?: string; onSeek?: (t: number) => void }) {
  const text = label ?? timecode(at, true);
  return onSeek ? (
    <button type="button" className="ui-qa-time" aria-label={`Go to ${text}`} onClick={() => onSeek(at)}>
      {text}
    </button>
  ) : (
    <span className="ui-qa-time">{text}</span>
  );
}

/** One of the Engine's findings, as its comment. */
export function EngineComment({
  f,
  n,
  dom,
  active,
  chosen,
  acting,
  settling,
  onFocus,
  onChoose,
  onSettle,
  onSeek,
}: {
  f: QaFinding;
  /** Its pin's number on the creative. */
  n?: number;
  dom: string;
  active: boolean;
  chosen: boolean;
  /** Its answers show (not once it is checked, nor while the Engine fixes it). */
  acting: boolean;
  settling: boolean;
  onFocus: () => void;
  onChoose: () => void;
  onSettle: () => void;
  onSeek?: (t: number) => void;
}) {
  const stops = f.severity === "critical";
  return (
    <li
      className="ui-qa-c"
      id={dom}
      data-from="engine"
      data-active={active ? "" : undefined}
      data-chosen={chosen ? "" : undefined}
      onFocusCapture={onFocus}
      onClick={onFocus}
    >
      <div className="ui-qa-c-head">
        {n !== undefined && (
          <span className="ui-qa-c-num" aria-label={`Pin ${n}`}>
            {n}
          </span>
        )}
        <EngineAvatar />
        <span className="ui-qa-c-who">{fixer.author}</span>
        <span className="ui-qa-c-tag" data-stops={stops ? "" : undefined}>
          {stops && <Icon name="circle-alert" />}
          {`${findingKind[f.dimension]} · ${severityWords[f.severity]}`}
        </span>
      </div>
      <p className="ui-qa-c-text">{f.finding}</p>
      {f.seconds && (
        <p className="ui-qa-c-meta">
          <Time at={landOn(f.seconds)} label={stretch(f.seconds)} onSeek={onSeek} />
        </p>
      )}
      {f.expected && (
        <p className="ui-qa-c-should">
          <span className="ui-qa-c-label">Should be</span> {f.expected}
        </p>
      )}
      {acting && (
        <div className="ui-qa-c-actions">
          <Button
            size="sm"
            variant={chosen ? "secondary" : "quiet"}
            icon={chosen ? "check" : undefined}
            aria-pressed={chosen}
            onClick={onChoose}
          >
            {chosen ? fixer.goes : fixer.fixWith}
          </Button>
          <Button size="sm" variant="quiet" loading={settling} onClick={onSettle}>
            Not a problem
          </Button>
        </div>
      )}
    </li>
  );
}

/** A line the Engine flagged without a finding: a comment she can send on, nothing to set aside. */
export function FlagComment({
  flag,
  dom,
  chosen,
  acting,
  onChoose,
  onSeek,
}: {
  flag: QaFlag;
  dom: string;
  chosen: boolean;
  acting: boolean;
  onChoose: () => void;
  onSeek?: (t: number) => void;
}) {
  return (
    <li className="ui-qa-c" id={dom} data-from="engine" data-chosen={chosen ? "" : undefined}>
      <div className="ui-qa-c-head">
        <EngineAvatar />
        <span className="ui-qa-c-who">{fixer.author}</span>
        {flag.at !== undefined && (
          <span className="ui-qa-c-when">
            <Time at={flag.at} onSeek={onSeek} />
          </span>
        )}
      </div>
      <p className="ui-qa-c-text">{flag.text}</p>
      {acting && (
        <div className="ui-qa-c-actions">
          <Button
            size="sm"
            variant={chosen ? "secondary" : "quiet"}
            icon={chosen ? "check" : undefined}
            aria-pressed={chosen}
            onClick={onChoose}
          >
            {chosen ? fixer.goes : fixer.fixWith}
          </Button>
        </div>
      )}
    </li>
  );
}

/** One of her comments, before it goes. */
export function NoteComment({
  note,
  n,
  dom,
  user,
  active,
  onFocus,
  onRemove,
  onSeek,
}: {
  note: QaNote;
  n?: number;
  dom: string;
  user?: User;
  active: boolean;
  onFocus: () => void;
  onRemove: () => void;
  onSeek?: (t: number) => void;
}) {
  return (
    <li
      className="ui-qa-c"
      id={dom}
      data-from="person"
      data-active={active ? "" : undefined}
      onFocusCapture={onFocus}
      onClick={onFocus}
    >
      <div className="ui-qa-c-head">
        {n !== undefined && (
          <span className="ui-qa-c-num" aria-label={`Pin ${n}`}>
            {n}
          </span>
        )}
        <PersonAvatar user={user} />
        <span className="ui-qa-c-who">You</span>
        {note.format && <span className="ui-qa-c-tag">{formatWords(note.format)}</span>}
        {note.at !== undefined && (
          <span className="ui-qa-c-when">
            <Time at={note.at} onSeek={onSeek} />
          </span>
        )}
        <Button
          className="ui-qa-c-remove"
          size="sm"
          variant="quiet"
          iconOnly
          icon="x"
          aria-label={n !== undefined ? `Remove pin ${n}` : "Remove the comment"}
          onClick={onRemove}
        />
      </div>
      <p className="ui-qa-c-text">{note.text}</p>
      <p className="ui-qa-c-meta">{`Goes with ${fixer.tell}`}</p>
    </li>
  );
}

/** What was said to the Engine in one round, as her comment; while the Engine fixes it, it says so. */
export function SaidComment({
  said,
  user,
  who,
  live,
}: {
  said: QaFeedback;
  user?: User;
  who: (id?: Id) => string;
  /** The round the Engine is working on now. */
  live?: boolean;
}) {
  return (
    <li className="ui-qa-c" data-from="person" data-resolved={live ? undefined : ""}>
      <div className="ui-qa-c-head">
        <PersonAvatar user={user} />
        <span className="ui-qa-c-who">{who(said.by)}</span>
        <time className="ui-qa-c-time" dateTime={said.at}>
          {time(said.at)}
        </time>
      </div>
      {said.text && <p className="ui-qa-c-text">{said.text}</p>}
      {(said.pins ?? []).map((p) => (
        <p key={p.n} className="ui-qa-c-pinline">
          <span className="ui-qa-c-num" aria-label={`Pin ${p.n}`}>
            {p.n}
          </span>
          <span>{p.text}</span>
        </p>
      ))}
      <p className="ui-qa-c-meta">
        {said.state !== "sent" ? upper(fixer.fixed) : live ? <TextShimmer>{fixer.fixing}</TextShimmer> : fixer.withIt}
      </p>
    </li>
  );
}

/** A finding settled before: set aside by the one who checks (with Undo), or fixed by the Engine. */
export function SettledComment({
  f,
  who,
  acting,
  undoing,
  onUndo,
}: {
  f: QaFinding;
  who: (id?: Id) => string;
  acting: boolean;
  undoing: boolean;
  onUndo: () => void;
}) {
  return (
    <li className="ui-qa-c" data-from="engine" data-resolved="">
      <div className="ui-qa-c-head">
        <EngineAvatar />
        <span className="ui-qa-c-who">{fixer.author}</span>
        <span className="ui-qa-c-tag">{findingKind[f.dimension]}</span>
      </div>
      <p className="ui-qa-c-text">{f.finding}</p>
      <p className="ui-qa-c-meta">
        {f.status === "resolved"
          ? upper(fixer.fixed)
          : `Not a problem, said ${who(f.by)}${f.at ? `, ${time(f.at)}` : ""}`}
      </p>
      {acting && f.status === "accepted" && (
        <div className="ui-qa-c-actions">
          <Button size="sm" variant="quiet" icon="undo-2" loading={undoing} onClick={onUndo}>
            Undo
          </Button>
        </div>
      )}
    </li>
  );
}

// ─── Folds ───────────────────────────────────────────────────────────────

/** A quiet fold under the comments: one line until asked. */
export function Fold({ label, children, defaultOpen }: { label: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <Collapsible className="ui-qa-against" defaultOpen={defaultOpen}>
      <CollapsibleTrigger>{label}</CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** What holds, and what it was checked against, in one fold. */
export function HoldsFold({
  holds,
  against,
  format,
  brandDna,
  byEye,
}: {
  holds: string[];
  against: QaView["against"];
  format: QaItem["format"];
  brandDna?: number;
  byEye: boolean;
}) {
  const f = copy.format[format];
  // The channel line follows the creative's own format (the brand's list is written for a feed).
  const lines = (against ?? []).map((a) =>
    a.area === "channel" ? { ...a, against: `${f.label} ${f.size}; nothing important in the outer 6 %.` } : a,
  );
  if (!holds.length && !lines.length) return null;
  const label = [
    byEye ? "Check it by eye" : holds.length ? copy.count(holds.length, "check holds", "checks hold") : undefined,
    brandDna ? `Brand DNA v${brandDna}` : lines.length ? "what it is checked against" : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Fold label={label}>
      {holds.length > 0 && (
        <ul className="ui-qa-notes ui-qa-holds">
          {holds.map((h, i) => (
            <li key={i} className="ui-qa-note" data-result="pass">
              <Icon name="circle-check" />
              {h}
            </li>
          ))}
        </ul>
      )}
      {lines.length > 0 && (
        <dl className="ui-qa-against-list">
          {lines.map((a) => (
            <div key={a.area + a.label} className="ui-qa-against-row">
              <dt>{a.label}</dt>
              <dd>{a.against}</dd>
            </div>
          ))}
        </dl>
      )}
    </Fold>
  );
}

/** The thread's head: "Comments 3". */
export function ThreadHead({ id, count }: { id: string; count: number }) {
  return (
    <div className="ui-qa-thread-head">
      <h3 className="ui-qa-part-title" id={`${id}-comments`}>
        Comments
      </h3>
      {count > 0 && <Badge className="ui-qa-thread-count">{count}</Badge>}
    </div>
  );
}

// ─── An ad's formats ─────────────────────────────────────────────────────

/** "Square 1:1". */
export const formatWords = (f: Format) => `${copy.format[f].label} ${copy.format[f].ratio}`;

const howMade: Record<QaFormat["method"] | "master", string> = {
  master: "Master",
  native: "Same picture",
  crop: "Cropped",
  expand: "Extended",
};

/** An ad's formats under the well (FLOWS §35.2, PROPOSED): the master first, then each format made from it, with how
 *  it was made; the one shown lifts onto the surface. Marcus, round 15: one ad in Check, its formats checked inside it. */
export function FormatStrip({
  master,
  formats,
  shown,
  pins,
  onShow,
}: {
  master: { format: Format; image: string };
  formats: QaFormat[];
  /** The format in the well; undefined is the master. */
  shown?: Format;
  /** Her pins on each format, so a format with comments says so. */
  pins: Partial<Record<Format, number>>;
  onShow: (f?: Format) => void;
}) {
  const all = [{ format: master.format, image: master.image, method: "master" as const }, ...formats];
  return (
    <div className="ui-qa-formats" role="group" aria-label="The ad’s formats">
      {all.map((f) => {
        const on = (shown ?? master.format) === f.format;
        const n = pins[f.format] ?? 0;
        return (
          <button
            key={f.format}
            type="button"
            className="ui-qa-format"
            aria-pressed={on}
            onClick={() => onShow(f.method === "master" ? undefined : f.format)}
          >
            <img className="ui-qa-format-media" src={f.image} alt="" data-format={f.format} draggable={false} />
            <span className="ui-qa-format-text">
              <span className="ui-qa-format-name">{formatWords(f.format)}</span>
              <span className="ui-qa-format-how">
                {howMade[f.method]}
                {n > 0 ? ` · ${copy.count(n, "pin")}` : ""}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
