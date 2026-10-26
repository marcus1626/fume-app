// The campaign's Plan tab (FLOWS §22, §26.2, §26.8). By the plan's state:
// - no plan yet: the brief is its own stage (BriefTab, the campaign's Brief tab); nothing is made yet.
// - writing / in check: a calm state on one screen (the step in words, with the text shimmer on the words under way),
//   when it is ready, what the plan will hold in one line, and her brief beside it, read-only.
// - changes asked: "Fume is changing the plan", her note, and the version she asked to change, read-only.
// - ready: the plan document with the step footer. Fume writes the plan and it is hers at once: "Approve and start"
//   (the one Ink; ⌘↵ too when the focus is not in a field) starts the masters, with Undo in the toast; "Change it with
//   Fume" opens the Fume chat with the plan in its side panel; "Ask Anna to check" is optional, and the plan comes back
//   checked.
// - approved: the same document, read-only.
// In a brand an agency runs the agency checks the plan and sends it to the client: its footer's Ink is "Send to Maja"
// (the Send panel the creatives use, with the plan in it and the campaign's client link), and once sent it reads "You
// sent it to Maja". The client sees where the plan is until it is sent; then the plan with "Ask for changes" and
// "Approve and start", as the customer has in Fume (or the same in the client link). Her approval starts the Engine. An
// expert's step carries the checked triangle (grey while it waits, Amber once checked), the same mark as Check's.
import { Button, Icon, PageFooter, PickGrid, PickTile, ProductTile, cx, useToast } from "@fume/ui";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useApprovePlan,
  useAskPlanCheck,
  useCatalogue,
  usePlan,
  useSendBrief,
  useUndoApprovePlan,
} from "../../api/hooks";
import { useCampaignSends } from "../agency/clientFlow";
import { SendToClientSheet } from "../agency/SendToClient";
import { AskChanges } from "./AskChanges";
import type { Brief, Campaign, CampaignPlan, CampaignView } from "../../contract";
import * as copy from "../../copy";
import { Nothing, Query, Section } from "../../shell/Page";
import { BriefFacts, briefGaps } from "../campaigns/brief-lines";
import type { rights } from "../campaigns/parts";
import { ProductScopePicker } from "../products/ProductScopePicker";
import { usePlanChatPath } from "./chat";
import { PlanDocument } from "./PlanDocument";
import { usePlanPeople, type PlanPeople } from "./people";
import { byDay, creativesOf, onDay, partsToCome, sentOn } from "./words";

type Rights = ReturnType<typeof rights>;

/** What happens once she sends the brief, in one sentence (the same words as the chat's brief panel). */
export const AFTER_SENDING =
  "Fume writes the plan from your brief: the direction, how every creative looks and every creative. You approve the plan before anything is made.";

export function PlanTab({ view, can }: { view: CampaignView; can: Rights }) {
  const plan = usePlan(view.campaign.id);
  const people = usePlanPeople();
  return (
    <Query query={plan} loading="Opening the plan">
      {(p) => <PlanByState plan={p} view={view} can={can} people={people} />}
    </Query>
  );
}

