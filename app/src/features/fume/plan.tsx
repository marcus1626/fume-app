// The plan in the Fume chat (FLOWS §22, §23). She sends her brief; Fume writes the plan from it; she approves it, and
// only then does the Engine make anything. The chat never says or implies that something is made before that.
// - The plan card in the conversation (MessageCard kind "plan") reads the plan as it is now, not as it was when the
//   card was posted: writing / in check (the words under way in the text shimmer, "Ready by …"), ready (the chosen
//   direction, the count and the dates, "Checked by Anna", "Open the plan"), changes asked, approved. Only the
//   campaign's latest plan card is drawn; an earlier one would show the same plan again, so Fume's words stand alone
//   there. While the panel beside the conversation shows the plan, the card is one line that points to it.
// - The panel beside the conversation on a desk (from 1280 px) follows a campaign once its brief is sent: "The plan"
//   with its state, then its summary and "Open the plan" (secondary: the composer's Send stays the chat's one primary).
// Words: Fume writes the plan; the expert checks it ("Checked by Anna"); she approves it; the Engine only makes
// creatives. No Amber here: Amber stays on checked creatives.
import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  TextShimmer,
} from "@fume/ui";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCampaign, usePeople, usePlan } from "../../api/hooks";
import type { CampaignPlan, Id } from "../../contract";
import * as copy from "../../copy";
import { date, dayGroup, due } from "../../lib/time";
import { directory, initials, useIsMe } from "../../shell/people";
import { useExpertName } from "../brand/parts";
import { BriefRowsList, useBriefRows } from "./desk";
import { useOpenFullPage, useOpenLink } from "./open";

/** The plan page, where she approves the plan or asks for changes. */
export const planHref = (campaignId: Id) => `/campaigns/${campaignId}/plan`;

/** "today", "tomorrow", "Thu 15 Oct": a day in the plan's words, as the plan page and the status sentence say it. */
const day = (iso: string) => due(iso).replace(",", "");
/** "today", "yesterday" or "on 13 Oct": when something was done. */
export const onDay = (iso: string) => {
  const g = dayGroup(iso);
  return g === "Earlier" ? `on ${date(iso)}` : g.toLowerCase();
};

/** "Ready by Thu 22 Oct", "Ready by tomorrow", "Ready today". */
const readyWords = (iso: string | undefined, lead = "Ready") => {
  if (!iso) return undefined;
  const d = day(iso);
  return d === "today" ? `${lead} today` : `${lead} by ${d}`;
};

/** The first sentence of the idea: the idea in one line. */
const firstSentence = (text: string) => /^.*?[.!?](?=\s|$)/.exec(text.trim())?.[0] ?? text.trim();

/** The plan's facts in words: the chosen direction, how many creatives of which kind, when the masters come. */
export function planFacts(plan: CampaignPlan) {
  const direction = plan.directions.find((d) => d.id === plan.chosenDirectionId) ?? plan.directions[0];
  const creatives = direction?.creatives ?? [];
  const masters = creatives.filter((c) => c.kind === "master").length;
  const rest = creatives.length - masters;
  const after = rest === 0 ? "" : rest === 1 ? ", 1 variant or format" : `, ${rest} variants and formats`;
  // How many of them are videos and carousels, once she asked for some in the chat.
  const videos = creatives.filter((c) => c.medium === "video").length;
  const carousels = creatives.filter((c) => c.medium === "carousel").length;
  const media = [videos ? copy.count(videos, "video") : "", carousels ? copy.count(carousels, "carousel") : ""]
    .filter(Boolean)
    .join(" and ");
  return {
    direction,
    /** "9 creatives: 3 masters, 6 variants and formats" (", 2 of them videos") */
    count: creatives.length
      ? `${copy.creatives(creatives.length)}: ${copy.count(masters, "master")}${after}${media ? `; ${media} among them` : ""}`
      : undefined,
    /** "Masters by Thu 22 Oct" */
    masters: plan.timeline[0] ? `Masters by ${day(plan.timeline[0].at)}` : undefined,
  };
}

