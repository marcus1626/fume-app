// Fume learns the brand's taste from its pictures (the edge function taste-learn): after the Brand DNA is read, a
// picture is kept or removed, creatives are approved or asked to change. It runs in the background; nothing waits on
// it, and a failure only means the next time tries again. The app's own pictures (a relative address, behind the
// preview's password) are fetched here and sent along, made small.
import { supabase } from "./supabase";

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