function PlanByState({
  plan,
  view,
  can,
  people,
}: {
  plan: CampaignPlan | null;
  view: CampaignView;
  can: Rights;
  people: PlanPeople;
}) {
  const { campaign, brief } = view;
  // Before the brief is sent there is no plan: the brief is its own stage.
  if (!plan)
    return (
      <Nothing
        icon="file-text"
        title="No plan yet"
        text={
          people.viewer === "client"
            ? `${people.agencyName ?? "Your agency"} sends the brief; Fume writes the plan from it.`
            : "Send your brief to Fume and Fume writes the plan from it: the direction, how every creative looks, every creative and the dates."
        }
        action={
          <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
            <Link to={`/campaigns/${campaign.id}/brief`} replace>
              Open the brief
            </Link>
          </Button>
        }
      />
    );
  switch (plan.state) {
    case "writing":
    case "in_check":
      return <PlanWaiting plan={plan} campaign={campaign} brief={brief} people={people} />;
    case "changes_asked":
      return (
        <>
          <PlanWaiting plan={plan} campaign={campaign} brief={brief} people={people} />
          {plan.directions.length > 0 && (
            <PlanDocument
              plan={plan}
              campaign={campaign}
              brief={brief}
              people={people}
              mode="previous"
              edit={false}
              choose={false}
            />
          )}
        </>
      );
    case "ready":
      // The agency's client sees the plan once the agency has checked it and sent it to her.
      if (people.viewer === "client" && !plan.checkedBy)
        return <PlanWaiting plan={plan} campaign={campaign} brief={brief} people={people} />;
      return <PlanReady plan={plan} campaign={campaign} brief={brief} people={people} can={can} />;
    case "approved":
      return (
        <PlanDocument
          plan={plan}
          campaign={campaign}
          brief={brief}
          people={people}
          mode="approved"
          edit={false}
          choose={false}
        />
      );
  }
}

// ─── Ready: the document, Ask for changes, Approve the plan ────────────────

