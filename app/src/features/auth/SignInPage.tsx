// Sign in (live backend only; the mock picks a demo person instead). Fume is open to invited people only, and there is
// no password: "Continue with Google" leads, an email with a link (and, with VITE_AUTH_CODE=on, a code for another
// device) is the other way. A link from Fume's emails opens /auth/confirm, which signs in only when the person presses
// the button, so a mail scanner cannot use it up; an invitation's link says who invited them to which brand. The look
// is sign-in.css (PROPOSED).
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldError,
  FieldLabel,
  FieldSeparator,
  Icon,
  Input,
  InputOTP,
} from "@fume/ui";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  confirmEmailLink,
  emailLinkFromUrl,
  googleSignIn,
  justSignedOut,
  sendSignInLink,
  signInCode,
  signInProblemFromUrl,
  signInWithCode,
  signInWithGoogle,
  type EmailLink,
  type SignInProblem,
} from "../../api/auth";
import { FumeError } from "../../contract";
import { SignInFrame } from "./frame";

/** How long before the same address can have another link (Supabase sends one a minute). */
const RESEND_AFTER_S = 60;

type Notice = { kind: SignInProblem | "signed_out" | "google"; title: string; text?: string };

// What the screen says on arrival (a sign-in that came back with a problem, or a sign-out) is read once and then
// cleared from the address and the tab, so it is kept here for the renders that follow (React runs a state's first
// value twice in development).
let arrival: Notice | null | undefined;
function noticeOnArrival(): Notice | null {
  if (arrival === undefined)
    arrival = signInProblemFromUrl() ?? (justSignedOut() ? { kind: "signed_out", title: "You are signed out" } : null);
  return arrival;
}

export function SignInPage() {
  const [link, setLink] = useState(emailLinkFromUrl);
  const [failed, setFailed] = useState<Notice | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  return (
    <SignInFrame foot="Fume is open to invited people only.">
      {link ? (
        <ConfirmLink
          link={link}
          onFailed={(notice) => {
            setFailed(notice);
            setLink(null);
          }}
        />
      ) : sentTo ? (
        <CheckEmail address={sentTo} onAnother={() => setSentTo(null)} />
      ) : (
        <SignInForm onSent={setSentTo} given={failed} />
      )}
    </SignInFrame>
  );
}

/** An email's link, opened: one press signs in (or joins the brand an invitation names). */
function ConfirmLink({ link, onFailed }: { link: EmailLink; onFailed: (notice: Notice) => void }) {
  const [busy, setBusy] = useState(false);
  const invite = link.type === "invite";
  const place = link.brand ?? "Fume";
  const press = async () => {
    setBusy(true);
    try {
      await confirmEmailLink(link); // signed in: Fume opens in this screen's place
    } catch {
      window.history.replaceState(null, "", "/");
      onFailed(
        invite
          ? {
              kind: "expired",
              title: "This invitation link no longer works",
              text: "Your invitation is still there. Sign in with the address it went to.",
            }
          : {
              kind: "expired",
              title: "This link no longer works",
              text: "A sign-in link works once, for a short time. Send yourself a new one.",
            },
      );
    }
  };
  return (
    <>
      <header className="ui-signin-head">
        <h1 className="ui-signin-title">{invite ? `Join ${place} on Fume` : "Sign in to Fume"}</h1>
        <p className="ui-signin-lede">
          {invite
            ? `${link.inviter ?? "Someone at Fume"} invited you to work on ${place} in Fume.`
            : "You opened your sign-in link. Press the button to sign in on this device."}
        </p>
      </header>
      <div className="ui-signin-ways">
        <Button type="button" size="lg" loading={busy} onClick={press} data-ui-autofocus="">
          {invite ? `Join ${place}` : "Sign in"}
        </Button>
      </div>
    </>
  );
}

