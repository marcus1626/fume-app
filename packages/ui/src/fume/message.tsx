// Message, bubble and message scroller (design-system/components/message.css, behaviour from message.js). Three voices:
// - People (you, Anna) speak in a Bubble, with their avatar in the header. Yours sit at the end (align="end").
// - The Engine has no bubble and no face: MessageText on a 64ch column under its mark (fi-fume-engine) and the
//   word "Engine". It never says "I". What it makes (the run card, creatives) is the surface.
// - Fume (the conversation partner, who speaks as "we") is not a person either, so it never has a face or a
//   bubble: it writes MessageText like the Engine, under the word "Fume". The design system has no sign for
//   Fume yet, so its header has none unless a screen passes `sign` (see API.md).
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import {
  Avatar,
  Btn,
  EngineMark,
  Glyph,
  prefersReducedMotion,
  tokenPx,
  useAnnouncer,
  useIsoLayoutEffect,
  vars,
  type PersonSign,
} from "./_parts";

// ---------- list and group ----------

/** A conversation without a scroller: div.ui-message-list (senders 24 apart). */
export const MessageList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function MessageList(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cx("ui-message-list", className)} {...props} />;
});

/** One sender's run of messages: div.ui-message-group (4 apart; consecutive bubbles step their inner corners). */
export const MessageGroup = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function MessageGroup(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cx("ui-message-group", className)} {...props} />;
});

// ---------- message ----------

/** Who wrote a message: contract MessageAuthor["kind"]. */
export type MessageAuthorKind = "person" | "engine" | "fume";
/** The Engine's message states (data-state). */
export type MessageState = "streaming" | "thinking" | "error";

export interface MessageProps extends HTMLAttributes<HTMLElement> {
  /** start: everyone else, the Engine and Fume; end: your own messages. */
  align?: "start" | "end";
  /** streaming and thinking also set aria-busy. */
  state?: MessageState;
}

/** article.ui-message[data-align][data-state]. */
export const Message = forwardRef<HTMLElement, MessageProps>(function Message(
  { align = "start", state, className, ...props },
  ref,
) {
  return (
    <article
      ref={ref}
      className={cx("ui-message", className)}
      data-align={align}
      data-state={state}
      aria-busy={state === "streaming" || state === "thinking" ? true : undefined}
      {...props}
    />
  );
});

export interface MessageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** person: avatar and name; engine: the Engine mark and "Engine"; fume: the name "Fume", no face. */
  author: MessageAuthorKind;
  /** The person (for author="person"). */
  person?: PersonSign;
  /** Overrides the name: defaults to person.name, "Engine" or "Fume". */
  name?: string;
  /** A named person's role beside the name ("Designer"). */
  role?: string;
  /** The time as shown ("14:02"), in the data face. */
  time?: string;
  /** Machine time for <time dateTime> (an ISO instant). */
  dateTime?: string;
  /** Replaces the sign (avatar or mark), e.g. a Fume brand mark once the design system has one. */
  sign?: ReactNode;
}

/** div.ui-message-header: the sign (24 box), the name, the role, the time. */
export const MessageHeader = forwardRef<HTMLDivElement, MessageHeaderProps>(function MessageHeader(
  { author, person, name, role, time, dateTime, sign, className, ...props },
  ref,
) {
  const shown = name ?? (author === "engine" ? "Engine" : author === "fume" ? "Fume" : (person?.name ?? ""));
  let mark: ReactNode = sign;
  if (mark === undefined) {
    if (author === "engine") mark = <EngineMark />;
    else if (author === "person" && person) mark = <Avatar person={person} size="sm" className="ui-message-avatar" />;
  }
  return (
    <div ref={ref} className={cx("ui-message-header", className)} {...props}>
      {mark}
      <span className="ui-message-name">{shown}</span>
      {role && <span className="ui-message-role">{role}</span>}
      {time && (
        <time className="ui-message-time" dateTime={dateTime}>
          {time}
        </time>
      )}
    </div>
  );
});

