// One campaign (FLOWS §13; Marcus 15 Oct: the Campaigns page "ble litt kaotisk hierarki-messig").
// Round 9 (desktop review 19 Oct, DLAY-3, DWAY-7, DLOAD-9, DLOAD-10, DWAY-20; PROPOSED 19 Oct 2026): ONE compact header,
// the same on all four tabs: the title with the one Ink action on its line ("Review 6") and a quiet History pill; under
// it one meta line: where the campaign stands in one sentence (copy.campaignStatus, the same words as Home, the list,
// ⌘K and the chat), five step dots with the stage's word, and the go-live ("Live from Sat 17 Oct"). The banner is gone:
// what used to sit in it (the run while Fume works, the directions, what is in check) is the body of Creatives. So the
// tabs sit at the same height on every tab, stick under the app bar, and change with replace (Back leaves the page).
// Creatives come in three groups, To approve, Approved and In check (grey places for what Anna still checks), with
// no second "Creatives 8" heading; the chosen direction is one line under them.
// The tabs are routes (/campaigns/:id/:tab). Older tab links still land: overview opens the default tab, directions
// opens Creatives, record opens History. ?c=<id> opens the creative in the one review viewer over Creatives (the same
// word as review; round 9, VIEWER: an older ?creative=<id> link is moved to ?c= on arrival).
// Round 10 (FLOWS §22, PROPOSED 20 Oct 2026; Marcus 20 Oct: "hvor er planen som blir lagd før Engine genererer?"):
// the tabs are Creatives · Moodboard · Plan · Delivery. The Plan tab replaces Brief (features/plan/PlanTab): her brief
// until she sends it, then the plan Fume writes from it, which she approves before the Engine makes anything. An old
// /brief link lands on the Plan tab. The default tab is the Plan until the plan is approved, Creatives after. The
// header's one Ink: "Send to Fume" while the brief waits to be sent (on the Plan tab its footer has it), "Open the
// plan" while the plan waits on her (none on the Plan tab: the plan's own footer decides). Nothing in Creatives says
// that directions or pictures come after the brief: nothing is made before she approves the plan.
// Round 11 CLIENT FLOW (FLOWS §24.2, §24.5; PROPOSED 20 Oct 2026): in a brand an agency runs, the agency's people never
// approve a creative. Their header's Ink is "Send to client" (the review, with the panel open); their first group is
// "Ready for Maja", each creative saying whether it waits on her; an approval they recorded says so on its tile
// ("Maja approved · recorded by Nora", "recorded by you").
// Round 12 AGENCY (UX review DLOAD-5, DLOAD-4; brief r12 SENDING; PROPOSED 20 Oct 2026): the agency's checked creatives
// are in two groups, "To send" and "With Maja", and its Ink is "Send to Maja" only while something is not sent. The
// client's "Review N" counts what was sent to her (waits.toSend is the agency's, never hers).
// Round 13 (Marcus's video comments #21, #27, #36, #35, #28, robot note 03; PROPOSED 22 Oct 2026): the tabs are the
// campaign's six stages, Brief → Moodboard → Plan → Masters → Creatives → Delivery (stages.ts), and the page opens on
// the stage the campaign is in. A stage behind it reads as done (a check before its word), the one it is in reads as
// the step, and later stages are quiet but open (they say what comes there). Brief is her brief, changeable until the
// plan is approved; Moodboard is optional: Fume proposes one from the brief and the Brand DNA, she adds to it, or skips
// it. Masters are the first creatives (and directions, on a campaign from before the plan); Creatives the variants and
// formats. /campaigns/:id/<stage> opens each; /directions lands on Masters. The moodboard sits in a board of fixed
// height (zoom never scrolls the page) and opens full screen as a layer over the whole app (Esc closes it). History
// holds the plan's own steps too (sent, written, checked, changed, asked, approved), the expert's check with the
// Amber checked triangle.
import {
  Button,
  CreativeGrid,
  CreativeTile,
  EngineRun,
  FilterBar,
  Icon,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemMediaImage,
  ItemTitle,
  PageHeader,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useNarrowScreen,
  useToast,
  type FilterDef,
  type FilterValue,
  type IconName,
} from "@fume/ui";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useBoard, useCampaign, useDeliveries, usePeople, usePlan, useSendBrief, useSession, useSkipMoodboard, useTeam } from "../../api/hooks";
import type { Board as BoardData, CampaignPlan, CampaignView, Creative, Format, MessageAuthor, RecordEvent } from "../../contract";
import * as copy from "../../copy";
import { date, due, when } from "../../lib/time";
import { Back, Nothing, Page, Query, Section, useTabNavigate } from "../../shell/Page";
import { directory } from "../../shell/people";
import { Board } from "../boards/Board";
import { StartMoodboard } from "../boards/StartMoodboard";
import { CampaignDeliveries } from "../deliveries/CampaignDeliveries";
import { runForCustomer } from "../fume/parts";
import { BriefTab, PlanTab } from "../plan/PlanTab";
import { chosenOf, creativesOf } from "../plan/words";
import { QuestionSheet, useQuestion } from "../questions/QuestionSheet";
import { useCustomerNames } from "../review/names";
import { useOverlay } from "../review/overlay";
import { ReviewViewer } from "../review/ViewerPage";
import { CreativeCard, formatLine, runProps } from "../shared/creatives";
import { ClientCheck } from "../agency/ClientCheck";
import { useAgencyScope, useCampaignSends } from "../agency/clientFlow";
import { DirectionCard, FilterSheet, rights, StepDots } from "./parts";
import { briefGaps } from "./brief-lines";
import { STAGES, stageIndex, stageLabel, stageOf, type Stage } from "./stages";