/** Who acts on the plan now, in words: what shimmers while Fume or the expert works on it, and when it is ready. */
export function usePlanWords(plan: CampaignPlan | null | undefined) {
  const expert = useExpertName();
  const isMe = useIsMe();
  const people = directory(usePeople().data);
  if (!plan) return {};
  const checker = plan.checkedBy ? people.user(plan.checkedBy) : undefined;
  const approver = plan.approvedBy
    ? copy.byYou(people.user(plan.approvedBy)?.name ?? "Someone", isMe(plan.approvedBy), true)
    : undefined;
  switch (plan.state) {
    case "writing":
      return { working: "Fume is writing the plan", meta: readyWords(plan.readyBy), short: "Fume is writing it" };
    case "in_check":
      return {
        working: `${expert} is checking the plan`,
        meta: readyWords(plan.readyBy),
        short: `${expert} is checking it`,
      };
    case "changes_asked":
      return {
        working: "Fume is changing the plan",
        meta: readyWords(plan.readyBy, `Version ${plan.version + 1}, ready`),
        short: "Fume is changing it",
      };
    case "ready":
      return {
        checker,
        short: checker
          ? `Checked by ${copy.byYou(checker.name, isMe(checker.id))}, ready to approve`
          : "Ready to approve",
      };
    case "approved":
      return {
        checker,
        short: `${approver ?? "Someone"} approved it${plan.approvedAt ? ` ${onDay(plan.approvedAt)}` : ""}`,
      };
  }
}

/** The step under way, the one line that shimmers, and when the plan is ready. */
function PlanWorking({ working, meta }: { working: string; meta?: string }) {
  return (
    <div className="ui-chat-plan-state" role="status">
      <TextShimmer className="ui-chat-plan-working">{working}</TextShimmer>
      {meta && <span className="ui-chat-plan-meta">{meta}</span>}
    </div>
  );
}

/** "Checked by Anna" with her face (words, never an Amber mark). */
function CheckedBy({ plan }: { plan: CampaignPlan }) {
  const isMe = useIsMe();
  const people = directory(usePeople().data);
  const user = plan.checkedBy ? people.user(plan.checkedBy) : undefined;
  if (!user) return null;
  return (
    <p className="ui-chat-plan-checked">
      <Avatar
        size="sm"
        src={user.avatar}
        initials={initials(user.name)}
        ink={user.staffRole === "expert"}
        aria-hidden="true"
      />
      <span>Checked by {copy.byYou(user.name, isMe(user.id))}</span>
    </p>
  );
}

/** The ready plan in short: the direction, its idea in one line, the count, the masters' date, who checked it. */
function PlanSummary({ plan }: { plan: CampaignPlan }) {
  const { direction, count, masters } = planFacts(plan);
  if (!direction) return null;
  const facts = [count, masters].filter(Boolean).join(" · ");
  return (
    <div className="ui-chat-plan">
      <div className="ui-chat-plan-direction">
        <p className="ui-chat-plan-eyebrow">
          Direction {direction.letter}
          {direction.recommended ? " · Fume’s pick" : ""}
        </p>
        <p className="ui-chat-plan-name">{direction.name}</p>
        <p className="ui-chat-plan-idea">{firstSentence(direction.idea)}</p>
      </div>
      {facts && <p className="ui-chat-plan-facts">{facts}</p>}
      <CheckedBy plan={plan} />
    </div>
  );
}

/** Version 2 and on: what Fume changed, as Fume said it. */
function VersionNote({ plan }: { plan: CampaignPlan }) {
  if (plan.version < 2 || !plan.note || plan.note.by !== "fume") return null;
  return (
    <p className="ui-chat-plan-note">
      Version {plan.version} · {plan.note.text}
    </p>
  );
}

// ─── The plan card in the conversation ──────────────────────────────────────

/** The plan as it is now. `latest`: this is the campaign's latest plan card (an earlier one is not drawn). `inPanel`:
 *  the panel beside the conversation shows this plan, so the card points to it. */
