// Agency view models: the agency's clients, team and campaigns across clients, what a client link opens, and the
// agency's plan with Fume. The agency's Home is in views/home.ts.

import type { Id, Instant } from "../entities/common";
import type { ClientSend, AgencyFeature, FumeRequest } from "../entities/agency";
import type { Campaign } from "../entities/campaigns";
import type { AgencyRole, CustomerRole, Organisation, User, Workspace } from "../entities/identity";
import type { CampaignPlan } from "../entities/plan";
import type { Creative } from "../entities/review";

/** One client brand as the agency sees it (Home's cards, Clients, the picker and the sidebar list). */
export interface AgencyClient {
  workspace: Workspace;
  /** One sentence on where the client stands, by its most urgent campaign: "Winter gifting: the plan is ready to approve". */
  status: string;
  /** What waits on the agency in this client, as a count (the picker's dot, the list's count). */
  waitingOnYou: number;
  /** Who the work waits on when it is the client: "Waiting on Maja". */
  waitingOn?: string;
  /** The client's picture for its card (a recent creative or its product). */
  picture?: string;
  campaignsActive: number;
  /** The current campaign and how far it is, 0 to 1 (approved creatives over planned). */
  current?: { campaignId?: Id; name: string; progress: number; detail: string };
  nextDelivery?: { title: string; at: Instant };
  /** The client's own people in Fume. */
  people: User[];
  /** The agency person who leads the client. */
  lead?: User;
  /** The preview has full example data for LYSNE only; the others are shown at the agency level. */
  example: "full" | "summary";
  since: Instant;
  /** When the signed-in person last opened it (recent first in the picker). */
  openedAt?: Instant;
  /** The client's people with their role. */
  roles?: Record<Id, CustomerRole>;
  /** Added just now: Fume is still reading it. */
  isNew?: boolean;
}

/** One agency person this week (Home's "Team this week", Team). */
export interface AgencyTeamMember {
  user: User;
  role: AgencyRole;
  /** The clients they lead or work on. */
  clientIds: Id[];
  /** 0 to 1: this week's load. */
  load: number;
  /** "12 creatives to check · LYSNE, HALM" */
  thisWeek: string;
}

/** A campaign in the agency's table across clients. */
export interface AgencyCampaignRow {
  campaign: Campaign;
  client: Workspace;
  /** The status sentence, made the same way as copy.campaignStatus. */
  status: string;
  waitingOn?: string;
  liveAt?: Instant;
  example: "full" | "summary";
}

/** What a client link opens: the brand, the campaign, what was sent and who sent it. A campaign has one client link:
 *  it opens the plan the agency sent first and, later, the creatives sent in the same link; `creatives` holds every
 *  one sent in it (FLOWS §26.8). */
export interface ClientLinkView {
  send: ClientSend;
  client: Workspace;
  agency: Organisation;
  campaign: Campaign;
  creatives: Creative[];
  sentBy: User;
  /** What the client link calls each creative (creative id → "Night Body Oil · Feed A3"), the same customer name the
   *  client reads in Fume; without it the page says the campaign's name and the format. */
  names?: Record<Id, string>;
  /** The plan, when the link carries it: as it stands now (a version the client asked to change is being rewritten). */
  plan?: CampaignPlan;
  /** The newest send that carried the plan: its version, its note and when. */
  planSend?: ClientSend;
}

/** The agency's plan with Fume: what it has, what comes and who at Fume answers it. */
export interface AgencyFumePlan {
  /** "Agency · early access" */
  name: string;
  /** Who decides: one sentence. */
  decidedBy: string;
  /** The person at Fume who answers the agency (Sander, its producer at Fume). */
  contact?: User;
  features: AgencyFeature[];
  /** What the agency asked Fume for, newest first. */
  requests: FumeRequest[];
}