/** The tabs are the six stages (round 13), in stages.ts's order and words. */
type Tab = Stage;
const tabs = STAGES.map((s) => s.id) as Tab[];
/** The tab names of earlier campaign pages, so their links keep working. */
const oldTab: Record<string, Tab | undefined> = { directions: "masters", variants: "creatives" };
/** Which creatives each stage shows: the masters, then the variants and formats. */
const kindOf: Partial<Record<Tab, Creative["kind"]>> = { masters: "master", creatives: "variant" };

const recordIcon: Record<RecordEvent["action"], IconName> = {
  brief_approved: "file-text",
  direction_chosen: "columns-2",
  made: "fume-engine",
  checked: "fume-check",
  correction: "pencil",
  held: "pause",
  approved: "circle-check",
  changes_requested: "message-square",
  delivered: "download",
  confirmed_live: "external-link",
  brand_dna_approved: "palette",
};

/** Names as the signed-in person reads them: "you" for herself (DLOAD-18), first names for everyone else. */
interface Names {
  /** "you" / "Anna", for the middle of a sentence. */
  name: (id?: string) => string;
  /** "You" / "Anna", to start one. */
  Name: (id?: string) => string;
  user: ReturnType<typeof directory>["user"];
  author: ReturnType<typeof directory>["author"];
  /** Fume's expert on this brand, by first name ("Anna"), or "the expert". */
  expert: string;
}

function useNames(): Names {
  const session = useSession().data!;
  const people = directory(usePeople().data);
  const team = useTeam().data?.fumeTeam ?? [];
  const expert = team.find((u) => u.staffRole === "expert")?.name.split(" ")[0] ?? "the expert";
  const full = (id?: string) => (id ? (people.user(id)?.name ?? people.name(id)) : "");
  return {
    name: (id) => copy.byYou(full(id), id === session.user.id),
    Name: (id) => copy.byYou(full(id), id === session.user.id, true),
    user: people.user,
    author: people.author,
    expert,
  };
}

/** The stage the campaign is in, as a tab: its contract stage (stageOf), and Delivery once it is approved. */
function stageNow(view: CampaignView): Tab {
  const { campaign } = view;
  if (["approved", "delivered", "closed"].includes(campaign.state)) return "delivery";
  return stageOf(campaign);
}

/** The tab a tab param names, or the default: the stage the campaign is in (round 13). A creative opened in the viewer
 *  (?c=) opens the stage it belongs to. */
function tabOf(param: string | undefined, view: CampaignView, open: string | null): Tab {
  if ((tabs as readonly string[]).includes(param ?? "")) return param as Tab;
  const old = oldTab[param ?? ""];
  if (old) return old;
  const shown = open ? view.creatives.find((c) => c.id === open) : undefined;
  if (shown) return shown.kind === "master" ? "masters" : "creatives";
  return stageNow(view);
}

/** How a stage's tab reads: done (behind the campaign), now (the stage it is in), or later (quiet, still open). The
 *  moodboard is optional: past it, it reads as done once it has a board or she skipped it. */
function tabState(t: Tab, view: CampaignView): "done" | "now" | "later" {
  const now = stageIndex(stageNow(view));
  const i = stageIndex(t);
  const finished = ["delivered", "closed"].includes(view.campaign.state);
  if (finished || i < now) return t === "moodboard" && !view.campaign.boardId && !view.campaign.moodboardSkipped ? "later" : "done";
  return i === now ? "now" : "later";
}

export function CampaignPage() {
  const { campaignId, tab } = useParams<"campaignId" | "tab">();
  const campaign = useCampaign(campaignId);
  const name = campaign.data?.campaign.name ?? "Campaign";
  const label = tab && (tabs as readonly string[]).includes(tab) ? stageLabel(tab as Tab) : undefined;
  return (
    <Page title={name} docTitle={label ? `${label} · ${name}` : undefined}>
      <Query query={campaign} loading="Loading the campaign">
        {(view) => <CampaignScreen view={view} />}
      </Query>
    </Page>
  );
}

