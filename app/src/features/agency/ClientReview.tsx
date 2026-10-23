// Round 11 CLIENT FLOW (FLOWS §24.2, §24.5; PROPOSED 20 Oct 2026): a campaign's review as the agency sees it. The
// agency never approves a creative, so there is no selection and no Approve here. What was approved shows with who
// recorded it ("Maja approved · recorded by you"); what was sent, and the client link, sit beside on a desk.
// Round 12 AGENCY (UX review DLOAD-5, DTASK-15; brief r12 SENDING; PROPOSED 20 Oct 2026): a checked creative reaches
// the client only when the agency sends it, so the review has the two states in two groups, each named once: "To send"
// (checked, not sent: the header's Ink "Send to Maja") and "With Maja" (sent; she approves them), then "Changes asked
// for" and "Approved". Record an approval is a visible secondary pill in the header while anything waits on the
// client (no "…" menu); its panel starts with nothing ticked.
import { Button, CreativeGrid, CreativeTile } from "@fume/ui";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { CampaignView, Creative, Id, User } from "../../contract";
import * as copy from "../../copy";
import { date } from "../../lib/time";
import { Nothing, Section } from "../../shell/Page";
import { firstName } from "../../shell/people";
import { tileCaption } from "../review/parts";
import { useCustomerNames } from "../review/names";
import { ClientCheck } from "./ClientCheck";
import { useCampaignSends } from "./clientFlow";
import { RecordApprovalSheet } from "./RecordApproval";
import { ClientSends, SendToClientSheet } from "./SendToClient";

type People = { name: (id?: string) => string; user: (id?: string) => User | undefined };

/** The two panels of the review, opened from the header (Send to Maja, Record an approval) or from `?send=1`. */
export function useClientPanels(view: CampaignView, checked: Creative[]) {
  const [send, setSend] = useState<{ initial?: Id[] } | null>(null);
  const [record, setRecord] = useState<{ initial?: Id[] } | null>(null);
  const panels = (
    <>
      <SendToClientSheet campaign={view.campaign} creatives={checked} initial={send?.initial} open={send !== null} onOpenChange={(o) => !o && setSend(null)} />
      <RecordApprovalSheet campaign={view.campaign} creatives={checked} initial={record?.initial} open={record !== null} onOpenChange={(o) => !o && setRecord(null)} />
    </>
  );
  return { openSend: (initial?: Id[]) => setSend({ initial }), openRecord: (initial?: Id[]) => setRecord({ initial }), panels };
}

/** The review's header actions for the agency: "Send to Maja" (Ink) while anything is not sent, else "Send again"
 *  (a white pill); "Record an approval" a white pill beside it while anything waits on the client. Passed as the
 *  header's `actions` with a .ui-page-header-label, so on a phone each is a circle that keeps its name, and on a desk
 *  no empty More sits beside them. */
export function useClientActions(view: CampaignView, checked: Creative[], panels: ReturnType<typeof useClientPanels>) {
  const { split } = useCampaignSends(view.campaign.id, true);
  const { toSend } = split(checked);
  const approver = firstName(view.approver.name);
  if (!checked.length) return {};
  const pill = (label: string, icon: "check" | "send", onClick: () => void) => (
    <Button key={label} variant="secondary" icon={icon} onClick={onClick}>
      <span className="ui-page-header-label">{label}</span>
    </Button>
  );
  const record = pill("Record an approval", "check", () => panels.openRecord());
  return toSend.length
    ? { actions: record, primaryAction: { label: copy.send.action(approver), icon: "send" as const, onSelect: () => panels.openSend() } }
    : { actions: [record, pill("Send again", "send", () => panels.openSend())] };
}

