// The panel beside the conversation, for what the chat links to, and the small things the conversation shows of it
// (round 13, Marcus's video comments #13, #14, #15 and #16 of 21 Oct; PROPOSED 22 Oct 2026).
// - LinkPanel (#15): a campaign, its plan, a creative, a product or a collection, opened from the chat, shows in the
//   panel (the same card as "The brief" and "The plan"), its head with "Open full page" and ✕. The conversation stays.
// - ChatThumbs (#14, "Til å ikke være åpnet, dekket de litt voldsomt mye av skjermen"): creatives in a message are a
//   row of small tiles, four at most and then "+N"; a tile opens the creative in the panel.
// - LinkCard and SummaryCard (#16): what Fume answers with when she asks about something the app knows: one line that
//   opens it in the panel; what waits on her (the same rows as Home); this month in numbers (the same as Home).
import {
  Button,
  DataList,
  DataListItem,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemMediaImage,
  ItemTitle,
  Progress,
  Stat,
  StatGrid,
  type IconName,
} from "@fume/ui";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  useBrandDna,
  useCampaign,
  useCatalogue,
  useCollection,
  useCreative,
  useHome,
  usePeople,
  useProduct,
} from "../../api/hooks";
import type { ChatLink, Creative, Id } from "../../contract";
import * as copy from "../../copy";
import { date, due } from "../../lib/time";
import { directory } from "../../shell/people";
import { useWaitingOnYou } from "../../shell/waiting";
import { useOpenProductCheck } from "../check/ProductCheckHost";
import { useCreativeLabels, useCustomerNames } from "../review/names";
import { CreativeCard } from "../shared/creatives";
import { BriefRowsList, useBriefRows } from "./desk";
import { useOpenFullPage, useOpenLink } from "./open";
import { PlanPanel } from "./plan";

const KIND_WORD: Record<ChatLink["kind"], string> = {
  campaign: "Campaign",
  plan: "The plan",
  creative: "Creative",
  product: "Product",
  collection: "Collection",
};
const KIND_ICON: Record<ChatLink["kind"], IconName> = {
  campaign: "megaphone",
  plan: "layers",
  creative: "image",
  product: "tag",
  collection: "folder",
};

/** "Open full page" and ✕, in the panel's head. */
export function PanelActions({ link, onClose }: { link: ChatLink; onClose?: () => void }) {
  const full = useOpenFullPage();
  return (
    <div className="ui-chat-panel-actions">
      <Button variant="quiet" size="sm" icon="arrow-up-right" onClick={() => full(link)}>
        Open full page
      </Button>
      {onClose && <Button variant="quiet" size="sm" icon="x" iconOnly aria-label="Close the panel" onClick={onClose} />}
    </div>
  );
}

/** The panel's card: its head (what it is, its name, a line under it, the actions), its body, its foot. */
function Shell({
  link,
  onClose,
  title,
  meta,
  children,
  foot,
}: {
  link: ChatLink;
  onClose?: () => void;
  title: string;
  meta?: ReactNode;
  children?: ReactNode;
  foot?: ReactNode;
}) {
  return (
    <aside className="ui-chat-brief ui-chat-link-panel" aria-labelledby="fume-link-title">
      <div className="ui-chat-brief-head">
        <div className="ui-chat-panel-top">
          <p className="ui-chat-plan-eyebrow">{KIND_WORD[link.kind]}</p>
          <PanelActions link={link} onClose={onClose} />
        </div>
        <h2 className="ui-chat-brief-title" id="fume-link-title" tabIndex={-1}>
          {title}
        </h2>
        {meta && <p className="ui-chat-brief-meta">{meta}</p>}
      </div>
      <div className="ui-chat-brief-body">{children}</div>
      {foot && <div className="ui-chat-brief-foot">{foot}</div>}
    </aside>
  );
}

