// The client link, /c/:token, outside the shells (FLOWS §24.5, §26.8): one link per campaign, for a client without an
// account. Who sent what at the top ("Brygga Studio sent you 6 creatives for LYSNE · Autumn launch"), the sender's
// note, then the plan when the link carries it (one card with Approve the plan and Ask for changes), then each creative
// big enough to judge with Approve and Ask for changes. The reviewer's name is asked once, before the first answer;
// when everything has an answer the page closes with what was said. An expired or unknown link says so in one calm
// sentence.
// Signed in as one of the agency's people the page is a preview: a line at the top says so, the answers show but are
// switched off, and the name field is left out, so the agency never answers as the client (the mock refuses it too).
import { Button, Field, FieldDescription, FieldError, FieldLabel, Icon, Input, Textarea, useToast } from "@fume/ui";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAnswerClientLink, useAnswerClientPlan, useClientLink, usePeople, useSession } from "../../api/hooks";
import type { CampaignPlan, ClientLinkView, Creative, Format, Id } from "../../contract";
import * as copy from "../../copy";
import { date } from "../../lib/time";
import { Mark } from "../../shell/Logo";
import { Loading, Page } from "../../shell/Page";
import { firstName } from "../../shell/people";
import { byDay } from "../plan/words";

const formatWord: Record<Format, string> = { feed: "Feed", square: "Square", story: "Story" };
const formatShape: Record<Format, string> = { feed: "4:5", square: "1:1", story: "9:16" };

type Answer = { verdict: "approve" | "changes"; text?: string };

export function ClientLinkPage() {
  const { token } = useParams();
  const link = useClientLink(token);
  const session = useSession().data;
  const people = usePeople().data;
  const navigate = useNavigate();
  // The agency's own people see the link as a preview; the real link has no sign-in and no way into Fume.
  const preview = Boolean(session?.user.agency);
  const sentTo = link.data?.send.to[0];
  const client =
    (sentTo && people?.find((u) => u.id === sentTo)?.name.split(" ")[0]) || link.data?.client.brandName || "the client";
  /** Back the way she came: the window she opened, else the page before, else the campaign's review. */
  const close = () => {
    if (window.opener) return window.close();
    const at = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (at > 0) return navigate(-1);
    navigate(link.data ? `/campaigns/${link.data.campaign.id}/review` : "/", { replace: true });
  };

  return (
    <div className="ui-client-link" data-preview={preview || undefined}>
      {preview && (
        <div className="ui-client-link-preview" role="note">
          <p className="ui-client-link-preview-text">
            <Icon name="eye" />
            <span>Preview of what {client} sees. Nothing you do here counts.</span>
          </p>
          <Button variant="secondary" size="sm" icon="x" onClick={close} data-ui-autofocus="">
            Close the preview
          </Button>
        </div>
      )}
      <header className="ui-client-link-bar">
        <span className="ui-client-link-agency">{link.data?.agency.name ?? ""}</span>
      </header>
      <main id="main" className="ui-client-link-main">
        {link.isPending ? (
          <Loading label="Opening the creatives" />
        ) : link.data ? (
          <ClientLinkBody view={link.data} token={token!} preview={preview} />
        ) : (
          <Page title="Client link" className="ui-client-link-page">
            <h1 className="ui-client-link-gone">
              This link has expired or no longer works; ask the person who sent it for a new one.
            </h1>
          </Page>
        )}
      </main>
      <footer className="ui-client-link-foot">
        <span aria-hidden="true">
          <Mark className="ui-client-link-mark" />
        </span>
        Made with Fume
      </footer>
    </div>
  );
}

