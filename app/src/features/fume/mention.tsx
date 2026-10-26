// "@" in the Fume composer (FLOWS §26.1). Typing "@" (or the composer's @ button) opens a small Smoke glass list over
// the composer: her campaigns, products, collections and the creatives of her campaigns, filtered as she types. ↑ ↓
// move, Enter or Tab picks, Esc closes; a click picks too. The pick writes "@Autumn launch " into her words, and Fume
// answers about what she named (in the mock: where it is, the numbers, what comes next, and a line that
// opens it beside the conversation). When the composer is empty, a few things to ask sit over it ("Where is Autumn
// launch?", "What waits on me?", "This month in numbers").
import { Button, Icon, type IconName } from "@fume/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCampaigns, useCampaignViews, useCatalogue } from "../../api/hooks";
import type { Campaign } from "../../contract";
import { creativeLabels } from "../review/names";

export interface MentionItem {
  id: string;
  /** What the pick writes after "@": "Autumn launch", "Feed 1 in Autumn launch". */
  name: string;
  kind: "campaign" | "product" | "collection" | "creative";
  /** One quiet line: "Campaign · at the creatives", "Product · 50 ml". */
  meta: string;
  picture?: string;
}

const ICON: Record<MentionItem["kind"], IconName> = {
  campaign: "megaphone",
  product: "tag",
  collection: "folder",
  creative: "image",
};
const KIND: Record<MentionItem["kind"], string> = {
  campaign: "Campaign",
  product: "Product",
  collection: "Collection",
  creative: "Creative",
};
const live = (c: Campaign) => !["closed"].includes(c.state);

/** Everything she can name, in the order the list offers it: campaigns, products, collections, creatives. */
function useMentionItems(): MentionItem[] {
  const campaigns = useCampaigns().data;
  const catalogue = useCatalogue().data;
  const withCreatives = (campaigns ?? []).filter((c) => live(c) && c.stage !== "brief" && c.stage !== "plan");
  const views = useCampaignViews(withCreatives.map((c) => c.id)).data;
  return useMemo(() => {
    const items: MentionItem[] = [];
    for (const c of (campaigns ?? []).filter(live))
      items.push({ id: `c:${c.id}`, name: c.name, kind: "campaign", meta: "Campaign" });
    for (const p of catalogue?.products ?? [])
      items.push({
        id: `p:${p.id}`,
        name: p.name,
        kind: "product",
        meta: [`Product`, p.variant].filter(Boolean).join(" · "),
        picture: p.images[0],
      });
    for (const k of catalogue?.collections ?? [])
      items.push({
        id: `k:${k.id}`,
        name: k.name,
        kind: "collection",
        meta: `Collection · ${k.productIds.length} ${k.productIds.length === 1 ? "product" : "products"}`,
        picture: k.cover,
      });
    for (const v of views ?? []) {
      const labels = creativeLabels(v.creatives);
      for (const cr of v.creatives.filter(
        (x) => x.current.state !== "making" && x.current.state !== "in_check" && x.current.state !== "correcting",
      ))
        items.push({
          id: `cr:${cr.id}`,
          name: `${labels.get(cr.id)} in ${v.campaign.name}`,
          kind: "creative",
          meta: "Creative",
          picture: cr.current.image,
        });
    }
    return items;
  }, [campaigns, catalogue, views]);
}

/** The "@word" being typed at the caret, and where it starts. */
function queryAt(text: string, caret: number): { at: number; query: string } | undefined {
  const m = /(^|\s)@([^@\n]{0,40})$/.exec(text.slice(0, caret));
  if (!m) return undefined;
  return { at: caret - m[2].length - 1, query: m[2] };
}

/** Best first: a name that starts with the words, then one that holds them. Eight at most. */
function match(items: MentionItem[], query: string): MentionItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.filter((i) => i.kind !== "creative").slice(0, 8);
  const starts = items.filter((i) => i.name.toLowerCase().startsWith(q));
  const holds = items.filter((i) => !starts.includes(i) && i.name.toLowerCase().includes(q));
  return [...starts, ...holds].slice(0, 8);
}

/**
 * The @ list for the composer whose textarea has `inputId`. Returns the list (to render over the composer, inside a
 * positioned parent) and `open`, for the composer's own keys.
 */