/** div.ui-message-content: what was said, then what came with it (attachments, a run card), 8 apart. */
export const MessageContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function MessageContent(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cx("ui-message-content", className)} {...props} />;
});

export interface MessageTextProps extends HTMLAttributes<HTMLDivElement> {
  /** Shows the quiet Ink caret after the text (set Message state="streaming" too). */
  streaming?: boolean;
}

/**
 * div.ui-message-text: the Engine's (and Fume's) words, plain on the page, 64ch. Children are paragraphs;
 * a string is wrapped in <p>. With `streaming` the caret follows the last paragraph.
 */
export const MessageText = forwardRef<HTMLDivElement, MessageTextProps>(function MessageText(
  { streaming, className, children, ...props },
  ref,
) {
  const caret = streaming ? <MessageCaret /> : null;
  const body =
    typeof children === "string" ? (
      <p>
        {children}
        {caret}
      </p>
    ) : (
      <>
        {children}
        {caret}
      </>
    );
  return (
    <div ref={ref} className={cx("ui-message-text", className)} {...props}>
      {body}
    </div>
  );
});

/** span.ui-message-caret: the quiet caret after words still arriving. */
export function MessageCaret() {
  return <span className="ui-message-caret" aria-hidden="true" />;
}

/** p.ui-message-status: the step in words while the Engine thinks ("Reading the brief"). */
export const MessageStatus = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function MessageStatus({ className, ...props }, ref) {
    return <p ref={ref} className={cx("ui-message-status", className)} {...props} />;
  },
);

export interface MessageErrorProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Rouge, after the circle-alert: "The Engine couldn’t finish." */
  title: ReactNode;
  /** The reason and what is kept, in secondary text. */
  text?: ReactNode;
  /** Shows Try again (refresh-cw). */
  onRetry?: () => void;
  retryLabel?: string;
  /** Other actions beside Try again. */
  actions?: ReactNode;
}

/** div.ui-message-error[role=alert]: the Engine could not finish (set Message state="error"). */
export const MessageError = forwardRef<HTMLDivElement, MessageErrorProps>(function MessageError(
  { title, text, onRetry, retryLabel = "Try again", actions, className, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cx("ui-message-error", className)} role="alert" {...props}>
      <Glyph name="circle-alert" />
      <p className="ui-message-error-title">{title}</p>
      {text && <p className="ui-message-error-text">{text}</p>}
      {(onRetry || actions) && (
        <div className="ui-message-error-action">
          {onRetry && (
            <Btn variant="secondary" size="sm" icon="refresh-cw" onClick={onRetry}>
              {retryLabel}
            </Btn>
          )}
          {actions}
        </div>
      )}
    </div>
  );
});

export interface MessageReplyProps extends HTMLAttributes<HTMLDivElement> {
  /** Who it answers ("Anna"). */
  to: string;
  /** What it answers, cut with an ellipsis. */
  quote: string;
}

/** div.ui-message-reply: "To Anna: …" above the bubble, no quote bar. */
export const MessageReply = forwardRef<HTMLDivElement, MessageReplyProps>(function MessageReply(
  { to, quote, className, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cx("ui-message-reply", className)} {...props}>
      <Glyph name="reply" />
      <span className="ui-message-reply-text">
        To <b>{to}</b>: {quote}
      </span>
    </div>
  );
});

/** span.ui-message-mention: "@Anna" inside a bubble. */
export function MessageMention({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("ui-message-mention", className)}>{children}</span>;
}

/** div.ui-message-footer: meta under a message and the actions. */
export const MessageFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function MessageFooter(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cx("ui-message-footer", className)} {...props} />;
});

/** span.ui-message-meta: the brief's settings, Edited, Seen ("LYSNE · Feed, Story · 12 creatives"). */
export function MessageMeta({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("ui-message-meta", className)}>{children}</span>;
}

// ---------- actions ----------

export interface MessageActionsProps extends HTMLAttributes<HTMLDivElement> {
  /** "Actions for the Engine’s message". */
  label: string;
}