function ClientLinkBody({ view, token, preview }: { view: ClientLinkView; token: string; preview: boolean }) {
  const id = useId();
  const toast = useToast();
  const answer = useAnswerClientLink();
  const answerPlan = useAnswerClientPlan();
  const nameField = useRef<HTMLInputElement>(null);
  const closing = useRef<HTMLElement>(null);
  const [name, setName] = useState("");
  const [named, setNamed] = useState(false);
  const [missing, setMissing] = useState(false);
  const [answers, setAnswers] = useState<Record<Id, Answer>>({});
  const [planAnswer, setPlanAnswer] = useState<Answer | undefined>();

  const agency = view.agency.name;
  const brand = view.client.brandName;
  const campaign = view.campaign.name;
  const creatives = view.creatives;
  // The plan, when the link carries it. It waits on her while the version the agency sent is the plan's own.
  const plan = view.plan;
  const planOpen = Boolean(
    plan && plan.state === "ready" && plan.checkedBy && plan.version === view.planSend?.plan?.version,
  );
  const open = creatives.filter((c) => c.current.state === "checked");
  const total = creatives.length + (plan ? 1 : 0);
  const done = total - open.length - (planOpen ? 1 : 0);
  const allDone = total > 0 && open.length === 0 && !planOpen;
  const mine = Object.values(answers);
  const approved = mine.filter((a) => a.verdict === "approve").length;
  const changes = mine.length - approved;
  const nameOf = (c: Creative) => view.names?.[c.id] ?? `${campaign} · ${formatWord[c.format]}`;
  const sender = view.sentBy.name;

  // The closing words take focus once the last answer is in, so the reader hears and sees that it is done.
  const wasDone = useRef(allDone);
  useEffect(() => {
    if (allDone && !wasDone.current) closing.current?.focus();
    wasDone.current = allDone;
  }, [allDone]);

  /** The reviewer's name first: until it is given, an answer goes to the name field instead. */
  const needName = (): boolean => {
    if (name.trim()) return false;
    setMissing(true);
    nameField.current?.focus();
    return true;
  };

  const send = (c: Creative, verdict: Answer["verdict"], text?: string) => {
    if (needName() || answer.isPending) return Promise.resolve(false);
    return answer.mutateAsync({ token, versionId: c.current.id, verdict, text, name: name.trim() }).then(
      () => {
        setNamed(true);
        setAnswers((a) => ({ ...a, [c.id]: { verdict, text } }));
        return true;
      },
      (err: Error) => {
        toast.error(`Your answer didn’t reach ${agency}`, { description: err.message });
        return false;
      },
    );
  };

  const sendPlan = (verdict: Answer["verdict"], text?: string) => {
    if (needName() || answerPlan.isPending) return Promise.resolve(false);
    return answerPlan.mutateAsync({ token, verdict, text, name: name.trim() }).then(
      () => {
        setNamed(true);
        setPlanAnswer({ verdict, text });
        return true;
      },
      (err: Error) => {
        toast.error(`Your answer didn’t reach ${agency}`, { description: err.message });
        return false;
      },
    );
  };

  const who = firstName(name.trim());
  const said = [approved ? `${approved} approved` : "", changes ? `${changes} with changes` : ""]
    .filter(Boolean)
    .join(", ");
  // The plan answered here with no creatives yet: what happens next, in one sentence each.
  const planOnly = planAnswer && creatives.length === 0;
  const closingTitle = planOnly
    ? planAnswer.verdict === "approve"
      ? `Thank you${who ? `, ${who}` : ""}. The plan is approved.`
      : `Thank you${who ? `, ${who}` : ""}. ${agency} has your changes.`
    : mine.length || planAnswer
      ? `Thank you${who ? `, ${who}` : ""}. That’s all ${total}.`
      : `All ${total} have an answer`;
  const closingText = planOnly
    ? planAnswer.verdict === "approve"
      ? `${agency} sends you the creatives in this same link once they are made and checked. You can close this page.`
      : "The next version comes to this same link. You can close this page."
    : mine.length || planAnswer
      ? `${agency} has your answers: ${[planAnswer ? (planAnswer.verdict === "approve" ? "the plan approved" : "changes to the plan") : "", said].filter(Boolean).join(", ")}. You can close this page.`
      : `Everything in this link has an answer, and ${agency} has them all. You can close this page.`;
  const what = [plan ? "the plan" : "", creatives.length ? copy.creatives(creatives.length) : ""]
    .filter(Boolean)
    .join(" and ");

  return (
    <Page
      title={`${brand} · ${campaign}`}
      docTitle={`${brand} · ${campaign} · ${agency}`}
      className="ui-client-link-page"
    >
      <div className="ui-client-link-head">
        <h1 className="ui-client-link-title">
          {agency} sent you {what} for {brand} · {campaign}
        </h1>
        <p className="ui-client-link-lede">
          {planOpen
            ? "Read the plan, then approve it or ask for changes. Fume makes nothing before you approve it; the creatives come to this page once they are made and checked."
            : creatives.length
              ? `Approve each one, or ask for changes. ${agency} sees your answers as you give them.`
              : plan && plan.state !== "approved"
                ? `Fume is writing the next version of the plan, and ${agency} sends it to this page.`
                : `${agency} sends the creatives to this page once they are made and checked.`}{" "}
          The link works until {date(view.send.link?.expiresAt ?? view.send.sentAt)}.
        </p>
        {view.send.note && (
          <figure className="ui-client-link-note">
            <blockquote>“{view.send.note}”</blockquote>
            <figcaption>
              {sender}, {agency} · {date(view.send.sentAt)}
            </figcaption>
          </figure>
        )}
        <div className="ui-client-link-who">
          {preview ? null : named ? (
            <p className="ui-client-link-as">
              You answer as {name.trim()}.{" "}
              <Button variant="link" size="sm" onClick={() => setNamed(false)}>
                Change your name
              </Button>
            </p>
          ) : (
            !allDone && (
              <Field invalid={missing && !name.trim()} className="ui-client-link-reviewer">
                <FieldLabel htmlFor={`${id}-name`}>Your name</FieldLabel>
                <Input
                  ref={nameField}
                  id={`${id}-name`}
                  value={name}
                  autoComplete="name"
                  onChange={(e) => {
                    setName(e.target.value);
                    if (e.target.value.trim()) setMissing(false);
                  }}
                  aria-invalid={(missing && !name.trim()) || undefined}
                  aria-describedby={`${id}-name-help`}
                />
                {missing && !name.trim() ? (
                  <FieldError id={`${id}-name-help`}>
                    Write your name first: {agency} sees it with your answers.
                  </FieldError>
                ) : (
                  <FieldDescription id={`${id}-name-help`}>
                    Asked once, before your first answer: {agency} sees it with your answers.
                  </FieldDescription>
                )}
              </Field>
            )
          )}
          <p className="ui-client-link-count" aria-live="polite">
            <span className="ui-client-link-num">
              {done} of {total}
            </span>{" "}
            answered
          </p>
        </div>
      </div>

      {plan && (
        <LinkPlan
          plan={plan}
          open={planOpen}
          brand={brand}
          agency={agency}
          mine={planAnswer}
          busy={answerPlan.isPending ? answerPlan.variables?.verdict : undefined}
          preview={preview}
          onAnswer={sendPlan}
        />
      )}

      {creatives.length > 0 && (
        <ol className="ui-client-link-list" aria-label={`The creatives from ${agency}`}>
          {creatives.map((c, i) => (
            <LinkCreative
              key={c.id}
              creative={c}
              name={nameOf(c)}
              place={`${i + 1} of ${creatives.length}`}
              brand={brand}
              agency={agency}
              mine={answers[c.id]}
              busy={
                answer.isPending && answer.variables?.versionId === c.current.id ? answer.variables.verdict : undefined
              }
              preview={preview}
              onAnswer={(verdict, text) => send(c, verdict, text)}
            />
          ))}
        </ol>
      )}

      {allDone && (
        <section ref={closing} className="ui-client-link-done" tabIndex={-1} aria-labelledby={`${id}-done`}>
          <Icon name="circle-check" />
          <h2 id={`${id}-done`} className="ui-client-link-done-title">
            {closingTitle}
          </h2>
          <p className="ui-client-link-done-text">{closingText}</p>
        </section>
      )}
    </Page>
  );
}

