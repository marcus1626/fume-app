// Parts the campaign screens and the review screens share: what a role may do, where a campaign is (its step dots), its
// group on the Campaigns page, the two ways to start a campaign, its one next action, a direction as a card, and the
// phone's filter sheet. Words follow copy/: where a campaign stands is one sentence, copy.campaignStatus; the sentences
// here are the screens' own, in the same voice.
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardMedia,
  CardTitle,
  CreativeMedia,
  DataList,
  DataListItem,
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  FilterSheetOptions,
  filterShowLabel,
  type FilterDef,
  OptionMenu,
  type FilterValue,
} from "@fume/ui";
import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { Campaign, CustomerRole, Direction, ServiceClock } from "../../contract";
import * as copy from "../../copy";
import { date } from "../../lib/time";
import { STAGES, stageIndex, stageLabel, stageOf } from "./stages";

// ─── Roles ──────────────────────────────────────────────────────────────────

/** What the signed-in person may do (ARCHITECTURE §2). Fume's people (no customer role) only look. */
export function rights(role: CustomerRole | null) {
  const approve = role === "owner" || role === "approver";
  const ask = approve || role === "member";
  return { approve, ask, start: ask, act: ask };
}

// ─── Where a campaign is ────────────────────────────────────────────────────

// Six stages, Brief → Moodboard → Plan → Masters → Creatives → Delivery, in the words and order of stages.ts. A
// campaign's stage comes from the contract's (stageOf): "directions" and "masters" are Masters, "variants" Creatives.
// The moodboard is optional; past it, it reads as done.

/** Where a campaign is: step 1–6 and its word; a delivered or closed campaign is past the last step ("Delivered"). */
export function stepOf(campaign: Pick<Campaign, "stage" | "state">): {
  step: number;
  of: number;
  word: string;
  done: boolean;
} {
  const done = campaign.state === "delivered" || campaign.state === "closed";
  const stage = stageOf(campaign);
  return {
    step: done ? STAGES.length : stageIndex(stage) + 1,
    of: STAGES.length,
    word: done ? "Delivered" : stageLabel(stage),
    done,
  };
}

/** Where a campaign is, as six small dots and the stage's word; it is a status, never a button. The Campaigns table's
 *  Stage column shows the word; the campaign header leaves it out (`word={false}`), since its status sentence beside
 *  the dots already says the step ("Fume is writing the plan"), and the dots carry it as their name and tooltip. */
export function StepDots({ campaign, word = true }: { campaign: Pick<Campaign, "stage" | "state">; word?: boolean }) {
  const s = stepOf(campaign);
  const label = s.done ? `All ${s.of} stages done` : `Stage ${s.step} of ${s.of}, ${s.word}`;
  // The words are real text (read out, and copied as words), the dots are their picture.
  const said = word ? (s.done ? `All ${s.of} stages done, ` : `Stage ${s.step} of ${s.of}, `) : label;
  return (
    <span className="ui-campaign-steps" title={label}>
      <span className="ui-campaign-sr">{said}</span>
      <span className="ui-campaign-dots" aria-hidden="true">
        {STAGES.map((st, i) => (
          <span
            key={st.id}
            className="ui-campaign-dot"
            data-state={s.done || i + 1 < s.step ? "done" : i + 1 === s.step ? "current" : undefined}
          />
        ))}
      </span>
      {word && <span className="ui-campaign-steps-word">{s.word}</span>}
    </span>
  );
}

/** The campaign's group on the Campaigns page: waiting on you, being made, or done. */
export function campaignGroup(c: Campaign, options?: copy.CampaignStatusOptions): "you" | "making" | "done" {
  if (c.state === "approved" || c.state === "delivered" || c.state === "closed") return "done";
  // the reader's own sentence (the client of an agency, useStatusOptions)
  return copy.campaignStatus(c, undefined, options).waiting ? "you" : "making";
}

// ─── Starting a campaign ────────────────────────────────────────────────────

/** The two ways a campaign starts (FLOWS §12), as they read in the New campaign menu and the command palette. */
export const newCampaignWays = [
  {
    id: "fume",
    icon: "message-square",
    label: "With Fume",
    description: "Talk it through. Fume asks a few questions and writes the brief.",
    to: "/fume?new=1",
  },
  {
    id: "form",
    icon: "file-text",
    label: "Write it yourself",
    description: "Fill in the brief in your own words, line by line.",
    to: "/campaigns/new",
  },
] as const;

/** One New campaign button: its menu holds the two ways, each with one line. A dropdown on a desk, the drawer on a
 *  phone (OptionMenu). `quiet` makes it a white pill where the page already has its one Ink action. */