/** div.ui-message-actions[role=group]: quiet circles under a message, on hover and focus with a mouse. */
export const MessageActions = forwardRef<HTMLDivElement, MessageActionsProps>(function MessageActions(
  { label, className, ...props },
  ref,
) {
  return <div ref={ref} className={cx("ui-message-actions", className)} role="group" aria-label={label} {...props} />;
});

export interface MessageActionProps extends Omit<HTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  /** aria-label: "Generate again", "Reply to Anna", "More". */
  label: string;
  disabled?: boolean;
}

/** A quiet icon circle: button.ui-btn.ui-btn--quiet.ui-btn--icon.ui-btn--sm. */
export const MessageAction = forwardRef<HTMLButtonElement, MessageActionProps>(function MessageAction(
  { icon, label, ...props },
  ref,
) {
  return <Btn ref={ref} variant="quiet" size="sm" iconOnly icon={icon} aria-label={label} {...props} />;
});

export interface MessageCopyActionProps {
  /** The words to copy. */
  text: string;
  label?: string;
  copiedLabel?: string;
  onCopied?: () => void;
}

/** Copy: copies the message's words; the icon is a check for a moment (1.6 s), as message.js. */
export function MessageCopyAction({ text, label = "Copy", copiedLabel = "Copied", onCopied }: MessageCopyActionProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const done = () => {
    setCopied(true);
    onCopied?.();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <Btn
      variant="quiet"
      size="sm"
      iconOnly
      icon={copied ? "check" : "copy"}
      aria-label={copied ? copiedLabel : label}
      data-state={copied ? "copied" : undefined}
      onClick={() => {
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, done);
        else done();
      }}
    />
  );
}

export interface MessageLikeActionProps {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  label?: string;
}

/** The thumbs-up: a toggle (ui-toggle ui-toggle--sm ui-toggle--icon, aria-pressed). Feedback, not a decision. */
export function MessageLikeAction({ pressed, onPressedChange, label = "Good result" }: MessageLikeActionProps) {
  return (
    <button
      className="ui-toggle ui-toggle--sm ui-toggle--icon"
      type="button"
      aria-pressed={pressed}
      data-state={pressed ? "on" : "off"}
      aria-label={label}
      onClick={() => onPressedChange(!pressed)}
    >
      <Icon name="thumbs-up" />
    </button>
  );
}

// ---------- bubble ----------

/** One bubble a sender's message sits in. */
export interface BubbleProps extends HTMLAttributes<HTMLDivElement> {
  /** default: one step toward Ink; muted: the lighter step; ghost: no surface. */
  variant?: "default" | "muted" | "ghost";
  /** Only needed outside a Message (inside one, the message's align wins). */
  align?: "start" | "end";
  /** A small pill on the bubble's lower edge (span.ui-bubble-reactions), e.g. a thumbs-up and a count. */
  reactions?: ReactNode;
}

/**
 * div.ui-bubble > div.ui-bubble-content: a person's words. A string child is wrapped in <p>.
 * People only: the Engine and Fume never speak in a bubble.
 */
export const Bubble = forwardRef<HTMLDivElement, BubbleProps>(function Bubble(
  { variant = "default", align, reactions, className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx("ui-bubble", className)}
      data-variant={variant === "default" ? undefined : variant}
      data-align={align}
      {...props}
    >
      <div className="ui-bubble-content">{typeof children === "string" ? <p>{children}</p> : children}</div>
      {reactions && <span className="ui-bubble-reactions">{reactions}</span>}
    </div>
  );
});

/** div.ui-bubble-group: consecutive bubbles from one sender, 4 apart, inner corners stepped down. */
export const BubbleGroup = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function BubbleGroup(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cx("ui-bubble-group", className)} {...props} />;
});

// ---------- message scroller ----------

