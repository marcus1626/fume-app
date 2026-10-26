// Sign in (live backend only): one field for the email address, then "Check your email". No passwords; the link in the
// email signs the person in and brings them back here. It borrows the first run's frame (brand-scan.css); the screen's own
// design is still to come.
import { Button, Field, FieldError, FieldLabel, Input } from "@fume/ui";
import { useId, useState, type FormEvent } from "react";
import { googleSignIn, sendSignInLink, signInErrorFromUrl, signInWithGoogle } from "../../api/auth";
import { FumeError } from "../../contract";
import { Lockup } from "../../shell/Logo";

export function SignInPage() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() => signInErrorFromUrl());
  const [sending, setSending] = useState(false);
  const [toGoogle, setToGoogle] = useState(false);

  const google = async () => {
    setToGoogle(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof FumeError ? e.message : "Google sign-in did not open. Try again.");
      setToGoogle(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await sendSignInLink(email);
      setSentTo(email.trim());
    } catch (e) {
      setError(e instanceof FumeError ? e.message : "The link could not be sent. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ui-welcome">
      <header className="ui-nav">
        <div className="ui-nav-bar">
          <span className="ui-nav-brand">
            <Lockup />
          </span>
        </div>
      </header>
      <main id="main" className="ui-app-page">
        <div className="ui-welcome-screen">
          <header className="ui-welcome-head">
            <h1 className="ui-welcome-title">{sentTo ? "Check your email" : "Sign in to Fume"}</h1>
            <p className="ui-welcome-lede">
              {sentTo
                ? `We sent a sign-in link to ${sentTo}. Open it on this device and you are in.`
                : googleSignIn
                  ? "Continue with Google, or get a link by email. There is no password."
                  : "We email you a link to sign in. There is no password."}
            </p>
          </header>
          {sentTo ? (
            <div className="ui-welcome-go">
              <Button variant="secondary" onClick={() => setSentTo(null)}>
                Use another address
              </Button>
            </div>
          ) : (
            <form className="ui-welcome-form" onSubmit={submit} noValidate aria-label="Sign in">
              {googleSignIn && (
                <div className="ui-welcome-go">
                  <Button type="button" size="lg" variant="secondary" loading={toGoogle} onClick={google}>
                    Continue with Google
                  </Button>
                </div>
              )}
              <div className="ui-welcome-way">
                <Field invalid={Boolean(error)}>
                  <FieldLabel htmlFor={id}>Your work email</FieldLabel>
                  <Input
                    id={id}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(error) || undefined}
                    data-ui-autofocus=""
                  />
                  <FieldError>{error}</FieldError>
                </Field>
                <div className="ui-welcome-go">
                  <Button type="submit" size="lg" loading={sending} disabled={!email.trim()}>
                    Send me a link
                  </Button>
                  <p className="ui-welcome-note">Fume is open to invited people only.</p>
                </div>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
