// Keeps a copy of a picture that is only a link to a brand's site (a packshot imported from nike.com) in Fume's
// storage, so the picture check and the fix read it there. Only https, only pictures, at most 20 MB.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";

export async function keepPicture(service: SupabaseClient, link: string, bucket: string, path: string): Promise<boolean> {
  if (!/^https:\/\//.test(link)) return false;
  const got = await fetch(link, { signal: AbortSignal.timeout(20_000), redirect: "follow" });
  const type = got.headers.get("content-type") ?? "";
  if (!got.ok || !type.startsWith("image/")) return false;
  const bytes = new Uint8Array(await got.arrayBuffer());
  if (bytes.byteLength > 20_000_000) return false;
  return !(await service.storage.from(bucket).upload(path, bytes, { contentType: type, upsert: true })).error;
}
