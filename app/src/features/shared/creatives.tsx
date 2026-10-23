// A creative and an Engine run as the screens draw them. Every screen that shows a creative goes through here, so
// the words stay one set (rule check-states): "In check" while the expert works, "Checked by Anna" after, and the
// Amber triangle only on checked work. The customer never sees a creative before it is checked (the mock and the
// backend never send one), so "making" and "in_check" appear only in the studio.
import {
  CheckMark,
  CreativeTile,
  type CheckState,
  type EngineRunState,
  type EngineRunStepData,
  type RunTileData,
  type ViewerItem,
} from "@fume/ui";
import { useNavigate } from "react-router-dom";
import type { Campaign, Creative, EngineRun, User, VersionState } from "../../contract";
import * as copy from "../../copy";
import { time } from "../../lib/time";
import { firstName, useIsMe } from "../../shell/people";

export function checkState(state: VersionState): CheckState {
  switch (state) {
    case "making":
      return "generating";
    case "in_check":
    case "correcting":
    case "held":
      return "in-check";
    case "changes_requested":
      return "changes";
    default:
      return "checked";
  }
}

/** "Feed · 4:5 · V2" */
export const formatLine = (c: Creative) => `${copy.format[c.format].label} · ${copy.format[c.format].ratio}${c.current.number > 1 ? ` · V${c.current.number}` : ""}`;

/** The check line under a creative: who checked it and when, or the state in words. */
export function CreativeCheck({ creative, people, long }: { creative: Creative; people: (id?: string) => User | undefined; long?: boolean }) {
  const v = creative.current;
  const isMe = useIsMe();
  const state = checkState(v.state);
  const by = v.checkedBy ? firstName(people(v.checkedBy)?.name ?? "the expert") : undefined;
  const label =
    v.state === "approved" || v.state === "delivered"
      ? v.approvedBy
        ? isMe(v.approvedBy)
          ? "You approved"
          : copy.approvedBy(firstName(people(v.approvedBy)?.name ?? "Someone"))
        : "Approved"
      : v.state === "changes_requested"
        ? copy.versionState.changes_requested
        : v.state === "held" || v.state === "correcting"
          ? copy.versionState[v.state]
          : undefined;
  return (
    <CheckMark
      state={state}
      by={state === "checked" ? by : undefined}
      time={long && v.checkedAt && state === "checked" && !label ? time(v.checkedAt) : undefined /* round 8 REVIEW (LOAD-10): no clock time on tiles; only the long line keeps it */}
      dateTime={v.checkedAt}
      wording={long ? "long" : "short"}
      label={label}
    />
  );
}

export interface CreativeCardProps {
  creative: Creative;
  people: (id?: string) => User | undefined;
  /** An app route: the tile opens it through the router (CreativeTile's own href would reload the page). */
  to?: string;
  onOpen?: () => void;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
}

/** One creative as a tile: the image in its format, the format line, and the check. */
export function CreativeCard({ creative, people, to, onOpen, selected, onSelectedChange }: CreativeCardProps) {
  const navigate = useNavigate();
  return (
    <CreativeTile
      src={creative.current.image}
      alt={creative.title}
      format={creative.format}
      label={creative.title}
      caption={formatLine(creative)}
      check={<CreativeCheck creative={creative} people={people} />}
      onOpen={onOpen ?? (to ? () => navigate(to) : undefined)}
      selected={selected}
      onSelectedChange={onSelectedChange}
    />
  );
}

/** The creative viewer's item for a creative. */
export function viewerItem(creative: Creative, campaign: Campaign | undefined, people: (id?: string) => User | undefined): ViewerItem {
  const v = creative.current;
  const checked = ["checked", "approved", "delivered", "changes_requested"].includes(v.state);
  return {
    src: v.image,
    alt: creative.title,
    name: creative.name,
    campaign: campaign?.name,
    format: creative.format,
    size: `${v.width} × ${v.height}`,
    check: checked
      ? { state: "checked", by: firstName(people(v.checkedBy)?.name ?? "the expert"), time: v.checkedAt ? time(v.checkedAt) : undefined }
      : { state: "in_check" },
    facts: [
      { label: "Channel", value: copy.channel[creative.channel] },
      { label: "Version", value: `V${v.number}`, data: true },
      { label: "State", value: copy.versionState[v.state] },
    ],
  };
}

const runState: Record<EngineRun["state"], EngineRunState> = { queued: "queued", running: "running", paused: "paused", failed: "failed", done: "done" };

export const runTitle: Record<EngineRun["purpose"], string> = {
  directions: "Making three directions",
  masters: "Making the masters",
  variants: "Making the variants and formats",
  correction: "Making the corrections",
};

/** An Engine run in the run card's terms. The last active step carries the progress and the tiles made so far. */
export function runProps(run: EngineRun): { title: string; state: EngineRunState; steps: EngineRunStepData[] } {
  const active = run.steps.findIndex((s) => s.state === "active");
  // A finished run shows what it made; a running one also the slots still to come.
  const tiles: RunTileData[] = Array.from({ length: run.state === "done" ? Math.min(run.previews.length, 6) : Math.min(run.total, 6) }, (_, i) =>
    i < run.previews.length ? { state: "done", src: run.previews[i] } : i === run.previews.length && run.state === "running" ? { state: "active" } : { state: "pending" },
  );
  // A detail that is only a count ("6 of 9") is the step's own progress, drawn as data beside its label. The
  // creatives go under the step that makes them: the last step not at the Quality Gate, up to the active one.
  const count = (d?: string) => d?.match(/^(\d+) of (\d+)$/);
  const lastMaking = run.steps.reduce((last, s, i) => (!s.label.startsWith("Quality Gate") && (active === -1 || i <= active) ? i : last), -1);
  const making = lastMaking === -1 ? (active === -1 ? run.steps.length - 1 : active) : lastMaking;
  return {
    title: runTitle[run.purpose],
    state: runState[run.state],
    steps: run.steps.map((s, i) => {
      const n = count(s.detail);
      const progress = n
        ? { made: Number(n[1]), total: Number(n[2]), label: s.label }
        : i === making
          ? { made: run.made, total: run.total, label: `${run.made} of ${run.total} made` }
          : undefined;
      return { label: s.label, state: s.state, detail: n ? undefined : s.detail, ...(progress && { progress }), ...(i === making && { tiles }) };
    }),
  };
}