export function PlanCard({
  campaignId,
  latest = true,
  inPanel,
}: {
  campaignId: Id;
  latest?: boolean;
  inPanel?: boolean;
}) {
  const plan = usePlan(campaignId).data;
  const words = usePlanWords(plan);
  // The card opens the plan the way every chat link does, in the panel beside the talk (on a smaller screen its page,
  // with "Back to the conversation"); the href stays for a new tab.
  const openLink = useOpenLink();
  const open = (e: ReactMouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    openLink({ kind: "plan", campaignId });
  };
  // An earlier card would show the same plan twice: Fume's words stand alone there.
  if (!plan || !latest) return null;
  const href = planHref(campaignId);
  if (inPanel)
    return (
      <Item variant="muted" size="sm">
        <ItemMedia variant="icon">
          <Icon name="layers" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>The plan</ItemTitle>
          <ItemDescription>
            {plan.state === "ready"
              ? "It is on the right. Open it to approve it or ask for changes."
              : `${words.short ?? "The plan"}. It is on the right.`}
          </ItemDescription>
        </ItemContent>
      </Item>
    );
  // A plan she approved: one line that opens it; the Engine's run card follows in the conversation.
  if (plan.state === "approved")
    return (
      <Item variant="outline" size="sm" asChild>
        <Link to={href} onClick={open}>
          <ItemMedia variant="icon">
            <Icon name="layers" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>The plan</ItemTitle>
            <ItemDescription>{words.short}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Icon name="chevron-right" />
          </ItemActions>
        </Link>
      </Item>
    );
  if (plan.state !== "ready")
    return (
      <Card className="ui-chat-plan-card">
        <CardHeader>
          <CardTitle as="p">The plan</CardTitle>
          <CardDescription>
            The direction, the look, every creative and the dates, before anything is made.
          </CardDescription>
        </CardHeader>
        <CardContent>{words.working && <PlanWorking working={words.working} meta={words.meta} />}</CardContent>
      </Card>
    );
  return (
    <Card className="ui-chat-plan-card">
      <CardHeader>
        <CardTitle as="p">The plan</CardTitle>
        <CardDescription>
          {plan.version > 1 ? `Version ${plan.version}, ready to approve` : "Ready to approve"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="ui-app-stack ui-app-stack--tight">
          <VersionNote plan={plan} />
          <PlanSummary plan={plan} />
        </div>
      </CardContent>
      <CardFooter>
        <div className="ui-app-row">
          <Button asChild variant="secondary" size="sm" iconEnd="arrow-right">
            <Link to={href} onClick={open}>
              Open the plan
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

// ─── The panel beside the conversation, once the brief is sent ──────────────

/** What the plan will hold, one line each (FLOWS §22.2), while Fume writes it. */
const PARTS = [
  "Your brief, in Fume’s words",
  "The direction, with reference pictures",
  "The look and the content every creative keeps to",
  "Every creative the Engine will make",
  "The rules it keeps",
  "When each step is ready",
];

/** "The plan" beside the conversation: its state while Fume writes it and the expert checks it, then its summary and
 *  "Open the plan". The brief she sent stays under it, read-only. Opened from a link, its head has "Open full page" and
 *  ✕ (`actions`); while it is ready, her words in the composer change it with Fume. */
export function PlanPanel({ campaignId, actions }: { campaignId: Id; actions?: ReactNode }) {
  const openFull = useOpenFullPage();
  const plan = usePlan(campaignId).data;
  const view = useCampaign(campaignId).data;
  const words = usePlanWords(plan);
  const rows = useBriefRows(view);
  const brief = view?.brief;
  const ready = plan?.state === "ready";
  const sent = brief?.approvedAt ? `Your brief, sent ${onDay(brief.approvedAt)}` : "Your brief";
  return (
    <aside className="ui-chat-brief" aria-labelledby="fume-plan-title">
      <div className="ui-chat-brief-head">
        {actions && (
          <div className="ui-chat-panel-top">
            <p className="ui-chat-plan-eyebrow">{plan && plan.version > 1 ? `Version ${plan.version}` : "The plan"}</p>
            {actions}
          </div>
        )}
        <h2 className="ui-chat-brief-title" id="fume-plan-title" tabIndex={-1}>
          The plan
        </h2>
        {view && <p className="ui-chat-brief-meta">{view.campaign.name}</p>}
      </div>
      <div className="ui-chat-brief-body">
        {!plan ? null : ready ? (
          <div className="ui-app-stack">
            <VersionNote plan={plan} />
            <PlanSummary plan={plan} />
          </div>
        ) : (
          <div className="ui-chat-plan-wait">
            {words.working && <PlanWorking working={words.working} meta={words.meta} />}
            <div className="ui-chat-plan-holds">
              <p className="ui-chat-plan-eyebrow">What the plan will hold</p>
              <ul className="ui-chat-plan-parts">
                {PARTS.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
            {brief && (
              <div className="ui-chat-plan-holds">
                <p className="ui-chat-plan-eyebrow">{sent}</p>
                <BriefRowsList rows={rows} />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="ui-chat-brief-foot">
        <p className="ui-chat-brief-note" role="status">
          {ready
            ? "Change it here: tell Fume how many creatives, videos or carousels, or the dates. Nothing is made before you approve it."
            : "Nothing is made before you approve the plan."}
        </p>
        {ready && (
          <Button asChild variant="secondary" iconEnd="arrow-right">
            <Link
              to={planHref(campaignId)}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                openFull({ kind: "plan", campaignId }); // its page then shows "Back to the conversation"
              }}
            >
              Open the plan
            </Link>
          </Button>
        )}
      </div>
    </aside>
  );
}
