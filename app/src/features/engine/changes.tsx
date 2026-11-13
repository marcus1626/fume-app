// A Studio document's thread in the Engine panel (Round 15, PROPOSED 9 Nov 2026): what she told the Engine about this
// creative and what it changed, turn by turn. It holds what the Studio's Engine bar and the video's conversation held
// (FLOWS §9.1, §34.6): the change is shown before it is kept, on the board or the timeline, and here as a card: for a
// picture each part of what she said, what it changed and, for a part it did not read, why and the change it would make
// if asked (Yes); Undo (Esc) and Keep and render (Enter). For a video, the changes line by line, Undo and Keep. A change
// kept or undone stays in the thread as such, so the thread reads as a record. The look is studio-desk.css's change
// card and engine-panel.css.
import {
  Bubble,
  Button,
  Icon,
  Message,
  MessageContent,
  MessageHeader,
  MessageText,
  WithTooltip,
  studioValueWords,
  useToast,
  type StudioVariable,
} from "@fume/ui";
import { Fragment, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { useDecideEdit } from "../../api/hooks";
import type { CreativeDocument, EngineEdit, StudioMode, VarValue, VideoEngineEdit } from "../../contract";
import { time } from "../../lib/time";
import type { directory } from "../../shell/people";
import { sign } from "../../shell/people";
import type { EngineDesk } from "./panel";

type People = ReturnType<typeof directory>;

const changeWords = (c: { key: string; label: string; from: VarValue; to: VarValue }, mode?: StudioMode) => {
  const v = mode?.variables.find((x) => x.key === c.key) as StudioVariable | undefined;
  // A value keeps its unit on its line: "28 %", never "28 / %"
  const value = (x: VarValue) => studioValueWords(v, x as never).replace(/ (?=%|px\b|s\b|°)/g, "\u00a0");
  return `${c.label} ${value(c.from)} → ${value(c.to)}`;
};

/** An example to start with that fits the creative. */
export const docStarts = (doc: CreativeDocument, mode?: StudioMode): string[] =>
  doc.studio === "video"
    ? ["Cut it to 12 s on the beat", "Hold shot 4 longer", "No captions"]
    : doc.studio === "design"
      ? ["Hide the logo", "Move the headline up"]
      : mode?.output === "model"
        ? ["Make her hair longer"]
        : mode?.output === "reference"
          ? ["Make it in oak"]
          : ["Make the light warmer", "Move the bottle lower, more air above"];

/** The document's turns, oldest first: her words, then what the Engine changed and where that stands. */
export function DocumentTurns({
  doc,
  mode,
  desk,
  people,
  meId,
  edits: only,
}: {
  doc: CreativeDocument;
  /** The changes to show (round 16: this session's, or an earlier chat's); all of them when left out. */
  edits?: (EngineEdit | VideoEngineEdit)[];
  mode?: StudioMode;
  /** The desk's hands, when the document is open beside the panel. */
  desk?: EngineDesk;
  people: People;
  meId?: string;
}) {
  const edits: (EngineEdit | VideoEngineEdit)[] = only ?? (doc.video ? doc.video.edits : doc.edits);
  return (
    <>
      {edits.map((e) => {
        const user = people.user(e.by);
        return (
          <Fragment key={e.id}>
            <Message align={e.by === meId ? "end" : "start"}>
              <MessageHeader
                author="person"
                person={sign(user)}
                name={e.by === meId ? "You" : people.name(e.by)}
                time={time(e.at)}
                dateTime={e.at}
              />
              <MessageContent>
                <Bubble>{e.text}</Bubble>
              </MessageContent>
            </Message>
            <Message>
              <MessageHeader author="engine" />
              <MessageContent>
                {"after" in e ? (
                  <VideoChange doc={doc} edit={e} desk={desk} />
                ) : (
                  <PictureChange doc={doc} edit={e} mode={mode} desk={desk} />
                )}
              </MessageContent>
            </Message>
          </Fragment>
        );
      })}
    </>
  );
}

/** Where a kept or undone change stands, in one quiet line. */
function Settled({ state, kept }: { state: "kept" | "undone"; kept: string }) {
  return (
    <p className="ui-engine-change-state" data-state={state}>
      <Icon name={state === "kept" ? "check" : "undo-2"} />
      {state === "kept" ? kept : "Undone."}
    </p>
  );
}

/** A picture's change: part by part while it waits (Undo, Keep and render); once decided, what it changed. */
function PictureChange({
  doc,
  edit,
  mode,
  desk,
}: {
  doc: CreativeDocument;
  edit: EngineEdit;
  mode?: StudioMode;
  desk?: EngineDesk;
}) {
  const decide = useDecideEdit();
  const keep = useQuietFocus();
  // The suggestions she took with Yes, by variable: undone with the card.
  const [taken, setTaken] = useState<Record<string, VarValue>>({});
  const proposed = edit.state === "proposed";
  const parts = edit.parts?.length ? edit.parts : [{ text: edit.text, keys: edit.changes.map((c) => c.key) }];
  const canKeep = edit.changes.length > 0 || Object.keys(taken).length > 0;
  const many = parts.length > 1 || parts.some((p) => !p.keys.length);
  const byKey = (key: string) => edit.changes.find((c) => c.key === key);
  const busy = desk?.busy ?? doc.versions.some((v) => v.state === "rendering");

  // The card takes the keyboard when it comes: Enter keeps and renders, Esc undoes.
  useEffect(() => {
    if (proposed && canKeep) keep.focus();
  }, [proposed, canKeep, keep]);

  const undo = () => {
    for (const [key, from] of Object.entries(taken)) desk?.onVariable(key, from);
    decide.mutate({ documentId: doc.id, editId: edit.id, verdict: "undo" });
  };
  const keepIt = () => {
    if (doc.protectedPhoto) return;
    desk?.onBefore();
    decide.mutate({ documentId: doc.id, editId: edit.id, verdict: "keep" });
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    undo();
  };

  const words = !many ? (
    <MessageText>
      {edit.changes.length ? (
        <>
          {proposed ? "On the board now: " : "I changed "}
          <span className="ui-desk-engine-what">{edit.changes.map((c) => changeWords(c, mode)).join(" · ")}</span>
        </>
      ) : (
        "I found nothing to change for that."
      )}
    </MessageText>
  ) : (
    <ul className="ui-desk-engine-parts" aria-label="What the Engine read">
      {parts.map((p, i) => {
        const s = p.suggestion;
        const took = s && s.key in taken;
        return (
          <li key={i} className="ui-desk-engine-part" data-read={p.keys.length || took ? "" : undefined}>
            <Icon name={p.keys.length || took ? "circle-check" : "minus"} className="ui-desk-engine-part-icon" />
            <span className="ui-desk-engine-part-text">
              <span className="ui-desk-engine-said">“{p.text}”</span>
              {p.keys.length > 0 && (
                <span className="ui-desk-engine-what">
                  {p.keys
                    .map((k) => byKey(k))
                    .filter(Boolean)
                    .map((c) => changeWords(c!, mode))
                    .join(" · ")}
                </span>
              )}
              {!p.keys.length && p.note && <span className="ui-desk-engine-note">{p.note}.</span>}
              {!p.keys.length && s && (
                <span className="ui-desk-engine-what">{took ? changeWords(s, mode) : `${changeWords(s, mode)}?`}</span>
              )}
            </span>
            {proposed && !p.keys.length && s && !took && desk && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setTaken((t) => ({ ...t, [s.key]: s.from }));
                  desk.onVariable(s.key, s.to);
                }}
              >
                Yes
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );

  if (!proposed)
    return (
      <>
        {words}
        <Settled state={edit.state as "kept" | "undone"} kept="Kept, and rendered as a new version." />
      </>
    );
  return (
    <div className="ui-desk-engine-change ui-engine-change" aria-live="polite" onKeyDown={onKey}>
      <div className="ui-desk-engine-words">{words}</div>
      <div className="ui-desk-engine-actions">
        <WithTooltip label="Undo the change" shortcut="Esc">
          <Button size="sm" variant="quiet" icon="undo-2" disabled={decide.isPending} onClick={undo}>
            Undo
          </Button>
        </WithTooltip>
        {canKeep && (
          <WithTooltip label="Keep it and render a new version" shortcut="↵">
            <Button
              ref={keep.ref}
              onFocus={keep.onFocus}
              size="sm"
              variant="secondary"
              icon="refresh-cw"
              loading={decide.isPending}
              disabled={busy || doc.protectedPhoto}
              onClick={keepIt}
            >
              Keep and render
            </Button>
          </WithTooltip>
        )}
      </div>
    </div>
  );
}

/** A video's change: the lines it would change on the timeline, Undo or Keep; once decided, where it stands. */
function VideoChange({ doc, edit, desk }: { doc: CreativeDocument; edit: VideoEngineEdit; desk?: EngineDesk }) {
  const decide = useDecideEdit();
  const toast = useToast();
  const keep = useQuietFocus();
  const proposed = edit.state === "proposed";
  const canKeep = edit.changes.length > 0;
  useEffect(() => {
    if (proposed && canKeep) keep.focus();
  }, [proposed, canKeep, keep]);
  const verdict = (v: "keep" | "undo") => {
    desk?.onBefore();
    decide.mutate(
      { documentId: doc.id, editId: edit.id, verdict: v },
      { onError: (err) => toast.error("That didn’t go through", { description: err.message }) },
    );
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    verdict("undo");
  };
  const lines = edit.changes.length ? (
    <>
      <MessageText>{proposed ? "On the timeline now:" : "I changed:"}</MessageText>
      <ul className="ui-engine-change-lines">
        {edit.changes.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
    </>
  ) : (
    <MessageText>
      I found nothing to change for that. Try a length, the beat, a shot to slow or hold, or captions.
    </MessageText>
  );
  if (!proposed)
    return (
      <>
        {lines}
        {edit.changes.length > 0 && <Settled state={edit.state as "kept" | "undone"} kept="Kept in the edit." />}
      </>
    );
  return (
    <div className="ui-desk-engine-change ui-engine-change" aria-live="polite" onKeyDown={onKey}>
      <div className="ui-desk-engine-words">{lines}</div>
      <div className="ui-desk-engine-actions">
        <WithTooltip label="Undo the change" shortcut="Esc">
          <Button size="sm" variant="quiet" icon="undo-2" disabled={decide.isPending} onClick={() => verdict("undo")}>
            {canKeep ? "Undo" : "Close"}
          </Button>
        </WithTooltip>
        {canKeep && (
          <WithTooltip label="Keep the change in the edit" shortcut="↵">
            <Button
              ref={keep.ref}
              onFocus={keep.onFocus}
              size="sm"
              variant="secondary"
              icon="check"
              loading={decide.isPending}
              onClick={() => verdict("keep")}
            >
              Keep
            </Button>
          </WithTooltip>
        )}
      </div>
    </div>
  );
}

/** Focus a button for the keyboard (Enter keeps) without opening its tooltip over the words she is reading. Radix
 *  opens a tooltip on any focus; a focus handler that prevents the default stops it. A Tab to the button still shows
 *  the tooltip. */
function useQuietFocus() {
  const ref = useRef<HTMLButtonElement>(null);
  const quiet = useRef(false);
  // One object for the card's life, so an effect that focuses it runs only when the card changes
  const [api] = useState(() => ({
    ref,
    focus: () => {
      quiet.current = true;
      ref.current?.focus({ preventScroll: true });
      quiet.current = false;
    },
    onFocus: (e: FocusEvent<HTMLButtonElement>) => {
      if (quiet.current) e.preventDefault();
    },
  }));
  return api;
}
