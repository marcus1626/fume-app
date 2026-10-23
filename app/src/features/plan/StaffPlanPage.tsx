// The plan for Fume's expert (FLOWS §22.3, PROPOSED 20 Oct 2026): /studio/b/:workspaceId/campaigns/:campaignId/plan.
// The same document the customer reads, whole while it is in check, every line and every creative changeable in place
// (the expert may change any line), and the step footer's one Ink: "Mark checked", which sends it to the customer.
// While Fume is still writing it, the same calm state the customer sees.
// Round 12 (desktop review 20 Oct, DTASK-8, DLAY-11, DTASK-9, DLOAD-17; PROPOSED 20 Oct 2026):
// - Mark checked has its key, ⌘↵ (Ctrl+↵ off a Mac), on the pill. The check waits 10 s before the customer sees the
//   plan, with Undo in the toast and in the foot; leaving the page sends it at once. Then the foot stays and says
//   where it stands and what comes next: "Checked by you · It waits on Maja", and "Next: 3 creatives in Check" (or
//   "Nothing else waits on you").
// - The customer's brief sits in the sticky aside, beside the lines she checks against it (the facts fold to one line).
// - The foot counts what she changed in her check ("You changed 1 line"); each line she changed reads "Changed by Anna"
//   on both sides (the plan's mock keeps who changed it).
// - The plan speaks of the customer by name on this page ("Maja's brief", PlanDocument's voice for staff).
// Round 13 (Marcus's comments #20, #25, #28; PROPOSED 22 Oct 2026): the expert's check of a plan is optional. A plan
// comes here in check only when the customer asks ("Ask Anna to check"); otherwise it goes to her as Fume wrote it. The
// foot's "Checked by you" is the Focus pointer in Amber, as Check marks it.
import { Button, CheckMark, Kbd, PageFooter, PageHeader, shortcutLabel, useToast } from "@fume/ui";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCampaign, useCheckPlan, usePlan, useSession } from "../../api/hooks";
import type { CampaignPlan, CampaignView, Id } from "../../contract";
import * as copy from "../../copy";
import { Back, Nothing, Page, Query } from "../../shell/Page";
import { checkPath } from "../../shell/scope";
import { BriefFacts } from "../campaigns/brief-lines";
import { useQaWaiting } from "../studio/qa/count";
import { PlanDocument } from "./PlanDocument";
import { PlanIndex } from "./PlanIndex";
import { WaitingState } from "./PlanTab";
import { usePlanPeople, type PlanPeople } from "./people";
import { byDay, chosenOf, sentOn } from "./words";

/** How long a check waits before the customer sees the plan: the time Undo has. */
const HOLD = 10_000;

export function StaffPlanPage() {
  const { workspaceId, campaignId } = useParams<"workspaceId" | "campaignId">();
  const campaign = useCampaign(campaignId);
  const plan = usePlan(campaignId);
  const name = campaign.data?.campaign.name ?? "Campaign";
  return (
    <Page title={`${name} · Plan`} docTitle={`Plan · ${name}`}>
      <Query query={campaign} loading="Loading the campaign">
        {(view) => (
          <Query query={plan} loading="Opening the plan">
            {(p) => <StaffPlan view={view} plan={p} workspaceId={workspaceId ?? view.campaign.workspaceId} />}
          </Query>
        )}
      </Query>
    </Page>
  );
}

