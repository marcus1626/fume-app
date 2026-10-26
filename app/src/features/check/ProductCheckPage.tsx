// The confirm queue: every product that waits for her, inside the shell. On a desk it is master and detail: the
// products on the left (photo, name, why it waits, a tick once confirmed; ↑ ↓ move through them), the product's card on
// the right (ProductCheckCard), and Later · Confirm pinned at the bottom of the window, at the same place for every
// product. ‹ › and ← → step without deciding (outside a field), ⌘↵ confirms, Esc goes back where she came from. The
// product on the card is in the address (?p=pr-candle, replaced on each step), so a reload or a link lands on it. The
// end says what is next. On a phone it is the one-card flow, the pills where the tab bar was.
// Opened from Home, Brand › Products, the import ("Confirm them now") and the brief: /check/products, ?ids=a,b to go
// through only those, ?start=id (or ?p=id) to begin with one.
import { Button, CheckCard, CheckEnd, CheckQueue, CheckQueueItem, CheckQueueList, PageHeader, tokenMs } from "@fume/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCampaigns, useCatalogue, useProductKinds, useQuestions } from "../../api/hooks";
import type { Id, Product } from "../../contract";
import * as copy from "../../copy";
import { Back, Page, Query, useBack } from "../../shell/Page";
import { photoOf, useProductCheck, waitingOn, type CheckVerdict } from "./ProductCheckCard";
import { useQueueKeys } from "./queue";
import { missingDetails } from "../products/spec";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function ProductCheckPage() {
  const catalogue = useCatalogue();
  const campaigns = useCampaigns();
  const [params] = useSearchParams();
  const back = useBack({ to: "/", label: "Home" });
  const [queue, setQueue] = useState<Id[] | null>(null);
  const products = catalogue.data?.products;

  // The queue is set once, when it opens: what waits then, a product a campaign waits on first. Confirming one does
  // not reorder the rest; it keeps its row with a tick.
  useEffect(() => {
    if (queue || !products || !campaigns.data) return;
    const only = params.get("ids")?.split(",").filter(Boolean);
    const start = params.get("start");
    const waiting = products.filter((p) => p.state === "needs_you" && (!only || only.includes(p.id)));
    const blocked = waiting.filter((p) => waitingOn(campaigns.data, p.id));
    const ordered = [...blocked, ...waiting.filter((p) => !blocked.includes(p))].map((p) => p.id);
    setQueue(start && ordered.includes(start) ? [start, ...ordered.filter((id) => id !== start)] : ordered);
  }, [queue, products, campaigns.data, params]);

  return (
    <Page title="Confirm products">
      <PageHeader title="Confirm products" back={<Back to="/" label="Home" />} />
      <Query query={catalogue} loading="Loading your products">
        {() =>
          queue === null ? null : queue.length === 0 ? (
            <CheckQueue>
              <CheckEnd
                title="Every product is confirmed"
                text="Fume can use each of them in a campaign."
                actions={
                  <Button onClick={back.back} icon="arrow-left">
                    Back to {back.label}
                  </Button>
                }
              />
            </CheckQueue>
          ) : (
            <Queue queue={queue} />
          )
        }
      </Query>
    </Page>
  );
}