interface LinkCreativeProps {
  creative: Creative;
  name: string;
  /** "3 of 6" */
  place: string;
  brand: string;
  agency: string;
  /** What this reviewer answered here. */
  mine?: Answer;
  /** The answer on its way. */
  busy?: Answer["verdict"];
  /** The agency's preview: the answers show, switched off. */
  preview?: boolean;
  onAnswer: (verdict: Answer["verdict"], text?: string) => Promise<boolean>;
}

function LinkCreative({ creative: c, name, place, brand, agency, mine, busy, preview, onAnswer }: LinkCreativeProps) {
  const id = useId();
  const [asking, setAsking] = useState(false);
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const state = c.current.state;
  const waiting = state === "checked";

  useEffect(() => {
    if (asking) field.current?.focus();
  }, [asking]);

  const sendChanges = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setTried(true);
      field.current?.focus();
      return;
    }
    void onAnswer("changes", text.trim()).then((ok) => ok && setAsking(false));
  };
  const cancel = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setAsking(false);
    }
  };

  const view = waiting
    ? asking
      ? "asking"
      : "open"
    : state === "approved" || state === "delivered"
      ? "approved"
      : state === "changes_requested"
        ? "changes"
        : "remaking";

  return (
    <li className="ui-client-link-item" data-state={view} aria-labelledby={`${id}-name`}>
      <div className="ui-creative-media ui-client-link-picture" data-format={c.format}>
        <img src={c.current.image} alt={name} />
      </div>
      <div className="ui-client-link-side">
        <div className="ui-client-link-what">
          <h2 id={`${id}-name`} className="ui-client-link-name">
            {name}
          </h2>
          <p className="ui-client-link-meta">
            <span className="ui-client-link-num">{`${formatShape[c.format]}  ·  ${place}`}</span>
          </p>
        </div>

        {view === "open" && (
          <div className="ui-client-link-actions">
            <Button
              icon="check"
              disabled={preview}
              loading={busy === "approve"}
              onClick={() => void onAnswer("approve")}
              aria-describedby={`${id}-name`}
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              icon="message-square"
              disabled={preview}
              onClick={() => setAsking(true)}
              aria-describedby={`${id}-name`}
            >
              Ask for changes
            </Button>
          </div>
        )}

        {view === "asking" && (
          <form className="ui-client-link-ask" onSubmit={sendChanges} onKeyDown={cancel} noValidate>
            <Field invalid={tried && !text.trim()}>
              <FieldLabel htmlFor={`${id}-changes`}>What should change</FieldLabel>
              <Textarea
                ref={field}
                id={`${id}-changes`}
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="The bottle could sit lower, and the light could be warmer."
                aria-invalid={(tried && !text.trim()) || undefined}
                aria-describedby={`${id}-changes-help`}
              />
              {tried && !text.trim() ? (
                <FieldError id={`${id}-changes-help`}>Say what should change, so {agency} can make it.</FieldError>
              ) : (
                <FieldDescription id={`${id}-changes-help`}>
                  {agency} reads it as you write it and makes a new version.
                </FieldDescription>
              )}
            </Field>
            <div className="ui-client-link-actions">
              <Button type="submit" icon="send" loading={busy === "changes"}>
                Send the changes
              </Button>
              <Button variant="quiet" onClick={() => setAsking(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {view === "approved" && (
          <p className="ui-client-link-answer" data-answer="approved">
            <Icon name="circle-check" />
            {mine ? "You approved this" : `${brand} approved this`}
          </p>
        )}
        {view === "changes" && (
          <div className="ui-client-link-said">
            <p className="ui-client-link-answer" data-answer="changes">
              <Icon name="message-square" />
              {mine ? "You asked for changes" : `${brand} asked for changes`}
            </p>
            {mine?.text && <blockquote className="ui-client-link-quote">“{mine.text}”</blockquote>}
            <p className="ui-client-link-next">{agency} makes a new version and sends it to you.</p>
          </div>
        )}
        {view === "remaking" && (
          <p className="ui-client-link-answer" data-answer="remaking">
            <Icon name="clock" />
            {agency} is making a new version of this one.
          </p>
        )}
      </div>
    </li>
  );
}

// ─── The plan: one card, then Approve the plan and Ask for changes ─────────

const shapeWords = (f: Format) => `${formatWord[f]} ${formatShape[f]}`;

interface LinkPlanProps {
  plan: CampaignPlan;
  /** It waits on her: the version the agency sent, checked. */
  open: boolean;
  brand: string;
  agency: string;
  mine?: Answer;
  busy?: Answer["verdict"];
  preview?: boolean;
  onAnswer: (verdict: Answer["verdict"], text?: string) => Promise<boolean>;
}

function LinkPlan({ plan, open, brand, agency, mine, busy, preview, onAnswer }: LinkPlanProps) {
  const id = useId();
  const [asking, setAsking] = useState(false);
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const direction = plan.directions.find((d) => d.id === plan.chosenDirectionId) ?? plan.directions[0];
  const masters = direction?.creatives.filter((c) => c.kind === "master") ?? [];
  const rest = (direction?.creatives.length ?? 0) - masters.length;

  useEffect(() => {
    if (asking) field.current?.focus();
  }, [asking]);

  const sendChanges = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setTried(true);
      field.current?.focus();
      return;
    }
    void onAnswer("changes", text.trim()).then((ok) => ok && setAsking(false));
  };
  const cancel = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setAsking(false);
    }
  };

  const view = open
    ? asking
      ? "asking"
      : "open"
    : plan.state === "approved"
      ? "approved"
      : plan.state === "changes_asked" && mine
        ? "changes"
        : "remaking";

  return (
    <section className="ui-client-link-plan" data-state={view} aria-labelledby={`${id}-title`}>
      <div className="ui-client-link-plan-card">
        <div className="ui-client-link-plan-head">
          <p className="ui-client-link-eyebrow">The plan · version {plan.version}</p>
          <h2 id={`${id}-title`} className="ui-client-link-name">
            {direction ? direction.name : "The plan"}
          </h2>
          {plan.checkedBy && (
            <p className="ui-client-link-plan-check">
              <span className="ui-creative-check" data-check="approved" aria-hidden="true">
                <Icon name="fume-check" />
              </span>
              {copy.checkedBy(agency)}
              {plan.checkedAt ? ` · ${date(plan.checkedAt)}` : ""}
            </p>
          )}
        </div>
        {plan.summary && <p className="ui-client-link-plan-text">{plan.summary}</p>}
        {direction && (
          <>
            <p className="ui-client-link-plan-text">{direction.idea}</p>
            {direction.references.length > 0 && (
              <ul className="ui-client-link-plan-refs" aria-label="Pictures for the direction">
                {direction.references.slice(0, 4).map((r) => (
                  <li key={r.image}>
                    <img src={r.image} alt={r.caption} />
                  </li>
                ))}
              </ul>
            )}
            <div className="ui-client-link-plan-part">
              <h3 className="ui-client-link-plan-label">How it looks</h3>
              <ul className="ui-client-link-plan-list">
                {direction.look.map((l) => (
                  <li key={l.key} className="ui-client-link-plan-row">
                    <p className="ui-client-link-plan-row-name">{l.label}</p>
                    <p className="ui-client-link-plan-row-text">{l.value}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="ui-client-link-plan-part">
              <h3 className="ui-client-link-plan-label">
                What Fume makes: {copy.count(masters.length, "master")}
                {rest > 0 ? `, then ${rest} more from them` : ""}
              </h3>
              <ol className="ui-client-link-plan-list">
                {masters.map((m) => (
                  <li key={m.id} className="ui-client-link-plan-row">
                    <p className="ui-client-link-plan-row-name">
                      {m.name} · {shapeWords(m.format)}
                    </p>
                    <p className="ui-client-link-plan-row-text">
                      {m.scene}
                      {m.text ? ` “${m.text}”` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
        {plan.timeline.length > 0 && (
          <div className="ui-client-link-plan-part">
            <h3 className="ui-client-link-plan-label">When, once you approve it</h3>
            <dl className="ui-client-link-plan-dates">
              {plan.timeline.map((s) => (
                <div key={s.label} className="ui-client-link-plan-date">
                  <dt>{s.label}</dt>
                  <dd>{byDay(s.at)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      {view === "open" && (
        <div className="ui-client-link-actions">
          <Button
            icon="check"
            disabled={preview}
            loading={busy === "approve"}
            onClick={() => void onAnswer("approve")}
            aria-describedby={`${id}-title`}
          >
            Approve the plan
          </Button>
          <Button
            variant="secondary"
            icon="message-square"
            disabled={preview}
            onClick={() => setAsking(true)}
            aria-describedby={`${id}-title`}
          >
            Ask for changes
          </Button>
        </div>
      )}

      {view === "asking" && (
        <form className="ui-client-link-ask" onSubmit={sendChanges} onKeyDown={cancel} noValidate>
          <Field invalid={tried && !text.trim()}>
            <FieldLabel htmlFor={`${id}-changes`}>What should change in the plan</FieldLabel>
            <Textarea
              ref={field}
              id={`${id}-changes`}
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="The gift box closed on the first master, and no hands."
              aria-invalid={(tried && !text.trim()) || undefined}
              aria-describedby={`${id}-changes-help`}
            />
            {tried && !text.trim() ? (
              <FieldError id={`${id}-changes-help`}>
                Say what should change, so Fume can write the next version.
              </FieldError>
            ) : (
              <FieldDescription id={`${id}-changes-help`}>
                Fume writes the next version and {agency} sends it to you here.
              </FieldDescription>
            )}
          </Field>
          <div className="ui-client-link-actions">
            <Button type="submit" icon="send" loading={busy === "changes"}>
              Send the changes
            </Button>
            <Button variant="quiet" onClick={() => setAsking(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {view === "approved" && (
        <p className="ui-client-link-answer" data-answer="approved">
          <Icon name="circle-check" />
          {mine
            ? "You approved the plan. Fume has started on the masters."
            : `${brand} approved the plan. Fume has started on the masters.`}
        </p>
      )}
      {view === "changes" && (
        <div className="ui-client-link-said">
          <p className="ui-client-link-answer" data-answer="changes">
            <Icon name="message-square" />
            You asked for changes
          </p>
          {mine?.text && <blockquote className="ui-client-link-quote">“{mine.text}”</blockquote>}
          <p className="ui-client-link-next">Fume writes the next version and {agency} sends it to you here.</p>
        </div>
      )}
      {view === "remaking" && (
        <p className="ui-client-link-answer" data-answer="remaking">
          <Icon name="clock" />
          Fume is writing the next version of the plan. {agency} sends it to you here.
        </p>
      )}
    </section>
  );
}
