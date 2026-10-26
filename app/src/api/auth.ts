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
    throw new FumeError("unavailable", "We sent a link to this address just now. Wait a minute, then send another.");
  // The database refuses an address that has no invitation.
  if (/database error/i.test(error.message))
    throw new FumeError(
      "forbidden",
      "This address has no invitation to Fume. Ask the person who works with you at Fume to invite you.",
    );
  throw new FumeError("unavailable", error.message);
}

/** Google sign-in is on once its provider is set up in Supabase Auth (VITE_AUTH_GOOGLE=on). */
export const googleSignIn = import.meta.env.VITE_AUTH_GOOGLE === "on";

/** Signs in with Google; Google brings the person back to the page they are on. */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw new FumeError("unavailable", error.message);
}

/** Why a sign-in that came back to Fume did not go through. */
export type SignInProblem = "not_invited" | "cancelled" | "expired" | "other";

/** A sign-in that came back with an error (from Google or an email link): what went wrong, in Fume's words. Read
 *  once from the address and then cleared from it. */
export function signInProblemFromUrl(): { kind: SignInProblem; title: string; text: string } | null {
  const params = new URLSearchParams(window.location.search + "&" + window.location.hash.slice(1));
  const code = params.get("error_code") ?? params.get("error") ?? "";
  const description = params.get("error_description") ?? "";
  if (!code && !description) return null;
  window.history.replaceState(null, "", window.location.pathname);
  if (/database error/i.test(description))
    return {
      kind: "not_invited",
      title: "This account has no invitation",
      text: "Fume is open to invited people. Sign in with the address your invitation went to, or ask the person who works with you at Fume to invite you.",
    };
  if (code === "access_denied" || /denied|cancel/i.test(description))
    return { kind: "cancelled", title: "Google sign-in was cancelled", text: "Try again, or get a link by email." };
  if (code === "otp_expired" || /expired|invalid/i.test(description))
    return {
      kind: "expired",
      title: "This link no longer works",
      text: "A sign-in link works once, for a short time. Send yourself a new one.",
    };
  return { kind: "other", title: "You were not signed in", text: description || "Try again." };
}

const SIGNED_OUT_KEY = "fume-signed-out";

/** Whether this tab just signed out, so the sign-in screen can say so once. */
export function justSignedOut(): boolean {
  try {
    const was = sessionStorage.getItem(SIGNED_OUT_KEY) === "1";
    sessionStorage.removeItem(SIGNED_OUT_KEY);
    return was;
  } catch {
    return false;
  }
}

export async function signOut(): Promise<void> {
  if (!isLive) return;
  try {
    sessionStorage.setItem(SIGNED_OUT_KEY, "1");
  } catch {
    /* no storage: the sign-in screen just does not say it */
  }
  await supabase().auth.signOut();
}
