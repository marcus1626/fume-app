// Brand (FLOWS §0.3, §2, §4.1; UX review 15 Oct, §2.3; round 8 UX walk-through 19 Oct). One place, three tabs:
// Brand DNA, Products and Taste (/brand, /brand/products, /brand/taste). The Brand DNA tab is the brand's guidelines
// page: the logo on light and dark, every colour, type in the customer's own face, voice, imagery and the AI models.
// Round 9 (desktop review DLAY-9, DLOAD-5, DLOAD-6, DWAY-14, DWAY-15, DWAY-17, DLAY-13; PROPOSED 19 Oct 2026):
// - The tab is "Brand DNA" (the name the onboarding teaches); "Behind the board" is "More about your Brand DNA".
// - The board acts in place: a find Fume is not sure of carries Confirm · Change · Remove where it is (board.tsx),
//   so the part pages are gone: /brand/logo, /colour, /type, /voice and /imagery send you to /brand#<part>, and a
//   part's "How it is used" opens its details in place. /brand/check stays as the one-at-a-time queue: its way in,
//   "Confirm 7 finds", is the page's one Ink action, in the header on the title's line (DLAY-13); a line under the
//   summary says what the finds are.
// - From 1280 px the board is two columns (Logo | Colour, Type | Voice, Imagery across, AI models | More), so the
//   whole brand fits in two screens at 1440 × 900 instead of four.
// - The tab row sticks under the app bar (≥ 1024 px) with, on Brand DNA, an index that jumps to each part and lights
//   the part in view; tabs switch with replace, so Back leaves Brand instead of stepping through its tabs, and a tab
//   that sticks stays where the mouse left it.
// Rules (/brand/rules), What Fume learned (/brand/memory), Brand DNA summary (/brand/understanding) and Update the
// brand (/brand/update) are pages of their own.
import { Button, Icon, PageHeader, Tabs, TabsList, TabsTrigger } from "@fume/ui";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useBrandAssets, useBrandBoard, usePeople, useSession } from "../../api/hooks";
import type { BrandBoardView } from "../../contract";
import { Page, Query } from "../../shell/Page";
import { directory } from "../../shell/people";
import { BoardPart, ColourPart, ImageryPart, LogoPart, TypePart, VoicePart, type Visit } from "./board";
import { BrandRules } from "./BrandRules";
import { BrandUpdatePage } from "./BrandUpdatePage";
import { MemoryPage } from "./MemoryPage";
import { Models, useHasModels } from "./models";
import { BrandHeaderSlotProvider, useModelsHeldBack, useRole, useViewer, versionLine } from "./parts";
import { ProductsContent } from "./ProductsPage";
import { TasteContent } from "./TastePage";
import { VoicePage } from "./voice";

/** The three tabs: the only Brand pages with a tab row. */
const tabs = [
  { id: "board", label: "Brand DNA" },
  { id: "products", label: "Products" },
  { id: "taste", label: "Taste" },
] as const;
type Tab = (typeof tabs)[number]["id"];

/** The board's parts that once had a page of their own; their addresses now land on the part (/brand#colour). */
const partIds = ["logo", "colour", "type", "voice", "imagery"] as const;
type Part = (typeof partIds)[number];

const isTab = (t: string | undefined): t is Tab => tabs.some((x) => x.id === t);
const isPart = (t: string | undefined): t is Part => partIds.includes(t as Part);

/** "A logo", "2 colours": one kind of find in words. */
const findWords = (n: number, one: string, many: string) => (n === 1 ? `a ${one}` : `${n} ${many}`);