/** What a chat link names, beside the conversation. */
export function LinkPanel({ link, onClose }: { link: ChatLink; onClose?: () => void }) {
  switch (link.kind) {
    case "plan":
      return <PlanPanel campaignId={link.campaignId} actions={<PanelActions link={link} onClose={onClose} />} />;
    case "campaign":
      return <CampaignPanel link={link} onClose={onClose} />;
    case "creative":
      return <CreativePanel link={link} onClose={onClose} />;
    case "product":
      return <ProductPanel link={link} onClose={onClose} />;
    case "collection":
      return <CollectionPanel link={link} onClose={onClose} />;
  }
}

function CampaignPanel({ link, onClose }: { link: Extract<ChatLink, { kind: "campaign" }>; onClose?: () => void }) {
  const view = useCampaign(link.campaignId).data;
  const rows = useBriefRows(view);
  const named = useCustomerNames(view?.campaign);
  if (!view) return <Shell link={link} onClose={onClose} title="Opening the campaign" />;
  const c = view.campaign;
  const status = copy.campaignStatus(c);
  const waiting = view.creatives.filter((x) => x.current.state === "checked");
  const shown = view.creatives
    .filter((x) => !["making", "in_check", "correcting", "held"].includes(x.current.state))
    .map(named);
  return (
    <Shell
      link={link}
      onClose={onClose}
      title={c.name}
      meta={[status.words, c.dueAt ? `live ${due(c.dueAt).replace(",", "")}` : undefined].filter(Boolean).join(" · ")}
      foot={
        waiting.length > 0 ? (
          <>
            <p className="ui-chat-brief-note">
              {copy.creatives(waiting.length)} checked by the expert, waiting on you.
            </p>
            <Button asChild variant="secondary" iconEnd="arrow-right">
              <Link to={`/campaigns/${c.id}/review`}>Review them</Link>
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="ui-app-stack">
        {shown.length > 0 && (
          <div className="ui-chat-plan-holds">
            <p className="ui-chat-plan-eyebrow">The creatives</p>
            <ChatThumbs creatives={shown} campaignId={c.id} max={8} />
          </div>
        )}
        <div className="ui-chat-plan-holds">
          <p className="ui-chat-plan-eyebrow">The brief</p>
          <BriefRowsList rows={rows} />
        </div>
      </div>
    </Shell>
  );
}

function CreativePanel({ link, onClose }: { link: Extract<ChatLink, { kind: "creative" }>; onClose?: () => void }) {
  const data = useCreative(link.creativeId).data;
  const people = directory(usePeople().data);
  const label = useCreativeLabels(data?.campaign);
  const named = useCustomerNames(data?.campaign);
  const full = useOpenFullPage();
  if (!data) return <Shell link={link} onClose={onClose} title="Opening the creative" />;
  const c = named(data.creative);
  const waits = c.current.state === "checked";
  return (
    <Shell
      link={link}
      onClose={onClose}
      title={label(c)}
      meta={data.campaign.name}
      foot={
        <>
          <p className="ui-chat-brief-note">
            {waits
              ? "Checked by the expert. Approve it, or say what to change, on its page."
              : "Its page shows it full size, with its comments."}
          </p>
          <Button variant={waits ? "secondary" : "quiet"} iconEnd="arrow-right" onClick={() => full(link)}>
            {waits ? "Review it" : "Open it"}
          </Button>
        </>
      }
    >
      <div className="ui-chat-panel-creative">
        <CreativeCard creative={c} people={people.user} onOpen={() => full(link)} />
      </div>
    </Shell>
  );
}

function ProductPanel({ link, onClose }: { link: Extract<ChatLink, { kind: "product" }>; onClose?: () => void }) {
  const p = useProduct(link.productId).data;
  const check = useOpenProductCheck();
  if (!p) return <Shell link={link} onClose={onClose} title="Opening the product" />;
  const confirmed = p.state === "verified";
  return (
    <Shell
      link={link}
      onClose={onClose}
      title={p.name}
      meta={[p.variant, confirmed ? "Confirmed" : "Not confirmed yet"].filter(Boolean).join(" · ")}
      foot={
        !confirmed ? (
          <>
            <p className="ui-chat-brief-note">Fume makes creatives of a product once you have confirmed it.</p>
            <Button variant="secondary" icon="circle-check" onClick={() => check(p.id, { over: "conversation" })}>
              Confirm details
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="ui-app-stack">
        {p.images[0] && <img className="ui-chat-panel-photo" src={p.images[0]} alt={`${p.name}, as Fume has it`} />}
        <DataList className="ui-chat-brief-lines">
          {p.facts.map((f) => (
            <DataListItem key={f.id} label={f.label}>
              {f.source === "unknown" ? <span className="ui-chat-brief-empty">Fume asks you</span> : f.statement}
            </DataListItem>
          ))}
        </DataList>
      </div>
    </Shell>
  );
}

function CollectionPanel({ link, onClose }: { link: Extract<ChatLink, { kind: "collection" }>; onClose?: () => void }) {
  const view = useCollection(link.collectionId).data;
  const open = useOpenLink();
  if (!view) return <Shell link={link} onClose={onClose} title="Opening the collection" />;
  const waiting = view.products.filter((p) => p.state !== "verified").length;
  return (
    <Shell
      link={link}
      onClose={onClose}
      title={view.collection.name}
      meta={[
        copy.count(view.products.length, "product"),
        waiting ? `${waiting} not confirmed yet` : "All confirmed",
      ].join(" · ")}
    >
      <ItemGroup>
        {view.products.map((p) => (
          <Item key={p.id} size="sm" asChild>
            <button type="button" onClick={() => open({ kind: "product", productId: p.id })}>
              <ItemMedia variant="image">
                <ItemMediaImage src={p.images[0]} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{p.name}</ItemTitle>
                <ItemDescription>
                  {[p.variant, p.state === "verified" ? "Confirmed" : "Not confirmed yet"].filter(Boolean).join(" · ")}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Icon name="chevron-right" />
              </ItemActions>
            </button>
          </Item>
        ))}
      </ItemGroup>
    </Shell>
  );
}

// ─── In the conversation ────────────────────────────────────────────────────

/** #14: creatives in a message, as small tiles: four at most, then "+N" (it opens the campaign). */
export function ChatThumbs({
  creatives,
  campaignId,
  max = 4,
}: {
  creatives: Creative[];
  campaignId: Id;
  max?: number;
}) {
  const open = useOpenLink();
  const label = useCreativeLabels({ id: campaignId });
  const shown = creatives.slice(0, max);
  const rest = creatives.length - shown.length;
  return (
    <ul className="ui-chat-thumbs" aria-label={copy.creatives(creatives.length)}>
      {shown.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            className="ui-chat-thumb"
            data-format={c.format}
            onClick={() => open({ kind: "creative", campaignId, creativeId: c.id })}
            aria-label={`Open ${label(c)}`}
          >
            <img src={c.current.image} alt="" />
          </button>
        </li>
      ))}
      {rest > 0 && (
        <li>
          <button
            type="button"
            className="ui-chat-thumb ui-chat-thumb-more"
            onClick={() => open({ kind: "campaign", campaignId })}
            aria-label={`${rest} more: open the campaign`}
          >
            +{rest}
          </button>
        </li>
      )}
    </ul>
  );
}

/** What a link names, in a few words, for its line in the conversation. */
function useLinkWords(link: ChatLink): { title: string; description?: string; picture?: string } {
  const campaign = useCampaign("campaignId" in link ? link.campaignId : undefined).data;
  const catalogue = useCatalogue().data;
  const creative = link.kind === "creative" ? campaign?.creatives.find((c) => c.id === link.creativeId) : undefined;
  const label = useCreativeLabels(campaign?.campaign);
  switch (link.kind) {
    case "campaign":
      return {
        title: campaign?.campaign.name ?? "The campaign",
        description: campaign ? copy.campaignStatus(campaign.campaign).words : undefined,
        picture: campaign?.creatives.find((c) => c.current.state !== "making")?.current.image,
      };
    case "plan":
      return {
        title: `The plan for ${campaign?.campaign.name ?? "the campaign"}`,
        description: "Open it beside the conversation",
      };
    case "creative":
      return {
        title: creative ? `${label(creative)} in ${campaign?.campaign.name}` : "The creative",
        description: creative ? copy.format[creative.format].label : undefined,
        picture: creative?.current.image,
      };
    case "product": {
      const p = catalogue?.products.find((x) => x.id === link.productId);
      return {
        title: p ? `${p.name}${p.variant ? ` ${p.variant}` : ""}` : "The product",
        description: p ? (p.state === "verified" ? "Confirmed" : "Not confirmed yet") : undefined,
        picture: p?.images[0],
      };
    }
    case "collection": {
      const c = catalogue?.collections.find((x) => x.id === link.collectionId);
      return {
        title: c?.name ?? "The collection",
        description: c ? copy.count(c.productIds.length, "product") : undefined,
        picture: c?.cover,
      };
    }
  }
}

/** #16: one line that opens what Fume answered about, beside the conversation. */
export function LinkCard({ link }: { link: ChatLink }) {
  const open = useOpenLink();
  const words = useLinkWords(link);
  return (
    <Item variant="outline" size="sm" asChild className="ui-chat-link">
      <button type="button" onClick={() => open(link)}>
        <ItemMedia variant={words.picture ? "image" : "icon"}>
          {words.picture ? <ItemMediaImage src={words.picture} /> : <Icon name={KIND_ICON[link.kind]} />}
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{words.title}</ItemTitle>
          {words.description && <ItemDescription>{words.description}</ItemDescription>}
        </ItemContent>
        <ItemActions>
          <Icon name="chevron-right" />
        </ItemActions>
      </button>
    </Item>
  );
}

/** #16: what waits on her (Home's rows, the same list), or this month in numbers (Home's, the same numbers). */
export function SummaryCard({ of }: { of: "waiting" | "month" }) {
  return of === "waiting" ? <WaitingSummary /> : <MonthSummary />;
}

function WaitingSummary() {
  const waiting = useWaitingOnYou();
  const open = useOpenLink();
  if (waiting.loading) return null;
  if (!waiting.items.length) return <p className="ui-chat-card-note">Nothing waits on you now.</p>;
  return (
    <ItemGroup className="ui-chat-summary">
      {waiting.items.map((row) => (
        <Item key={row.id} variant="muted" size="sm" asChild>
          {row.campaignId ? (
            <button type="button" onClick={() => open({ kind: "campaign", campaignId: row.campaignId! })}>
              <SummaryRow title={row.title} detail={row.detail} picture={row.pictures[0]} />
            </button>
          ) : (
            <Link to={row.href}>
              <SummaryRow title={row.title} detail={row.detail} picture={row.pictures[0]} />
            </Link>
          )}
        </Item>
      ))}
    </ItemGroup>
  );
}

function SummaryRow({ title, detail, picture }: { title: string; detail: string; picture?: string }) {
  return (
    <>
      <ItemMedia variant={picture ? "image" : "icon"}>
        {picture ? <ItemMediaImage src={picture} /> : <Icon name="palette" />}
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription>{detail}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Icon name="chevron-right" />
      </ItemActions>
    </>
  );
}

function MonthSummary() {
  const usage = useHome().data?.usage;
  const lessons = useBrandDna().data?.memory.length;
  if (!usage) return null;
  return (
    <div className="ui-chat-summary ui-app-stack ui-app-stack--tight">
      <StatGrid>
        <Stat label="Creatives used" value={[{ num: usage.creativesUsed, unit: `of ${usage.creativeCap}` }]} />
        <Stat label="Campaigns active" value={usage.campaignsActive} />
      </StatGrid>
      <Progress
        value={usage.creativesUsed}
        max={usage.creativeCap}
        aria-label={`${usage.creativesUsed} of ${usage.creativeCap} creatives used`}
      />
      <p className="ui-chat-card-note">
        {usage.periodEndsAt ? `The package renews ${date(usage.periodEndsAt)}.` : ""}
        {lessons ? ` Fume learned ${lessons === 1 ? "one thing" : `${lessons} things`} from your campaigns.` : ""}
      </p>
    </div>
  );
}
