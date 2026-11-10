// Fume reads a brand from its website (FLOWS §7 step 3): the home page and a couple of pages it links to, with their
// stylesheets, read by read.ts into proposals. The caller's own token saves them (save_brand_scan decides who may),
// so the people who run the brand and its owner or approver can start it. handler.test.ts runs it without the web.
import { publicUrl } from "../_shared/net.ts";
import { brandName, inlineCss, morePages, type Page, type Read, readBrand, stylesheets } from "./read.ts";

export interface Deps {
  /** A page or stylesheet, or null when it cannot be fetched. */
  fetchText(url: string): Promise<{ url: string; text: string } | null>;
  /** save_brand_scan as the caller. */
  save(input: Record<string, unknown>): Promise<{ data?: unknown; error?: { code: string; message: string } }>;
  /** The brand read from pictures its people added (file ids in its folder), when its website will not open. */
  readPictures?(workspaceId: string, fileIds: string[], brand: string): Promise<{ read: Read; names: string[] } | { error: string }>;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const STATUS: Record<string, number> = { not_found: 404, forbidden: 403, invalid: 400, conflict: 409 };
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export function siteUrl(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return publicUrl(u.href)?.href;
  } catch {
    return undefined;
  }
}
const label = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

export async function handleScan(req: Request, authorized: boolean, deps: Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(400, { code: "invalid", message: "Use POST." });
  if (!authorized) return reply(403, { code: "forbidden", message: "Sign in first." });
  let body: { workspaceId?: string; url?: string; brand?: string; files?: string[] };
  try {
    body = await req.json();
  } catch {
    return reply(400, { code: "invalid", message: "The request could not be read." });
  }
  const url = siteUrl(body.url ?? "");
  if (!body.workspaceId) return reply(400, { code: "invalid", message: "Name the brand." });
  if (!url) return reply(400, { code: "invalid", message: "Write the brand's website, like halm.no." });

  const save = async (input: Record<string, unknown>) => {
    const r = await deps.save({ p_workspace_id: body.workspaceId, p_url: url, p_source: "website", ...input });
    return r.error ? reply(STATUS[r.error.code] ?? 503, r.error) : reply(200, { scan: r.data });
  };

  const first = await deps.fetchText(url);
  if (!first || !/<html|<body|<head/i.test(first.text)) {
    // A site that keeps readers out is read from the pictures the brand's people added instead.
    const files = (Array.isArray(body.files) ? body.files : []).filter((f) => typeof f === "string" && UUID.test(f)).slice(0, 12);
    if (files.length && deps.readPictures) {
      const brand = (body.brand ?? "").trim() || label(url);
      const got = await deps.readPictures(body.workspaceId, files, brand);
      if ("read" in got) {
        const sources = got.names.map((n, i) => ({ id: `f${i}`, label: n, kind: "file", state: "read" }));
        return save({ p_identity: got.read, p_sources: sources, p_finds: findsOf(got.read, "f0"), p_source: "upload", p_files: files });
      }
      return save({ p_identity: {}, p_error: `Fume could not open ${label(url)}, nor read the brand's pictures: ${got.error}`, p_source: "upload", p_files: files });
    }
    return save({
      p_identity: {},
      p_error: `Fume could not open ${label(url)}. Check the address, or add the brand's own ads and pictures and read them instead.`,
    });
  }
  const home: Page = { url: first.url, html: first.text, css: inlineCss(first.text) };
  const others = (await Promise.all(morePages(home).map((u) => deps.fetchText(u)))).flatMap((p) =>
    p && /<html|<body/i.test(p.text) ? [{ url: p.url, html: p.text, css: inlineCss(p.text) }] : [],
  );
  const sheets = await Promise.all(stylesheets(home).map((u) => deps.fetchText(u)));
  home.css += "\n" + sheets.map((s) => s?.text ?? "").join("\n");

  const pages = [home, ...others];
  const brand = (body.brand ?? "").trim() || brandName(home, label(url));
  const read = readBrand(pages, brand);
  const sources = pages.map((p, i) => ({ id: `p${i}`, label: label(p.url), kind: "page", state: "read" }));
  return save({ p_identity: read, p_sources: sources, p_finds: findsOf(read, "p0") });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What was read as the finds the review shows, each from its source. */
export function findsOf(read: Read, sourceId: string) {
  return [
    ...read.logos.map((x, i) => ({
      id: `f-logo-${i}`,
      kind: "logo",
      label: x.name,
      value: x.wordmark,
      provenance: x.provenance,
    })),
    ...read.colours.map((x, i) => ({
      id: `f-colour-${i}`,
      kind: "colour",
      label: x.name,
      value: x.hex,
      provenance: x.provenance,
    })),
    ...read.typefaces.map((x, i) => ({
      id: `f-type-${i}`,
      kind: "typeface",
      label: x.name,
      value: x.sample,
      provenance: x.provenance,
    })),
    ...read.voice.map((x, i) => ({
      id: `f-voice-${i}`,
      kind: "voice",
      label: x.statement,
      value: x.example,
      provenance: x.provenance,
    })),
    ...read.imagery.map((x, i) => ({
      id: `f-image-${i}`,
      kind: "image",
      label: x.caption,
      value: x.image,
      provenance: x.provenance,
    })),
  ].map(({ provenance, ...f }) => ({
    ...f,
    sourceId,
    evidence: provenance.evidence,
    confidence: provenance.confidence,
    origin: "engine",
  }));
}
