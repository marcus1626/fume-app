// A brand's Studio start (FLOWS §9). Carrying on comes first, as Photoshop and Figma open on recent work: "In the
// Studio" is one row of the six newest creatives, every tile the same 4:5 box with the creative contained and its name
// (with its ratio) under it; "Show all (N)" shows the rest in place, "Show fewer" after. A tile names who made it with
// the names Check and Models use. Then one "New creative" block: Render or Design and the campaign on one line (No
// campaign by default; a campaign can bring its own look), then the modes as compact tiles, their one line in a
// tooltip. Modes that are not built yet are left out. The header links to the Engine chat and Engine output. Large sets
// ("50 packshots") are made as a batch on the campaign page or by the Engine chat, not here (FLOWS §9.7).
import {
  Badge,
  CreativeGrid,
  CreativeTile,
  Icon,
  PageHeader,
  SegmentedControl,
  SegmentedOption,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  WithTooltip,
  useToast,
  type IconName,
} from "@fume/ui";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDocuments, useOpenDocument, useSession, useStudioKit, useStudioModes } from "../../../api/hooks";
import type { CreativeDocument, StudioKind, StudioMode } from "../../../contract";
import { when } from "../../../lib/time";
import { Nothing, Page, Query, Section } from "../../../shell/Page";
import { useNames } from "../qa/names";
import { documentName, shownVersion } from "./Board";
import { useBrandCampaigns } from "./campaign";

/** How many creatives the first row shows before "Show all (N)": one row at a desk's width. */
const ROW = 6;
const NO_CAMPAIGN = "none";

const modeIcon = (m: StudioMode): IconName =>
  m.studio === "video"
    ? "film"
    : m.output === "model"
      ? "user"
      : m.output === "reference"
        ? "image-plus"
        : /packshot/i.test(m.name)
          ? "package"
          : /layout|design|type/i.test(m.name)
            ? "type"
            : /free/i.test(m.name)
              ? "pencil"
              : "image";

export function StudioHomePage() {
  const { workspaceId = "" } = useParams();
  const session = useSession().data;
  const brand = session?.workspaces.find((w) => w.id === workspaceId)?.brandName;
  const modes = useStudioModes();
  const docs = useDocuments(workspaceId);
  const products = useStudioKit(workspaceId).data?.products ?? [];
  const open = useOpenDocument();
  const navigate = useNavigate();
  const toast = useToast();
  const names = useNames();
  const [studio, setStudio] = useState<StudioKind>("render");
  const [all, setAll] = useState(false);
  const campaigns = useBrandCampaigns(workspaceId);
  const [campaignId, setCampaignId] = useState<string>();
  const campaign = campaigns.find((c) => c.id === campaignId);
  const base = `/studio/b/${workspaceId}`;

  const start = (mode: StudioMode) =>
    open.mutate(
      { workspaceId, studio: mode.studio, modeId: mode.id, campaignId },
      {
        onSuccess: (d) => navigate(`/studio/doc/${d.id}`),
        onError: (e) => toast.error("The Studio didn’t open", { description: e.message }),
      },
    );
  const modeOf = (d: CreativeDocument) => modes.data?.find((m) => m.id === d.modeId);

  return (
    <Page title={brand ? `${brand} Studio` : "Studio"}>
      <PageHeader
        title="Studio"
        secondaryActions={[
          { label: "Engine", icon: "fume-engine", onSelect: () => navigate(`${base}/engine`) },
          { label: "Engine output", icon: "image", onSelect: () => navigate(`${base}/output`) },
        ]}
      />

      <Section
        title="In the Studio"
        titleId="studio-docs"
        meta={docs.data?.length || undefined}
        action={
          (docs.data?.length ?? 0) > ROW ? (
            <Button
              size="sm"
              variant="quiet"
              className="ui-studio-recent-all"
              aria-expanded={all}
              onClick={() => setAll(!all)}
            >
              {all ? "Show fewer" : `Show all (${docs.data!.length})`}
            </Button>
          ) : undefined
        }
      >
        <Query query={docs} loading="Loading the creatives">
          {(list) => {
            const newest = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
            return newest.length ? (
              <CreativeGrid className="ui-studio-recent">
                {(all ? newest : newest.slice(0, ROW)).map((d) => {
                  const v = shownVersion(d);
                  const mode = modeOf(d);
                  const name = documentName(d, mode, products.find((p) => p.id === d.specs.productId)?.name);
                  const meta = `${mode?.name ?? "Studio"} · ${names.name(d.by)}, ${when(d.updatedAt)}`;
                  return (
                    <CreativeTile
                      key={d.id}
                      src={v?.image}
                      alt=""
                      ratio="4 / 5"
                      label={`Open ${name} in the Studio`}
                      title={`${name} · ${meta}`}
                      caption={
                        <>
                          <span className="ui-studio-recent-name">{name}</span>
                          <span className="ui-studio-recent-meta">{meta}</span>
                        </>
                      }
                      check={
                        d.state === "in_check" ? (
                          <Badge check="waiting">In check</Badge>
                        ) : d.state === "checked" ? (
                          <Badge check="approved">Checked</Badge>
                        ) : v ? (
                          <Badge>V{v.number}</Badge>
                        ) : undefined
                      }
                      onOpen={() => navigate(`/studio/doc/${d.id}`)}
                    />
                  );
                })}
              </CreativeGrid>
            ) : (
              <Nothing
                icon="layers"
                title="Nothing in the Studio yet"
                text="Each creative is one document here: every render becomes a version, and nothing is overwritten. Start one below."
              />
            );
          }}
        </Query>
      </Section>

      <Section title="New creative" titleId="studio-new">
        <div className="ui-studio-new">
          <div className="ui-studio-new-bar">
            <SegmentedControl aria-label="Studio" value={studio} onValueChange={(v) => setStudio(v as StudioKind)}>
              <SegmentedOption value="render">Image</SegmentedOption>
              <SegmentedOption value="design">Design</SegmentedOption>
              <SegmentedOption value="video">Video</SegmentedOption>
            </SegmentedControl>
            {campaigns.length > 0 && (
              <Select
                value={campaignId ?? NO_CAMPAIGN}
                onValueChange={(v) => setCampaignId(v === NO_CAMPAIGN ? undefined : v)}
              >
                <SelectTrigger className="ui-studio-new-campaign" aria-label="Campaign">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CAMPAIGN}>No campaign</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {campaign?.look && (
              <p className="ui-studio-new-help">{campaign.name}’s own colours and light lead the look sections.</p>
            )}
          </div>
          <Query query={modes} loading="Loading the modes">
            {(list) => {
              const live = list.filter((m) => m.studio === studio && m.available);
              return live.length ? (
                <ul
                  className="ui-studio-new-modes"
                  aria-label={studio === "design" ? "Design modes" : studio === "video" ? "Video modes" : "Image modes"}
                >
                  {live.map((m) => (
                    <li key={m.id}>
                      <WithTooltip label={m.description.replace(/ Coming later\.?$/, "")}>
                        <button
                          type="button"
                          className="ui-studio-new-mode"
                          disabled={open.isPending}
                          onClick={() => start(m)}
                        >
                          <Icon name={modeIcon(m)} className="ui-studio-new-mode-icon" />
                          <span className="ui-studio-new-mode-name">{m.name}</span>
                        </button>
                      </WithTooltip>
                    </li>
                  ))}
                </ul>
              ) : (
                <Nothing icon="layers" title="No modes here yet" />
              );
            }}
          </Query>
        </div>
      </Section>
    </Page>
  );
}
