// Step 2, "Fume reads it" (FLOWS §7 step 3; round 7, Marcus 16 Oct; round 8, UX review ONB-2, ONB-3, ONB-22): the
// moment the customer sees Fume understand them. The reading plays as a mind map on a calm Paper grid: the logo lands
// in the middle, then Palette, Type, Pictures, Products, Voice, Rules and Audience connect to it one by one, each
// with a line of what is being read ("Reading lysne.no/about"). A node waits for the page it is read from.
// The map is the payoff and stays: no board, no Confirm · Change · Remove here (that is step 3's one job). When the
// reading is done, one summary line with one honest count ("12 finds to confirm, about 5 minutes") and one pill,
// "Confirm what Fume found", pinned to the bottom of the screen. After 3 s a quiet "Show me the result" skips the
// rest of the animation; a reading that is already done opens settled, so coming back never replays it.
// The look and motion are design-system/components/mind-map.css and MindMap (@fume/ui). Reduced motion: a static map.
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  Button,
  Icon,
  MindMap,
  type MindMapNode,
  type MindMapPlace,
} from "@fume/ui";
import type { IconName } from "@fume/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBrandBoard, useBrandScan, useSession, useStartBrandScan } from "../../api/hooks";
import type { BrandIdentity, BrandScan, BrandScanFind } from "../../contract";
import * as copy from "../../copy";
import { brandFaces, vars } from "../brand/board";
import { StepFrame } from "./frame";
import { finds as findsWord, openTotal } from "./found";

type Kind = BrandScanFind["kind"];
type NodeId = "palette" | "type" | "pictures" | "products" | "voice" | "rules" | "audience";

/** The nodes in the order they land (also the order they stack on a phone), and where each sits around the logo. */
const nodeDefs: { id: NodeId; kind: Kind; title: string; icon: IconName; place: MindMapPlace; wide?: boolean }[] = [
  { id: "palette", kind: "colour", title: "Palette", icon: "palette", place: "nw" },
  { id: "type", kind: "typeface", title: "Type", icon: "type", place: "n" },
  { id: "pictures", kind: "image", title: "Pictures", icon: "image", place: "w" },
  { id: "products", kind: "product", title: "Products", icon: "package", place: "sw", wide: true },
  { id: "voice", kind: "voice", title: "Voice", icon: "message-square", place: "ne" },
  { id: "rules", kind: "rule", title: "Rules", icon: "list", place: "e" },
  { id: "audience", kind: "audience", title: "Audience", icon: "users", place: "se" },
];

/** How long a node reads before it lands; the next one starts reading as it lands, so the motion overlaps. */
const STEP = 1100;
const STEP_REDUCED = 300;
/** After this long, "Show me the result" can skip the rest. */
const SKIP_AFTER = 3000;
/** Product tiles on the map before the rest are counted ("+6"). */
const TILES = 5;

function useReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

type Phase = { logo: boolean; states: Record<string, MindMapNode["state"]>; settled: boolean };

/**
 * The map's timeline. The logo lands first; then one node at a time reads (once the page it comes from is open) and
 * lands a step later. A reading that was already done when the page opened is shown settled, with nothing to watch;
 * `skip` settles it as soon as the reading is done.
 */
