// The edge function `client-link` (handler.ts says what it does). Deployed with verify_jwt off: the client opens the
// link without an account.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { handleLink, type LinkError, type Result } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const keyOf = (json: string, legacy: string) =>
  (Deno.env.get(json) && JSON.parse(Deno.env.get(json)!).default) || Deno.env.get(legacy)!;
const secret = keyOf("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const CODES = ["not_found", "forbidden", "invalid", "conflict"] as const;

/** A database refusal keeps its code (app.fail puts it in the detail); anything else is "unavailable". */
function result<T>(r: { data: T | null; error: { message: string; details?: string | null } | null }): Result<T> {
  if (!r.error) return { data: r.data as T };
  const code = CODES.find((c) => c === r.error!.details);
  if (!code) console.error("client-link", r.error.message);
  return {
    error: (code
      ? { code, message: r.error.message }
      : { code: "unavailable", message: "The link could not be opened just now. Try again in a minute." }) as LinkError,
  };
}

Deno.serve((req) => {
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  return handleLink(req, {
    caller: async () => {
      if (!bearer || !bearer.includes(".")) return null;
      const { data } = await service.auth.getUser(bearer);
      return data.user?.id ?? null;
    },
    view: async (token) => result(await service.rpc("client_link_view", { p_token: token })),
    answer: async (a) =>
      result(
        await service.rpc("client_link_answer", {
          p_token: a.token,
          p_version_id: a.versionId,
          p_verdict: a.verdict,
          p_text: a.text,
          p_name: a.name,
          p_caller: a.caller,
        }),
      ),
    plan: async (a) =>
      result(
        await service.rpc("client_link_plan", {
          p_token: a.token,
          p_verdict: a.verdict,
          p_text: a.text,
          p_name: a.name,
          p_caller: a.caller,
        }),
      ),
    sign: async (paths) => {
      const { data } = await service.storage.from("workspace-files").createSignedUrls(paths, 60 * 60);
      return Object.fromEntries((data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl]] : [])));
    },
  });
});
