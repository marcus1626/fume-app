// The storyboard's data (round 16, PROPOSED 9 Nov 2026): its sections and its notes. The edit's order of shots is
// the truth: a section is a run of shots one after another, so the board and the timeline never disagree. A shot
// moved on the board moves on the timeline, and a shot moved anywhere else keeps its section where it can. An edit
// with no board gets one: the first shot is the hook, the last the end card, the rest the story.
import type { Storyboard, StoryboardNote, StoryboardSection, VideoEdit } from "../../../../contract";

/** The board as it stands with the edit's shots: every shot in one section, in the edit's order. */
export function boardOf(edit: Pick<VideoEdit, "clips" | "board">): Storyboard {
  const ids = edit.clips.map((c) => c.id);
  const saved = edit.board;
  if (!saved?.sections.length) return { sections: defaultSections(ids), notes: saved?.notes ?? [] };
  // Each shot to its section's index; a shot in none follows the one before it. Sections stay runs: a shot never
  // goes back to a section before the one the shot before it is in.
  const home = new Map<string, number>();
  saved.sections.forEach((s, i) => s.clipIds.forEach((id) => home.set(id, i)));
  const runs: string[][] = saved.sections.map(() => []);
  let last = 0;
  for (const id of ids) {
    const i = Math.max(last, home.get(id) ?? last);
    runs[i]!.push(id);
    last = i;
  }
  return {
    sections: saved.sections.map((s, i) => ({ ...s, clipIds: runs[i]! })),
    notes: saved.notes,
  };
}

export function defaultSections(ids: string[]): StoryboardSection[] {
  if (ids.length < 3) return [{ id: "sb-story", name: "Story", clipIds: ids }];
  return [
    { id: "sb-hook", name: "Hook", clipIds: ids.slice(0, 1) },
    { id: "sb-story", name: "Story", clipIds: ids.slice(1, -1) },
    { id: "sb-end", name: "End card", clipIds: ids.slice(-1) },
  ];
}

/** The edit with a board: its shots in the board's order. */
function withBoard(edit: VideoEdit, board: Storyboard): VideoEdit {
  const order = board.sections.flatMap((s) => s.clipIds);
  const byId = new Map(edit.clips.map((c) => [c.id, c]));
  const clips = order.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  // The first shot never fades in from nothing: it starts on a cut.
  return {
    ...edit,
    clips: clips.map((c, i) => (i === 0 && c.transition !== "cut" ? { ...c, transition: "cut" as const } : c)),
    board,
  };
}

/** Move a shot to a place on the board: a section, and the place in it (before the shot at that index). */
export function moveShot(edit: VideoEdit, clipId: string, sectionId: string, index: number): VideoEdit {
  const board = boardOf(edit);
  const sections = board.sections.map((s) => ({ ...s, clipIds: s.clipIds.filter((id) => id !== clipId) }));
  const to = sections.find((s) => s.id === sectionId);
  if (!to) return edit;
  const from = board.sections.find((s) => s.clipIds.includes(clipId));
  // Within its own section, a later place counts without the shot itself.
  const was = from?.id === sectionId ? from.clipIds.indexOf(clipId) : -1;
  const at = Math.min(to.clipIds.length, Math.max(0, was >= 0 && index > was ? index - 1 : index));
  to.clipIds.splice(at, 0, clipId);
  return withBoard(edit, { ...board, sections });
}

/** A shot one place earlier or later on the board, across sections. */
export function nudgeShot(edit: VideoEdit, clipId: string, by: -1 | 1): VideoEdit {
  const board = boardOf(edit);
  const si = board.sections.findIndex((s) => s.clipIds.includes(clipId));
  if (si < 0) return edit;
  const s = board.sections[si]!;
  const i = s.clipIds.indexOf(clipId);
  if (by < 0) {
    if (i > 0) return moveShot(edit, clipId, s.id, i - 1);
    const prev = board.sections[si - 1];
    return prev ? moveShot(edit, clipId, prev.id, prev.clipIds.length) : edit;
  }
  if (i < s.clipIds.length - 1) return moveShot(edit, clipId, s.id, i + 2);
  const next = board.sections[si + 1];
  return next ? moveShot(edit, clipId, next.id, 0) : edit;
}

export function addSection(edit: VideoEdit, id: string): VideoEdit {
  const board = boardOf(edit);
  const name = `Section ${board.sections.length + 1}`;
  return { ...edit, board: { ...board, sections: [...board.sections, { id, name, clipIds: [] }] } };
}

export function renameSection(edit: VideoEdit, id: string, name: string): VideoEdit {
  const board = boardOf(edit);
  return { ...edit, board: { ...board, sections: board.sections.map((s) => (s.id === id ? { ...s, name } : s)) } };
}

/** Take a section out: its shots join the section before it (or after it, for the first). The last one stays. */
export function removeSection(edit: VideoEdit, id: string): VideoEdit {
  const board = boardOf(edit);
  if (board.sections.length < 2) return edit;
  const i = board.sections.findIndex((s) => s.id === id);
  if (i < 0) return edit;
  const gone = board.sections[i]!;
  const sections = board.sections.filter((s) => s.id !== id).map((s) => ({ ...s, clipIds: [...s.clipIds] }));
  const into = sections[Math.max(0, i - 1)]!;
  if (i === 0) into.clipIds.unshift(...gone.clipIds);
  else into.clipIds.push(...gone.clipIds);
  return { ...edit, board: { ...board, sections } };
}

export function addNote(edit: VideoEdit, note: StoryboardNote): VideoEdit {
  const board = boardOf(edit);
  return { ...edit, board: { ...board, notes: [...board.notes, note] } };
}

export function setNote(edit: VideoEdit, id: string, change: Partial<StoryboardNote>): VideoEdit {
  const board = boardOf(edit);
  return { ...edit, board: { ...board, notes: board.notes.map((n) => (n.id === id ? { ...n, ...change } : n)) } };
}

export function removeNote(edit: VideoEdit, id: string): VideoEdit {
  const board = boardOf(edit);
  return { ...edit, board: { ...board, notes: board.notes.filter((n) => n.id !== id) } };
}
