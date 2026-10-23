// All brands (FLOWS §4.2) is the overview now (OverviewPage.tsx): one page for Fume's studio and an agency, as Marcus
// decided 20 Oct 2026. What stays here is the deliveries list the studio's Deliveries page shares.
// Round 12 (DTASK-19, DWAY-14; PROPOSED 20 Oct 2026): a delivery opens its campaign (for Fume's people its plan, for an
// agency's the campaign; Fume's admin, who checks no plan, the brand's Home), in the frame's own address.
import { Badge, Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@fume/ui";
import { Link } from "react-router-dom";
import { useSession } from "../../api/hooks";
import type { AllBrandsView } from "../../contract";
import { due } from "../../lib/time";
import { Nothing } from "../../shell/Page";
import { brandBase, campaignHref, useFrameKind } from "../../shell/scope";

export { OverviewPage as AllBrandsPage } from "./OverviewPage";

export function DeliveriesDue({ rows }: { rows: AllBrandsView["deliveriesDue"] }) {
  const frame = useFrameKind();
  const admin = useSession().data?.user.staffRole === "admin" && frame === "fume";
  if (!rows.length)
    return <Nothing icon="download" title="Nothing due" text="A delivery shows here once a campaign has a date." />;
  return (
    <ItemGroup as="ul">
      {rows.map((d) => (
        <Item key={d.campaign.id} as="li" variant="muted" asChild>
          <Link to={admin ? brandBase(frame, d.workspace.id) : campaignHref(frame, d.workspace.id, d.campaign.id)}>
            <ItemContent>
              <ItemTitle>{d.campaign.name}</ItemTitle>
              <ItemDescription>
                {d.workspace.brandName} · {d.total ? `${d.approved} of ${d.total} approved` : "No creatives yet"}
              </ItemDescription>
            </ItemContent>
            <ItemActions>{d.dueAt && <Badge icon="clock">Due {due(d.dueAt)}</Badge>}</ItemActions>
          </Link>
        </Item>
      ))}
    </ItemGroup>
  );
}