function StaffPlan({
  view,
  plan,
  workspaceId,
}: {
  view: CampaignView;
  plan: CampaignPlan | null;
  workspaceId: string;
}) {
  const people = usePlanPeople();
  const session = useSession().data;
  const brand = session?.workspaces.find((w) => w.id === workspaceId)?.brandName ?? "";
  const approver = people.name(view.campaign.approverId);
  const held = useHeldCheck(view.campaign.id, cap(approver));
  // What waits on her next: this brand's creatives in Check, else any brand's (DTASK-8).
  const here = useQaWaiting(workspaceId);
  const all = useQaWaiting();
  const next = here.total || all.total;
  const back = <Back to={`/studio/b/${workspaceId}/campaigns`} label="Campaigns" />;
  const meta = [
    brand,
    plan ? `Plan · version ${plan.version}` : "Plan",
    ...(plan ? [held.held ? copy.checkedBy("you") : stateWords(plan, people, approver)] : []),
  ].filter(Boolean);
  const inCheck = plan?.state === "in_check";

  // ⌘↵ / Ctrl+↵: Mark checked, from anywhere on the page but a field (a line's own editor keeps its keys).
  useEffect(() => {
    if (!inCheck) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], [role='menu']")) return;
      e.preventDefault();
      held.mark();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!plan)
    return (
      <>
        <PageHeader title={view.campaign.name} back={back} meta={meta} />
        <Nothing icon="file-text" title="No plan yet" text={`Fume writes the plan once ${approver} sends the brief.`} />
      </>
    );

  const whole = plan.directions.length > 0;
  const mine = changedByMe(plan, people.me?.id);
  // The customer's brief beside the lines she checks against it (DLAY-11).
  const briefFrom = view.brief.approvedBy ? people.Name(view.brief.approvedBy) : cap(approver);
  const aside = (
    <>
      <p className="ui-plandoc-index-title">
        {briefFrom}’s brief{view.brief.approvedAt ? `, sent ${sentOn(view.brief.approvedAt)}` : ""}
      </p>
      <BriefFacts brief={view.brief} campaign={view.campaign} editable={false} made={view.campaign.counts.creatives} />
    </>
  );

  return (
    <>
      <PageHeader title={view.campaign.name} back={back} meta={meta} />
      {plan.state === "writing" ? (
        <WaitingState
          version={plan.version}
          words="Fume is writing the plan"
          line={`Ready for your check by ${plan.readyBy ? byDay(plan.readyBy) : "tomorrow"}.`}
          steps={[
            {
              label: `${cap(approver)} sent the brief`,
              when: view.brief.approvedAt ? sentOn(view.brief.approvedAt) : undefined,
              state: "done",
            },
            { label: "Fume writes the plan", state: "now" },
            { label: "You check it", state: "ahead" },
            { label: `${cap(approver)} approves it, and the Engine starts`, state: "ahead" },
          ]}
        />
      ) : whole ? (
        <>
          <div className="ui-plandoc-bar">
            <PlanIndex />
          </div>
          <PlanDocument
            plan={plan}
            campaign={view.campaign}
            brief={view.brief}
            people={people}
            mode="staff"
            edit={plan.state !== "approved" && !held.held}
            choose={false}
            aside={plan.state === "in_check" || plan.state === "ready" ? aside : undefined}
          />
        </>
      ) : null}
      {inCheck && !held.held && !held.sent && (
        <PageFooter
          className="ui-plandoc-foot"
          start={`${mine ? `You changed ${mine} in your check.` : "Change what needs it, line by line."} Marked checked, the plan goes to ${approver}.`}
        >
          <Button icon="check" loading={held.sending} onClick={held.mark}>
            Mark checked
            <Kbd className="ui-qa-key" aria-hidden="true">
              {shortcutLabel("⌘↵")}
            </Kbd>
          </Button>
        </PageFooter>
      )}
      {(held.held || held.sent || (plan.state === "ready" && people.isMe(plan.checkedBy))) && (
        <PageFooter
          className="ui-plandoc-foot"
          start={
            <>
              {/* Round 13 (#28): the Focus pointer in Amber, as Check marks "Checked by you" */}
              <CheckMark state="checked" label={copy.checkedBy("you")} />
              {" · "}
              {[
                held.held ? `${cap(approver)} sees it in 10 s` : `It waits on ${approver}`,
                ...(here.loaded && all.loaded && !next ? ["Nothing else waits on you"] : []),
              ].join(" · ")}
            </>
          }
        >
          {held.held && (
            <Button variant={next ? "secondary" : "primary"} icon="undo-2" onClick={held.undo}>
              Undo
            </Button>
          )}
          {next > 0 && (
            <Button asChild iconEnd="arrow-right">
              <Link to={checkPath("fume", here.total ? workspaceId : undefined)}>
                Next: {copy.creatives(next)} in Check
              </Link>
            </Button>
          )}
        </PageFooter>
      )}
    </>
  );
}

/** The check, held 10 s so Undo can take it back before the customer sees anything (DTASK-8). Leaving the page sends a
 *  held check at once. */
function useHeldCheck(campaignId: Id, Approver: string) {
  const check = useCheckPlan();
  const toast = useToast();
  const [held, setHeld] = useState(false);
  const [sent, setSent] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<(() => void) | undefined>(undefined);
  const shown = useRef<ReturnType<typeof toast.done> | undefined>(undefined);

  const send = () => {
    window.clearTimeout(timer.current);
    pending.current = undefined;
    check.mutate(campaignId, {
      onSuccess: () => {
        setHeld(false);
        setSent(true);
      },
      onError: (e) => {
        setHeld(false);
        toast.error("The plan wasn’t marked checked", { description: e.message });
      },
    });
  };
  const undo = () => {
    if (!pending.current) return;
    window.clearTimeout(timer.current);
    pending.current = undefined;
    setHeld(false);
    shown.current?.dismiss();
    toast.info("Check undone", { description: "The plan waits for your check again." });
  };
  const mark = () => {
    if (held || sent || check.isPending) return;
    setHeld(true);
    pending.current = send;
    timer.current = window.setTimeout(send, HOLD);
    shown.current = toast.done("Plan checked", {
      description: `${Approver} sees it in 10 s.`,
      duration: HOLD,
      action: { label: "Undo", onClick: undo },
    });
  };
  useEffect(() => () => pending.current?.(), []);

  return { held, sent, sending: check.isPending, mark, undo };
}

/** What she changed in this version of the plan: lines and creatives (DTASK-9), as "1 line", "2 lines and 1 creative". */
function changedByMe(plan: CampaignPlan, me?: Id): string {
  const direction = chosenOf(plan);
  if (!direction || !me) return "";
  const since = (x: { changedBy?: string; changedAt?: string }) =>
    x.changedBy === me && (!plan.writtenAt || !x.changedAt || x.changedAt >= plan.writtenAt);
  const lines = [...direction.look, ...plan.content].filter(since).length;
  const made = direction.creatives.filter(since).length;
  return [lines ? copy.count(lines, "line") : "", made ? copy.creatives(made) : ""].filter(Boolean).join(" and ");
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Where the plan is, for the expert. */
function stateWords(plan: CampaignPlan, people: PlanPeople, approver: string): string {
  switch (plan.state) {
    case "writing":
      return "Fume is writing it";
    case "in_check":
      return people.expert && people.isMe(people.expert.id)
        ? "Waits on your check"
        : `In check with ${people.expertName}`;
    case "ready":
      return `Waits on ${approver}`;
    case "changes_asked":
      return `${cap(approver)} asked for changes`;
    case "approved":
      return `${people.Name(plan.approvedBy)} approved it`;
  }
}
