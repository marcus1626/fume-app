// The Quality Gate: Fume's experts (or an agency's own people) check every creative before the customer sees it. The
// per-creative checks of the first Studio, and Check: the QA items, each sent from the Studio or landed by an Engine
// run, checked, sent back to the Engine with feedback, or opened in the Studio.
import {
  FumeError,
  type Campaign,
  type Check,
  type CheckView,
  type CreativeVersion,
  type FumeApi,
  type Id,
  type QaItem,
  type QaView,
  type QueueItem,
} from "../contract";
import type { Mock } from "./context";
import { agencyBrands } from "./home";
import { defaults } from "./seed/studioModes";

type Calls =
  | "checkQueue"
  | "check"
  | "passItem"
  | "addNote"
  | "markChecked"
  | "requestCorrection"
  | "hold"
  | "release"
  | "qualityLog"
  | "qaQueue"
  | "qaCheck"
  | "qaUncheck"
  | "qaFeedback"
  | "qaEdit"
  | "qaToStudio";

/** The expert's own checks; an operator or admin sees every open check in the workspaces they are on. */
export function openChecks(m: Mock): Check[] {
  const { db } = m;
  return db.checks
    .filter((c) =>
      m.me().staffRole === "expert"
        ? c.expertId === m.userId
        : db.staff.some((s) => s.userId === m.userId && s.workspaceId === c.workspaceId) || m.me().staffRole === "admin",
    )
    .filter((c) => c.state !== "checked")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt) || (a.risk === "high" ? -1 : 1));
}

export function queueItems(m: Mock): QueueItem[] {
  const { db } = m;
  return openChecks(m).map((check) => ({
    check,
    creative: m.find(db.creatives, check.creativeId, "creative"),
    campaign: m.campaignOf(check.campaignId),
    workspace: m.find(db.workspaces, check.workspaceId, "workspace"),
  }));
}

/** The creative a QA item checks, when it is the same creative in the same format (a Design item may only borrow an id). */
const creativeOf = (m: Mock, item: QaItem) => {
  const c = m.db.creatives.find((x) => x.id === item.creativeId);
  return c && c.format === item.format && c.campaignId === item.campaignId ? c : undefined;
};

/** Every QA item of a brand (or of all), as Check lists them: what waits first, then the risky and the soonest due. */
export function qaViews(m: Mock, workspaceId?: Id): QaView[] {
  const { db } = m;
  /** What it is checked against travels with it, from the creative's own check, else the brand's. */
  const againstOf = (item: QaItem): QaView["against"] => {
    const own = creativeOf(m, item) ? db.checks.find((c) => c.creativeId === item.creativeId) : undefined;
    const check = own ?? db.checks.find((c) => c.workspaceId === item.workspaceId);
    return check?.items.map(({ area, label, against }) => ({ area, label, against }));
  };
  /** The product a QA item shows: its document's, else its campaign's when the campaign has one. */
  const productOf = (item: QaItem) => {
    const d = item.documentId ? db.documents.find((x) => x.id === item.documentId) : undefined;
    const ids = d?.specs.productId
      ? [d.specs.productId]
      : (db.campaigns.find((c) => c.id === item.campaignId)?.productIds ?? []);
    return ids.length === 1 ? db.products.find((p) => p.id === ids[0])?.name : undefined;
  };
  /** A creative made outside a campaign (a product page's pictures, campaignId "") is checked too. In Check it sits in
   *  its brand's "Product page" group; this stand-in only names the group and the brand's customer. */
  const productPage = (item: QaItem): Campaign => {
    const w = m.find(db.workspaces, item.workspaceId, "workspace");
    const any = db.campaigns.find((c) => c.workspaceId === item.workspaceId);
    return {
      id: "",
      workspaceId: w.id,
      name: "Product page",
      productIds: [],
      state: "in_production",
      stage: "masters",
      approverId: any?.approverId ?? "",
      channels: ["product_page"],
      formats: [item.format],
      market: w.market,
      language: w.language,
      createdBy: "fume",
      createdAt: item.sentAt ?? m.now(),
      updatedAt: m.now(),
      counts: { creatives: 0, inCheck: 0, checked: 0, approved: 0, delivered: 0 },
      roundsUsed: 0,
      roundsIncluded: 0,
      brandDnaVersion: any?.brandDnaVersion ?? 1,
    };
  };
  const order = { waiting: 0, fixing: 1, in_studio: 2, checked: 3 };
  return db.qaItems
    .filter((i) => !workspaceId || i.workspaceId === workspaceId)
    .sort(
      (a, b) =>
        order[a.state] - order[b.state] ||
        (a.risk === b.risk ? a.dueAt.localeCompare(b.dueAt) : a.risk === "high" ? -1 : 1),
    )
    .map((item) => ({
      item,
      campaign: item.campaignId ? m.find(db.campaigns, item.campaignId, "campaign") : productPage(item),
      workspace: m.find(db.workspaces, item.workspaceId, "workspace"),
      against: againstOf(item),
      productName: productOf(item),
    }));
}

