// "About you" (/hello): the first screen after a person's first sign-in, before anything else in Fume, for customers,
// Fume's people and agencies alike (shell/Root sends them here until they have said who they are). Two fields: the
// name and the job title, which sign what the person decides in Fume (F-D040). Both start from the invitation or the
// Google account; an address is never offered as a name. Then on: a customer's new brand opens its onboarding, everyone
// else their Home. The look is sign-in.css (PROPOSED).
import {
  Avatar,
  AvatarFallback,
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Icon,
  Input,
  useToast,
} from "@fume/ui";
import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "../../api/auth";
import { useSession, useUpdateProfile } from "../../api/hooks";
import { isLive } from "../../api/live/supabase";
import type { Session } from "../../contract";
import { initials } from "../../shell/people";
import { SignInFrame } from "./frame";

/** The name to offer: what the invitation or Google gave, never the part of the address before the @. */
function offeredName(session: Session): string {
  const { name, email } = session.user;
  const local = email.split("@")[0] ?? "";
  return name.trim().toLowerCase() === local.toLowerCase() ? "" : name;
}

/** What the name and title sign, said for each kind of person. */
function signs(session: Session): string {
  if (session.user.staffRole || session.user.agency) return "Your name and title sign the work you do in Fume.";
  return "Your name and title go with every brief you send and every creative you approve.";
}

export function AboutYouPage() {
  const session = useSession().data!;
  const update = useUpdateProfile();
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(() => offeredName(session));
  const [title, setTitle] = useState(session.user.title);
  const [tried, setTried] = useState(false);
  const nameField = useRef<HTMLInputElement>(null);
  const titleField = useRef<HTMLInputElement>(null);
  // Fume's and an agency's people check work: their title is on every check, so it is needed.
  const titleNeeded = Boolean(session.user.staffRole || session.user.agency);
  const nameMissing = !name.trim();
  const titleMissing = titleNeeded && !title.trim();
  const brandIsNew = !session.user.staffRole && !session.user.agency && !session.onboarded;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (nameMissing) return nameField.current?.focus();
    if (titleMissing) return titleField.current?.focus();
    update.mutate(
      { name: name.trim(), title: title.trim(), email: session.user.email },
      {
        onSuccess: () => navigate("/", { replace: true }),
        onError: (e) => toast.error("Your name wasn’t saved", { description: e.message }),
      },
    );
  };

  return (
    <SignInFrame
      foot={
        <>
          You sign in as {session.user.email}.
          {isLive && (
            <>
              {" "}
              <Button type="button" variant="link" size="sm" onClick={() => void signOut()}>
                Not you?
              </Button>
            </>
          )}
        </>
      }
    >
      <header className="ui-signin-head">
        <h1 className="ui-signin-title">About you</h1>
        <p className="ui-signin-lede">{signs(session)}</p>
      </header>
      <form className="ui-signin-about" onSubmit={submit} noValidate aria-label="About you">
        <div className="ui-signin-you" aria-hidden="true">
          {name.trim() || session.user.avatar ? (
            <Avatar size="lg" src={session.user.avatar} initials={initials(name.trim() || "?")} />
          ) : (
            <Avatar size="lg">
              <AvatarFallback>
                <Icon name="user" />
              </AvatarFallback>
            </Avatar>
          )}
          <span className="ui-signin-you-text">
            <span className="ui-signin-you-name" data-empty={name.trim() ? undefined : ""}>
              {name.trim() || "Your name"}
            </span>
            <span className="ui-signin-you-title" data-empty={title.trim() ? undefined : ""}>
              {title.trim() || "Your title"}
            </span>
          </span>
        </div>
        <Field invalid={tried && nameMissing}>
          <FieldLabel htmlFor="you-name">Your name</FieldLabel>
          <Input
            ref={nameField}
            id="you-name"
            size="lg"
            autoComplete="name"
            placeholder="First and last name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={tried && nameMissing ? true : undefined}
            data-ui-autofocus={name ? undefined : ""}
          />
          <FieldError>{tried && nameMissing ? "Write your name." : null}</FieldError>
        </Field>
        <Field invalid={tried && titleMissing}>
          <FieldLabel htmlFor="you-title">Job title</FieldLabel>
          <Input
            ref={titleField}
            id="you-title"
            size="lg"
            autoComplete="organization-title"
            placeholder="Head of Marketing"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={tried && titleMissing ? true : undefined}
            aria-describedby="you-title-help"
            data-ui-autofocus={name && !title ? "" : undefined}
          />
          {tried && titleMissing ? (
            <FieldError>Write your title: it is on every creative you check.</FieldError>
          ) : (
            <FieldDescription id="you-title-help">
              {titleNeeded
                ? "Shown with your name on every check."
                : "Shown with your name. You can leave it for later."}
            </FieldDescription>
          )}
        </Field>
        <Button type="submit" size="lg" loading={update.isPending}>
          Continue
        </Button>
        {brandIsNew && <p className="ui-signin-hint">Next, Fume reads your brand.</p>}
      </form>
    </SignInFrame>
  );
}
