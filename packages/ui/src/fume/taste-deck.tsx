// Taste deck (design-system/components/taste-deck.css): one card at a time, saved on the tap (app round 8, UX review
// ONB-11, MOB-11, LOAD-12). PROPOSED 19 Oct 2026. The same deck in the onboarding (step 4) and on Brand › Taste.
// A single picture is swiped: right "This is us", left "Not us", with the two pills under it too. The card follows the
// finger a little turned, a stamp in words fades in, and past 30 % of its width it leaves and the answer is saved;
// let go earlier and it glides back (no spring). A pair is answered by tapping the picture you prefer, or by swiping
// toward it (Marcus 19 Oct: left picks the left one, right the right one; the pair follows the finger a little and the
// side it leans to shows its ring): an Ink ring and a check, saved at once, and the next card comes in after 300 ms. "Why" is asked after the pick, as quiet chips
// about the card just answered; ignoring them costs nothing. "Back one" returns to the last card.
// Keys: 1/2 pick in a pair; Y/N answer a single picture; Backspace goes back one. Arrows answer nothing (round 9,
// desktop review DWAY-2: an arrow moves, it never decides).
// Round 9 (desktop review DLAY-12, DTSK-22, PROPOSED 19 Oct 2026): on a desk (≥ 1024 px) the picture is sized from
// the screen (min(55vh, 560 px), and never taller than the room the page leaves it) and the question, the answers,
// "Why?" and Back one stand beside it, on the picture's left edge's axis; a phone keeps one column. Once the last card
// is answered the deck is gone: only `end` shows, never under the last card's "Why?".
//   <TasteDeck label="Your taste" cards={…} index={i} onIndexChange={setI} onAnswer={save} reasons={…} onReason={…} end={<Card/>} />
//   <TasteDeckStage open title="Teach Fume your taste" onOpenChange={…}> <TasteDeck …/> </TasteDeckStage>
// Round 13 (Marcus's video comments #5, #47; PROPOSED 22 Oct 2026): a card may name its part ("Part 1 of 2") with one
// line on what the part teaches; the head then counts the cards of that part only. A pair may be answered "Neither"
// (neitherLabel, key N) when neither picture feels like the brand.
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "../icons";
import { Btn, Kbd, prefersReducedMotion } from "./_parts";

export type TasteDeckAnswer = "a" | "b" | "yes" | "no" | "neither";

export interface TasteDeckCard {
  id: string;
  /** pair: which of two is more you (tap one); single: this is us or not (swipe or the pills). */
  kind: "pair" | "single";
  question: string;
  /** A small line over the question ("Light"). */
  eyebrow?: string;
  a: string;
  b?: string;
  altA?: string;
  altB?: string;
  /** The answer already given (shown when she comes back to the card). */
  answer?: TasteDeckAnswer;
  /** The part of the deck the card belongs to ("Part 1 of 2") and one line on what it teaches; the head counts the
   *  cards of the part. */
  part?: { label: string; line?: string };
}

export interface TasteDeckProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** The group's name for assistive tech ("Your taste"). */
  label: string;
  cards: TasteDeckCard[];
  /** The card shown, from 0; cards.length shows `end`. */
  index: number;
  onIndexChange: (index: number) => void;
  /** Saves an answer: called at once, on the tap or the let-go. */
  onAnswer: (card: TasteDeckCard, answer: TasteDeckAnswer) => void;
  /** A single picture's two answers, also the stamps. */
  yesLabel?: string;
  noLabel?: string;
  /** Chips that say why, for the card just answered. */
  reasons?: (card: TasteDeckCard, answer: TasteDeckAnswer) => string[];
  /** All the chips chosen (and anything written), joined: "Warmer, calmer". */
  onReason?: (card: TasteDeckCard, answer: TasteDeckAnswer, reason: string) => void;
  /** After the last card. */
  end?: ReactNode;
  disabled?: boolean;
  /** A pair's third answer, when neither picture is the brand ("Neither feels like LYSNE"); key N. */
  neitherLabel?: string;
}

type Leaving = "left" | "right" | "a" | "b" | "neither" | null;

const NEXT_AFTER = 300;

