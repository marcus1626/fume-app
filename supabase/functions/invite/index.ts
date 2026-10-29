// The edge function `invite` (supabase/functions/invite/handler.ts says what it does). Deployed with verify_jwt off:
// the handler asks Supabase Auth who the token belongs to, and the database command, called with that token,
// decides who may invite. Only the email is sent with the service role.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { handleInvite } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
// Projects on the new API keys get them as JSON ({ "default": "sb_…" }); older ones as the anon and service role keys.
const keyOf = (json: string, legacy: string) =>
  (Deno.env.get(json) && JSON.parse(Deno.env.get(json)!).default) || Deno.env.get(legacy)!;
const publishable = keyOf("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const secret = keyOf("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve((req) =>
  handleInvite(req, (authorization) => {
    const asCaller = createClient(url, publishable, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      caller: {
        signedIn: async () => {
          const { data } = await asCaller.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
          return Boolean(data.user);
        },
        invite: async (p) => {
          const { data, error } = await asCaller.rpc("invite_member", p);
          return { data, error };
        },
      },
      admin: {
        setMetadata: async (userId, data) => {
          const { error } = await service.auth.admin.updateUserById(userId, { user_metadata: data });
          return { error };
        },
        sendInvite: async (email, data, redirectTo) => {
          const { error } = await service.auth.admin.inviteUserByEmail(email, { data, redirectTo });
          return { error };
        },
      },
    };
  }),
);