/** "a logo, a colour and Leo, an AI model": a list as one line. */
function listWords(words: string[]): string {
  return words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** What waits on the Brand DNA tab, the same count Home shows: the finds in every part, the moodboard's and the AI models. */
function useFinds(view: BrandBoardView | undefined) {
  const heldBack = useModelsHeldBack();
  const models = useBrandAssets().data?.models ?? [];
  if (!view) return { count: 0, words: [] as string[] };
  const waiting = heldBack ? [] : models.filter((m) => m.state === "saved");
  const open = (list: { provenance: { state: string } }[]) => list.filter((x) => x.provenance.state === "proposed").length;
  const id = view.identity;
  const kinds: [number, string, string][] = [
    [open(id.logos), "logo", "logos"],
    [open(id.colours), "colour", "colours"],
    [open(id.typefaces), "typeface", "typefaces"],
    [open(id.voice), "voice line", "voice lines"],
    [open(id.imagery), "picture", "pictures"],
    [open(view.moodboard.items), "moodboard picture", "moodboard pictures"],
  ];
  const words = [...kinds.filter(([n]) => n > 0).map(([n, one, many]) => findWords(n, one, many)), ...waiting.map((m) => `${m.name}, an AI model`)];
  return { count: view.open + waiting.length, words };
}

/** /brand/update, /brand/rules and /brand/memory are pages of their own; a part's old page lands on the part. */
export function BrandBoardPage() {
  const { tab } = useParams<"tab">();
  if (tab === "update") return <BrandUpdatePage />;
  if (tab === "rules") return <BrandRules />;
  if (tab === "memory") return <MemoryPage />;
  // Round 13 (#4): the voice has a page of its own again, the whole voice in five parts
  if (tab === "voice") return <VoicePage />;
  if (isPart(tab)) return <Navigate to={{ pathname: "/brand", hash: tab }} replace />;
  return <BrandTabs />;
}

/** The scroller the page lives in (the sidebar inset), for keeping the tab row where it is. */
const scrollerOf = (el: Element | null) => (el?.closest(".ui-sidebar-inset") as HTMLElement | null) ?? null;

/** Brand DNA, Products and Taste: one header (with the tab's page action) and the tab row that sticks. */
function BrandTabs() {
  const params = useParams<"tab">();
  const tab: Tab = isTab(params.tab) ? params.tab : "board";
  const navigate = useNavigate();
  const session = useSession().data!;
  const board = useBrandBoard();
  const { canApprove } = useRole();
  const finds = useFinds(board.data);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const header = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const label = tabs.find((t) => t.id === tab)!.label;

  // A tab change keeps the tab row where the mouse is: if the row is stuck under the app bar, the page scrolls back
  // only to where it starts to stick, so the next tab opens at its top with the row in the same place.
  function go(next: string) {
    const s = scrollerOf(bar.current);
    const h = header.current;
    if (s && h && bar.current) {
      const top = s.getBoundingClientRect().top;
      const gap = parseFloat(getComputedStyle(bar.current.parentElement!).rowGap) || 0;
      const natural = h.getBoundingClientRect().bottom - top + s.scrollTop + gap;
      const stuckAt = bar.current.getBoundingClientRect().top - top;
      const stick = natural - stuckAt;
      if (stick > 0 && s.scrollTop > stick) s.scrollTop = stick;
    }
    navigate(next === "board" ? "/brand" : `/brand/${next}`, { replace: true });
  }

  return (
    <Page title={`${label} · Brand`}>
      <PageHeader
        ref={header}
        title="Brand"
        meta={[session.workspace.brandName]}
        actions={
          <>
            {tab === "board" && canApprove && finds.count > 0 && (
              <Button asChild iconEnd="arrow-right">
                <Link to="/brand/check">{finds.count === 1 ? "Confirm 1 find" : `Confirm ${finds.count} finds`}</Link>
              </Button>
            )}
            <span ref={setSlot} className="ui-brand-header-slot" />
          </>
        }
      />
      {/* ui-page-header-tabs: the page notes a tab change by it (Page.tsx), so the reader's place is kept */}
      <div ref={bar} className="ui-brand-bar ui-page-header-tabs">
        <Tabs value={tab} onValueChange={go}>
          <TabsList aria-label="Brand">
            {tabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {tab === "board" && board.data && <PartIndex />}
      </div>

      <BrandHeaderSlotProvider value={slot}>
        {tab === "products" ? (
          <ProductsContent />
        ) : tab === "taste" ? (
          <TasteContent moodboardId={board.data?.moodboard.id ?? "bd-brand"} moodboardItems={board.data?.moodboard.items.filter((i) => i.kind === "image" || i.kind === "creative").length} />
        ) : (
          <Query query={board} loading="Loading your Brand DNA">
            {(view) => <BoardTab view={view} finds={finds} />}
          </Query>
        )}
      </BrandHeaderSlotProvider>
    </Page>
  );
}

/** Scrolls the page to a part, under the tab row that sticks, and gives the part focus without a ring. */
function jumpTo(id: string, from: HTMLElement | null): boolean {
  const el = document.getElementById(id);
  const s = scrollerOf(from);
  if (!el || !s) return false;
  const row = from?.closest<HTMLElement>(".ui-page-header-tabs");
  const covered = row ? (parseFloat(getComputedStyle(row).top) || 0) + row.offsetHeight : 0;
  const air = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-space-lg")) || 16;
  const top = el.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop - covered - air;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  s.scrollTo({ top: Math.max(0, top), behavior: still ? "auto" : "smooth" });
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.setAttribute("data-ui-focus", "pointer");
  el.focus({ preventScroll: true });
  return true;
}

/** The index of the board's parts, in the tab row: a link to each, the one in view lit (aria-current). */
function PartIndex() {
  const hasModels = useHasModels();
  const parts = [
    { id: "logo", label: "Logo" },
    { id: "colour", label: "Colour" },
    { id: "type", label: "Type" },
    { id: "voice", label: "Voice" },
    { id: "imagery", label: "Imagery" },
    ...(hasModels ? [{ id: "models", label: "AI models" }] : []),
    { id: "more", label: "More" },
  ];
  const [current, setCurrent] = useState<string | null>(null);
  const nav = useRef<HTMLElement>(null);
  // the part just jumped to: two parts abreast share a top, so the one picked stays lit until its row leaves
  const picked = useRef<{ id: string; at: number } | null>(null);
  // a jump by address (/brand#colour, the old /brand/colour) lights its part too
  const { hash } = useLocation();
  useEffect(() => {
    const id = hash.slice(1);
    if (parts.some((p) => p.id === id)) picked.current = { id, at: Date.now() };
    // parts change only with the AI models
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  // The part in view: the last row whose top has passed a line a quarter down the board under the tab row; a row of
  // two lights its first part, or the one just picked. The foot of the page lights the last row.
  useEffect(() => {
    const s = scrollerOf(nav.current);
    if (!s) return;
    let frame = 0;
    const pick = () => {
      const below = nav.current?.getBoundingClientRect().bottom ?? 0;
      const line = below + (s.getBoundingClientRect().bottom - below) / 4;
      const tops = parts.map((p) => document.getElementById(p.id)?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY);
      let at = -1;
      tops.forEach((top, i) => {
        if (top <= line && (at < 0 || top > tops[at]! + 4)) at = i;
      });
      if (s.scrollTop + s.clientHeight >= s.scrollHeight - 2) at = tops.findIndex((t) => Math.abs(t - tops[tops.length - 1]!) <= 4);
      // while the jump is still under way (a second), or while its row is the one in view, the pick stays lit
      const pin = picked.current;
      const p = pin ? parts.findIndex((x) => x.id === pin.id) : -1;
      if (p >= 0 && (Date.now() - pin!.at < 1000 || (at >= 0 && Math.abs(tops[p]! - tops[at]!) <= 4))) at = p;
      else picked.current = null;
      setCurrent(at >= 0 ? parts[at]!.id : null);
    };
    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(pick);
    };
    pick();
    s.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      s.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
    };
    // parts change only with the AI models
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasModels]);

  return (
    <nav ref={nav} className="ui-brand-index" aria-label="Parts of your Brand DNA">
      {parts.map((p) => (
        <Link
          key={p.id}
          to={{ hash: p.id }}
          replace
          className="ui-brand-index-link"
          aria-current={current === p.id ? "location" : undefined}
          onClick={(e) => {
            picked.current = { id: p.id, at: Date.now() };
            setCurrent(p.id);
            // Round 13 (#40): the index scrolls to the part itself, so the address keeps no hash and the part is not
            // marked as a jump target; focus moves to the part without a scroll of its own and without a ring
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            if (jumpTo(p.id, nav.current)) e.preventDefault();
          }}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}

type PartOpen = Partial<Record<Part, boolean>>;

function BoardTab({ view, finds }: { view: BrandBoardView; finds: { count: number; words: string[] } }) {
  const { canApprove, me } = useRole();
  const viewer = useViewer();
  const dir = directory(usePeople().data);
  // What was decided here keeps its place until the next visit (board.tsx Visit).
  const [decided, setDecided] = useState<ReadonlySet<string>>(new Set());
  const visit: Visit = { decided, onDecided: (id) => setDecided((s) => new Set(s).add(id)) };
  const [open, setOpen] = useState<PartOpen>({});
  const part = (p: Part) => ({ identity: view.identity, rules: view.rules, visit, open: Boolean(open[p]), onOpen: (o: boolean) => setOpen((x) => ({ ...x, [p]: o })) });
  const never = view.rules.filter((r) => r.kind === "hard_constraint").length;

  return (
    <div className="ui-brand" data-layout="board">
      <header className="ui-brand-hero">
        <p className="ui-brand-summary">{view.dna.summary}</p>
        {finds.count > 0 && (
          <p className="ui-brand-hero-line">
            <Icon name="fume-engine" />
            <span>
              {canApprove ? "To confirm" : "Waiting for an owner or an approver to confirm"}: {listWords(finds.words)}.
            </span>
          </p>
        )}
        {view.dna.state !== "approved" && (
          <p className="ui-brand-hero-line">
            <Icon name="clock" />
            <span>{viewer.Your} Brand DNA waits for approval.</span>
          </p>
        )}
      </header>

      <div className="ui-brand-grid">
        <LogoPart {...part("logo")} />
        <ColourPart {...part("colour")} />
        <TypePart {...part("type")} />
        <VoicePart {...part("voice")} />
        <ImageryPart {...part("imagery")} />
        <Models />
        <BoardPart id="more" title="More about your Brand DNA">
          <div className="ui-brand-links">
            {/* /brand#rules (⌘K's "Rules" row) lands here */}
            <Link to="/brand/rules" id="rules" className="ui-brand-link">
              <Icon name="list" />
              <span className="ui-brand-link-title">Rules</span>
              <span className="ui-brand-link-text">
                {view.rules.length === 1 ? "1 rule" : `${view.rules.length} rules`}
                {never ? `, ${never} never broken` : ""}
              </span>
            </Link>
            <Link to="/brand/memory" className="ui-brand-link">
              <Icon name="bookmark" />
              <span className="ui-brand-link-title">What Fume learned</span>
              <span className="ui-brand-link-text">From your approvals and changes</span>
            </Link>
            <Link to="/brand/understanding" className="ui-brand-link">
              <Icon name="eye" />
              <span className="ui-brand-link-title">Brand DNA summary</span>
              <span className="ui-brand-link-text">{versionLine(view.dna, dir.name, me)}</span>
            </Link>
            <Link to="/brand/update" className="ui-brand-link">
              <Icon name="refresh-cw" />
              <span className="ui-brand-link-title">Update the brand</span>
              <span className="ui-brand-link-text">New pages or new material</span>
            </Link>
          </div>
        </BoardPart>
      </div>
    </div>
  );
}
