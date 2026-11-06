// The client link (20261103140000_agency.sql): what an agency sent its client, opened without an account, and the
// client's answer to it. The token is the key; the service role reads what was sent in it and signs its pictures, and
// writes the answer as the client. The agency's own people open it signed in, as a preview: the database refuses
// their answer. handler.test.ts runs it without Supabase.

export interface LinkError {
  code: "not_found" | "forbidden" | "invalid" | "conflict" | "unavailable";
  message: string;
}
export type Result<T> = { data: T } | { error: LinkError };

interface FileRow {
  id: string;
  path: string;
}
export interface LinkView {
  creatives: { creative_versions: { files: FileRow | null }[] }[];
  [key: string]: unknown;
}

export interface Deps {
  /** The signed-in person behind the request, or null for the client without an account. */
  caller(): Promise<string | null>;
  view(token: string): Promise<Result<LinkView>>;
  answer(input: {
    token: string;
    versionId: string;
    verdict: string;
    text: string | null;
    name: string;
    caller: string | null;
  }): Promise<Result<unknown>>;
  plan(input: {
    token: string;
    verdict: string;
    text: string | null;
    name: string;
    caller: string | null;
  }): Promise<Result<unknown>>;
  /** Signed addresses for the files, by path. */
  sign(paths: string[]): Promise<Record<string, string>>;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const STATUS: Record<LinkError["code"], number> = {
  not_found: 404,
  forbidden: 403,
  invalid: 400,
  conflict: 409,
  unavailable: 503,
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (e: LinkError) => reply(STATUS[e.code] ?? 400, e);
const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function handleLink(req: Request, deps: Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail({ code: "invalid", message: "Use POST." });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) ?? {};
  } catch {
    return fail({ code: "invalid", message: "The request could not be read." });
  }
  const token = str(body.token);
  if (!/^[a-z0-9]{20,80}$/i.test(token))
    return fail({ code: "not_found", message: "This client link has expired or was never made." });

  if (body.action === "view") {
    const found = await deps.view(token);
    if ("error" in found) return fail(found.error);
    const files = found.data.creatives.flatMap((c) => c.creative_versions.flatMap((v) => (v.files ? [v.files] : [])));
    const signed = files.length ? await deps.sign([...new Set(files.map((f) => f.path))]) : {};
    const urls: Record<string, string> = {};
    for (const f of files) if (signed[f.path]) urls[f.id] = signed[f.path]!;
    return reply(200, { view: found.data, urls });
  }

  const verdict = str(body.verdict);
  const text = str(body.text).trim() || null;
  const name = str(body.name).trim().slice(0, 120);
  const caller = await deps.caller();
  if (body.action === "answer") {
    const versionId = str(body.versionId);
    if (!versionId) return fail({ code: "invalid", message: "Name the creative." });
    const done = await deps.answer({ token, versionId, verdict, text, name, caller });
    return "error" in done ? fail(done.error) : reply(200, { version: done.data });
  }
  if (body.action === "plan") {
    const done = await deps.plan({ token, verdict, text, name, caller });
    return "error" in done ? fail(done.error) : reply(200, { plan: done.data });
  }
  return fail({ code: "invalid", message: "Open the link, or answer it." });
}