export function useMentions({
  inputId,
  text,
  onText,
  disabled,
}: {
  inputId: string;
  text: string;
  onText: (text: string) => void;
  disabled?: boolean;
}) {
  const items = useMentionItems();
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [closedAt, setClosedAt] = useState<number | null>(null);
  // The caret as the field has it now (after a keystroke the field is ahead of the last caret this hook kept).
  const field =
    typeof document !== "undefined" ? (document.getElementById(inputId) as HTMLTextAreaElement | null) : null;
  const here =
    field && document.activeElement === field && field.value === text ? (field.selectionStart ?? caret) : caret;
  const found = disabled ? undefined : queryAt(text, here);
  const shown = found && closedAt !== found.at ? match(items, found.query) : [];
  const open = shown.length > 0;
  const listId = `${inputId}-mentions`;
  const state = useRef({ open, shown, active, found, text });
  state.current = { open, shown, active, found, text };

  useEffect(() => setActive(0), [found?.query]);

  const pick = (item: MentionItem) => {
    const el = document.getElementById(inputId) as HTMLTextAreaElement | null;
    const f = state.current.found;
    if (!f) return;
    const words = state.current.text;
    const end = f.at + 1 + f.query.length;
    const next = `${words.slice(0, f.at)}@${item.name} ${words.slice(end).replace(/^ /, "")}`;
    onText(next);
    const at = f.at + item.name.length + 2;
    setCaret(at);
    // This "@" is done: the list stays closed while she writes on after the name.
    setClosedAt(f.at);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at, at);
    });
  };
  const pickRef = useRef(pick);
  pickRef.current = pick;

  // The textarea's caret and its keys while the list is open (before the composer's own Enter, which sends).
  useEffect(() => {
    const el = document.getElementById(inputId) as HTMLTextAreaElement | null;
    if (!el) return;
    // Never a state change inside the field's own input event: React would put the old value back before its onChange.
    const track = () => window.setTimeout(() => setCaret(el.selectionStart ?? el.value.length), 0);
    const keys = (e: KeyboardEvent) => {
      const s = state.current;
      if (!s.open) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = s.shown.length;
        setActive((i) => (e.key === "ArrowDown" ? (i + 1) % n : (i - 1 + n) % n));
      } else if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const item = s.shown[s.active];
        if (item) pickRef.current(item);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (s.found) setClosedAt(s.found.at);
      }
    };
    // Her words changed from outside the field too (the @ button puts "@" at the caret): read the caret once it is set.
    const frame = requestAnimationFrame(() => document.activeElement === el && track());
    el.addEventListener("input", track);
    el.addEventListener("click", track);
    el.addEventListener("keyup", track);
    el.addEventListener("focus", track);
    el.addEventListener("keydown", keys);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("input", track);
      el.removeEventListener("click", track);
      el.removeEventListener("keyup", track);
      el.removeEventListener("focus", track);
      el.removeEventListener("keydown", keys);
    };
  }, [inputId, text]);

  // A new "@" opens the list again after Esc closed it.
  useEffect(() => {
    if (closedAt !== null && (!found || found.at !== closedAt)) setClosedAt(null);
  }, [found, closedAt]);

  // The textarea says which option is active (combobox pattern), while the list is open.
  useEffect(() => {
    const el = document.getElementById(inputId);
    if (!el) return;
    if (open) {
      el.setAttribute("aria-controls", listId);
      el.setAttribute("aria-expanded", "true");
      el.setAttribute("aria-activedescendant", `${listId}-${active}`);
    } else {
      el.removeAttribute("aria-controls");
      el.removeAttribute("aria-activedescendant");
      el.removeAttribute("aria-expanded");
    }
  }, [open, active, inputId, listId]);

  const list = open ? (
    <div
      className="ui-glass ui-glass--small ui-mention"
      role="listbox"
      id={listId}
      aria-label="Name something for Fume"
    >
      {shown.map((item, i) => (
        <div
          key={item.id}
          id={`${listId}-${i}`}
          role="option"
          aria-selected={i === active}
          className="ui-mention-row"
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setActive(i)}
          onClick={() => pick(item)}
        >
          <span className="ui-mention-media" aria-hidden="true">
            {item.picture ? <img src={item.picture} alt="" /> : <Icon name={ICON[item.kind]} />}
          </span>
          <span className="ui-mention-name">{item.name}</span>
          <span className="ui-mention-meta">{item.meta || KIND[item.kind]}</span>
        </div>
      ))}
    </div>
  ) : null;

  return { list, open };
}

/** A few things to ask, over an empty composer. */
export function AskSuggestions({ campaign, onAsk }: { campaign?: string; onAsk: (text: string) => void }) {
  const asks = [campaign ? `Where is @${campaign}?` : undefined, "What waits on me?", "This month in numbers"].filter(
    (x): x is string => Boolean(x),
  );
  return (
    <div className="ui-chat-chips ui-chat-asks" role="group" aria-label="Ask Fume">
      {asks.map((a) => (
        <Button key={a} variant="secondary" size="sm" onClick={() => onAsk(a)}>
          {a.replace("@", "")}
        </Button>
      ))}
    </div>
  );
}