/** The queue itself, once it is known: the list, the card, the foot. */
function Queue({ queue }: { queue: Id[] }) {
  const catalogue = useCatalogue();
  const campaigns = useCampaigns();
  const questions = useQuestions();
  const kinds = useProductKinds();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const back = useBack({ to: "/", label: "Home" });
  const [results, setResults] = useState<Record<Id, CheckVerdict>>({});
  const [leaving, setLeaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [live, setLive] = useState("");
  // A decision puts the focus in the next card's answer; stepping and moving through the list keep it where it is.
  const [focusCard, setFocusCard] = useState(true);
  const products = catalogue.data?.products;
  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const asked = params.get("p");
  const current = asked && queue.includes(asked) ? asked : queue[0];
  const at = queue.indexOf(current);
  const total = queue.length;
  // Confirmed here, or somewhere else meanwhile (the chat, the product page): it is done either way.
  const verdict = (id: Id): CheckVerdict | undefined =>
    results[id] ?? (byId.get(id)?.state === "verified" ? "confirmed" : undefined);

  /** Show this product; the address follows, replaced, so Back still leaves the queue in one step. */
  // Stepping with ← → from the card (or from nowhere): the next card takes the focus, so it is never lost on the body.
  const cardFocus = useRef(false);
  useEffect(() => {
    if (!cardFocus.current) return;
    cardFocus.current = false;
    document.querySelector<HTMLElement>(".ui-check-queue-stage > .ui-check-card")?.focus({ preventScroll: true });
  }, [current]);
  function show(id: Id, focus = true) {
    const at = document.activeElement;
    cardFocus.current = !focus && (at === document.body || Boolean(at?.closest(".ui-check-card")));
    setFocusCard(focus);
    setFinished(false);
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.set("p", id);
        n.delete("start");
        return n;
      },
      { replace: true, preventScrollReset: true },
    );
  }
  // Stepping (‹ ›, ← →) only looks: the focus stays where it is, so the arrows go on stepping. A decision puts it in
  // the next product's answer.
  const step = (by: 1 | -1) => {
    const next = queue[at + by];
    if (next) show(next, false);
  };

  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  function done(v: CheckVerdict, product: Product) {
    const after = { ...results, [current]: v };
    setResults(after);
    // The next one still open, after this one, then from the top.
    const open = (id: Id) =>
      !(after[id] ?? (byId.get(id)?.state === "verified" && id !== current ? "confirmed" : undefined));
    const next = [...queue.slice(at + 1), ...queue.slice(0, at)].find(open);
    const nextName = next ? byId.get(next)?.name : undefined;
    setLive(
      `${product.name} ${v === "confirmed" ? "confirmed" : "left for later"}.${nextName ? ` Next: ${nextName}.` : ""}`,
    );
    setLeaving(true);
    timer.current = window.setTimeout(
      () => {
        setLeaving(false);
        if (next) show(next);
        else setFinished(true);
        document.querySelector(".ui-sidebar-inset")?.scrollTo({ top: 0 });
      },
      reduced() ? 0 : tokenMs("--ui-motion-slow", 480),
    );
  }

  const check = useProductCheck(current, {
    onDone: done,
    autoFocus: focusCard,
    fallback: current ? byId.get(current) : undefined,
  });
  useQueueKeys({
    onPrev: () => step(-1),
    onNext: () => step(1),
    onClose: back.back,
    onConfirm: finished ? undefined : check.confirm,
  });

  /** Go through the ones left for later, once more. */
  function again() {
    const later = queue.filter((id) => results[id] === "later");
    setResults((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== "later")));
    if (later[0]) show(later[0]);
  }

  const confirmed = queue.filter((id) => verdict(id) === "confirmed");
  const later = queue.filter((id) => results[id] === "later");
  // What is next: a campaign that waited on a product she just confirmed, else her first campaign, else Home.
  const unblocked = (campaigns.data ?? []).find(
    (c) =>
      !["delivered", "closed", "approved"].includes(c.state) &&
      c.productIds.some((id) => confirmed.includes(id) && results[id]),
  );
  const firstRun = campaigns.data !== undefined && campaigns.data.length === 0;
  const openQuestions = (id: Id) => (questions.data ?? []).filter((q) => q.productId === id).length;

  const list =
    total > 1 ? (
      <CheckQueueList label="Products to confirm">
        {queue.map((id) => {
          const p = byId.get(id);
          const v = verdict(id);
          const by = waitingOn(campaigns.data, id);
          const n = openQuestions(id);
          // what is still missing, as the add toast said it
          const missing = p
            ? missingDetails(
                p,
                kinds.data?.find((k) => k.id === p.kindId),
              )
            : 0;
          const src = photoOf(p);
          return (
            <CheckQueueItem
              key={id}
              current={!finished && id === current}
              done={v === "confirmed"}
              media={src ? <img src={src} alt="" loading="lazy" /> : null}
              title={p ? `${p.name} ${p.variant}`.trim() : id}
              detail={
                v === "confirmed"
                  ? "Confirmed"
                  : v === "later"
                    ? "Later"
                    : by
                      ? `${by.name} waits on it`
                      : n
                        ? copy.count(n, "question") + " for you"
                        : missing
                          ? `${copy.count(missing, "detail")} missing`
                          : "Only needs a look"
              }
              onClick={() => show(id, false)}
            />
          );
        })}
      </CheckQueueList>
    ) : undefined;

  const end = (
    <CheckEnd
      title={
        confirmed.length === 0
          ? "Nothing confirmed yet"
          : later.length
            ? `${copy.count(confirmed.length, "product")} confirmed, ${later.length} for later`
            : `${copy.count(confirmed.length, "product")} confirmed`
      }
      text={
        unblocked
          ? `${unblocked.name} can go on now.`
          : confirmed.length === 0
            ? "They wait here until you have a minute. A campaign asks for the one it needs."
            : firstRun
              ? confirmed.length === 1
                ? "It is ready for your first campaign."
                : "They are ready for your first campaign."
              : confirmed.length === 1
                ? "Fume can use it in any campaign now."
                : "Fume can use them in any campaign now."
      }
      actions={
        <>
          {unblocked ? (
            <Button icon="arrow-right" onClick={() => navigate(`/campaigns/${unblocked.id}`, { replace: true })}>
              Open {unblocked.name}
            </Button>
          ) : firstRun && confirmed.length > 0 ? (
            <Button icon="message-square" onClick={() => navigate("/fume?new=1", { replace: true })}>
              Tell Fume what you need
            </Button>
          ) : (
            <Button onClick={back.back}>Done</Button>
          )}
          {later.length > 0 && (
            <Button variant="secondary" onClick={again}>
              Go through the {later.length === 1 ? "one" : later.length} left
            </Button>
          )}
        </>
      }
    />
  );

  return (
    <CheckQueue
      list={list}
      live={live}
      step={
        !finished && total > 1 ? (
          <>
            <Button
              variant="quiet"
              size="sm"
              iconOnly
              icon="chevron-left"
              aria-label="Previous product"
              shortcut="←"
              disabled={at <= 0}
              onClick={() => step(-1)}
            />
            <span className="ui-check-queue-count">
              {at + 1} of {total}
            </span>
            <Button
              variant="quiet"
              size="sm"
              iconOnly
              icon="chevron-right"
              aria-label="Next product"
              shortcut="→"
              disabled={at >= total - 1}
              onClick={() => step(1)}
            />
          </>
        ) : undefined
      }
      foot={
        !finished ? (
          <>
            <Button variant="quiet" onClick={check.later} disabled={check.busy || !check.product}>
              Later
            </Button>
            <Button icon="check" onClick={check.confirm} loading={check.busy} disabled={!check.product}>
              Confirm
            </Button>
          </>
        ) : undefined
      }
    >
      {finished ? (
        end
      ) : (
        <CheckCard
          key={current}
          className="ui-check-card--product"
          tabIndex={-1}
          leaving={leaving}
          aria-labelledby={`check-${current}-name`}
          onKeyDown={check.onKeyDown}
        >
          {check.head}
          {check.body}
        </CheckCard>
      )}
    </CheckQueue>
  );
}