/** The Engine fixes the feedback (one note, or all the item holds) a while after it is sent, unless a designer took
 *  the item over in the Studio. */
export function fixLater(m: Mock, item: QaItem, delay: number, only?: QaItem["feedback"][number]) {
  setTimeout(() => {
    if (item.state !== "fixing") return;
    (only ? [only] : item.feedback).forEach((f) => (f.state = "fixed"));
    item.state = "waiting";
    item.evaluation = { productTruth: "pass", brandRules: "pass", artefacts: "none", notes: [] };
    m.emit({ type: "qa.state", item: structuredClone(item) });
  }, delay);
}

export function qualityCalls(m: Mock): Pick<FumeApi, Calls> {
  const { db, wait } = m;
  /** Before a check in Check: what the creative and its check were, so Undo puts both back. */
  const beforeCheck = new Map<Id, { version?: CreativeVersion; check?: Check["state"] }>();

  function checkView(check: Check, queue: Check[]): CheckView {
    const creative = m.find(db.creatives, check.creativeId, "creative");
    const campaign = m.campaignOf(check.campaignId);
    const index = queue.findIndex((c) => c.id === check.id);
    return {
      check,
      creative,
      version: creative.current,
      campaign,
      workspace: m.find(db.workspaces, check.workspaceId, "workspace"),
      product: db.products.find((p) => campaign.productIds.includes(p.id)),
      index: Math.max(index, 0),
      total: queue.length,
      prevId: queue[index - 1]?.id,
      nextId: queue[index + 1]?.id,
    };
  }

  return {
    async checkQueue() {
      m.mustStaff();
      return wait(queueItems(m));
    },
    async check(id) {
      m.mustStaff();
      const check = m.find(db.checks, id, "check");
      if (check.state === "waiting") Object.assign(check, { state: "in_check", startedAt: m.now() });
      return wait(checkView(check, openChecks(m)));
    },
    async passItem(id, itemId) {
      const check = m.find(db.checks, id, "check");
      const item = m.find(check.items, itemId, "item");
      item.result = item.result === "pass" ? "pending" : "pass";
      return wait(check);
    },
    async addNote(id, note) {
      const check = m.find(db.checks, id, "check");
      const n = {
        id: m.nextId("n"),
        number: check.notes.length + 1,
        author: m.userId,
        at: m.now(),
        x: note.x,
        y: note.y,
        text: note.text,
      };
      check.notes.push(n);
      if (note.itemId) Object.assign(m.find(check.items, note.itemId, "item"), { result: "note", noteId: n.id });
      return wait(check);
    },
    async markChecked(id) {
      m.mustStaff();
      const check = m.find(db.checks, id, "check");
      Object.assign(check, { state: "checked", checkedAt: m.now() });
      check.items.forEach((i) => i.result === "pending" && (i.result = "pass"));
      const creative = m.find(db.creatives, check.creativeId, "creative");
      m.setVersion(creative, { state: "checked", checkedBy: m.userId, checkedAt: m.now() });
      m.recount(m.campaignOf(check.campaignId));
      db.record.push({
        id: m.nextId("e"),
        workspaceId: check.workspaceId,
        campaignId: check.campaignId,
        subjectId: creative.id,
        actor: { kind: "person", userId: m.userId },
        action: "checked",
        detail: `${creative.title} checked`,
        at: m.now(),
      });
      return wait(check);
    },
    async requestCorrection(id) {
      m.mustStaff();
      const check = m.find(db.checks, id, "check");
      check.state = "changes_requested";
      m.setVersion(m.find(db.creatives, check.creativeId, "creative"), { state: "correcting" });
      return wait(check);
    },
    async hold(id, reason) {
      m.mustStaff();
      const check = m.find(db.checks, id, "check");
      check.state = "held";
      m.setVersion(m.find(db.creatives, check.creativeId, "creative"), { state: "held", heldReason: reason });
      return wait(check);
    },
    // "Send to Maja": the checked set goes to the customer, with every creative checked since the last send.
    async release(campaignId) {
      m.mustStaff();
      const c = m.campaignOf(campaignId);
      c.state = "in_review";
      for (const cr of db.creatives) if (cr.campaignId === campaignId) m.heldForSend.delete(cr.current.id);
      m.emit({ type: "campaign.state", campaign: c });
      return wait(c);
    },
    async qualityLog() {
      m.mustStaff();
      return wait([...db.qualityLog].sort((a, b) => b.at.localeCompare(a.at)));
    },

    // An agency's people see only their own clients' items.
    async qaQueue(workspaceId) {
      m.mustStaff();
      const views = qaViews(m, workspaceId);
      const keep = agencyBrands(m);
      return wait(keep ? views.filter((v) => keep.has(v.workspace.id)) : views);
    },
    // A check in Check moves the creative itself (its version and the campaign's counts), so what waits to be sent
    // counts it. Once the campaign's set is out, a new check waits for the next send.
    async qaCheck(itemId) {
      m.mustStaff();
      const item = m.find(db.qaItems, itemId, "QA item");
      if (item.state === "fixing") throw new FumeError("invalid", "The Engine is still fixing it.");
      if (item.state === "checked") return wait(item);
      Object.assign(item, { state: "checked", checkedBy: m.me().id, checkedAt: m.now() });
      const creative = creativeOf(m, item);
      const check = db.checks.find((c) => c.creativeId === item.creativeId && creative);
      beforeCheck.set(item.id, { version: creative ? { ...creative.current } : undefined, check: check?.state });
      if (creative && ["making", "in_check", "correcting", "held"].includes(creative.current.state)) {
        m.setVersion(creative, { state: "checked", checkedBy: m.me().id, checkedAt: m.now(), heldReason: undefined });
        const campaign = db.campaigns.find((c) => c.id === item.campaignId); // none for a product page's pictures
        if (campaign && campaign.state !== "in_production" && !m.agencyRun(item.workspaceId))
          m.heldForSend.add(creative.current.id);
        if (campaign) m.recount(campaign);
        db.record.push({
          id: m.nextId("e"),
          workspaceId: item.workspaceId,
          campaignId: item.campaignId,
          subjectId: creative.id,
          actor: { kind: "person", userId: m.me().id },
          action: "checked",
          detail: `${creative.title} checked`,
          at: m.now(),
        });
      }
      if (check) Object.assign(check, { state: "checked", checkedAt: m.now() });
      m.emit({ type: "qa.state", item: structuredClone(item) });
      return wait(item);
    },
    async qaUncheck(itemId) {
      m.mustStaff();
      const item = m.find(db.qaItems, itemId, "QA item");
      if (item.state !== "checked") return wait(item);
      Object.assign(item, { state: "waiting", checkedBy: undefined, checkedAt: undefined });
      const was = beforeCheck.get(item.id);
      beforeCheck.delete(item.id);
      const creative = creativeOf(m, item);
      if (creative && was?.version && creative.current.state === "checked") {
        m.heldForSend.delete(creative.current.id);
        m.setVersion(creative, {
          state: was.version.state,
          checkedBy: was.version.checkedBy,
          checkedAt: was.version.checkedAt,
          heldReason: was.version.heldReason,
        });
        const campaign = db.campaigns.find((c) => c.id === item.campaignId);
        if (campaign) m.recount(campaign);
        const i = db.record.map((e) => e.subjectId === creative.id && e.action === "checked").lastIndexOf(true);
        if (i >= 0) db.record.splice(i, 1);
      }
      const check = db.checks.find((c) => c.creativeId === item.creativeId && creative);
      if (check && was?.check) check.state = was.check;
      m.emit({ type: "qa.state", item: structuredClone(item) });
      return wait(item);
    },
    // The pins go with the feedback as located notes.
    async qaFeedback(itemId, text, pins) {
      m.mustStaff();
      const item = m.find(db.qaItems, itemId, "QA item");
      const fb = {
        id: m.nextId("fb"),
        text,
        by: m.me().id,
        at: m.now(),
        state: "sent" as "sent" | "fixed",
        ...(pins?.length ? { pins: structuredClone(pins) } : {}),
      };
      item.feedback.push(fb);
      item.state = "fixing";
      fixLater(m, item, m.latency * 20, fb);
      return wait(item);
    },
    async qaEdit(itemId, layers) {
      m.mustStaff();
      const item = m.find(db.qaItems, itemId, "QA item");
      item.layers = layers;
      if (item.documentId) m.find(db.documents, item.documentId, "creative document").layers = structuredClone(layers);
      return wait(item);
    },
    // While the Engine fixes it, the desk opens locked; only Take over takes it (and the fix stops).
    async qaToStudio(itemId, takeOver) {
      m.mustStaff();
      const item = m.find(db.qaItems, itemId, "QA item");
      let d = item.documentId
        ? db.documents.find((x) => x.id === item.documentId)
        : db.documents.find((x) => x.creativeId === item.creativeId);
      if (!d) {
        const modeId = item.studio === "design" ? "m-layout" : "m-scene";
        d = {
          id: m.nextId("doc"),
          workspaceId: item.workspaceId,
          campaignId: item.campaignId,
          creativeId: item.creativeId,
          title: item.title,
          slot: item.slot,
          studio: item.studio,
          modeId,
          variables: defaults(modeId),
          specs: {
            format: item.format,
            count: 4,
            imageModel: "Nano Banana Pro",
            referenceIds: [],
            modelIds: [],
            productId: "pr-oil",
          },
          overrides: [],
          layers: item.layers ?? [],
          edits: [],
          state: "draft",
          by: m.me().id,
          updatedAt: m.now(),
          versions: [
            {
              id: m.nextId("rv"),
              number: 1,
              image: item.image,
              at: item.madeAt,
              by: m.me().id,
              state: "done",
              variables: defaults(modeId),
              specs: { format: item.format, count: 1, imageModel: "Nano Banana Pro", referenceIds: [], modelIds: [] },
              evaluation: item.evaluation,
              cost: 0.12,
            },
          ],
        };
        d.pickedVersionId = d.versions[0].id;
        db.documents.push(d);
      }
      item.documentId = d.id;
      if (item.state === "fixing" && !takeOver) return wait({ item, document: d });
      if (item.state !== "checked") Object.assign(item, { state: "in_studio", studioBy: m.me().id, studioAt: m.now() });
      m.emit({ type: "qa.state", item: structuredClone(item) });
      return wait({ item, document: d });
    },
  };
}
