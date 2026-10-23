// Agency calls (FLOWS §24). The agency's own calls; inside a client the agency uses the customer's calls on that
// client's workspace. The agency checks; only its client approves, the plan included (FLOWS §26.8).

import type { Id, Instant } from "../entities/common";
import type { ClientSend, FumeRequest } from "../entities/agency";
import type { CustomerRole } from "../entities/identity";
import type { CampaignPlan } from "../entities/plan";
import type { CreativeVersion } from "../entities/review";
import type {
  AgencyCampaignRow,
  AgencyClient,
  AgencyFumePlan,
  AgencyTeamMember,
  ClientLinkView,
} from "../views/agency";

export interface AgencyApi {
  // Clients, campaigns and the team
  /** Every client brand (Clients, the picker, the sidebar list), recent first. */
  agencyClients(): Promise<AgencyClient[]>;
  /** Every campaign across the clients. */
  agencyCampaigns(): Promise<AgencyCampaignRow[]>;
  agencyTeam(): Promise<AgencyTeamMember[]>;
  /** Lead only: a new client brand; Fume starts its Brand DNA from the website; the client's people are invited. */
  addClient(input: {
    brandName: string;
    website?: string;
    market?: string;
    language?: string;
    people: { name: string; email: string; role: CustomerRole }[];
  }): Promise<AgencyClient>;

  // Sending to the client and the client link
  /** Checked creatives to the client: the people named are told in Fume; with link, a client link too. With `plan`
   *  the agency checks the plan and sends it: the client approves it, and only then does the Engine start. A campaign
   *  has one client link: a later send with a link reuses it. */
  sendToClient(input: {
    campaignId: Id;
    versionIds: Id[];
    to: Id[];
    link: boolean;
    note?: string;
    plan?: boolean;
  }): Promise<ClientSend>;
  /** What was sent to the client for a campaign, newest first. */
  clientSends(campaignId: Id): Promise<ClientSend[]>;
  /** An approval the client gave outside Fume, recorded by the agency (approvedBy stays the client). */
  recordClientApproval(input: {
    versionIds: Id[];
    clientUserId: Id;
    note: string;
    /** The day she approved; today when left out. */
    at?: Instant;
  }): Promise<CreativeVersion[]>;
  /** What a client link opens (no sign-in in the real app; the mock serves it to anyone). */
  clientLink(token: string): Promise<ClientLinkView>;
  /** Approve or ask for changes through a client link, as the client person it was sent to. */
  answerClientLink(input: {
    token: string;
    versionId: Id;
    verdict: "approve" | "changes";
    text?: string;
    name: string;
  }): Promise<CreativeVersion>;
  /** Approve the plan or ask for changes through a client link, as the client person it was sent to. Approved, the
   *  Engine starts on the masters; changes go to Fume, and the agency checks the next version before she sees it. */
  answerClientPlan(input: {
    token: string;
    verdict: "approve" | "changes";
    text?: string;
    name: string;
  }): Promise<CampaignPlan>;

  // The agency's plan with Fume
  /** What the agency's Fume plan holds and what comes (Fume decides). */
  agencyPlan(): Promise<AgencyFumePlan>;
  /** Borrow Fume's people, or write to Fume's customer service. Sends a request; Fume answers in a working day. */
  askFume(input: Omit<FumeRequest, "id" | "by" | "at" | "state">): Promise<FumeRequest>;
}