function PlanReady({
  plan,
  campaign,
  brief,
  people,
  can,
}: {
  plan: CampaignPlan;
  campaign: Campaign;
  brief: Brief;
  people: PlanPeople;
  can: Rights;
}) {
  const approve = useApprovePlan();
  const undo = useUndoApprovePlan();
  const askCheck = useAskPlanCheck();
  const chatPath = usePlanChatPath(campaign.id);
  const catalogue = useCatalogue();
  const toast = useToast();
  // The expert's check is optional; she asks for it while no expert has checked this version.
  const expert = people.expert && people.viewer === "customer" && !plan.checkedBy ? people.expertName : undefined;
  const Expert = expert ? expert.charAt(0).toUpperCase() + expert.slice(1) : undefined;
  const { masters } = creativesOf(plan);
  const mastersWords = masters.length === 1 ? "the master" : `the ${masters.length} masters`;
  // A product the plan uses that waits to be confirmed: the footer says it once, the toast says what waits.
  const waiting = (catalogue.data?.products ?? []).filter(
    (p) => campaign.productIds.includes(p.id) && p.state === "needs_you",
  );
  const held = masters.filter((m) => m.productIds.some((id) => waiting.some((p) => p.id === id)));
  const first = waiting.map((p) => p.name).join(" and ");
  // An agency checks the plan and sends it to the client; only the client approves it.
  const agency = people.viewer === "agency";
  const client = people.viewer === "client";
  const sent = agency && Boolean(plan.checkedBy);
  const clientName = people.approver(campaign);
  const [sending, setSending] = useState(false);
  const [asking, setAsking] = useState(false);
  const { sends } = useCampaignSends(campaign.id, agency);
  const planLink = sends.find((s) => s.plan && s.link)?.link;
  const verb = "Approve it";

  const doApprove = () => {
    if (agency) {
      if (!sent) setSending(true);
      return;
    }
    if (approve.isPending) return;
    // mutateAsync, not mutate's callbacks: approved, this footer unmounts before they would run (and so does the toast's Undo)
    void approve.mutateAsync(campaign.id).then(
      () =>
        toast.done("Plan approved", {
          description:
            held.length === 0
              ? `The Engine has started on ${mastersWords}.`
              : held.length === masters.length
                ? `The Engine starts on ${mastersWords} once ${first} ${waiting.length === 1 ? "is" : "are"} confirmed.`
                : `The Engine has started on ${listWords(masters.filter((m) => !held.includes(m)).map((m) => m.name))}; ${listWords(held.map((m) => m.name))} once ${first} ${waiting.length === 1 ? "is" : "are"} confirmed.`,
          action: {
            label: "Undo",
            onClick: () =>
              void undo.mutateAsync(campaign.id).then(
                () => toast.done(`Undone. The plan waits on ${people.approver(campaign)} again.`),
                (e: Error) => toast.error("That wasn’t undone", { description: e.message }),
              ),
          },
        }),
      (e: Error) => toast.error("The plan wasn’t approved", { description: e.message }),
    );
  };

  // ⌘↵ approves (the agency: opens Send) while the focus is not in a field and no panel is open (never an arrow key).
  useEffect(() => {
    if (!can.approve || sent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const a = document.activeElement as HTMLElement | null;
      if (a && (a.matches("input, textarea, select, [contenteditable='true']") || a.closest("form"))) return;
      // an open panel or menu, not the phone's closed sidebar (a modal dialog that is always there, inert while closed)
      const open = document.querySelectorAll(
        "[role='dialog'][data-state='open'], [role='alertdialog'][data-state='open'], [role='menu'][data-state='open'], [aria-modal='true']",
      );
      if ([...open].some((d) => !d.closest("[inert]"))) return;
      e.preventDefault();
      doApprove();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // The footer says once what approving starts, and what waits for a product to be confirmed.
  const going = masters.filter((m) => !held.includes(m));
  const line =
    held.length === 0
      ? expert
        ? `${verb} and Fume starts on ${mastersWords}. ${Expert} checks it first if you ask.`
        : `${verb} and Fume starts on ${mastersWords}. Nothing is made before that.`
      : going.length === 0
        ? `${verb} and Fume starts on ${mastersWords} once ${first} ${waiting.length === 1 ? "is" : "are"} confirmed.`
        : `${verb} and Fume starts on ${listWords(going.map((m) => m.name))}; ${listWords(held.map((m) => m.name))} ${held.length === 1 ? "waits" : "wait"} for ${first}.`;

  const agencyName = people.agencyName ?? "Your agency";
  // The agency's footer: check it and send it to the client; once sent, where it is (and the client link).
  if (agency)
    return (
      <>
        <PlanDocument
          plan={plan}
          campaign={campaign}
          brief={brief}
          people={people}
          mode="ready"
          edit={can.approve && !sent}
          choose={can.approve && !sent}
        />
        {sent ? (
          <PageFooter
            className="ui-plandoc-foot"
            start={`You sent it to ${clientName}${plan.checkedAt ? ` ${onDay(plan.checkedAt, false)}` : ""}. Fume starts on ${mastersWords} once she approves it.`}
          >
            {planLink && (
              <Button asChild variant="secondary" icon="external-link">
                <Link to={`/c/${planLink.token}`}>Open the client link</Link>
              </Button>
            )}
          </PageFooter>
        ) : can.approve ? (
          <PageFooter
            className="ui-plandoc-foot"
            start={`Check the plan, then send it to ${clientName}. Fume starts on ${mastersWords} once she approves it.`}
          >
            <Button asChild variant="secondary" icon="message-square">
              <Link to={chatPath}>Change it with Fume</Link>
            </Button>
            <Button icon="send" onClick={() => setSending(true)} aria-keyshortcuts="Meta+Enter Control+Enter">
              {copy.send.action(clientName.charAt(0).toUpperCase() + clientName.slice(1))}
            </Button>
          </PageFooter>
        ) : (
          <PageFooter className="ui-plandoc-foot" start={`${agencyName}’s lead sends the plan to ${clientName}.`} />
        )}
        <SendToClientSheet campaign={campaign} creatives={[]} plan={plan} open={sending} onOpenChange={setSending} />
      </>
    );

  return (
    <>
      <PlanDocument
        plan={plan}
        campaign={campaign}
        brief={brief}
        people={people}
        mode="ready"
        edit={can.approve && !client}
        choose={can.approve && !client}
      />
      {can.approve && client ? (
        // The client approves the plan the agency checked and sent her; changes go to Fume in her words.
        <PageFooter className="ui-plandoc-foot" start={`${agencyName} checked it. ${line}`}>
          <Button variant="secondary" icon="message-square" onClick={() => setAsking(true)}>
            Ask for changes
          </Button>
          <Button
            icon="check"
            loading={approve.isPending}
            onClick={doApprove}
            aria-keyshortcuts="Meta+Enter Control+Enter"
          >
            Approve and start
          </Button>
          <AskChanges
            campaignId={campaign.id}
            expert={agencyName}
            included={plan.changeRequestsIncluded}
            open={asking}
            onOpenChange={setAsking}
          />
        </PageFooter>
      ) : can.approve ? (
        <PageFooter className="ui-plandoc-foot" start={line}>
          {Expert && (
            <Button
              variant="quiet"
              icon="fume-check"
              loading={askCheck.isPending}
              onClick={() =>
                askCheck.mutate(campaign.id, {
                  onSuccess: () =>
                    toast.done(`${Expert} checks the plan`, {
                      description: "You see it here again once it is checked. Nothing is made before you approve it.",
                    }),
                  onError: (e) => toast.error("That wasn’t sent", { description: e.message }),
                })
              }
            >
              Ask {Expert} to check
            </Button>
          )}
          <Button asChild variant="secondary" icon="message-square">
            <Link to={chatPath}>Change it with Fume</Link>
          </Button>
          <Button
            icon="check"
            loading={approve.isPending}
            onClick={doApprove}
            aria-keyshortcuts="Meta+Enter Control+Enter"
          >
            Approve and start
          </Button>
        </PageFooter>
      ) : (
        <PageFooter
          className="ui-plandoc-foot"
          start={`${people.Approver(campaign)} approves the plan. Nothing is made before that.`}
        />
      )}
    </>
  );
}

const listWords = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");

// ─── While Fume writes, the expert checks, or Fume changes it ──────────────

type StepState = "done" | "now" | "ahead";
/** A step of the waiting state; `check` marks the expert's (the checked triangle). */
type WaitStep = { label: string; when?: string; state: StepState; check?: boolean };

function PlanWaiting({
  plan,
  campaign,
  brief,
  people,
}: {
  plan: CampaignPlan;
  campaign: Campaign;
  brief: Brief;
  people: PlanPeople;
}) {
  const expert = people.expert ? people.expertName : undefined;
  const Expert = expert ? expert.charAt(0).toUpperCase() + expert.slice(1) : undefined;
  const sent = brief.approvedAt;
  const by = plan.readyBy ? byDay(plan.readyBy) : undefined;
  const client = people.viewer === "client";
  // Who approves the plan, as this reader says it: "You", "Maja".
  const Who = people.Approver(campaign);
  // In a brand an agency runs the agency checks the plan and sends it ("You check it and send it to Maja", "Brygga
  // Studio checks it"), then the client approves it.
  const agencyRun = people.viewer === "agency" || client;
  const Agency = people.viewer === "agency" ? "You" : (people.agencyName ?? "Your agency");
  const approves = `${Who} ${Who === "You" ? "approve" : "approves"} it`;
  const yoursNext =
    people.viewer === "agency"
      ? "It is yours to check as soon as it is written."
      : client
        ? ""
        : "It is yours to approve as soon as it is written.";
  // The last steps: the agency's check (in agency work), then the approval, then the Engine makes the masters (the one
  // place it is named here).
  const checkStep: WaitStep[] = agencyRun
    ? [
        {
          label:
            people.viewer === "agency"
              ? `You check it and send it to ${people.approver(campaign)}`
              : `${Agency} checks it and sends it to you`,
          state: "ahead",
          check: true,
        },
      ]
    : [];
  const last = { label: `${approves}; then the Engine makes the masters`, state: "ahead" as StepState };
  const sender = brief.approvedBy
    ? people.isMe(brief.approvedBy)
      ? "You"
      : client
        ? Agency
        : people.Name(brief.approvedBy)
    : "You";
  // Who asked for the changes: the note's author, or (once Fume has answered it) the one who approves the plan.
  const noteBy = plan.note && plan.note.by !== "fume" ? plan.note.by : undefined;
  const asker = noteBy ? (people.isMe(noteBy) ? "You" : people.Name(noteBy)) : Who;
  let words: string;
  let line: string;
  let steps: WaitStep[];
  // The expert checks only when she asked; who asked, in this reader's words.
  const askedCheck = plan.checkAsked
    ? people.isMe(plan.checkAsked.by)
      ? "You"
      : client
        ? Who
        : people.Name(plan.checkAsked.by)
    : undefined;
  if (plan.state === "changes_asked") {
    words = "Fume is changing the plan";
    line = `Version ${plan.version + 1}${by ? ` by ${by}` : " next"}. ${client ? "" : yoursNext}`.trim();
    steps = [
      { label: `${asker} asked for changes`, when: plan.note ? sentOn(plan.note.at) : undefined, state: "done" },
      { label: `Fume writes version ${plan.version + 1}`, state: "now" },
      ...checkStep,
      last,
    ];
  } else if (plan.state === "ready") {
    // The agency's client, before the agency has checked the plan and sent it to her.
    const again = plan.version > 1;
    words = again ? `${Agency} is checking version ${plan.version}` : `${Agency} is checking the plan`;
    line = `You see it here once ${Agency} sends it to you. Nothing is made before you approve it.`;
    steps = [
      ...(again
        ? [
            {
              label: `Fume wrote version ${plan.version}`,
              when: plan.writtenAt ? sentOn(plan.writtenAt) : undefined,
              state: "done" as StepState,
            },
          ]
        : [
            { label: `${sender} sent the brief`, when: sent ? sentOn(sent) : undefined, state: "done" as StepState },
            {
              label: "Fume wrote the plan",
              when: plan.writtenAt ? sentOn(plan.writtenAt) : undefined,
              state: "done" as StepState,
            },
          ]),
      { label: `${Agency} checks it and sends it to you`, state: "now", check: true },
      last,
    ];
  } else if (plan.state === "in_check") {
    const again = plan.version > 1;
    words = again
      ? `${Expert ?? "The expert"} is checking version ${plan.version}`
      : `${Expert ?? "The expert"} is checking the plan`;
    line = `Ready by ${by ?? "tomorrow"}. You see it here once it is checked.`;
    steps = [
      ...(again
        ? [
            {
              label: `Fume wrote version ${plan.version}`,
              when: plan.writtenAt ? sentOn(plan.writtenAt) : undefined,
              state: "done" as StepState,
            },
          ]
        : [
            { label: `${sender} sent the brief`, when: sent ? sentOn(sent) : undefined, state: "done" as StepState },
            {
              label: "Fume wrote the plan",
              when: plan.writtenAt ? sentOn(plan.writtenAt) : undefined,
              state: "done" as StepState,
            },
          ]),
      ...(askedCheck && plan.checkAsked
        ? [
            {
              label: `${askedCheck} asked ${Expert ?? "the expert"} to check it`,
              when: sentOn(plan.checkAsked.at),
              state: "done" as StepState,
            },
          ]
        : []),
      { label: `${Expert ?? "The expert"} checks it`, state: "now", check: true },
      last,
    ];
  } else {
    words = "Fume is writing the plan";
    line = `Ready by ${by ?? "tomorrow"}. ${client ? "" : yoursNext}`.trim();
    steps = [
      { label: `${sender} sent the brief`, when: sent ? sentOn(sent) : undefined, state: "done" },
      { label: "Fume writes the plan", state: "now" },
      ...checkStep,
      last,
    ];
  }
  const asked = plan.state === "changes_asked" && plan.note && plan.note.by !== "fume" ? plan.note.text : undefined;
  const yours = sender === "You";
  return (
    <div className="ui-plandoc-waiting" data-brief={plan.state !== "changes_asked" ? "" : undefined}>
      <WaitingState
        version={plan.state === "changes_asked" ? plan.version + 1 : plan.version}
        words={words}
        line={line}
        steps={steps}
        asked={asked}
        askedBy={asker}
        more={plan.state !== "changes_asked" ? <ToCome creatives={brief.creatives} /> : undefined}
      />
      {plan.state !== "changes_asked" && (
        <aside className="ui-plandoc-waiting-brief" aria-labelledby="plan-sent-brief">
          <div className="ui-plandoc-part-head">
            <h2 className="ui-plandoc-group-title" id="plan-sent-brief">
              {yours ? "Your brief" : `${sender}’s brief`}
              {sent ? `, sent ${sentOn(sent)}` : ""}
            </h2>
            <p className="ui-plandoc-label">Fume writes the plan from this version.</p>
          </div>
          <BriefFacts brief={brief} campaign={campaign} editable={false} />
        </aside>
      )}
    </div>
  );
}

/** The state in words: the step under way shimmers (the one line that does in this view), when it is ready, the steps. */
export function WaitingState({
  version,
  words,
  line,
  steps,
  asked,
  askedBy = "You",
  more,
}: {
  version: number;
  words: string;
  line: string;
  steps: WaitStep[];
  asked?: string;
  /** Who asked ("You", "Maja", "Brygga Studio"). */
  askedBy?: string;
  /** A last line under the steps (what the plan will hold). */
  more?: ReactNode;
}) {
  return (
    <section className="ui-plandoc-state" aria-labelledby="plan-state-title" aria-live="polite">
      <p className="ui-plandoc-eyebrow">The plan · version {version}</p>
      <h2 className="ui-plandoc-state-title" id="plan-state-title">
        <span className="ui-text-shimmer">{words}</span>
      </h2>
      <p className="ui-plandoc-state-by">{line}</p>
      {asked && (
        <blockquote className="ui-plandoc-quote">
          <p className="ui-plandoc-label">{askedBy} asked</p>
          <p className="ui-plandoc-quote-text">“{asked}”</p>
        </blockquote>
      )}
      <ol className="ui-plandoc-steps" aria-label="Where the plan is">
        {steps.map((s) => (
          <li
            key={s.label}
            className={cx("ui-plandoc-steps-item", s.check && "ui-plandoc-steps-item--check")}
            data-state={s.state}
            aria-current={s.state === "now" ? "step" : undefined}
          >
            {/* the expert's step: the checked triangle, grey while it waits and Amber once checked */}
            {s.check ? (
              <span
                className="ui-creative-check"
                data-check={s.state === "done" ? "approved" : "waiting"}
                aria-hidden="true"
              >
                <Icon name="fume-check" />
              </span>
            ) : s.state === "done" ? (
              <Icon name="circle-check" />
            ) : (
              <span className="ui-plandoc-step-dot" aria-hidden="true" />
            )}
            <span>
              {s.label}
              {s.when ? ` · ${s.when}` : ""}
            </span>
          </li>
        ))}
      </ol>
      {more}
    </section>
  );
}

/** What the plan will hold, in one line of its parts. */
export function ToCome({ creatives }: { creatives: number }) {
  return (
    <p className="ui-plandoc-tocome">
      <span className="ui-plandoc-label">The plan will hold</span>
      <span className="ui-plandoc-tocome-text">{partsToCome(creatives)}</span>
    </p>
  );
}

// ─── The brief: her brief, changed in place until the plan is approved, then Send to Fume ─────────

/** The campaign's Brief tab: her brief, every line changeable in place until the plan is approved, and "Send to Fume"
 *  once it is complete. Changed after it was sent, the new version goes to Fume again and the plan is written again
 *  from it (its next version). */
export function BriefTab({ view, can }: { view: CampaignView; can: Rights }) {
  const people = usePlanPeople();
  const plan = usePlan(view.campaign.id).data;
  return <BriefToSend view={view} can={can} people={people} plan={plan} />;
}

function BriefToSend({
  view,
  can,
  people,
  plan,
}: {
  view: CampaignView;
  can: Rights;
  people: PlanPeople;
  plan: CampaignPlan | null | undefined;
}) {
  const { brief, campaign } = view;
  const send = useSendBrief();
  const toast = useToast();
  const gaps = briefGaps(brief);
  const sent = brief.state === "approved";
  const planApproved = plan?.state === "approved";
  const over =
    planApproved ||
    ["approved", "delivered", "closed"].includes(campaign.state) ||
    ["directions", "masters", "variants", "delivery"].includes(campaign.stage);
  // The agency's client reads the brief; the agency writes it and sends it (FLOWS §24.2).
  const client = people.viewer === "client";
  // Changeable until the plan is approved (a change after sending makes the next version, sent again).
  const editable = !over && can.ask && !client && plan?.state !== "writing" && plan?.state !== "changes_asked";
  const again = Boolean(plan) && !sent;
  const complete =
    !sent &&
    brief.missing.length === 0 &&
    gaps.length === 0 &&
    (campaign.productIds.length > 0 || Boolean(campaign.collectionIds?.length));
  const text = client
    ? `${people.agencyName ?? "Your agency"} writes the brief with Fume and sends it; Fume writes the plan from it.`
    : sent
      ? `${people.Name(brief.approvedBy)} sent it${brief.approvedAt ? ` ${onDay(brief.approvedAt, false)}` : ""}. Fume works to this version.${editable ? " Change a line and the new version goes to Fume; the plan is written again from it." : ""}`
      : brief.missing.length
        ? `Fume still needs ${copy.count(brief.missing.length, "answer")}: ${brief.missing.map((m) => m.charAt(0).toLowerCase() + m.slice(1)).join(", and ")}.`
        : gaps.length
          ? `Fill in the ${gaps.join(" and the ").toLowerCase()} here, or use Fume’s suggestion.`
          : again
            ? `You changed it after sending it. Send version ${brief.version} and Fume writes the plan again from it.`
            : brief.state === "ready" || complete
              ? "Change any line here before you send it."
              : "Fume is still forming the brief with you, one question at a time.";
  // The agency checks the plan and sends it; its client approves it.
  const checksPlan = people.viewer === "agency";
  const after = checksPlan
    ? `Fume writes the plan ${again ? "again from this version" : "from your brief"}. You check it and send it to ${people.approver(campaign)}; nothing is made before she approves it.`
    : again
      ? "Fume writes the plan again from this version. You approve the plan before anything is made."
      : AFTER_SENDING;

  const doSend = () =>
    // mutateAsync: once sent, this state gives way to the waiting state before mutate's callbacks would run
    void send.mutateAsync(campaign.id).then(
      () =>
        toast.done("Sent to Fume", {
          description: again
            ? "Fume writes the plan again from your new brief."
            : checksPlan
              ? `Fume is writing the plan. You check it and send it to ${people.approver(campaign)}.`
              : "Fume is writing the plan. You approve it before anything is made.",
        }),
      (e: Error) => toast.error("The brief wasn’t sent", { description: e.message }),
    );

  const footer = complete && !over && !client;
  return (
    <>
      <div className="ui-plandoc-waiting">
        <Section
          title="The brief"
          meta={`version ${brief.version}`}
          titleId="campaign-brief"
          text={text}
          action={
            editable ? (
              <Button asChild variant="quiet" size="sm" icon="message-square">
                <Link to={`/fume/${view.threadId}`}>Change it with Fume</Link>
              </Button>
            ) : undefined
          }
        >
          <BriefFacts brief={brief} campaign={campaign} editable={editable} made={campaign.counts.creatives} />
        </Section>
        <Scope campaign={campaign} editable={editable} />
        {/* what happens next, last: with the footer it is the footer's line */}
        {!footer && !sent && !over && !client && <NextLine>{after}</NextLine>}
        {sent && plan && !client && (
          <p className="ui-plandoc-note">
            <Icon name="file-text" />
            <span>
              {planApproved
                ? `The plan was written from version ${plan.briefVersion}. `
                : "Fume wrote the plan from this version. "}
              <Link className="ui-link" to={`/campaigns/${campaign.id}/plan`} replace>
                Open the plan
              </Link>
            </span>
          </p>
        )}
      </div>
      {footer && (
        <PageFooter className="ui-plandoc-foot" start={after}>
          {can.approve ? (
            <Button icon="send" loading={send.isPending} onClick={doSend}>
              {again ? `Send version ${brief.version} to Fume` : "Send to Fume"}
            </Button>
          ) : (
            <span>{people.Name(campaign.approverId)} sends it to Fume.</span>
          )}
        </PageFooter>
      )}
    </>
  );
}

function NextLine({ children }: { children: ReactNode }) {
  return (
    <p className="ui-plandoc-note">
      <Icon name="message-square" />
      <span>{children}</span>
    </p>
  );
}

/** The collections and products the campaign makes creatives for (FLOWS §3.2), with a way to change them. */
function Scope({ campaign, editable }: { campaign: Campaign; editable: boolean }) {
  const catalogue = useCatalogue();
  const [changing, setChanging] = useState(false);
  const navigate = useNavigate();
  const collections = (catalogue.data?.collections ?? []).filter((c) => campaign.collectionIds?.includes(c.id));
  const inCollections = new Set(collections.flatMap((c) => c.productIds));
  const all = catalogue.data?.products ?? [];
  const products = all.filter((p) => campaign.productIds.includes(p.id));
  const single = products.filter((p) => !inCollections.has(p.id));
  return (
    <Section
      title="What it covers"
      meta={catalogue.data ? copy.count(products.length, "product") : undefined}
      titleId="campaign-scope"
      text={
        changing
          ? "Pick whole collections or single products. A collection brings all its products, and new ones in it join later."
          : undefined
      }
      action={
        editable && !changing ? (
          <Button variant="quiet" size="sm" icon="pencil" onClick={() => setChanging(true)}>
            Change
          </Button>
        ) : changing ? (
          <Button variant="quiet" size="sm" onClick={() => setChanging(false)}>
            Cancel
          </Button>
        ) : undefined
      }
    >
      {changing ? (
        <ProductScopePicker campaign={campaign} onSaved={() => setChanging(false)} />
      ) : (
        <Query query={catalogue} loading="Loading the products">
          {() =>
            collections.length === 0 && single.length === 0 ? (
              <p className="ui-app-section-text">No products picked yet. Pick them, so Fume knows what to show.</p>
            ) : (
              <PickGrid aria-labelledby="campaign-scope">
                {collections.map((c) => (
                  <PickTile
                    key={c.id}
                    title={c.name}
                    line={`Collection · ${copy.count(c.productIds.length, "product")}`}
                    src={c.cover}
                    images={c.productIds
                      .map((id) => all.find((p) => p.id === id)?.images[0])
                      .filter((x): x is string => Boolean(x))}
                    icon="layers"
                    label={`Open the collection ${c.name}`}
                    onOpen={() => navigate(`/products/collections/${c.id}`)}
                  />
                ))}
                {single.map((p) => (
                  <ProductTile
                    key={p.id}
                    name={p.name}
                    variant={p.variant}
                    src={p.images[0]}
                    label={`Open ${p.name}`}
                    onOpen={() => navigate(`/brand/products/${p.id}`)}
                  />
                ))}
              </PickGrid>
            )
          }
        </Query>
      )}
    </Section>
  );
}
