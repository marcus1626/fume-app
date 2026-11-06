// Fume learns the brand's taste from its pictures (the edge function taste-learn): after the Brand DNA is read, a
// picture is kept or removed, creatives are approved or asked to change. It runs in the background; nothing waits on
// it, and a failure only means the next time tries again. The app's own pictures (a relative address, behind the
// preview's password) are fetched here and sent along, made small.
import type { FumeApi, Reference, TasteCard, TastePair, TasteState } from "../../contract";
import type { Live } from "./context";
import { fileUrls, uploadFile } from "./map";
import { command, rows, supabase } from "./supabase";

const running = new Set<string>();
const last = new Map<string, number>();

export function learnTaste(workspaceId: string, now = false): void {
  if (running.has(workspaceId)) return;
  if (!now && Date.now() - (last.get(workspaceId) ?? 0) < 10 * 60_000) return;
  running.add(workspaceId);
  last.set(workspaceId, Date.now());
  void run(workspaceId)
    .catch(() => last.delete(workspaceId))
    .finally(() => running.delete(workspaceId));
}

async function run(workspaceId: string): Promise<void> {
  const site = window.location.origin;
  const first = await invoke({ workspaceId, site });
  if (!first.send?.length) return;
  const pictures: Record<string, string> = {};
  for (const url of first.send) {
    const small = await shrink(url).catch(() => null);
    if (small) pictures[url] = small;
  }
  if (Object.keys(pictures).length) await invoke({ workspaceId, site, pictures });
}

async function invoke(body: Record<string, unknown>): Promise<{ send?: string[] }> {
  const { data, error } = await supabase().functions.invoke<{ send?: string[] }>("taste-learn", { body });
  if (error) throw error;
  return data ?? {};
}

/** The picture at most 512 px on its long side, as base64 JPEG. */
async function shrink(url: string): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const bitmap = await createImageBitmap(await res.blob());
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.9).split(",")[1] ?? null;
}

// ─── Taste swipes (FLOWS §14) ───────────────────────────────────────────────
// The deck is the database's (public.taste_deck): two of the brand's own pictures that differ most on what Fume is
// least sure of, or one picture it only proposed. The first pairs are the onboarding's taste pairs; the rest are the
// Taste tab's training cards. Every answer goes to public.answer_taste_card.

interface CardRow {
  id: string;
  kind: "pair" | "single";
  area: TasteCard["area"];
  question: string;
  a?: string;
  aFile?: string;
  b?: string;
  bFile?: string;
  answer?: "a" | "b" | "yes" | "no" | "neither";
  reason?: string;
}
interface DeckRow {
  cards: CardRow[];
  answered: CardRow[];
  state: TasteState;
}
const PAIRS = 4;

export async function readDeck(workspaceId: string) {
  const deck = await command<DeckRow>("taste_deck", { p_workspace_id: workspaceId });
  const all = [...deck.cards, ...deck.answered];
  const files = await fileUrls(all.flatMap((c) => [c.aFile, c.bFile]));
  const pic = (url?: string, file?: string) => (file ? (files.get(file)?.url ?? "") : (url ?? ""));
  const byAge = [...deck.answered].reverse();
  // The onboarding's pairs: the first ones made, answered or not, so an answer shows when she comes back.
  const pairs: TastePair[] = [...byAge, ...deck.cards]
    .filter((c) => c.kind === "pair")
    .slice(0, PAIRS)
    .map((c) => ({
      id: c.id,
      a: pic(c.a, c.aFile),
      b: pic(c.b, c.bFile),
      question: c.question,
      ...(c.answer === "a" || c.answer === "b" ? { chosen: c.answer } : {}),
      ...(c.answer === "neither" ? { neither: true } : {}),
      ...(c.reason ? { reason: c.reason } : {}),
    }));
  const inPairs = new Set(pairs.map((p) => p.id));
  const cards: TasteCard[] = deck.cards
    .filter((c) => !inPairs.has(c.id))
    .map((c) => ({
      id: c.id,
      kind: c.kind,
      area: c.area,
      question: c.question,
      a: pic(c.a, c.aFile),
      ...(c.kind === "pair" ? { b: pic(c.b, c.bFile) } : {}),
    }));
  return { pairs, cards, state: deck.state };
}

/** "This is us" and "Not us": the pictures she added, newest first. */
export async function readReferences(workspaceId: string): Promise<Reference[]> {
  const list = await rows<{
    id: string;
    verdict: "liked" | "disliked";
    reason: string | null;
    image_url: string | null;
    file_id: string | null;
    created_by: string | null;
  }>(
    supabase()
      .from("taste_signals")
      .select("id, verdict, reason, image_url, file_id, created_by")
      .eq("workspace_id", workspaceId)
      .eq("origin", "reference")
      .order("created_at", { ascending: false }),
  );
  const files = await fileUrls(list.map((r) => r.file_id));
  return list.map((r) => ({
    id: r.id,
    image: r.file_id ? (files.get(r.file_id)?.url ?? "") : (r.image_url ?? ""),
    verdict: r.verdict,
    ...(r.reason ? { note: r.reason } : {}),
    addedBy: r.created_by ?? "",
  }));
}

type TasteCalls = "tasteTraining" | "answerTaste" | "chooseTastePair" | "passTastePair" | "addReference";

export function tasteCalls(live: Live): Pick<FumeApi, TasteCalls> {
  const answer = async (cardId: string, a: string, reason?: string) => {
    const r = await command<{ card: CardRow; state: TasteState }>("answer_taste_card", {
      p_card_id: cardId,
      p_answer: a,
      p_reason: reason ?? null,
    });
    learnTaste(await live.workspaceId(), true);
    return r;
  };
  return {
    async tasteTraining() {
      const { cards, state } = await readDeck(await live.workspaceId());
      return { cards, state };
    },
    async answerTaste({ cardId, answer: a, reason }) {
      const r = await answer(cardId, a, reason);
      const { aFile, bFile, a: _a, b: _b, answer: _x, reason: _r, ...card } = r.card;
      const files = await fileUrls([aFile, bFile]);
      return {
        card: {
          ...card,
          a: aFile ? (files.get(aFile)?.url ?? "") : (r.card.a ?? ""),
          ...(card.kind === "pair" ? { b: bFile ? (files.get(bFile)?.url ?? "") : (r.card.b ?? "") } : {}),
        },
        state: r.state,
      };
    },
    async chooseTastePair(pairId, chosen, reason) {
      await answer(pairId, chosen, reason);
      const { pairs } = await readDeck(await live.workspaceId());
      return pairs.find((p) => p.id === pairId) ?? { id: pairId, a: "", b: "", question: "", chosen };
    },
    // A picture from her computer (the panel hands a blob: address) is stored first; one from the web is kept by address.
    async addReference({ image, verdict, note }) {
      const ws = await live.workspaceId();
      let fileId: string | null = null;
      if (!/^https:\/\//.test(image)) {
        const blob = await (await fetch(image)).blob();
        const name = `reference.${(blob.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg")}`;
        fileId = await uploadFile(ws, blob, { name, purpose: "source" });
      }
      const r = await command<{ id: string }>("add_taste_reference", {
        p_workspace_id: ws,
        p_liked: verdict === "liked",
        p_file_id: fileId,
        p_image_url: fileId ? null : image,
        p_note: note ?? null,
      });
      learnTaste(ws, true);
      return (await readReferences(ws)).find((x) => x.id === r.id)!;
    },
    async passTastePair({ pairId, cardId, reason }) {
      await answer((pairId ?? cardId)!, "neither", reason);
    },
  };
}