function CampaignScreen({ view }: { view: CampaignView }) {
  const { tab: tabParam } = useParams<"tab">();
  const [params, setParams] = useSearchParams();
  const session = useSession().data!;
  const names = useNames();
  const navigate = useNavigate();
  const goTab = useTabNavigate();
  const narrow = useNarrowScreen();
  const can = rights(session.role);
  const { campaign } = view;
  const base = `/campaigns/${campaign.id}`;
  const tab = tabOf(tabParam, view, params.get("c") ?? params.get("creative"));
  // One word for the open creative, the same as review (?c=); an older ?creative= link still lands.
  const legacy = params.get("creative");
  useEffect(() => {
    if (!legacy) return;
    const next = new URLSearchParams(params);
    next.delete("creative");
    next.set("c", legacy);
    setParams(next, { replace: true });
  }, [legacy, params, setParams]);
  const [recordOpen, setRecordOpen] = useState(tabParam === "record");
  // The plan's state, for the header's action and the index of its parts in the tab row (cached: the tab reads it too).
  const plan = usePlan(campaign.id).data;
  const count = (k: Creative["kind"]) => view.creatives.filter((c) => c.kind === k).length || undefined;

  return (
    <>
      <PageHeader
        className="ui-campaign-header"
        title={campaign.name}
        back={<Back to="/campaigns" label="Campaigns" />}
        description={<CampaignMeta view={view} names={names} />}
        actions={
          <>
            <Button variant="quiet" size="sm" icon="list" onClick={() => setRecordOpen(true)}>
              <span className="ui-page-header-label">History</span>
            </Button>
            <HeadAction view={view} tab={tab} can={can} plan={plan} />
          </>
        }
      />

      <Tabs value={tab} onValueChange={(t) => goTab(`${base}/${t}`)} className="ui-campaign-body">
        <div className="ui-campaign-tabs">
          <TabsList aria-label={`${campaign.name}, stages`}>
            {tabs.map((t) => {
              const state = tabState(t, view);
              return (
                <TabsTrigger
                  key={t}
                  value={t}
                  data-stage={state}
                  icon={state === "done" ? "circle-check" : undefined}
                  title={state === "done" ? `${stageLabel(t)}, done` : state === "now" ? `${stageLabel(t)}, the stage it is in` : undefined}
                  count={kindOf[t] ? count(kindOf[t]!) : undefined}
                >
                  {stageLabel(t)}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {/* Round 12 (DLAY-10, DWAY-12): the plan's index lives in the plan's own sticky aside, not in this row */}
        </div>
        <TabsContent value={tab}>
          <div className="ui-campaign-tab">
            {tab === "brief" && <BriefTab view={view} can={can} />}
            {tab === "moodboard" && <MoodboardTab view={view} can={can} />}
            {tab === "plan" && <PlanTab view={view} can={can} />}
            {(tab === "masters" || tab === "creatives") && <CreativesTab key={tab} view={view} names={names} plan={plan} kind={kindOf[tab]!} />}
            {tab === "delivery" && <DeliveryTab view={view} />}
          </div>
        </TabsContent>
      </Tabs>

      <Sheet
        open={recordOpen}
        onOpenChange={(open) => {
          setRecordOpen(open);
          if (!open && tabParam === "record") navigate(base, { replace: true });
        }}
      >
        <SheetContent side={narrow ? "bottom" : "right"} size="md">
          <SheetHeader>
            <SheetTitle>History</SheetTitle>
            <SheetDescription>Who did what to {campaign.name}, and when. Nothing here is ever overwritten.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <RecordPanel view={view} names={names} plan={plan} />
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── The header: one sentence, the step, the go-live; one Ink action ─────────

/** The meta line under the title (DLOAD-3, DLOAD-10): where it stands in ONE sentence, the step as dots (their name
 *  says the step; no second stage word beside a sentence that already says it), the go-live, each part after a dot:
 *  "Fume is making 3 directions · ●●○○○ · Live from Tue 3 Nov". */
function CampaignMeta({ view, names }: { view: CampaignView; names: Names }) {
  const { campaign } = view;
  const status = copy.campaignStatus(campaign);
  const live = copy.campaignLive(campaign);
  // Round 12 (DLOAD-4): in agency work the agency writes the brief, so "Maja approves" shows from the plan on (round 13,
  // Marcus's card 23 Oct 2026: the client approves the plan the agency checked and sent her).
  const planning = useAgencyScope() === "agency" && campaign.stage === "brief";
  const approver = view.approver.id !== useSession().data?.user.id && !planning ? `${names.Name(view.approver.id)} approves` : undefined;
  const parts: ReactNode[] = [
    <span key="status" className="ui-campaign-meta-status" data-waiting={status.waiting ? "" : undefined}>
      {status.words}
    </span>,
    <StepDots key="step" campaign={campaign} word={false} />,
    ...(live ? [<span key="live">{live}</span>] : []),
    ...(approver ? [<span key="approver">{approver}</span>] : []),
  ];
  return (
    <span className="ui-campaign-meta">
      {parts.map((part, i) => (
        // Each part after its quiet dot; the dot that would start a line is clipped (as PageHeader's meta line does),
        // so a wrapped line never starts or ends on a dot.
        <span key={i} className="ui-campaign-meta-part">
          <span className="ui-campaign-meta-sep" aria-hidden="true">
            {i > 0 ? " · " : ""}
          </span>
          {part}
        </span>
      ))}
    </span>
  );
}

/** The campaign's one Ink action, on the title's line (DLAY-13): what waits on her, wherever she is in the campaign.
 *  None while Fume works, for a viewer, or on the Plan tab while its own footer holds the step (Send to Fume, Approve
 *  the plan). */
function HeadAction({ view, tab, can, plan }: { view: CampaignView; tab: Tab; can: ReturnType<typeof rights>; plan: CampaignPlan | null | undefined }) {
  const { campaign, brief } = view;
  const deliveries = useDeliveries();
  const send = useSendBrief();
  const toast = useToast();
  const question = useQuestion({ campaignId: campaign.id });
  const [asking, setAsking] = useState(false);
  const scope = useAgencyScope();
  const agency = scope === "agency";
  if (!can.act) return null;
  const base = `/campaigns/${campaign.id}`;
  const delivery = (deliveries.data ?? []).find((d) => d.campaignId === campaign.id);
  const w = { questions: 0, directions: 0, briefReady: false, ...campaign.waits };
  const go = (label: string, to: string) => (
    <Button asChild className="ui-page-header-primary" iconEnd="arrow-right">
      <Link to={to}>{label}</Link>
    </Button>
  );
  const planReady = (plan?.state ?? w.plan) === "ready";

  switch (campaign.state) {
    case "draft":
    case "awaiting_input": {
      if (question || w.questions > 0)
        return question ? (
          <>
            <Button className="ui-page-header-primary" iconEnd="arrow-right" onClick={() => setAsking(true)}>
              Answer
            </Button>
            <QuestionSheet campaignId={campaign.id} open={asking} onOpenChange={setAsking} />
          </>
        ) : (
          go("Answer", `/fume/${view.threadId}`)
        );
      // She sends her brief to Fume (round 10): only once it is complete; on the Brief tab its footer has the action.
      if (brief.state === "ready" && briefGaps(brief).length > 0) return tab === "brief" ? null : go("Finish the brief", `${base}/brief`);
      if (brief.state === "ready")
        return tab === "brief" || !can.approve ? null : (
          <Button
            className="ui-page-header-primary"
            icon="send"
            loading={send.isPending}
            onClick={() =>
              void send.mutateAsync(campaign.id).then(
                () => toast.done("Sent to Fume", { description: "Fume is writing the plan. You approve it before anything is made." }),
                (e: Error) => toast.error("The brief wasn’t sent", { description: e.message }),
              )
            }
          >
            Send to Fume
          </Button>
        );
      return go("Continue with Fume", `/fume/${view.threadId}`);
    }
    case "in_review":
      // A brief she changed after sending it goes to Fume again from its own tab (round 13).
      if (brief.state === "ready" && campaign.stage === "plan" && can.approve) return tab === "brief" ? null : go("Send the new brief", `${base}/brief`);
      // The plan waits on her: its own footer decides on the Plan tab; anywhere else the way there.
      // Round 13 (Marcus's card): the agency's client gets the plan once the agency sent it (checked); then it is hers.
      if (campaign.stage === "plan" || planReady) return planReady && (scope !== "client" || plan?.checkedBy || w.planChecked) ? (tab === "plan" ? null : go("Open the plan", `${base}/plan`)) : null;
      if (w.directions > 0) return go("Choose a direction", `${base}/review`);
      // The agency sends checked creatives to the client, who approves them (round 11).
      if (campaign.counts.checked > 0) {
        // Round 12: the agency's Ink only while something is not sent; the client reviews what was sent to her.
        const toSend = w.toSend ?? 0;
        if (agency) return toSend > 0 ? go(copy.send.action(view.approver.name.split(" ")[0] ?? "the client"), `${base}/review?send=1`) : null;
        const ready = campaign.counts.checked - toSend;
        return ready > 0 ? go(`Review ${ready}`, `${base}/review`) : null;
      }
      return null;
    case "approved":
      return go("Get the delivery", delivery ? `/deliveries/${delivery.id}` : `${base}/delivery`);
    case "delivered":
      return delivery ? go("Download", `/deliveries/${delivery.id}`) : null;
    default:
      return null;
  }
}

// ─── Creatives: what waits, what is approved, what is in check ──────────────

const formats = Object.keys(copy.format) as Format[];

/** Under this many creatives the grid shows them all: search and filters cost more than they help (LOAD-13). */
const FILTER_FROM = 20;

const isApproved = (c: Creative) => c.current.state === "approved" || c.current.state === "delivered";
const inTheWorks = (c: Creative) => ["making", "in_check", "correcting", "held"].includes(c.current.state);

/** Masters (kind "master": the first creatives she approves, and directions on a campaign from before the plan) or
 *  Creatives (kind "variant": the variants and formats that follow them), round 13. */
function CreativesTab({ view, names, plan, kind }: { view: CampaignView; names: Names; plan: CampaignPlan | null | undefined; kind: Creative["kind"] }) {
  const [query, setQuery] = useState("");
  const [value, setValue] = useState<FilterValue>({});
  const [sheet, setSheet] = useState(false);
  const viewer = useOverlay("c");
  const me = useSession().data?.user.name.split(" ")[0] ?? "";
  const { campaign } = view;
  // A brand an agency runs (round 11): the tiles say who a creative waits on and who recorded an approval.
  const scope = useAgencyScope();
  const { waitingOn, split } = useCampaignSends(campaign.id, scope === "agency");
  // Every creative under the name she approves it by, here, in the viewer and in the delivery (TASK-17).
  const named = useCustomerNames(campaign);
  const all = useMemo(() => view.creatives.filter((c) => c.kind === kind).map(named), [view.creatives, named, kind]);
  const masters = kind === "master";
  // The run of this stage: the masters (or the directions before them), or the variants and formats.
  const running = view.runs.find((r) => r.state !== "done" && (masters ? r.purpose !== "variants" : r.purpose === "variants" || r.purpose === "correction"));
  const filtering = all.length >= FILTER_FROM;
  const proposed = masters ? view.directions.filter((d) => d.state === "proposed") : [];
  const chosen = view.directions.find((d) => d.state === "chosen");
  // Is this the stage under way? Only then do the creatives the expert still checks belong here.
  const here = (masters ? ["directions", "masters"] : ["variants", "delivery"]).includes(campaign.stage);

  const directionName = (id: string) => {
    const d = view.directions.find((x) => x.id === id);
    return d ? `${d.letter} · ${d.name}` : "Direction";
  };
  const directionIds = [...new Set(all.map((c) => c.directionId))];
  const filters: FilterDef[] = [
    ...(directionIds.length > 1 ? [{ key: "direction", label: "Direction", options: directionIds.map((id) => ({ value: id, label: directionName(id) })) }] : []),
    {
      key: "format",
      label: "Format",
      options: formats.filter((f) => all.some((c) => c.format === f)).map((f) => ({ value: f, label: copy.format[f].label, meta: copy.format[f].ratio })),
    },
  ];
  const pick = (key: string, v: string) => !filtering || !value[key]?.length || value[key]!.includes(v);
  const q = filtering ? query.trim().toLowerCase() : "";
  const shown = all.filter(
    (c) => (!q || c.title.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) && pick("direction", c.directionId) && pick("format", c.format),
  );

  // The viewer moves through what is shown; a link to a creative that the filters hide opens it among all of them.
  const open = viewer.value;
  const list: Creative[] = open && !shown.some((c) => c.id === open) ? all : shown;

  // Three groups (DLOAD-9): what waits on her, what is with Fume after her change request, what she approved; then
  // a grey place for each creative the expert still checks (she sees it once it is checked).
  const toApprove = shown.filter((c) => c.current.state === "checked");
  const changing = shown.filter((c) => c.current.state === "changes_requested");
  const approved = shown.filter(isApproved);
  const inCheckShown = shown.filter(inTheWorks);
  const unseen = here ? Math.max(0, campaign.counts.inCheck - view.creatives.filter(inTheWorks).length) : 0;
  const tile = (c: Creative) =>
    scope ? (
      <CreativeTile
        key={c.id}
        src={c.current.image}
        alt={c.title}
        format={c.format}
        label={c.title}
        caption={formatLine(c)}
        check={<ClientCheck creative={c} people={names.user} waitingOn={scope === "agency" ? waitingOn(c.current) : undefined} client={names.Name(view.approver.id)} />}
        onOpen={() => viewer.open(c.id)}
      />
    ) : (
      <CreativeCard key={c.id} creative={c} people={names.user} onOpen={() => viewer.open(c.id)} />
    );
  const by = campaign.waits?.by;

  // Nothing made yet. Before the plan is approved nothing is made at all (round 10): say so, and the way to the plan.
  const planApproved = plan?.state === "approved" || !["brief", "plan"].includes(campaign.stage);
  if (all.length === 0 && (!masters || view.directions.length === 0) && !running && unseen === 0) {
    if (!planApproved) {
      const state = plan?.state;
      // Round 12 (DLOAD-4, brief r12): Fume starts on the masters (the Engine only makes them). Round 13 (Marcus's card,
      // 23 Oct 2026): in agency work the agency checks the plan and sends it; the client approves it.
      const client = scope === "client";
      const clientName = view.approver.name.split(" ")[0] ?? "the client";
      const text =
        client
          ? state === "ready" && plan?.checkedBy
            ? "Your agency checked the plan. Approve it and Fume starts on the masters."
            : "Your agency checks the plan and sends it to you. Nothing is made before you approve it."
          : !plan
          ? "Send your brief to Fume. Fume writes the plan from it, and you approve the plan first."
          : state === "ready" && scope === "agency"
            ? plan.checkedBy
              ? `You sent the plan to ${clientName}. Fume starts on the masters once she approves it.`
              : `Check the plan and send it to ${clientName}. Fume starts on the masters once she approves it.`
          : state === "ready"
            ? `The plan is ready, checked by ${names.expert}. Approve it and Fume starts on the masters.`
            : state === "changes_asked"
              ? "Fume is changing the plan as you asked. You approve the next version first."
              : state === "in_check"
                ? `${names.expert.charAt(0).toUpperCase() + names.expert.slice(1)} is checking the plan${plan.readyBy ? `; you see it by ${due(plan.readyBy)}` : ""}.`
                : `Fume is writing the plan${plan.readyBy ? `; you see it by ${due(plan.readyBy)}` : ""}.`;
      return (
        <Nothing
          icon="file-text"
          title={scope === "agency" ? `Nothing is made before ${clientName} approves the plan.` : "Nothing is made before you approve the plan."}
          text={text}
          action={
            <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
              <Link to={`/campaigns/${campaign.id}/plan`} replace>
                Open the plan
              </Link>
            </Button>
          }
        />
      );
    }
    // Creatives before the masters are approved: they follow them (round 13).
    if (!masters && !here)
      return (
        <Nothing
          icon="layers"
          title="The creatives follow the masters"
          text="Once you approve the masters, Fume makes the variants and formats from them. They show here once they are checked."
          action={
            view.creatives.some((c) => c.kind === "master") ? (
              <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
                <Link to={`/campaigns/${campaign.id}/masters`} replace>
                  Open the masters
                </Link>
              </Button>
            ) : undefined
          }
        />
      );
    const status = copy.campaignStatus(campaign, undefined, { date: false });
    return (
      <Nothing
        icon="fume-engine"
        title={status.words}
        text={`${names.expert === "the expert" ? "The expert checks" : `${names.expert} checks`} each one before you see it.${by ? ` The first are here by ${due(by)}.` : ""}`}
      />
    );
  }

  return (
    <>
      {running && (
        <Section title="Being made" titleId="campaign-making">
          {/* The date it works to is in the header's sentence ("· by Sun 18 Oct"); a paused clock is said here. */}
          {/* In her words, as the chat says it ("Anna is checking · 6 of 9", "You approved the first 2 creatives"). */}
          <EngineRun {...runForCustomer(runProps(running), me)} description={view.clock?.state === "paused_waiting_on_you" ? "Paused until you answer Fume." : undefined} />
        </Section>
      )}

      {proposed.length > 0 && (
        <Section title="Directions to choose from" meta={proposed.length} titleId="campaign-directions" text="Pick one to take forward, or tell Fume why none fits.">
          <div className="ui-app-grid">
            {view.directions.map((d) => (
              <DirectionCard key={d.id} direction={d} name={names.name} />
            ))}
          </div>
        </Section>
      )}

      {filtering && all.length > 0 && (
        <>
          <FilterBar query={query} onQueryChange={setQuery} filters={filters} value={value} onValueChange={setValue} shown={shown.length} total={all.length} onOpenSheet={() => setSheet(true)} />
          <FilterSheet open={sheet} onOpenChange={setSheet} filters={filters} value={value} onValueChange={setValue} shown={shown.length} noun={["creative", "creatives"]} />
        </>
      )}
      {filtering && shown.length === 0 && <Nothing icon="search" title="No creative matches" text="Try another format or kind, or clear the filters." />}

      {scope === "agency" && toApprove.length > 0 && (
        <AgencyChecked toApprove={toApprove} split={split} tile={tile} checked={names.expert === me ? "You checked them" : `Checked by ${names.expert}`} client={names.Name(view.approver.id)} />
      )}

      {scope !== "agency" && toApprove.length > 0 && (
        <Section
          title="To approve"
          meta={toApprove.length}
          titleId="campaign-to-approve"
          text={`Checked by ${names.expert}. Approve them, or ask for changes with a pin.`}
        >
          <CreativeGrid aria-labelledby="campaign-to-approve">{toApprove.map(tile)}</CreativeGrid>
        </Section>
      )}

      {changing.length > 0 && (
        <Section title="Being changed" meta={changing.length} titleId="campaign-changing" text={scope === "agency" ? `${names.Name(view.approver.id)} asked for changes. Make the new versions in the Studio and check them; then send them again.` : `You asked for changes. ${names.expert} checks each new version before you see it.`}>
          <CreativeGrid aria-labelledby="campaign-changing">{changing.map(tile)}</CreativeGrid>
        </Section>
      )}

      {approved.length > 0 && (
        <Section title="Approved" meta={approved.length} titleId="campaign-approved">
          <CreativeGrid aria-labelledby="campaign-approved">{approved.map(tile)}</CreativeGrid>
        </Section>
      )}

      {(inCheckShown.length > 0 || unseen > 0) && (
        <Section title="In check" meta={inCheckShown.length + unseen} titleId="campaign-in-check" text={`${names.expert === "the expert" ? "The expert checks" : `${names.expert} checks`} each one. You see it here once it is checked.`}>
          <CreativeGrid aria-labelledby="campaign-in-check">
            {inCheckShown.map(tile)}
            {Array.from({ length: unseen }, (_, i) => (
              <li key={`unseen-${i}`} className="ui-campaign-slot">
                <span className="ui-campaign-slot-media" aria-hidden="true" />
                <span className="ui-campaign-slot-caption">In check</span>
              </li>
            ))}
          </CreativeGrid>
        </Section>
      )}

      {masters && all.length === 0 && view.directions.length > 0 && proposed.length === 0 && (
        <Nothing
          icon="image"
          title="No creatives to see yet"
          text={campaign.counts.inCheck > 0 ? `${copy.creatives(campaign.counts.inCheck)} in check. You see each one once it is checked.` : "You see each creative here once it is checked; the other sizes follow once you approve the masters."}
        />
      )}

      {masters && (chosen ? <ChosenDirection view={view} names={names} /> : plan?.state === "approved" && <PlanDirection view={view} plan={plan} names={names} />)}

      {open && list.some((c) => c.id === open) && (
        <ReviewViewer set={list} campaigns={[campaign]} creativeId={open} all={all} threadId={view.threadId} onMove={viewer.move} onClose={viewer.close} />
      )}
    </>
  );
}

/** The direction every creative is made on, as one line under the creatives; the others one click away (left-aligned). */
function ChosenDirection({ view, names }: { view: CampaignView; names: Names }) {
  const [all, setAll] = useState(false);
  const chosen = view.directions.find((d) => d.state === "chosen")!;
  return (
    <Section title="Direction" titleId="campaign-direction">
      <Item variant="muted">
        <ItemMedia variant="image">
          <ItemMediaImage src={chosen.cover} alt="" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            {chosen.letter} · {chosen.name}
          </ItemTitle>
          <ItemDescription>
            Chosen by {names.name(chosen.decidedBy)}
            {chosen.decidedAt ? ` on ${date(chosen.decidedAt)}` : ""}. Every creative is made on it.
          </ItemDescription>
        </ItemContent>
      </Item>
      {view.directions.length > 1 && (
        <div className="ui-app-row">
          <Button variant="quiet" size="sm" iconEnd={all ? "chevron-up" : "chevron-down"} aria-expanded={all} onClick={() => setAll((x) => !x)}>
            {all ? "Hide the other directions" : `See all ${view.directions.length} directions`}
          </Button>
        </div>
      )}
      {all && (
        <div className="ui-app-grid">
          {view.directions.map((d) => (
            <DirectionCard key={d.id} direction={d} name={names.name} />
          ))}
        </div>
      )}
    </Section>
  );
}

/** A campaign made from a plan: its direction as one line under the creatives, the plan one click away. */
function PlanDirection({ view, plan, names }: { view: CampaignView; plan: CampaignPlan; names: Names }) {
  const direction = chosenOf(plan);
  if (!direction) return null;
  const cover = direction.references[0]?.image;
  const { masters } = creativesOf(plan);
  return (
    <Section
      title="Direction"
      titleId="campaign-direction"
      action={
        <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
          <Link to={`/campaigns/${view.campaign.id}/plan`} replace>
            Open the plan
          </Link>
        </Button>
      }
    >
      <Item variant="muted">
        {cover && (
          <ItemMedia variant="image">
            <ItemMediaImage src={cover} alt="" />
          </ItemMedia>
        )}
        <ItemContent>
          <ItemTitle>
            {direction.letter} · {direction.name}
          </ItemTitle>
          <ItemDescription>
            In the plan {names.name(plan.approvedBy)} approved{plan.approvedAt ? ` on ${date(plan.approvedAt)}` : ""}. The {copy.count(masters.length, "master")} and everything after {masters.length === 1 ? "it" : "them"} are made on it.
          </ItemDescription>
        </ItemContent>
      </Item>
    </Section>
  );
}

// ─── Moodboard ──────────────────────────────────────────────────────────────

function MoodboardTab({ view, can }: { view: CampaignView; can: ReturnType<typeof rights> }) {
  const { campaign } = view;
  const board = useBoard(campaign.boardId);
  const skip = useSkipMoodboard();
  const toast = useToast();
  const [starting, setStarting] = useState(false);
  const [full, setFull] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  if (!campaign.boardId) {
    // Skipped (round 13): Fume plans from the brief and the Brand DNA; a moodboard can still be started.
    if (campaign.moodboardSkipped && !starting)
      return (
        <Nothing
          icon="layers"
          title="You skipped the moodboard"
          text="Fume plans from your brief and your Brand DNA. Start one any time; Fume reads it for what comes next."
          action={
            can.ask ? (
              <Button variant="secondary" icon="plus" onClick={() => setStarting(true)}>
                Start a moodboard
              </Button>
            ) : undefined
          }
        />
      );
    if (!can.ask)
      return <Nothing icon="layers" title="No moodboard yet" text="Fume proposes one from the brief and the Brand DNA; the team adds to it or skips it." />;
    // Fume's proposal from the brief and the Brand DNA, ready to start; she takes pictures away, adds her own, or skips.
    return (
      <Section
        title="Fume’s moodboard for this campaign"
        titleId="campaign-moodboard"
        text="Fume picked these from your brief and your Brand DNA. Take any away, pick more from your boards or add your own. The moodboard is optional: skip it and Fume plans from the brief and the Brand DNA."
      >
        <StartMoodboard
          campaign={campaign}
          brief={view.brief}
          onSkip={
            starting
              ? undefined
              : () =>
                  skip.mutate(campaign.id, {
                    onSuccess: () => toast.done("Moodboard skipped", { description: "Fume plans from your brief and your Brand DNA." }),
                    onError: (e) => toast.error("That wasn’t saved", { description: e.message }),
                  })
          }
          skipping={skip.isPending}
          onCancel={starting ? () => setStarting(false) : undefined}
        />
      </Section>
    );
  }
  return (
    <Section
      text="Pictures you liked and pictures Fume proposes for this campaign. A picture you like or pass on, with a reason, teaches Fume your taste."
      action={
        <Button ref={opener} variant="quiet" size="sm" icon="expand" onClick={() => setFull(true)}>
          Open full screen
        </Button>
      }
      title="Moodboard"
      titleId="campaign-moodboard"
    >
      <Query query={board} loading="Opening the moodboard">
        {(b) =>
          full ? (
            <>
              <div className="ui-board ui-board--embedded" aria-hidden="true" />
              <FullScreenBoard
                board={b}
                onClose={() => {
                  setFull(false);
                  window.requestAnimationFrame(() => opener.current?.focus({ preventScroll: true }));
                }}
              />
            </>
          ) : (
            <Board board={b} embedded />
          )
        }
      </Query>
    </Section>
  );
}

/** The moodboard full screen (round 13, #35): one layer over the whole app, sidebar and all, the board filling it with
 *  its toolbar pinned at the foot. Esc closes it (after letting go of a selected item), and so does "Close". */
function FullScreenBoard({ board, onClose }: { board: BoardData; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  const done = useRef(onClose);
  done.current = onClose;
  useEffect(() => {
    close.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      // the board's own Esc lets go of the selected item first (it marks the key as handled)
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [role='dialog'] [role='dialog'], [data-radix-popper-content-wrapper]")) return;
      e.preventDefault();
      done.current();
    };
    window.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = before;
    };
  }, []);
  return createPortal(
    <div className="ui-board-full" role="dialog" aria-modal="true" aria-labelledby="board-full-title">
      <div className="ui-board-full-head">
        <h2 className="ui-board-full-title" id="board-full-title">
          {board.name}
        </h2>
        <Button ref={close} variant="secondary" size="sm" icon="x" onClick={onClose} aria-keyshortcuts="Escape">
          Close full screen
        </Button>
      </div>
      <div className="ui-board-full-frame">
        <Board board={board} />
      </div>
    </div>,
    document.body,
  );
}

// ─── Delivery ───────────────────────────────────────────────────────────────

function DeliveryTab({ view }: { view: CampaignView }) {
  const { campaign } = view;
  return (
    <Section
      title="Delivery"
      titleId="campaign-delivery"
      text={campaign.collectionIds?.length ? "Each collection can be delivered as soon as all of its creatives are approved." : undefined}
    >
      <CampaignDeliveries campaignId={campaign.id} />
    </Section>
  );
}

// ─── History (the side panel) ───────────────────────────────────────────────

/** One line of History: the campaign's record, and (round 13, robot note 03) the plan's own steps. */
interface HistoryRow {
  id: string;
  icon: IconName;
  detail: string;
  actor: MessageAuthor;
  at: string;
  /** The expert's check: the Amber checked triangle, the same mark as Check's "Checked by you" (#28). */
  checked?: boolean;
}

const person = (id?: string): MessageAuthor => (id && id !== "fume" ? { kind: "person", userId: id } : { kind: "fume" });

/** The plan's steps as History lines: the brief sent, the plan written, the expert's check (asked for and done), each
 *  line or creative changed, each change asked for and each version Fume wrote, the approval. */
function planHistory(view: CampaignView, plan: CampaignPlan | null | undefined): HistoryRow[] {
  const rows: HistoryRow[] = [];
  const { brief } = view;
  if (brief.approvedAt && !view.record.some((e) => e.action === "brief_approved"))
    rows.push({ id: "h-brief", icon: "send", detail: `Sent the brief, version ${brief.version}`, actor: person(brief.approvedBy), at: brief.approvedAt });
  if (!plan) return rows;
  const first = plan.versions?.length ? undefined : plan.writtenAt;
  if (first) rows.push({ id: "h-written", icon: "file-text", detail: `Wrote the plan, version ${plan.version}`, actor: { kind: "fume" }, at: first });
  if (plan.checkAsked) rows.push({ id: "h-ask-check", icon: "user", detail: "Asked the expert to check the plan", actor: person(plan.checkAsked.by), at: plan.checkAsked.at });
  if (plan.checkedBy && plan.checkedAt) rows.push({ id: "h-checked", icon: "fume-check", detail: `Checked the plan, version ${plan.version}`, actor: person(plan.checkedBy), at: plan.checkedAt, checked: true });
  const direction = chosenOf(plan);
  for (const l of [...(direction?.look ?? []), ...plan.content])
    if (l.changedBy && l.changedAt && l.changedBy !== "fume") rows.push({ id: `h-line-${l.key}`, icon: "pencil", detail: `Changed the plan’s ${l.label.toLowerCase()}`, actor: person(l.changedBy), at: l.changedAt });
  for (const c of direction?.creatives ?? [])
    if (c.changedBy && c.changedAt && c.changedBy !== "fume") rows.push({ id: `h-cr-${c.id}`, icon: "pencil", detail: `Changed ${c.name} in the plan`, actor: person(c.changedBy), at: c.changedAt });
  for (const v of plan.versions ?? []) {
    if (v.asked) rows.push({ id: `h-ask-${v.version}`, icon: "message-square", detail: `Asked Fume to change the plan: “${v.asked}”`, actor: person(v.by), at: v.at });
    rows.push({ id: `h-v-${v.version}`, icon: "file-text", detail: `Wrote version ${v.version} of the plan${v.changes.length ? `: ${v.changes.join("; ")}` : ""}`, actor: { kind: "fume" }, at: v.at });
  }
  if (plan.state === "changes_asked" && plan.note && plan.note.by !== "fume")
    rows.push({ id: "h-asking", icon: "message-square", detail: `Asked Fume to change the plan: “${plan.note.text}”`, actor: person(plan.note.by), at: plan.note.at });
  if (plan.approvedAt) rows.push({ id: "h-approved", icon: "circle-check", detail: `Approved the plan, version ${plan.version}`, actor: person(plan.approvedBy), at: plan.approvedAt });
  return rows;
}

function RecordPanel({ view, names, plan }: { view: CampaignView; names: Names; plan: CampaignPlan | null | undefined }) {
  const { campaign } = view;
  const rows: HistoryRow[] = [
    ...view.record.map((e) => ({ id: e.id, icon: recordIcon[e.action], detail: e.detail, actor: e.actor, at: e.at, checked: e.action === "checked" })),
    ...planHistory(view, plan),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <div className="ui-app-stack ui-campaign-history">
      <ItemGroup as="ul" aria-label="Your package">
        <Item as="li" size="sm">
          <ItemMedia variant="icon">
            <Icon name="refresh-cw" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              {campaign.roundsUsed} of {campaign.roundsIncluded} change requests used
            </ItemTitle>
            <ItemDescription>Fume’s own corrections never use one.</ItemDescription>
          </ItemContent>
        </Item>
        <Item as="li" size="sm">
          <ItemMedia variant="icon">
            <Icon name="user" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{names.Name(view.approver.id)} approve{names.name(view.approver.id) === "you" ? "" : "s"}</ItemTitle>
            <ItemDescription>
              {campaign.counts.approved} of {campaign.counts.creatives} creatives approved · Brand DNA version {campaign.brandDnaVersion}
            </ItemDescription>
          </ItemContent>
        </Item>
      </ItemGroup>
      {rows.length === 0 ? (
        <p className="ui-campaign-history-empty">Nothing recorded yet. Each decision, check and delivery is kept here.</p>
      ) : (
        <ItemGroup as="ol" aria-label="What happened">
          {rows
            .slice()
            .reverse()
            .map((e) => (
              <Item key={e.id} as="li" size="sm">
                <ItemMedia variant="icon" className={e.checked ? "ui-campaign-history-checked" : undefined}>
                  <Icon name={e.icon} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{e.detail}</ItemTitle>
                  <ItemDescription>
                    {names.author(e.actor)} · <time dateTime={e.at}>{when(e.at)}</time>
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
        </ItemGroup>
      )}
    </div>
  );
}

/** The agency's checked creatives in a client brand (round 12, brief r12 SENDING): "To send" (checked, not sent) and
 *  "With Maja" (sent; she approves them), each state named once. */
function AgencyChecked({ toApprove, split, tile, checked, client }: { toApprove: Creative[]; split: ReturnType<typeof useCampaignSends>["split"]; tile: (c: Creative) => ReactNode; checked: string; client: string }) {
  const { toSend, withThem } = split(toApprove);
  return (
    <>
      {toSend.length > 0 && (
        <Section title="To send" meta={toSend.length} titleId="campaign-to-send" text={`${checked}. ${client} sees them once you send them; only ${client} approves a creative.`}>
          <CreativeGrid aria-labelledby="campaign-to-send">{toSend.map(tile)}</CreativeGrid>
        </Section>
      )}
      {withThem.length > 0 && (
        <Section title={copy.send.withThem(client)} meta={withThem.length} titleId="campaign-with-client" text={`${client} approves them in Fume or through the client link. When ${client} approved outside Fume, record it in the review.`}>
          <CreativeGrid aria-labelledby="campaign-with-client">{withThem.map(tile)}</CreativeGrid>
        </Section>
      )}
    </>
  );
}