export function TasteDeck({
  label,
  cards,
  index,
  onIndexChange,
  onAnswer,
  yesLabel = "This is us",
  noLabel = "Not us",
  reasons,
  onReason,
  end,
  disabled,
  neitherLabel,
  className,
  ...props
}: TasteDeckProps) {
  const card = cards[index];
  const done = index >= cards.length;
  const [leaving, setLeaving] = useState<Leaving>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [last, setLast] = useState<{ card: TasteDeckCard; answer: TasteDeckAnswer } | null>(null);
  const [chips, setChips] = useState<string[]>([]);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const start = useRef<{ x: number; y: number; id: number; w: number; captured: boolean } | null>(null);
  // A pair that was swiped must not also count as a tap on the picture under the finger.
  const swiped = useRef(false);
  const timer = useRef(0);
  const stage = useRef<HTMLDivElement>(null);
  const [said, setSaid] = useState("");

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function answer(value: TasteDeckAnswer) {
    if (!card || leaving || disabled) return;
    onAnswer(card, value);
    setSaid(card.kind === "pair" ? (value === "neither" ? (neitherLabel ?? "Neither") : `${value === "a" ? "The first" : "The second"} picture chosen`) : value === "yes" ? yesLabel : noLabel);
    setLeaving(card.kind === "pair" ? (value as "a" | "b" | "neither") : value === "yes" ? "right" : "left");
    const next = () => {
      setLeaving(null);
      setDrag(null);
      setLast({ card, answer: value });
      setChips([]);
      setWriting(false);
      setText("");
      onIndexChange(index + 1);
    };
    timer.current = window.setTimeout(next, prefersReducedMotion() ? 0 : NEXT_AFTER);
  }

  function back() {
    if (index === 0 || leaving) return;
    window.clearTimeout(timer.current);
    setLast(null);
    setChips([]);
    setWriting(false);
    onIndexChange(index - 1);
  }

  function sendReason(nextChips: string[], written: string) {
    if (!last || !onReason) return;
    const words = [...nextChips, written.trim()].filter(Boolean);
    const joined = words.map((w, i) => (i === 0 ? w : w.charAt(0).toLowerCase() + w.slice(1))).join(", ");
    onReason(last.card, last.answer, joined);
  }

  function toggleChip(chip: string) {
    const next = chips.includes(chip) ? chips.filter((c) => c !== chip) : [...chips, chip];
    setChips(next);
    sendReason(next, text);
  }

  // Keys: only where there is a keyboard, never while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) || t?.isContentEditable) return;
      if (!stage.current?.isConnected) return;
      const k = e.key.toLowerCase();
      if (k === "backspace" && index > 0) back();
      else if (!card || disabled) return;
      else if (card.kind === "pair" && k === "1") answer("a");
      else if (card.kind === "pair" && k === "2") answer("b");
      else if (card.kind === "pair" && k === "n" && neitherLabel) answer("neither");
      else if (card.kind === "single" && k === "y") answer("yes");
      else if (card.kind === "single" && k === "n") answer("no");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // A single picture follows the finger, a little turned; a pair follows it a little and leans to a side. Neither
  // starts at the screen's edge (iOS back-swipe). The pointer is captured only once the finger has moved, so a tap
  // on a picture in a pair stays a tap.
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!card || leaving || disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    const edge = 24;
    if (e.clientX < edge || e.clientX > window.innerWidth - edge) return;
    swiped.current = false;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, w: e.currentTarget.getBoundingClientRect().width, captured: false };
    if (card.kind === "single") {
      e.currentTarget.setPointerCapture(e.pointerId);
      start.current.captured = true;
    }
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const d = { x: e.clientX - s.x, y: e.clientY - s.y };
    if (!s.captured) {
      if (Math.abs(d.x) < 8 || Math.abs(d.x) < Math.abs(d.y)) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      s.captured = true;
    }
    setDrag(d);
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    start.current = null;
    const d = drag;
    const across = d && Math.abs(d.x) > Math.abs(d.y);
    if (card?.kind === "pair") {
      if (s.captured) swiped.current = true;
      setDrag(null);
      // Toward a side: left picks the left picture, right the right one. A fifth of the pair's width is enough.
      if (d && across && Math.abs(d.x) > s.w * 0.2) answer(d.x < 0 ? "a" : "b");
      return;
    }
    if (d && across && Math.abs(d.x) > s.w * 0.3) answer(d.x > 0 ? "yes" : "no");
    else setDrag(null);
  };
  const cancel = () => {
    start.current = null;
    setDrag(null);
  };
  const width = start.current?.w ?? 1;
  const hint = drag && Math.abs(drag.x) > Math.abs(drag.y) && Math.abs(drag.x) > width * 0.12 ? (drag.x > 0 ? "yes" : "no") : null;
  const stamp = leaving === "right" ? "yes" : leaving === "left" ? "no" : hint;
  // The side a dragged pair leans to.
  const lean = card?.kind === "pair" && drag && Math.abs(drag.x) > Math.abs(drag.y) && Math.abs(drag.x) > width * 0.08 ? (drag.x < 0 ? "a" : "b") : null;

  const chipList = last && reasons ? reasons(last.card, last.answer) : [];
  // A card that names its part: the head counts the cards of that part only ("Part 1 of 2", "2 of 3").
  const inPart = card?.part ? cards.filter((c) => c.part?.label === card.part!.label) : cards;
  const offset = card?.part ? cards.indexOf(inPart[0]!) : 0;
  const n = inPart.length;
  const shown = Math.min(index - offset + 1, n);

  // Under the card; once the deck is done, nothing of it stays (DTSK-22).
  const foot = !done && (
    <div className="ui-td-foot">
      {last && chipList.length > 0 && onReason ? (
        <div className="ui-td-why" role="group" aria-label="Why, about the picture you just answered (optional)">
          <span className="ui-td-why-label">
            <img className="ui-td-why-thumb" src={last.answer === "b" ? last.card.b : last.card.a} alt="" />
            Why?
          </span>
          {chipList.map((c) => (
            <button key={c} type="button" className="ui-toggle ui-toggle--outline ui-toggle--sm" aria-pressed={chips.includes(c)} onClick={() => toggleChip(c)}>
              {c}
            </button>
          ))}
          {writing ? (
            <input
              className="ui-input ui-input--sm ui-td-write"
              aria-label="Why, in your words"
              value={text}
              autoFocus
              placeholder="In your words"
              onChange={(e) => setText(e.target.value)}
              onBlur={() => sendReason(chips, text)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
              }}
            />
          ) : (
            <button type="button" className="ui-toggle ui-toggle--sm" onClick={() => setWriting(true)}>
              Write…
            </button>
          )}
        </div>
      ) : (
        <p className="ui-td-hint">
          <span className="ui-td-hint-touch">{card?.kind === "single" ? `Swipe right for “${yesLabel}”, left for “${noLabel}”.` : "Tap or swipe toward the picture that is more you."}</span>
          <span className="ui-td-hint-keys">
            {card?.kind === "single" ? (
              <>
                <Kbd>Y</Kbd> {yesLabel} <Kbd>N</Kbd> {noLabel}
              </>
            ) : (
              <>
                <Kbd>1</Kbd> or <Kbd>2</Kbd> to pick
                {neitherLabel && (
                  <>
                    {" "}
                    <Kbd>N</Kbd> neither
                  </>
                )}
              </>
            )}
          </span>
        </p>
      )}
      {index > 0 && (
        <Btn variant="quiet" size="sm" icon="undo-2" className="ui-td-back" onClick={back} disabled={Boolean(leaving)}>
          Back one
        </Btn>
      )}
    </div>
  );

  return (
    <div ref={stage} className={cx("ui-td", className)} role="group" aria-label={label} data-done={done ? "" : undefined} {...props}>
      {!done && (
        <div className="ui-td-head" data-part={card?.part ? "" : undefined}>
          {card?.part?.label && <span className="ui-td-part">{card.part.label}</span>}
          <ol className="ui-td-dots" aria-hidden="true">
            {inPart.map((c, j) => {
              const i = offset + j;
              return <li key={c.id} className="ui-td-dot" data-state={i < index ? "done" : i === index ? "current" : "todo"} />;
            })}
          </ol>
          <span className="ui-td-count">{`${shown} of ${n}`}</span>
        </div>
      )}

      {done ? (
        <div className="ui-td-end">{end}</div>
      ) : (
        <div className="ui-td-card" key={card.id} data-kind={card.kind}>
          {card.eyebrow && <p className="ui-td-eyebrow">{card.eyebrow}</p>}
          <h2 className="ui-td-question" id={`td-q-${card.id}`}>
            {card.question}
          </h2>
          {card.part?.line && <p className="ui-td-line">{card.part.line}</p>}
          {card.kind === "pair" ? (
            <div
              className="ui-td-pair"
              role="group"
              aria-labelledby={`td-q-${card.id}`}
              data-leaving={leaving ? "" : undefined}
              data-dragging={drag && start.current?.captured ? "" : undefined}
              style={{ "--dx": drag?.x ?? 0 } as CSSProperties}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={cancel}
              onClickCapture={(e) => {
                if (!swiped.current) return;
                swiped.current = false;
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {(["a", "b"] as const).map((side, i) => {
                const chosen = leaving === side || (!leaving && (lean ? lean === side : card.answer === side));
                return (
                  <button
                    key={side}
                    type="button"
                    className="ui-td-pick"
                    data-chosen={chosen ? "" : undefined}
                    aria-pressed={card.answer === side || leaving === side}
                    disabled={disabled || Boolean(leaving)}
                    onClick={() => answer(side)}
                    aria-label={`${i === 0 ? "The first" : "The second"} picture${(side === "a" ? card.altA : card.altB) ? `: ${side === "a" ? card.altA : card.altB}` : ""}`}
                  >
                    <span className="ui-td-media">
                      <img src={side === "a" ? card.a : card.b} alt="" draggable={false} />
                      <span className="ui-td-check" aria-hidden="true">
                        <Icon name="check" />
                      </span>
                    </span>
                    <span className="ui-td-pick-label">
                      <Kbd className="ui-td-key">{i + 1}</Kbd>
                      {i === 0 ? "This one" : "Or this one"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {card.kind === "pair" && neitherLabel ? (
            <div className="ui-td-answers" data-kind="pair" role="group" aria-labelledby={`td-q-${card.id}`}>
              <Btn variant="secondary" onClick={() => answer("neither")} disabled={disabled || Boolean(leaving)} aria-pressed={card.answer === "neither" || leaving === "neither"}>
                {neitherLabel}
                <Kbd className="ui-td-key">N</Kbd>
              </Btn>
            </div>
          ) : card.kind === "pair" ? null : (
            <>
              <div
                className="ui-td-single"
                data-dragging={drag && start.current ? "" : undefined}
                data-leaving={leaving ?? undefined}
                data-hint={stamp ?? undefined}
                style={{ "--dx": drag?.x ?? 0 } as CSSProperties}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={cancel}
              >
                <img src={card.a} alt={card.altA ?? ""} draggable={false} />
                <span className="ui-td-stamp" aria-hidden="true">
                  {stamp === "yes" ? yesLabel : stamp === "no" ? noLabel : ""}
                </span>
              </div>
              <div className="ui-td-answers" role="group" aria-labelledby={`td-q-${card.id}`}>
                <Btn variant="secondary" icon="x" onClick={() => answer("no")} disabled={disabled || Boolean(leaving)} aria-pressed={card.answer === "no"}>
                  {noLabel}
                  <Kbd className="ui-td-key">N</Kbd>
                </Btn>
                <Btn variant="primary" icon="thumbs-up" onClick={() => answer("yes")} disabled={disabled || Boolean(leaving)} aria-pressed={card.answer === "yes"}>
                  {yesLabel}
                  <Kbd className="ui-td-key">Y</Kbd>
                </Btn>
              </div>
            </>
          )}
        </div>
      )}

      {foot}
      <span className="ui-td-live" aria-live="polite">
        {said}
      </span>
    </div>
  );
}

export interface TasteDeckStageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Teach Fume your taste". */
  title: string;
  /** One line under the title for assistive tech. */
  description?: string;
  /** The close button's words. */
  closeLabel?: string;
  children: ReactNode;
}

/** The deck on its own full screen, on the light ground (Brand › Taste): a close pill, the title, the deck. */
export function TasteDeckStage({ open, onOpenChange, title, description, closeLabel = "Done", children }: TasteDeckStageProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content className="ui-td-stage" {...(description ? {} : { "aria-describedby": undefined })}>
          <header className="ui-td-stage-bar">
            <DialogPrimitive.Title className="ui-td-stage-title">{title}</DialogPrimitive.Title>
            {description && <DialogPrimitive.Description className="ui-td-live">{description}</DialogPrimitive.Description>}
            <DialogPrimitive.Close asChild>
              <Btn variant="secondary" size="sm" icon="x">
                {closeLabel}
              </Btn>
            </DialogPrimitive.Close>
          </header>
          <div className="ui-td-stage-body">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
