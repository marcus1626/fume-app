// Brygga Studio, the agency of the agency demo: its people, LYSNE's client people and the example clients (AURÉA, HALM
// and VEV), who leads each one, and how LYSNE's history becomes the agency's. The example clients exist at the agency
// level only: the mock is one brand deep (LYSNE), so their own places say so in the preview (FLOWS §24.8).
import type { Id, Organisation, UsageFigures, UsagePeriod, User, Workspace } from "../../contract";

export const AGENCY_ID = "o-brygga";
/** The one client with full example data in the preview. */
export const FULL_CLIENT = "w-lysne";
/** The person at Fume who answers an agency in its Fume conversation (FLOWS §24.1, §21). */
export const FUME_CONTACT = "u-sander";

export const agencyPeople: User[] = [
  {
    id: "u-nora",
    name: "Nora Vik",
    title: "Creative lead",
    email: "nora@brygga.example",
    staffRole: "expert",
    agency: { organisationId: AGENCY_ID, role: "lead" },
  },
  {
    id: "u-even",
    name: "Even Dahl",
    title: "Designer",
    email: "even@brygga.example",
    staffRole: "expert",
    agency: { organisationId: AGENCY_ID, role: "creative" },
  },
  {
    id: "u-live",
    name: "Live Hauge",
    title: "Art director",
    email: "live@brygga.example",
    staffRole: "expert",
    agency: { organisationId: AGENCY_ID, role: "creative" },
  },
  {
    id: "u-sindre",
    name: "Sindre Moe",
    title: "Producer",
    email: "sindre@brygga.example",
    staffRole: "operator",
    agency: { organisationId: AGENCY_ID, role: "creative" },
  },
];

export const clientPeople: User[] = [
  { id: "u-camille", name: "Camille Roux", title: "Brand director", email: "camille@aurea.example" },
  { id: "u-henrik", name: "Henrik Aas", title: "Founder", email: "henrik@halm.example" },
  { id: "u-sara", name: "Sara Lind", title: "Marketing lead", email: "sara@vev.example" },
];

export const summaryClients: { workspace: Workspace; org: Organisation }[] = [
  {
    workspace: {
      id: "w-aurea",
      organisationId: "o-aurea",
      brandName: "AURÉA",
      market: "Denmark",
      language: "Danish",
      agencyId: AGENCY_ID,
    },
    org: { id: "o-aurea", name: "AURÉA", packageId: "p-core", kind: "brand" },
  },
  {
    workspace: {
      id: "w-halm",
      organisationId: "o-halm",
      brandName: "HALM",
      market: "Norway",
      language: "Norwegian",
      agencyId: AGENCY_ID,
    },
    org: { id: "o-halm", name: "HALM", packageId: "p-core", kind: "brand" },
  },
  {
    workspace: {
      id: "w-vev",
      organisationId: "o-vev",
      brandName: "VEV",
      market: "Sweden",
      language: "Swedish",
      agencyId: AGENCY_ID,
    },
    org: { id: "o-vev", name: "VEV", packageId: "p-core", kind: "brand" },
  },
];

/** Who leads each client at the agency, and the client's own people. */
export const leads: Record<Id, Id> = {
  "w-lysne": "u-nora",
  "w-aurea": "u-live",
  "w-halm": "u-even",
  "w-vev": "u-live",
};
export const clientOwners: Record<Id, Id[]> = { "w-aurea": ["u-camille"], "w-halm": ["u-henrik"], "w-vev": ["u-sara"] };

/** Fume's people in LYSNE's history become the agency's: the checks and the producer are Brygga Studio's now. */
export const swapIds: Record<Id, Id> = { "u-anna": "u-nora", "u-tuva": "u-live", "u-sander": "u-sindre" };
export const swapNames: [RegExp, string][] = [
  [/\bAnna\b/g, "Nora"],
  [/\bTuva\b/g, "Live"],
  [/\bSander\b/g, "Sindre"],
];

/** The example clients' own figures (the preview has full data for LYSNE only, FLOWS §24.8). */
export const summaryUsage: Record<
  Id,
  Record<UsagePeriod, Pick<UsageFigures, "creatives" | "approved" | "delivered">>
> = {
  "w-vev": {
    month: { creatives: 16, approved: 10, delivered: 0 },
    last_month: { creatives: 12, approved: 12, delivered: 12 },
    weeks: { creatives: 28, approved: 22, delivered: 12 },
  },
  "w-halm": {
    month: { creatives: 0, approved: 0, delivered: 0 },
    last_month: { creatives: 0, approved: 0, delivered: 0 },
    weeks: { creatives: 0, approved: 0, delivered: 0 },
  },
  "w-aurea": {
    month: { creatives: 0, approved: 0, delivered: 0 },
    last_month: { creatives: 0, approved: 0, delivered: 0 },
    weeks: { creatives: 0, approved: 0, delivered: 0 },
  },
};