export interface MessageScrollerHandle {
  /** Goes to the end (smooth unless reduced motion), clears the count; use it after sending your own message. */
  scrollToEnd: (smooth?: boolean) => void;
  /** Reads text out once through the polite live region ("Anna: The new one keeps the whole cap."). */
  announce: (text: string) => void;
  /**
   * Shows an item from its top, so Fume's answer comes into view from its question, not from its last button. The
   * item's top goes to the viewport's top, less its scroll-margin and `offset`; when it fits with everything after it,
   * this is the end. The scroller then stops following the end, and the "Jump to latest" pill stays away until she
   * scrolls herself: what is below is the item she is reading.
   */
  reveal: (item: HTMLElement, options?: RevealOptions) => void;
  /** The viewport element. */
  viewport: HTMLDivElement | null;
}

/** How `reveal` places an item. */
export interface RevealOptions {
  smooth?: boolean;
  /** More room above the item's top (px). */
  offset?: number;
  /**
   * "end": an item that carries actions and is taller than the viewport shows its foot instead, `gap` (default 16)
   * above the viewport's bottom, so its buttons are never under the composer. An item that fits still comes in from its
   * top. A sticky header inside the item keeps its question in view.
   */
  block?: "start" | "end";
  gap?: number;
}

export interface MessageScrollerProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** aria-label of the viewport region: "Conversation about Autumn launch". */
  label: string;
  /** Size the viewport once so the message cut at the top shows about half (data-fit="half"). */
  fitHalf?: boolean;
  /** The pill's words while nothing new came in. */
  jumpLabel?: string;
  /** Words for n new messages on the pill. */
  newLabel?: (n: number) => string;
  /**
   * Text to read out for the newest message. When it changes, it is announced once; set it to the new
   * message's words ("Anna: …"), never word by word while streaming.
   */
  announcement?: string;
  /** Messages and markers. */
  children?: ReactNode;
}

/**
 * div.ui-message-scroller: starts at the end and stays there while you are there (growth keeps the end in
 * view: new messages, words arriving, a run card filling). Scrolled up, it leaves you where you are and the
 * "Jump to latest" pill (Smoke glass) floats in and counts what arrived meanwhile; pressing it goes to the
 * end and focuses the conversation. New messages are read through a polite live region (`announcement`).
 */