function useTimeline(
  scan: BrandScan | null | undefined,
  ids: NodeId[],
  sourcesOf: (id: NodeId) => string[],
  reduced: boolean,
  skip: boolean,
): Phase {
  const [phase, setPhase] = useState<Phase>({ logo: false, states: {}, settled: false });
  const scanRef = useRef(scan);
  scanRef.current = scan;
  const first = useRef<boolean | null>(null);
  const landed = () => Object.fromEntries(ids.map((id) => [id, "landed" as const]));

  useEffect(() => {
    if (!scan || first.current !== null) return;
    first.current = scan.state === "done";
    if (first.current) setPhase({ logo: true, states: landed(), settled: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan, ids]);

  useEffect(() => {
    if (skip && scan?.state === "done") setPhase({ logo: true, states: landed(), settled: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, scan?.state, ids]);

  useEffect(() => {
    if (!scan || first.current) return;
    const step = reduced ? STEP_REDUCED : STEP;
    const tick = () =>
      setPhase((p) => {
        const s = scanRef.current;
        if (!s || p.settled) return p;
        if (!p.logo) return { ...p, logo: true };
        const states = { ...p.states };
        const open = (id: NodeId) =>
          s.state === "done" || sourcesOf(id).every((src) => s.sources.find((x) => x.id === src)?.state !== "waiting");
        const reading = ids.find((id) => states[id] === "reading");
        if (reading) states[reading] = "landed";
        const next = ids.find((id) => !states[id]);
        if (next && open(next)) states[next] = "reading";
        const all = ids.every((id) => states[id] === "landed");
        if (all && s.state === "done" && p.states[ids[ids.length - 1]] === "landed")
          return { ...p, states, settled: true };
        return { ...p, states };
      });
    const kick = window.setTimeout(tick, reduced ? 0 : step / 3);
    const t = window.setInterval(tick, step);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(t);
    };
    // The timeline starts once per reading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan?.id, reduced]);

  return phase;
}

/** "Fume found your logo, 6 colours, 3 typefaces, 4 pictures, 3 lines of voice and 11 products." */
function foundLine(scan: BrandScan): string {
  const n = (k: Kind) => scan.finds.filter((f) => f.kind === k).length;
  const parts = [
    n("logo") && (n("logo") === 1 ? "your logo" : copy.count(n("logo"), "logo")),
    n("colour") && copy.count(n("colour"), "colour"),
    n("typeface") && copy.count(n("typeface"), "typeface"),
    n("image") && copy.count(n("image"), "picture"),
    n("voice") && copy.count(n("voice"), "line of voice", "lines of voice"),
    n("product") && copy.count(n("product"), "product"),
  ].filter(Boolean) as string[];
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return `Fume found ${list}.`;
}

/** The one count of the onboarding: what step 3 asks her to confirm (open finds in its five parts). */
function toConfirmLine(identity: BrandIdentity): string {
  const open = openTotal(identity);
  if (open === 0) return "Everything is confirmed.";
  const minutes = Math.max(2, Math.round(open * 0.4));
  return `${findsWord(open)} to confirm, about ${minutes} minutes.`;
}

/** What a node holds, as it lands: each thing a .ui-mind-map-item so it pulls into focus on its own. */
function NodeBody({ id, finds, identity }: { id: NodeId; finds: BrandScanFind[]; identity?: BrandIdentity }) {
  switch (id) {
    case "palette":
      return (
        <div className="ui-mind-map-swatches">
          {finds.map((f) => (
            <span
              key={f.id}
              className="ui-mind-map-item ui-mind-map-swatch"
              style={vars({ "--swatch": f.value })}
              role="img"
              aria-label={`${f.label}, ${f.value}`}
            />
          ))}
        </div>
      );
    case "type":
      return (
        <div className="ui-mind-map-specimens">
          {finds.map((f) => (
            <div
              key={f.id}
              className="ui-mind-map-item ui-mind-map-specimen"
              style={vars({ "--brand-font": identity?.typefaces.find((t) => t.name === f.label)?.cssFamily })}
            >
              <span className="ui-mind-map-specimen-aa" aria-hidden="true">
                Aa
              </span>
              <span className="ui-mind-map-specimen-name">{f.label}</span>
            </div>
          ))}
        </div>
      );
    case "pictures":
      return (
        <div className="ui-mind-map-pictures">
          {finds.slice(0, 4).map((f) => (
            <span key={f.id} className="ui-mind-map-item ui-mind-map-picture">
              <img src={f.value} alt={f.label} />
            </span>
          ))}
        </div>
      );
    case "products": {
      const more = finds.length - TILES;
      return (
        <ul className="ui-mind-map-tiles" aria-label={`${copy.count(finds.length, "product")} Fume found`}>
          {finds.slice(0, more > 1 ? TILES : finds.length).map((f) => (
            <li key={f.id} className="ui-mind-map-item ui-mind-map-tile">
              <span className="ui-mind-map-picture">
                {f.value ? <img src={f.value} alt="" /> : <Icon name="package" />}
              </span>
              <span className="ui-mind-map-tile-name">{f.label}</span>
            </li>
          ))}
          {more > 1 && (
            <li className="ui-mind-map-item ui-mind-map-tile">
              <span className="ui-mind-map-picture ui-mind-map-more">+{more}</span>
              <span className="ui-mind-map-tile-name">more</span>
            </li>
          )}
        </ul>
      );
    }
    case "voice":
      return (
        <>
          <p className="ui-mind-map-item ui-mind-map-quote">“{finds[0].value}”</p>
          <p className="ui-mind-map-item ui-mind-map-quote-note">{finds.map((f) => f.label).join(" ")}</p>
        </>
      );
    default:
      return (
        <ul className="ui-mind-map-list">
          {finds.map((f) => (
            <li key={f.id} className="ui-mind-map-item">
              {id === "audience" ? f.value : f.label}
            </li>
          ))}
        </ul>
      );
  }
}

export function BuildingDna() {
  const scanQuery = useBrandScan();
  const start = useStartBrandScan();
  const board = useBrandBoard();
  const session = useSession().data!;
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const asked = useRef(false);
  const [skip, setSkip] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const scan = scanQuery.data;

  // Opened directly, with nothing being read yet: the demo reads the website.
  useEffect(() => {
    if (scanQuery.isSuccess && scan === null && !asked.current) {
      asked.current = true;
      start.mutate({ source: "website", url: "lysne.no" });
    }
  }, [scanQuery.isSuccess, scan, start]);

  useEffect(() => {
    const t = window.setTimeout(() => setCanSkip(true), SKIP_AFTER);
    return () => window.clearTimeout(t);
  }, []);

  const defs = useMemo(
    () => nodeDefs.filter((d) => scan?.finds.some((f) => f.kind === d.kind)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scan?.id, scan?.finds.length],
  );
  const ids = useMemo(() => defs.map((d) => d.id), [defs]);
  const findsOf = (kind: Kind) => scan?.finds.filter((f) => f.kind === kind) ?? [];
  const sourcesOf = (id: NodeId) => {
    const kind = nodeDefs.find((d) => d.id === id)!.kind;
    return [
      ...new Set(
        findsOf(kind)
          .map((f) => f.sourceId)
          .filter((s): s is string => Boolean(s)),
      ),
    ];
  };
  const labelOf = (sourceId?: string) => scan?.sources.find((s) => s.id === sourceId)?.label;
  const phase = useTimeline(scan, ids, sourcesOf, reduced, skip);

  const identity = board.data?.identity;
  const logo = findsOf("logo")[0];
  const faces = identity ? brandFaces(identity) : undefined;
  const failed = scan?.state === "failed";
  const settled = phase.settled && Boolean(identity);
  const where = scan
    ? [scan.url, scan.files.length ? copy.count(scan.files.length, "upload") : ""].filter(Boolean).join(" and your ")
    : "";
  const readingNow = ids.find((id) => phase.states[id] === "reading");
  const readingSource = readingNow ? sourcesOf(readingNow).map(labelOf)[0] : undefined;
  const status = !scan
    ? "Fume is getting ready"
    : skip
      ? `Fume is finishing ${where || "your material"}`
      : readingNow
        ? `Reading ${readingSource ?? where}`
        : phase.logo
          ? `Reading ${where || "what you gave us"}`
          : `Opening ${scan.url ?? "your material"}`;

  const nodes: MindMapNode[] = defs.map((d) => {
    const finds = findsOf(d.kind);
    const sources = [...new Set(finds.map((f) => labelOf(f.sourceId) ?? f.evidence))];
    return {
      id: d.id,
      title: d.title,
      icon: d.icon,
      place: d.place,
      wide: d.wide,
      state: phase.states[d.id] ?? "waiting",
      reading: `Reading ${sources[0] ?? where}`,
      source: sources.join(", "),
      meta: finds.length > 1 ? String(finds.length) : undefined,
      children: <NodeBody id={d.id} finds={finds} identity={identity} />,
    };
  });

  const done = settled && scan && identity;
  return (
    <StepFrame
      step="scan"
      title="Fume reads it"
      foot={
        failed ? undefined : done ? (
          scan.finds.length ? (
            <Button size="lg" iconEnd="arrow-right" onClick={() => navigate("/welcome/review")}>
              Confirm what Fume found
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link to="/welcome">Upload your guidelines instead</Link>
            </Button>
          )
        ) : canSkip && !skip ? (
          <Button variant="quiet" iconEnd="arrow-right" onClick={() => setSkip(true)}>
            Show me the result
          </Button>
        ) : undefined
      }
      footAlign={done ? "end" : "center"}
    >
      <header className="ui-welcome-head">
        <h1 className="ui-welcome-title">
          {done ? `${session.workspace.brandName}, as Fume read it` : "Fume is reading your brand"}
        </h1>
        <p className="ui-welcome-lede" aria-live="polite">
          {done
            ? scan.finds.length
              ? `${foundLine(scan)} ${toConfirmLine(identity)}`
              : `Fume found nothing it could use on ${scan.url ?? "your website"}.`
            : `Your brand and your products from ${where || "what you gave us"}, one thing at a time.`}
        </p>
      </header>

      {failed ? (
        <Alert variant="error">
          <AlertTitle>{scan?.error ?? `Fume could not read ${scan?.url ?? "your website"}.`}</AlertTitle>
          <AlertDescription>Upload your guidelines instead.</AlertDescription>
          <AlertAction>
            <Button asChild variant="secondary" size="sm">
              <Link to="/welcome">Choose another way in</Link>
            </Button>
          </AlertAction>
        </Alert>
      ) : (
        <div className="ui-scan" data-state={settled ? "done" : "reading"}>
          {!done && (
            <p className="ui-scan-reading">
              <Icon name="fume-engine" />
              {status}
            </p>
          )}
          {scan && (
            <MindMap
              label={`${logo?.value ?? "Your brand"}, as Fume reads it`}
              centerState={phase.logo ? "landed" : "waiting"}
              center={
                <div
                  className="ui-mind-map-logo"
                  style={vars({
                    "--brand-ground": faces?.ground,
                    "--brand-ink": faces?.ink,
                    "--brand-display": faces?.display,
                  })}
                  role="img"
                  aria-label={logo ? `${logo.label}: ${logo.value}` : "Your logo"}
                >
                  {logo?.value ?? ""}
                </div>
              }
              nodes={nodes}
              settled={settled}
            />
          )}
        </div>
      )}
    </StepFrame>
  );
}
