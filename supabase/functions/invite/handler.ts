// Inviting someone to a brand (Settings › Team › Invite someone). The database decides first: public.invite_member,
// called as the person inviting, checks who may invite whom and keeps the invitation
// (supabase/migrations/20261027180000_invite_member.sql). Then this sends the invitation email with the service
// role, so the email names who invited and the brand (supabase/templates/invite.html). Someone who already uses Fume
// gets no email: the brand is in their list the next time they open Fume.
// The handler takes its clients from outside, so handler.test.ts runs it without Supabase.

export interface InviteBody {
  workspaceId?: string;
  email?: string;
  role?: string;
  /** The address of the app the person invites from; the email's button leads there (must be allowed in Auth). */
  site?: string;
}

/** What public.invite_member answers. */
export interface InviteResult {
  invitation: { id: string; email: string; role: string; state: string; created_at: string; invited_by: string };
  account: "new" | "invited" | "active";
  user_id: string | null;
  brand_name: string;
  inviter_name: string | null;
}

type Failure = { message: string; details?: string | null } | null;

/** The parts of the Supabase clients the handler uses. */
export interface Clients {
  /** As the person inviting (their own token): reads who they are and calls the command. */
  caller: {
    signedIn(): Promise<boolean>;
    invite(p: { p_workspace_id: string; p_email: string; p_role: string }): Promise<{
      data: InviteResult | null;
      error: Failure;
    }>;
  };
  /** With the service role: only sends the email. */
  admin: {
    setMetadata(userId: string, data: Record<string, unknown>): Promise<{ error: Failure }>;
    sendInvite(email: string, data: Record<string, unknown>, redirectTo?: string): Promise<{ error: Failure }>;
  };
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const STATUS: Record<string, number> = { invalid: 400, forbidden: 403, not_found: 404, conflict: 409 };

function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function refuse(code: string, message: string): Response {
  return answer(STATUS[code] ?? 503, { code: code in STATUS ? code : "unavailable", message });
}

/** Only a web address (the app's) may be where the email's button leads; Supabase Auth also checks its allow list. */
function siteOf(site: string | undefined): string | undefined {
  if (!site) return undefined;
  try {
    const url = new URL(site);
    return url.protocol === "https:" || url.hostname === "localhost" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

export async function handleInvite(req: Request, clients: (authorization: string) => Clients): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return refuse("invalid", "Send the invitation with POST.");
  const authorization = req.headers.get("Authorization");
  if (!authorization) return refuse("forbidden", "Sign in first.");

  let body: InviteBody;
  try {
    body = await req.json();
  } catch {
    return refuse("invalid", "The invitation could not be read.");
  }
  if (!body.workspaceId || !body.email || !body.role) return refuse("invalid", "Write the address and choose a role.");

  const { caller, admin } = clients(authorization);
  if (!(await caller.signedIn())) return refuse("forbidden", "Sign in first.");

  const { data, error } = await caller.invite({
    p_workspace_id: body.workspaceId,
    p_email: body.email,
    p_role: body.role,
  });
  if (error || !data) return refuse(error?.details ?? "unavailable", error?.message ?? "The invitation was not saved.");
  if (data.account === "active") return answer(200, { ...data, emailed: false });

  // The email's words come from the person's metadata: an account made by an earlier invitation gets this one's.
  const words = { inviter_name: data.inviter_name ?? "Someone at Fume", brand_name: data.brand_name };
  if (data.account === "invited" && data.user_id) {
    const { error: kept } = await admin.setMetadata(data.user_id, words);
    if (kept) return refuse("unavailable", "The invitation is saved, but the email did not go out. Try again.");
  }
  const { error: sent } = await admin.sendInvite(data.invitation.email, words, siteOf(body.site));
  if (sent) {
    return refuse("unavailable", "The invitation is saved, but the email did not go out. Try again in a moment.");
  }
  return answer(200, { ...data, emailed: true });
}