export function StartCampaign({ quiet }: { quiet?: boolean } = {}) {
  const navigate = useNavigate();
  return (
    <OptionMenu
      title="New campaign"
      options={newCampaignWays.map((w) => ({
        id: w.id,
        icon: w.icon,
        label: w.label,
        description: w.description,
        onSelect: () => navigate(w.to),
      }))}
    >
      <Button variant={quiet ? "secondary" : "primary"} icon="plus">
        <span className="ui-page-header-label">New campaign</span>
      </Button>
    </OptionMenu>
  );
}

// ─── The service clock ──────────────────────────────────────────────────────

/** True while the clock means something to the customer: Fume works to it, or it waits on them. */
export const clockShows = (clock: ServiceClock | undefined): clock is ServiceClock =>
  Boolean(clock && (clock.state === "running" || clock.state === "paused_waiting_on_you"));

// ─── The next action ────────────────────────────────────────────────────────

/** Where the campaign's one next action (copy.campaignNext) goes; none while Fume is the one working. */
export function nextAction(
  campaign: Campaign,
  threadId: string,
  deliveryId?: string,
): { label: string; to: string } | undefined {
  const label = copy.campaignNext[campaign.state];
  if (!label) return undefined;
  switch (campaign.state) {
    case "draft":
    case "awaiting_input":
      return { label, to: `/fume/${threadId}` };
    case "in_review":
      return { label, to: `/campaigns/${campaign.id}/review` };
    case "approved":
    case "delivered":
      return { label, to: deliveryId ? `/deliveries/${deliveryId}` : "/deliveries" };
    default:
      return undefined;
  }
}

// ─── A direction ────────────────────────────────────────────────────────────

/** The direction's state for the customer: chosen (who and when), passed, or ready for a decision. */
function DirectionBadge({ direction, name }: { direction: Direction; name: (id?: string) => string }) {
  if (direction.state === "chosen")
    return (
      <Badge variant="ink">{`Chosen by ${name(direction.decidedBy)}${direction.decidedAt ? ` · ${date(direction.decidedAt)}` : ""}`}</Badge>
    );
  if (direction.state === "passed") return <Badge>Not taken forward</Badge>;
  if (direction.state === "proposed") return <Badge variant="ink">{copy.waitingOnYou}</Badge>;
  return <Badge check="waiting">{copy.versionState.in_check}</Badge>;
}

/** One direction as a card: the cover, the idea, the hook, why it fits, what it will make, and its decision. */
export function DirectionCard({
  direction,
  name,
  headingLevel = "h3",
  footer,
}: {
  direction: Direction;
  name: (id?: string) => string;
  headingLevel?: "h2" | "h3";
  footer?: ReactNode;
}) {
  return (
    <Card selected={direction.state === "chosen" ? true : undefined}>
      <CardMedia>
        <CreativeMedia
          src={direction.cover}
          alt={`The cover of direction ${direction.letter}, ${direction.name}`}
          format="feed"
        />
      </CardMedia>
      <CardHeader>
        <CardTitle as={headingLevel}>
          {direction.letter} · {direction.name}
        </CardTitle>
        {direction.insight && <CardDescription>{direction.insight}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="ui-app-stack ui-app-stack--tight">
          <div className="ui-app-row">
            <DirectionBadge direction={direction} name={name} />
          </div>
          <DataList variant="stacked">
            {direction.hook && <DataListItem label="The hook">{direction.hook}</DataListItem>}
            {direction.message && <DataListItem label="The message">{direction.message}</DataListItem>}
            {direction.visualIdea && <DataListItem label="What you will see">{direction.visualIdea}</DataListItem>}
            {direction.whyItFits && <DataListItem label="Why it fits your brand">{direction.whyItFits}</DataListItem>}
            {direction.risks.length > 0 && (
              <DataListItem label="What to watch">{direction.risks.join(" ")}</DataListItem>
            )}
            {direction.plannedOutputs && (
              <DataListItem label="What it will make">{direction.plannedOutputs}</DataListItem>
            )}
            {direction.reason && (
              <DataListItem
                label={direction.state === "chosen" ? `Why ${name(direction.decidedBy)} chose it` : "The reason"}
              >
                {direction.reason}
              </DataListItem>
            )}
          </DataList>
        </div>
      </CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}

// ─── The phone's filter sheet ───────────────────────────────────────────────

/** FilterBar's Filters button opens this on a phone: the same filters as rows, then Clear all and Show n. */
export function FilterSheet({
  open,
  onOpenChange,
  filters,
  value,
  onValueChange,
  shown,
  noun,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterDef[];
  value: FilterValue;
  onValueChange: (value: FilterValue) => void;
  shown: number;
  noun: [string, string];
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="ui-filter-sheet" aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>Filters</DrawerTitle>
        </DrawerHeader>
        <FilterSheetOptions filters={filters} value={value} onValueChange={onValueChange} />
        <DrawerFooter>
          <Button variant="glass-clear" onClick={() => onValueChange({})}>
            Clear all
          </Button>
          <Button variant="glass-white" onClick={() => onOpenChange(false)}>
            {filterShowLabel(shown, noun)}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
