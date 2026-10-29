// The invite handler without Supabase: deno test supabase/functions/invite/
import { assertEquals } from "jsr:@std/assert@1";
import { type Clients, handleInvite, type InviteResult } from "./handler.ts";

const invitation = {
  id: "i1",
  email: "ane@lysne.test",
  role: "member",
  state: "sent",
  created_at: "2026-10-27T12:00:00Z",
  invited_by: "u1",
};

function fake(result: Partial<InviteResult> | { error: string; message: string }, signedIn = true) {
  const calls: string[] = [];
  const clients = (): Clients => ({
    caller: {
      signedIn: async () => signedIn,
      invite: async () => {
        calls.push("invite_member");
        if ("error" in result) return { data: null, error: { message: result.message, details: result.error } };
        return {
          data: { invitation, account: "new", user_id: null, brand_name: "LYSNE", inviter_name: "Maja Lind", ...result },
          error: null,
        };
      },
    },
    admin: {
      setMetadata: async (id, data) => {
        calls.push(`metadata ${id} ${JSON.stringify(data)}`);
        return { error: null };
      },
      sendInvite: async (email, data, to) => {
        calls.push(`email ${email} ${JSON.stringify(data)} ${to}`);
        return { error: null };
      },
    },
  });
  return { calls, clients };
}

const post = (body: unknown, auth = "Bearer t") =>
  new Request("https://x.test/functions/v1/invite", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
    body: JSON.stringify(body),
  });
const body = { workspaceId: "w1", email: "ane@lysne.test", role: "member", site: "https://fume-app.vercel.app/settings" };

Deno.test("a new address gets the invitation email, naming who invited and the brand", async () => {
  const { calls, clients } = fake({});
  const res = await handleInvite(post(body), clients);
  assertEquals(res.status, 200);
  assertEquals((await res.json()).emailed, true);
  assertEquals(calls, [
    "invite_member",
    'email ane@lysne.test {"inviter_name":"Maja Lind","brand_name":"LYSNE"} https://fume-app.vercel.app',
  ]);
});

Deno.test("someone who already uses Fume gets no email", async () => {
  const { calls, clients } = fake({ account: "active", user_id: "u2" });
  const res = await handleInvite(post(body), clients);
  assertEquals((await res.json()).emailed, false);
  assertEquals(calls, ["invite_member"]);
});

Deno.test("an account that never signed in gets this invitation's words, then the email again", async () => {
  const { calls, clients } = fake({ account: "invited", user_id: "u3" });
  await handleInvite(post(body), clients);
  assertEquals(calls[1], 'metadata u3 {"inviter_name":"Maja Lind","brand_name":"LYSNE"}');
  assertEquals(calls[2].startsWith("email ane@lysne.test"), true);
});

Deno.test("what the database refuses comes back with its code, and no email goes", async () => {
  const { calls, clients } = fake({ error: "forbidden", message: "Only the brand's owner invites people." });
  const res = await handleInvite(post(body), clients);
  assertEquals(res.status, 403);
  assertEquals(await res.json(), { code: "forbidden", message: "Only the brand's owner invites people." });
  assertEquals(calls, ["invite_member"]);
});

Deno.test("nobody invites without signing in", async () => {
  const { calls, clients } = fake({});
  assertEquals((await handleInvite(post(body, ""), clients)).status, 403);
  assertEquals((await handleInvite(post(body), fake({}, false).clients)).status, 403);
  assertEquals(calls, []);
});

Deno.test("the button leads only to a web address", async () => {
  const { calls, clients } = fake({});
  await handleInvite(post({ ...body, site: "javascript:alert(1)" }), clients);
  assertEquals(calls[1].endsWith(" undefined"), true);
});
