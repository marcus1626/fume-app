// One number for "waiting in Check" (walk-through 15 Oct, staff counts; round 12 the place is called Check): Check's
// count, its badge in the menu and the brand cards on All brands all count the same thing, the creatives still
// waiting for a check, for every expert alike. Before, the badge and the cards counted the old per-expert check queue, so
// Anna saw "In check 0" for SOLV over a QA page that listed 2, and the badge stayed at 3 after Mark checked.
import {
  Badge,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemMediaImage,
  ItemTitle,
} from "@fume/ui";
import { Link } from "react-router-dom";
import { useQaQueue } from "../../../api/hooks";
import type { Id, QaView } from "../../../contract";
import * as copy from "../../../copy";
import { due, time } from "../../../lib/time";

/** QA items waiting for a check, per brand; `total` is every brand together. */
export function useQaWaiting(workspaceId?: Id): { total: number; of: (workspaceId: Id) => number; loaded: boolean } {
  const queue = useQaQueue(workspaceId);
  const waiting = (queue.data ?? []).filter((v) => v.item.state === "waiting");
  return {
    total: waiting.length,
    of: (id) => waiting.filter((v) => v.item.workspaceId === id).length,
    loaded: Boolean(queue.data),
  };
}

/** The creatives waiting, as rows that open each one in Check (All brands). */
export function QaList({ items }: { items: QaView[] }) {
  return (
    <ItemGroup as="ul">
      {items.map(({ item, campaign, workspace }) => (
        <Item key={item.id} as="li" variant="outline" asChild>
          <Link to={`/studio/b/${workspace.id}/qa?item=${encodeURIComponent(item.id)}`}>
            <ItemMedia variant="creative">
              <ItemMediaImage src={item.image} alt="" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{copy.creativeName({ title: item.title, format: item.format })}</ItemTitle>
              <ItemDescription>
                {workspace.brandName} · {campaign.name} · {copy.format[item.format].label}{" "}
                {copy.format[item.format].ratio}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              {item.risk === "high" && <Badge variant="ink">High risk</Badge>}
              <Badge icon="clock">
                Due {due(item.dueAt)}, {time(item.dueAt)}
              </Badge>
              <Icon name="chevron-right" />
            </ItemActions>
          </Link>
        </Item>
      ))}
    </ItemGroup>
  );
}