export const MessageScroller = forwardRef<MessageScrollerHandle, MessageScrollerProps>(function MessageScroller(
  {
    label,
    fitHalf,
    jumpLabel = "Jump to latest",
    newLabel = (n) => (n === 1 ? "1 new message" : `${n} new messages`),
    announcement,
    className,
    children,
    ...props
  },
  ref,
) {
  const root = useRef<HTMLDivElement>(null);
  const vp = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const following = useRef(false);
  // An item was revealed from its top: the pill waits until she scrolls herself. While the scroll is on its way to
  // the item (smooth), the scroller's own scroll events are not hers.
  const quiet = useRef(false);
  const aim = useRef<number | null>(null);
  const aimTimer = useRef<number>();
  const hers = () => {
    quiet.current = false;
    aim.current = null;
  };
  const followTimer = useRef<number>();
  const [atEnd, setAtEnd] = useState(true);
  const [unread, setUnread] = useState(0);
  const [height, setHeight] = useState<number | null>(null);
  const [live, say] = useAnnouncer();

  const hit = () => tokenPx("--ui-size-hit", 44);
  const isAtEnd = (v: HTMLDivElement) => v.scrollHeight - v.scrollTop - v.clientHeight <= hit();
  const toEnd = (smooth?: boolean) => {
    const v = vp.current;
    if (v) v.scrollTo({ top: v.scrollHeight, behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto" });
  };

  const sync = useCallback(() => {
    const v = vp.current;
    if (!v) return;
    const end = isAtEnd(v);
    if (following.current) {
      if (end) following.current = false;
      else return;
    }
    if (aim.current !== null) {
      if (Math.abs(v.scrollTop - aim.current) > 2) return;
      aim.current = null;
    }
    if (quiet.current) {
      if (!end) return;
      quiet.current = false;
    }
    stick.current = end;
    setAtEnd(end);
    if (end) setUnread(0);
  }, []);

  const goEnd = useCallback(
    (smooth?: boolean) => {
      stick.current = true;
      if (smooth && !prefersReducedMotion()) {
        following.current = true;
        window.clearTimeout(followTimer.current);
        followTimer.current = window.setTimeout(() => {
          following.current = false;
          sync();
        }, 1200);
      }
      toEnd(smooth);
      setUnread(0);
      setAtEnd(true);
    },
    [sync],
  );

  const reveal = useCallback(
    (item: HTMLElement, options?: RevealOptions) => {
      const v = vp.current;
      if (!v || !v.contains(item)) return;
      const margin = parseFloat(getComputedStyle(item).scrollMarginTop) || 0;
      const box = item.getBoundingClientRect();
      const origin = v.getBoundingClientRect().top - v.scrollTop;
      let top = box.top - origin - margin - (options?.offset ?? 0);
      // Too tall to show whole: its foot (the action row) sits `gap` above the viewport's bottom instead.
      const gap = options?.gap ?? tokenPx("--ui-space-lg", 16);
      if (options?.block === "end" && box.bottom - origin - top > v.clientHeight - gap)
        top = box.bottom - origin - v.clientHeight + gap;
      if (top >= v.scrollHeight - v.clientHeight - hit()) {
        quiet.current = false;
        goEnd(options?.smooth);
        return;
      }
      stick.current = false;
      following.current = false;
      quiet.current = true;
      aim.current = Math.max(0, Math.round(top));
      window.clearTimeout(aimTimer.current);
      aimTimer.current = window.setTimeout(() => (aim.current = null), 1200);
      setAtEnd(true);
      setUnread(0);
      v.scrollTo({ top: Math.max(0, top), behavior: options?.smooth && !prefersReducedMotion() ? "smooth" : "auto" });
    },
    [goEnd],
  );

  useImperativeHandle(
    ref,
    () => ({
      scrollToEnd: (smooth = true) => {
        hers();
        goEnd(smooth);
      },
      reveal,
      announce: say,
      get viewport() {
        return vp.current;
      },
    }),
    [goEnd, reveal, say],
  );

  // once, not in a loop: the message cut at the top of the viewport shows about half
  const fit = useCallback(() => {
    const s = root.current,
      v = vp.current;
    if (!fitHalf || !s || !v || !v.clientHeight) return;
    setHeight(null);
    requestAnimationFrame(() => {
      toEnd();
      if (v.scrollHeight <= v.clientHeight + 1) return;
      const top = v.getBoundingClientRect().top;
      const items = Array.from(
        s.querySelectorAll<HTMLElement>(
          ".ui-message-scroller-content .ui-message, .ui-message-scroller-content .ui-marker",
        ),
      );
      let cut = items.find((el) => {
        const r = el.getBoundingClientRect();
        return r.top < top - 1 && r.bottom > top + 1;
      });
      if (!cut) cut = items.filter((el) => el.getBoundingClientRect().bottom <= top + 1).pop();
      if (!cut) return;
      const r = cut.getBoundingClientRect(),
        h = s.offsetHeight;
      const delta = Math.max(-h * 0.35, Math.min(h * 0.35, top - (r.top + r.height / 2)));
      if (Math.abs(delta) < 2) return;
      setHeight(Math.round(h + delta));
    });
  }, [fitHalf]);

  // start at the end
  useIsoLayoutEffect(() => {
    toEnd();
    stick.current = true;
    sync();
  }, [sync]);

  useEffect(() => {
    fit();
    const v = vp.current,
      c = content.current;
    if (!v || !c) return;
    // growth at the end (and a viewport that changes size) keeps the end in view while you are there
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        if (following.current) toEnd(true);
        else if (stick.current) toEnd();
      });
      ro.observe(c);
      ro.observe(v);
    }
    // a message that arrives while you are scrolled up is counted on the pill
    const mo = new MutationObserver((records) => {
      if (stick.current || following.current) return;
      let n = 0;
      records.forEach((r) =>
        r.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement && node.classList.contains("ui-message")) n++;
          else if (node instanceof HTMLElement && node.querySelector(":scope > .ui-message")) n++;
        }),
      );
      if (n) setUnread((u) => u + n);
    });
    mo.observe(c, { childList: true });
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (vp.current && isAtEnd(vp.current)) fit();
      }, 200);
    };
    window.addEventListener("resize", onResize);
    if (document.fonts?.ready)
      document.fonts.ready.then(() => {
        if (vp.current && isAtEnd(vp.current)) {
          fit();
          toEnd();
          sync();
        }
      });
    return () => {
      ro?.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
      window.clearTimeout(followTimer.current);
      window.clearTimeout(aimTimer.current);
    };
  }, [fit, sync]);

  // after the fitted height lands, keep the end in view
  useIsoLayoutEffect(() => {
    if (height !== null) {
      toEnd();
      sync();
    }
  }, [height, sync]);

  useEffect(() => {
    if (announcement) say(announcement);
  }, [announcement, say]);

  const frame = useRef(0);
  const words = unread ? newLabel(unread) : jumpLabel;
  return (
    <div
      ref={root}
      className={cx("ui-message-scroller", className)}
      data-fit={fitHalf ? "half" : undefined}
      {...props}
      style={{ ...props.style, ...(height !== null ? vars({ "--ui-message-scroller-height": `${height}px` }) : null) }}
    >
      <div
        ref={vp}
        className="ui-message-scroller-viewport"
        tabIndex={0}
        role="region"
        aria-label={label}
        onWheel={hers}
        onTouchStart={hers}
        onKeyDown={(e) => {
          if (
            ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "End", "Home", " "].includes(e.key) &&
            e.target === e.currentTarget
          )
            hers();
        }}
        onScroll={() => {
          if (frame.current) return;
          frame.current = requestAnimationFrame(() => {
            frame.current = 0;
            sync();
          });
        }}
      >
        <div ref={content} className="ui-message-scroller-content">
          {children}
        </div>
      </div>
      <div
        className="ui-message-scroller-button ui-glass ui-glass--small ui-glass--bar"
        data-direction="end"
        data-active={String(!atEnd)}
      >
        <Btn
          variant="glass-clear"
          size="sm"
          icon="arrow-down"
          aria-label={unread ? `${words}, jump to latest` : jumpLabel}
          tabIndex={atEnd ? -1 : undefined}
          onClick={() => {
            goEnd(true);
            vp.current?.focus({ preventScroll: true });
          }}
        >
          <span>{words}</span>
        </Btn>
      </div>
      <div className="ui-message-scroller-announce" role="status" aria-live="polite">
        {live}
      </div>
    </div>
  );
});