function SignInForm({ onSent, given }: { onSent: (address: string) => void; given?: Notice | null }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(() => given ?? noticeOnArrival());
  // The next time this screen opens (after another sign-out) it reads afresh.
  useEffect(() => {
    arrival = undefined;
  }, []);
  const [sending, setSending] = useState(false);
  const [toGoogle, setToGoogle] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  // A link that no longer works is answered by a new one: the address field is the next step.
  useEffect(() => {
    if (notice?.kind === "expired" || notice?.kind === "cancelled") field.current?.focus();
  }, [notice?.kind]);

  const google = async () => {
    setToGoogle(true);
    setNotice(null);
    setFieldError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setNotice({
        kind: "google",
        title: "Google sign-in did not open",
        text: e instanceof FumeError ? e.message : "Try again, or get a link by email.",
      });
      setToGoogle(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      setFieldError("Enter your work email.");
      field.current?.focus();
      return;
    }
    setSending(true);
    setFieldError(null);
    setNotice(null);
    try {
      await sendSignInLink(email);
      onSent(email.trim());
    } catch (e) {
      setFieldError(e instanceof FumeError ? e.message : "The link could not be sent. Try again.");
      field.current?.focus();
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <header className="ui-signin-head">
        <h1 className="ui-signin-title">Sign in to Fume</h1>
        <p className="ui-signin-lede">Use the account your invitation went to.</p>
      </header>
      {notice && (
        <Alert
          variant={notice.kind === "signed_out" ? "default" : notice.kind === "not_invited" ? "error" : "info"}
          icon={notice.kind === "signed_out" ? "log-out" : undefined}
          onSurface
        >
          <AlertTitle>{notice.title}</AlertTitle>
          {notice.text && <AlertDescription>{notice.text}</AlertDescription>}
        </Alert>
      )}
      <div className="ui-signin-ways">
        {googleSignIn && (
          <>
            <Button type="button" size="lg" loading={toGoogle} onClick={google}>
              {!toGoogle && <GoogleG />}
              Continue with Google
            </Button>
            <FieldSeparator>or</FieldSeparator>
          </>
        )}
        <form className="ui-signin-form" onSubmit={submit} noValidate aria-label="Get a sign-in link by email">
          <Field invalid={Boolean(fieldError)}>
            <FieldLabel htmlFor={id}>Work email</FieldLabel>
            <Input
              ref={field}
              id={id}
              size="lg"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldError(null);
              }}
              aria-invalid={Boolean(fieldError) || undefined}
              data-ui-autofocus={googleSignIn ? undefined : ""}
            />
            <FieldError>{fieldError}</FieldError>
          </Field>
          <Button type="submit" size="lg" variant={googleSignIn ? "secondary" : "primary"} loading={sending}>
            Email me a link
          </Button>
        </form>
      </div>
    </>
  );
}

function CheckEmail({ address, onAnother }: { address: string; onAnother: () => void }) {
  const title = useRef<HTMLHeadingElement>(null);
  const codeId = useId();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const verify = async (value: string) => {
    setVerifying(true);
    setCodeError(null);
    try {
      await signInWithCode(address, value); // signed in: Fume opens in this screen's place
    } catch (e) {
      setCodeError(e instanceof FumeError ? e.message : "That code does not work. Check it, or send a new link.");
      setCode("");
      setVerifying(false);
    }
  };
  const [wait, setWait] = useState(RESEND_AFTER_S);
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => title.current?.focus(), []);
  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  const again = async () => {
    setSending(true);
    setError(null);
    try {
      await sendSignInLink(address);
      setResent(true);
      setWait(RESEND_AFTER_S);
    } catch (e) {
      setError(e instanceof FumeError ? e.message : "The link could not be sent. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="ui-signin-sent-icon" aria-hidden="true">
        <Icon name="mail" />
      </div>
      <header className="ui-signin-head">
        <h1 className="ui-signin-title" ref={title} tabIndex={-1}>
          Check your email
        </h1>
        <p className="ui-signin-lede">
          {resent ? "We sent a new link to " : "We sent a sign-in link to "}
          <strong>{address}</strong>.{" "}
          {signInCode ? "Open it here, or enter the code from it below." : "Open it on this device and you are in."}
        </p>
        <p className="ui-signin-hint">It can take a minute. If it does not come, look in spam.</p>
      </header>
      {error && (
        <Alert variant="error" onSurface>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {signInCode && (
        <Field invalid={Boolean(codeError)}>
          <FieldLabel htmlFor={codeId}>Code from the email</FieldLabel>
          <InputOTP
            id={codeId}
            value={code}
            onChange={(v) => {
              setCode(v);
              setCodeError(null);
            }}
            onComplete={verify}
            invalid={Boolean(codeError)}
            disabled={verifying}
            aria-label="Code from the email"
          />
          <FieldError>{codeError}</FieldError>
        </Field>
      )}
      <div className="ui-signin-again">
        {wait > 0 ? (
          <p className="ui-signin-hint" aria-live="off">
            You can send another link in {wait} s.
          </p>
        ) : (
          <Button type="button" size="lg" variant="secondary" loading={sending} onClick={again}>
            Send another link
          </Button>
        )}
        <Button type="button" variant="link" icon="arrow-left" onClick={onAnother}>
          Use another email
        </Button>
      </div>
    </>
  );
}

/** Google's "G", in Google's own colours, as its sign-in guidelines ask on a dark button. */
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
