// Sign-in for the live backend: an email link (Supabase Auth, no passwords). Only invited people get in: the database
// refuses an account for an address no one invited. The mock has no sign-in; it picks a demo person instead.
import { useEffect, useState } from "react";
import { FumeError } from "../contract";
import { isLive, supabase } from "./live/supabase";

export type AuthState = "checking" | "signed_out" | "signed_in";

/** Whether someone is signed in, kept current as they sign in or out (also from another tab). */
export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>(isLive ? "checking" : "signed_in");
  useEffect(() => {
    if (!isLive) return;
    const auth = supabase().auth;
    auth.getSession().then(({ data }) => setState(data.session ? "signed_in" : "signed_out"));
    const { data } = auth.onAuthStateChange((_event, session) => setState(session ? "signed_in" : "signed_out"));
    return () => data.subscription.unsubscribe();
  }, []);
  return state;
}

/** Sends the sign-in link to this address; the link brings the person back to the page they are on. */
export async function sendSignInLink(email: string): Promise<void> {
  const address = email.trim();
  if (!/^\S+@\S+\.\S+$/.test(address)) throw new FumeError("invalid", "That email address doesn’t look right.");
  const { error } = await supabase().auth.signInWithOtp({
    email: address,
    options: { emailRedirectTo: window.location.origin + window.location.pathname, shouldCreateUser: true },
  });
  if (!error) return;
  if (error.status === 429)
    throw new FumeError("unavailable", "Too many links were sent just now. Try again in a while.");
  // The database refuses an address that has no invitation.
  if (/database error/i.test(error.message))
    throw new FumeError("forbidden", "This address has no invitation to Fume. Ask the person who works with you.");
  throw new FumeError("unavailable", error.message);
}

export async function signOut(): Promise<void> {
  if (isLive) await supabase().auth.signOut();
}