/** div.ui-message-scroller-item: an optional wrapper for one row of the scroller. */
export const MessageScrollerItem = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function MessageScrollerItem({ className, ...props }, ref) {
    return <div ref={ref} className={cx("ui-message-scroller-item", className)} {...props} />;
  },
);

// ---------- streaming text ----------

/**
 * Writes `text` word by word (message.js stream): returns the words so far and whether it is still going.
 * Pass `shown` to MessageText with `streaming={!done}` and set Message state="streaming" until done.
 * With reduced motion the text arrives at once. A new `text` starts again; `stop` ends it where it is.
 */
export function useStreamedText(
  text: string,
  options?: { delay?: number; stop?: boolean },
): { shown: string; done: boolean } {
  const delay = options?.delay ?? 55;
  const stop = !!options?.stop;
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const [pos, setPos] = useState(() => ({ text, count: prefersReducedMotion() ? words.length : 0 }));
  let count = pos.count;
  if (pos.text !== text) {
    count = prefersReducedMotion() ? words.length : 0;
    setPos({ text, count });
  }
  useEffect(() => {
    if (stop || count >= words.length) return;
    const t = window.setTimeout(
      () => {
        // a word and the space after it arrive together
        const next = words[count + 1] && /^\s+$/.test(words[count + 1]) ? count + 2 : count + 1;
        setPos({ text, count: next });
      },
      count === 0 ? 0 : delay,
    );
    return () => window.clearTimeout(t);
  }, [count, delay, stop, text, words]);
  return { shown: words.slice(0, count).join(""), done: stop || count >= words.length };
}
