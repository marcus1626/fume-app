// The creative's campaign in the Studio (Marcus 15 Oct: "Hvor i studio tenker du man velger kampanje? En kampanje kan
// ha egen stil, farger, moodboard. F eks black friday"). The campaign is a chip in the desk's top bar, beside the
// creative's name (round 12, DWAY-10: no breadcrumbs, so it is no longer a crumb that also changes data): it names the
// campaign, or "No campaign", and opens the brand's campaigns with their covers to pick another. A campaign with a look
// of its own shows a small "Black Friday look" chip beside it: its note, its colours, its light and its moodboard.
// The Studio's start asks the same with a small select.
import {
  Button,
  Icon,
  PickGrid,
  PickTile,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@fume/ui";
import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useStudioCampaigns } from "../../../api/hooks";
import type { Campaign, Id } from "../../../contract";
import * as copy from "../../../copy";

/** The brand's campaigns that new work can belong to: not closed, newest first. */
export function useBrandCampaigns(workspaceId: Id) {
  const rows = useStudioCampaigns().data ?? [];
  return rows
    .map((r) => r.campaign)
    .filter((c) => c.workspaceId === workspaceId && c.state !== "closed")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** "No campaign" and the brand's campaigns as tiles with their covers; one is picked. */
export function CampaignGrid({
  campaigns,
  value,
  onPick,
  size = "md",
}: {
  campaigns: Campaign[];
  value?: Id;
  onPick: (id: Id | undefined) => void;
  size?: "md" | "sm";
}) {
  return (
    <PickGrid size={size} aria-label="Campaigns">
      <PickTile
        title="No campaign"
        line="The brand’s own look"
        icon="minus"
        selected={!value}
        onSelectedChange={() => onPick(undefined)}
      />
      {campaigns.map((c) => (
        <PickTile
          key={c.id}
          title={c.name}
          line={c.look ? "Its own look" : copy.stage[c.stage]}
          src={c.cover}
          icon="megaphone"
          selected={value === c.id}
          onSelectedChange={() => onPick(c.id)}
        />
      ))}
    </PickGrid>
  );
}

/** The campaign chip in the desk's top bar: the campaign's name (or "No campaign"), opening the campaign grid. */
export function CampaignChip({
  workspaceId,
  campaign,
  onPick,
  disabled,
}: {
  workspaceId: Id;
  campaign?: Campaign;
  onPick: (picked: Campaign | undefined) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const campaigns = useBrandCampaigns(workspaceId);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="ui-desk-campaign"
          data-empty={campaign ? undefined : ""}
          disabled={disabled}
          aria-label={campaign ? `Campaign: ${campaign.name}. Change` : "No campaign. Pick one"}
        >
          <Icon name="megaphone" />
          <span className="ui-desk-campaign-name">{campaign?.name ?? "No campaign"}</span>
          <Icon name="chevron-down" className="ui-desk-campaign-chevron" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="ui-pick-popover" aria-labelledby="campaign-pick-title">
        <PopoverHeader>
          <PopoverTitle id="campaign-pick-title">Campaign</PopoverTitle>
          <PopoverDescription>
            A campaign can bring its own colours, light and moodboard; they lead the look sections.
          </PopoverDescription>
        </PopoverHeader>
        <CampaignGrid
          size="sm"
          campaigns={campaigns}
          value={campaign?.id}
          onPick={(id) => {
            setOpen(false);
            if (id !== campaign?.id) onPick(campaigns.find((c) => c.id === id));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** "Black Friday look": the campaign's own look in a popover, with its moodboard. */
export function CampaignLookChip({ campaign, workspaceId }: { campaign: Campaign; workspaceId: Id }) {
  const look = campaign.look;
  if (!look) return null;
  const colours = [
    ...look.backgrounds,
    ...look.colours.filter((c) => !look.backgrounds.some((b) => b.hex.toLowerCase() === c.hex.toLowerCase())),
  ];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="ui-desk-look" aria-label={`${campaign.name} look`}>
          <span className="ui-desk-look-dots" aria-hidden="true">
            {colours.slice(0, 3).map((c) => (
              <span key={c.hex} className="ui-desk-look-dot" style={{ "--swatch": c.hex } as CSSProperties} />
            ))}
          </span>
          <span className="ui-desk-look-name">{campaign.name} look</span>
          <span className="ui-desk-look-short">Look</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="ui-desk-look-popover" aria-labelledby="campaign-look-title">
        <PopoverHeader>
          <PopoverTitle id="campaign-look-title">{campaign.name} look</PopoverTitle>
          <PopoverDescription>{look.note}</PopoverDescription>
        </PopoverHeader>
        <ul className="ui-desk-look-colours" aria-label="Its colours">
          {colours.map((c) => (
            <li key={c.hex}>
              <span className="ui-desk-look-swatch" style={{ "--swatch": c.hex } as CSSProperties} aria-hidden="true" />
              <span className="ui-desk-look-colour-name">{c.name}</span>
              <span className="ui-desk-look-hex">{c.hex.toUpperCase()}</span>
            </li>
          ))}
        </ul>
        {look.light && (
          <p className="ui-desk-look-light">
            <Icon name="sliders-horizontal" />
            <span>{look.light}</span>
          </p>
        )}
        {campaign.boardId ? (
          <Button asChild size="sm" variant="glass-white" icon="layers">
            <Link to={`/studio/b/${workspaceId}/boards/${campaign.boardId}`}>Open the moodboard</Link>
          </Button>
        ) : (
          <p className="ui-desk-look-light">
            <Icon name="layers" />
            <span>No moodboard yet: the customer starts it on the campaign.</span>
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