/** The checked creatives in their two states, then what the client asked to change and what she approved. */
export function ClientCreatives({ view, checked, people, me, onOpen }: { view: CampaignView; checked: Creative[]; people: People; me: Id; onOpen: (c: Creative) => void }) {
  const named = useCustomerNames(view.campaign);
  const { waitingOn, split, sendOf } = useCampaignSends(view.campaign.id, true);
  const approver = firstName(view.approver.name);
  const approved = useMemo(() => view.creatives.filter((c) => c.current.state === "approved" || c.current.state === "delivered").map(named), [view.creatives, named]);
  const changed = useMemo(() => view.creatives.filter((c) => c.current.state === "changes_requested").map(named), [view.creatives, named]);
  const { toSend, withThem } = split(checked);
  const checkers = [...new Set(toSend.map((c) => c.current.checkedBy).filter((id): id is Id => Boolean(id)))];
  const byWhom = checkers.map((id) => copy.byYou(people.user(id)?.name ?? people.name(id), id === me, true));
  // "You checked these 2. Maja sees them once you send them; only Maja approves a creative."
  const checkedLine = byWhom.length ? `${byWhom.join(" and ")} checked ${toSend.length === 1 ? "this one" : `these ${toSend.length}`}. ` : "";
  const sentOn = [...new Set(withThem.map((c) => sendOf(c.current.id)?.sentAt).filter((d): d is string => Boolean(d)).map((d) => date(d)))];

  const tile = (c: Creative) => (
    <CreativeTile
      key={c.id}
      data-creative={c.id}
      src={c.current.image}
      alt={c.title}
      format={c.format}
      label={c.title}
      caption={tileCaption(c)}
      check={<ClientCheck creative={c} people={people.user} waitingOn={waitingOn(c.current)} client={approver} />}
      onOpen={() => onOpen(c)}
    />
  );

  return (
    <>
      {toSend.length > 0 && (
        <Section title="To send" meta={toSend.length} titleId="review-to-send" text={`${checkedLine}${approver} sees ${toSend.length === 1 ? "it" : "them"} once you send ${toSend.length === 1 ? "it" : "them"}; only ${approver} approves a creative.`}>
          <CreativeGrid className="ui-review-grid" aria-labelledby="review-to-send">
            {toSend.map(tile)}
          </CreativeGrid>
        </Section>
      )}
      {withThem.length > 0 && (
        <Section
          title={copy.send.withThem(approver)}
          meta={withThem.length}
          titleId="review-with-client"
          text={`Sent ${sentOn.join(" and ")}. ${approver} approves them in Fume or through the client link. When ${approver} approved outside Fume, record it.`}
        >
          <CreativeGrid className="ui-review-grid" aria-labelledby="review-with-client">
            {withThem.map(tile)}
          </CreativeGrid>
        </Section>
      )}
      {changed.length > 0 && (
        <Section
          title="Changes asked for"
          meta={changed.length}
          titleId="review-client-changes"
          text={`${approver} asked for changes on ${changed.length === 1 ? "this one" : `these ${changed.length}`}. Make the new version in the Studio and check it; then send it again.`}
        >
          <CreativeGrid aria-labelledby="review-client-changes">{changed.map(tile)}</CreativeGrid>
        </Section>
      )}
      {approved.length > 0 && (
        <Section title="Approved" meta={approved.length} titleId="review-approved" text={`${approver} approved these, in Fume, through a client link, or as you recorded it.`}>
          <CreativeGrid aria-labelledby="review-approved">{approved.map(tile)}</CreativeGrid>
        </Section>
      )}
    </>
  );
}

/** Beside the creatives on a desk: what was sent to the client and when, with the client link. */
export function ClientSent({ view }: { view: CampaignView }) {
  const { sends } = useCampaignSends(view.campaign.id, true);
  const approver = firstName(view.approver.name);
  return (
    <Section
      title="Sent"
      titleId="review-sent"
      text={sends.length ? undefined : `Nothing sent yet. ${approver} sees checked creatives only once you send them. A client link is for someone at the client without an account.`}
    >
      {sends.length > 0 && <ClientSends campaignId={view.campaign.id} titleId="review-sent" />}
    </Section>
  );
}

/** Nothing waits on the client in this campaign: what comes next is the agency's own check, or the next creatives. */
export function ClientNext({ view }: { view: CampaignView }) {
  const approver = firstName(view.approver.name);
  const inCheck = view.creatives.filter((c) => c.current.state === "in_check").length;
  return (
    <Nothing
      icon="circle-check"
      title={`Nothing waits on ${approver} here`}
      text={
        inCheck
          ? `${copy.creatives(inCheck)} in ${view.campaign.name} wait on a check. Once checked, they are yours to send to ${approver}.`
          : `When the next creatives in ${view.campaign.name} are checked, they are yours to send to ${approver}.`
      }
      action={
        <div className="ui-app-row">
          {inCheck > 0 && (
            <Button asChild iconEnd="arrow-right">
              <Link to={`/studio/b/${view.campaign.workspaceId}/qa`}>Check</Link>
            </Button>
          )}
          <Button asChild variant="secondary">
            <Link to="/">Home</Link>
          </Button>
        </div>
      }
    />
  );
}
