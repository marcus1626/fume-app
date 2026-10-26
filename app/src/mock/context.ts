// What every domain module of the mock shares: the database, who is signed in and where, the mock's clock, ids,
// events, and the few helpers more than one domain needs. index.ts makes one per mock.
import {
  FumeError,
  type Campaign,
  type Creative,
  type CreativeVersion,
  type CustomerRole,
  type FumeApi,
  type FumeEvent,
  type Id,
  type Message,
  type User,
} from "../contract";
import { countCreatives, customerSees, isFullyApproved, waitsForAgencySend } from "../domain/creatives";
import { canApprove } from "../domain/permissions";
import type { Db } from "./db";
import { NOW } from "./seed";

export interface MockOptions {
  /** Who is signed in: a customer (default Maja) or one of Fume's people (Anna, the expert). */
  userId?: Id;
  /** Milliseconds each call waits, so loading states show (0 in tests). */
  latency?: number;
  /** Start as a brand-new workspace, for the first run. */
  fresh?: boolean;
  /** The agency demo (FLOWS §24): LYSNE is Brygga Studio's client; Nora Vik, its creative lead, is signed in. */
  agency?: boolean;
}

/** A campaign started in the chat, while Fume still asks about its brief: the questions left, in order. */
export interface BriefQuestion {
  key: "market" | "audience" | "date" | "product" | "message";
  /** The product question shows the products as a grid. */
  productIds?: Id[];
  /** The products she named that wait to be confirmed; confirming them answers the question. */
  named?: Id[];
  missing: string;
  text: string;
  question: string;
  why: string;
  options: string[];
  fill: (answer: string, campaign: Campaign, brief: import("../contract").Brief) => void;
}

export interface Mock {
  db: Db;
  options: MockOptions;
  latency: number;
  /** Who is signed in, and the workspace they are in. */
  userId: Id;
  workspaceId: Id;
  /** The finished api, for a call that answers with another call. */
  api: FumeApi;
  listeners: Set<(event: FumeEvent) => void>;
  /** The chat's brief: the campaigns Fume still asks about, and the "Add to it or start a new one?" it waits on. */
  chat: {
    drafting: Map<Id, BriefQuestion[]>;
    pendingStart: Map<Id, { text: string; productIds: Id[]; campaignId: Id }>;
    startingAnyway: boolean;
  };
  /** Version ids checked after their campaign's set was sent to the customer: they wait for the next send. */
  heldForSend: Set<Id>;
  /** When the agency person last opened each client brand (the picker lists the recent first). */
  opened: Map<Id, string>;

  now(): string;
  nextId(prefix: string): string;
  /** Answers after the mock's latency, with a copy of the value as it is then. */
  wait<T>(value: T): Promise<T>;
  emit(event: FumeEvent): void;
  me(): User;
  isStaff(): boolean;
  role(): CustomerRole | null;
  user(id: Id): User;
  mustApprove(): void;
  mustStaff(): void;
  find<T extends { id: Id }>(list: T[], id: Id, what: string): T;
  campaignOf(id: Id): Campaign;
  inWorkspace<T extends { workspaceId: Id }>(list: T[]): T[];
  myCampaigns(): Campaign[];
  /** The workspace an agency runs, when it is one. */
  agencyRun(workspaceId: Id | undefined): boolean;
  /** A checked creative in a client brand that the agency has not sent to the client yet. */
  unsentToClient(c: Creative): boolean;
  /** A checked creative Fume has not sent to the customer yet (outside a campaign in production). */
  unsentByFume(c: Creative): boolean;
  /** Whether the signed-in person may see the creative. */
  visible(c: Creative): boolean;
  setVersion(creative: Creative, change: Partial<CreativeVersion>): void;
  recount(campaign: Campaign): void;
  /** Adds a message to a thread and tells the open pages. */
  post(threadId: Id, message: Omit<Message, "id" | "threadId" | "at">): Message;
}

export function createMock(db: Db, options: MockOptions): Mock {
  const latency = options.latency ?? 120;
  const started = Date.now();
  let seq = 0;

  const m: Mock = {
    db,
    options,
    latency,
    userId: options.userId ?? (options.agency ? "u-nora" : "u-maja"),
    workspaceId: "w-lysne",
    api: undefined as unknown as FumeApi,
    listeners: new Set(),
    chat: { drafting: new Map(), pendingStart: new Map(), startingAnyway: false },
    heldForSend: new Set(),
    opened: new Map(),

    // The mock's time runs on from the seed's moment (14 Oct 2026, 14:32 Oslo), so the demo always reads the same.
    now: () => new Date(NOW + Date.now() - started).toISOString(),
    nextId: (prefix) => `${prefix}-${Date.now().toString(36)}-${(seq += 1)}`,
    wait: (value) => new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), latency)),
    emit: (event) => m.listeners.forEach((l) => l(structuredClone(event))),

    me: () => db.users.find((u) => u.id === m.userId)!,
    isStaff: () => Boolean(m.me().staffRole),
    role: () => db.memberships.find((x) => x.userId === m.userId && x.workspaceId === m.workspaceId)?.role ?? null,
    user: (id) => {
      const found = db.users.find((u) => u.id === id);
      if (!found) throw new FumeError("not_found", `No person ${id}`);
      return found;
    },
    mustApprove: () => {
      if (!canApprove(m.role())) throw new FumeError("forbidden", "Only the approver can approve.");
    },
    mustStaff: () => {
      if (!m.isStaff()) throw new FumeError("forbidden", "The Quality Gate is for Fume's experts.");
    },
    find: (list, id, what) => {
      const found = list.find((x) => x.id === id);
      if (!found) throw new FumeError("not_found", `No ${what} ${id}`);
      return found;
    },
    campaignOf: (id) => m.find(db.campaigns, id, "campaign"),
    inWorkspace: (list) => list.filter((x) => x.workspaceId === m.workspaceId),
    myCampaigns: () => m.inWorkspace(db.campaigns),

    agencyRun: (workspaceId) => Boolean(db.workspaces.find((w) => w.id === workspaceId && w.agencyId)),
    unsentToClient: (c) => {
      const campaign = db.campaigns.find((k) => k.id === c.campaignId);
      const workspace = db.workspaces.find((w) => w.id === campaign?.workspaceId);
      return waitsForAgencySend(c, workspace, db.clientSends);
    },
    unsentByFume: (c) => c.current.state === "checked" && m.heldForSend.has(c.current.id),
    // After a campaign's set is released, a creative checked later waits for the next send; in a brand an agency
    // runs, the client sees what the agency sent.
    visible: (c) =>
      m.isStaff() || customerSees(c.current, m.campaignOf(c.campaignId), m.unsentToClient(c) || m.unsentByFume(c)),

    setVersion: (creative, change) => {
      creative.current = { ...creative.current, ...change };
      creative.versions[creative.versions.length - 1] = creative.current;
      m.emit({ type: "version.state", creativeId: creative.id, version: creative.current });
    },
    recount: (campaign) => {
      campaign.counts = countCreatives(db.creatives.filter((c) => c.campaignId === campaign.id));
      if (isFullyApproved(campaign)) campaign.state = "approved";
      campaign.updatedAt = m.now();
      m.emit({ type: "campaign.state", campaign });
    },
    post: (threadId, message) => {
      const msg: Message = { id: m.nextId("msg"), threadId, at: m.now(), ...message };
      db.messages.push(msg);
      m.emit({ type: "message.new", message: msg });
      return msg;
    },
  };
  return m;
}
