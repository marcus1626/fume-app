// The Video studio's small helpers (FLOWS §27): what is selected on the timeline, the grade's look on the player, a
// shot's state in words, and the edit with the Engine's checks worked out again after a change of hers.
import { editChecks, pickedTake } from "../../../../domain/video";
import type { MotionTemplate, VideoClip, VideoEdit } from "../../../../contract";

/** One thing picked on the timeline; nothing picked shows the edit's own settings. */
export interface Selection {
  kind: "shot" | "motion" | "caption" | "sound";
  id: string;
}

/** The edit after a change of hers: the checks follow at once, so the panel never shows a stale flag. */
export const checked = (edit: VideoEdit): VideoEdit => ({ ...edit, checks: editChecks(edit) });

/** The grade's name to the player's look (data-grade). */
export function gradeLook(grade: string): "warm" | "evening" | undefined {
  const g = grade.toLowerCase();
  if (g.includes("warm")) return "warm";
  if (g.includes("evening")) return "evening";
  return undefined;
}

/** "9:16" as a number for the frame. */
export const ratioOf = (r: string) => {
  const [w, h] = r.split(":").map(Number);
  return w && h ? w / h : 9 / 16;
};

/** A new id for something she adds on the desk (the backend keeps it). */
export const localId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Where a shot comes from, and its state, in a few words: "Engine · Kling 3.0 · 3.2 s". */
export function shotLine(clip: VideoClip, staff = true): string {
  const take = pickedTake(clip);
  const making = clip.takes.some((t) => t.state === "making");
  const seconds = `${((clip.out - clip.in) / (clip.speed || 1)).toFixed(1)} s`;
  if (!take) return making ? "The Engine is making it" : "No take yet";
  if (clip.source === "library") return `Footage · ${seconds}`;
  return [staff ? take.model : "Engine", `take ${take.number}`, seconds].join(" · ");
}

/** The open findings on the part of the picked take the edit uses. */
export const openFindings = (clip: VideoClip) =>
  (pickedTake(clip)?.findings ?? []).filter((f) => f.state === "open" && f.to > clip.in && f.from < clip.out);

/** The brand's motion: what each template is for, and the words it starts with. */
export const MOTION: Record<MotionTemplate, { name: string; line: string; start: string; seconds: number }> = {
  title: { name: "Title", line: "The film’s name, large, soft to sharp", start: "Night ritual", seconds: 2.5 },
  line: { name: "Line", line: "One line in the brand’s voice", start: "Kept for the night", seconds: 2 },
  product: {
    name: "Product line",
    line: "The product as its label sets it",
    start: "Night Body Oil · 100 ml",
    seconds: 2.2,
  },
  offer: { name: "Offer", line: "A price or an offer, when the plan has one", start: "New this autumn", seconds: 2 },
  end: { name: "End card", line: "The brand’s mark, last", start: "LYSNE", seconds: 1.6 },
};

/** A waveform for a sound cue, drawn from its name so it stays the same (the backend sends the real one later). */
export function wavePath(name: string, bars = 64): string {
  let seed = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) % 1000) / 1000;
  const w = 200 / bars;
  let d = "";
  for (let i = 0; i < bars; i++) {
    const swell = 0.35 + 0.45 * Math.sin((i / bars) * Math.PI);
    const h = Math.max(1.2, (swell * 0.6 + rand() * 0.4) * 18);
    const x = i * w + w * 0.3;
    d += `M${x.toFixed(2)} ${(10 - h / 2).toFixed(2)}h${(w * 0.4).toFixed(2)}v${h.toFixed(2)}h-${(w * 0.4).toFixed(2)}z`;
  }
  return d;
}

/** Her copy of the edit with what the backend owns laid over it: the takes (they become ready while she works), the
 *  Engine's asks and the other formats' progress. Undo and redo move her cut, never those. */
export function withServer(mine: VideoEdit, server: VideoEdit | undefined): VideoEdit {
  if (!server) return mine;
  const clips = new Map(server.clips.map((c) => [c.id, c]));
  const formats = new Map(server.formats.map((f) => [f.id, f.state]));
  return checked({
    ...mine,
    clips: mine.clips.map((c) => {
      const s = clips.get(c.id);
      return s ? { ...c, takes: s.takes, pickedTakeId: c.pickedTakeId ?? s.pickedTakeId } : c;
    }),
    formats: mine.formats.map((f) => {
      const s = formats.get(f.id);
      return f.id === mine.formatId || !s || s === "this" ? f : { ...f, state: s };
    }),
    edits: server.edits,
  });
}
