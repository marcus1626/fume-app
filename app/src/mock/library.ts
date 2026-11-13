// The brand's own pictures (FLOWS §38, DECIDED 13 Nov 2026): shoots in the Library, the Engine's read, an expert's check of the
// picks, and a checked pick becoming a creative in a campaign. A shoot dropped in the preview is read for real in the
// browser (lib/probe.ts, domain/shoot.ts); in the tests, where there is no canvas, every photograph is kept for later.
import { FumeError, type FumeApi, type Id, type OwnPicture, type Shoot } from "../contract";
import { canCheckPlan } from "../domain/permissions";
import { nearestFormat, pad, readShoot, sortOf, summarise, type PictureProbe } from "../domain/shoot";
import { probePicture } from "../lib/probe";
import type { Mock } from "./context";
import { agencyBrands } from "./home";

type Calls = "shoots" | "shoot" | "addShoot" | "movePicture" | "checkPicks" | "useShootInCampaign";

export function libraryCalls(m: Mock): Pick<FumeApi, Calls> {
  const { db, wait } = m;

  const workspaceOf = (id: Id) => db.workspaces.find((w) => w.id === id);
  /** The brands the signed-in person may see shoots in. */
  const mayOpen = (workspaceId: Id) => {
    if (!m.isStaff()) return workspaceId === m.workspaceId && Boolean(m.role());
    const keep = agencyBrands(m);
    return !keep || keep.has(workspaceId);
  };
  const shootOf = (id: Id) => {
    const s = m.find(db.shoots, id, "shoot");
    if (!mayOpen(s.workspaceId)) throw new FumeError("forbidden", "This shoot is in another brand.");
    return s;
  };
  /** What the signed-in person sees of a shoot: a customer sees Fume's read once an expert has checked the picks. */
  const seen = (s: Shoot): Shoot =>
    m.isStaff() || s.state === "checked"
      ? s
      : { ...s, pictures: s.pictures.map(({ read: _read, moved: _moved, ...p }) => p) };
  const mustAdd = () => {
    if (m.me().staffRole === "admin") throw new FumeError("forbidden", "Fume's admin reads the Library.");
    if (!m.isStaff() && m.role() === "viewer") throw new FumeError("forbidden", "A viewer cannot add pictures.");
  };
  const mustCheck = (s: Shoot) => {
    const me = m.me();
    if (me.staffRole === "admin" || !canCheckPlan(me, workspaceOf(s.workspaceId)).ok)
      throw new FumeError("forbidden", "An expert checks the picks.");
  };

  /** The Engine reads a new shoot: in the browser it looks at every photograph; it takes a moment either way. */
  async function read(s: Shoot) {
    const started = Date.now();
    const probes = new Map<Id, PictureProbe>();
    await Promise.all(
      s.pictures
        .filter((p) => p.kind === "photo")
        .map(async (p) => {
          const probe = await probePicture(p.src);
          if (probe) probes.set(p.id, probe);
        }),
    );
    const reads = readShoot(s.pictures, probes);
    const rest = Math.max(0, m.latency * 24 - (Date.now() - started));
    setTimeout(() => {
      for (const p of s.pictures) p.read = reads.get(p.id);
      s.state = "read";
    }, rest);
  }

  return {
    async shoots(workspaceId) {
      const forCustomer = !m.isStaff();
      const list = db.shoots
        .filter((s) => (!workspaceId || s.workspaceId === workspaceId) && mayOpen(s.workspaceId))
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((s) => summarise(s, forCustomer));
      return wait(list);
    },
    async shoot(id) {
      return wait(seen(shootOf(id)));
    },
    async addShoot({ workspaceId, name, shotOn, rights, files }) {
      mustAdd();
      if (!mayOpen(workspaceId)) throw new FumeError("forbidden", "This brand is not yours.");
      if (!files.length) throw new FumeError("invalid", "Add a picture or a clip first.");
      if (!name.trim()) throw new FumeError("invalid", "Give the shoot a name.");
      const id = m.nextId("sh");
      const s: Shoot = {
        id,
        workspaceId,
        name: name.trim(),
        shotOn: shotOn || undefined,
        by: m.me().id,
        at: m.now(),
        rights: { ...rights, photographer: rights.photographer?.trim() || undefined },
        state: "reading",
        pictures: files.map((f, i): OwnPicture => ({
          ...f,
          id: `${id}-p${i + 1}`,
          shootId: id,
          workspaceId,
          number: i + 1,
          usedIn: [],
        })),
      };
      db.shoots.unshift(s);
      void read(s);
      return wait(seen(s));
    },
    async movePicture(pictureId, sort) {
      const s = db.shoots.find((x) => x.pictures.some((p) => p.id === pictureId));
      if (!s) throw new FumeError("not_found", `No picture ${pictureId}`);
      shootOf(s.id);
      mustCheck(s);
      if (s.state === "reading") throw new FumeError("invalid", "Wait until the Engine has read the shoot.");
      const p = s.pictures.find((x) => x.id === pictureId)!;
      if (p.kind === "clip" && sort === "pick") throw new FumeError("invalid", "A clip is kept for the video editor.");
      p.moved = sort === p.read?.sort ? undefined : { sort, by: m.me().id, at: m.now() };
      // A move after the check opens the check again.
      if (s.state === "checked") {
        s.state = "read";
        s.checkedBy = undefined;
        s.checkedAt = undefined;
      }
      return wait(s);
    },
    async checkPicks(id) {
      const s = shootOf(id);
      mustCheck(s);
      if (s.state === "reading") throw new FumeError("invalid", "Wait until the Engine has read the shoot.");
      if (!s.pictures.some((p) => sortOf(p) === "pick")) throw new FumeError("invalid", "Pick at least one picture.");
      s.state = "checked";
      s.checkedBy = m.me().id;
      s.checkedAt = m.now();
      return wait(s);
    },
    async useShootInCampaign({ shootId, campaignId, pictureIds }) {
      m.mustStaff();
      if (m.me().staffRole === "admin") throw new FumeError("forbidden", "Fume's admin reads the Library.");
      const s = shootOf(shootId);
      if (s.state !== "checked") throw new FumeError("invalid", "An expert checks the picks first.");
      if (s.rights.people === "unsure")
        throw new FumeError("invalid", "Ask who is in the pictures before they are used.");
      const campaign = m.campaignOf(campaignId);
      if (campaign.workspaceId !== s.workspaceId) throw new FumeError("invalid", "The campaign is in another brand.");
      const picks = s.pictures.filter(
        (p) => p.kind === "photo" && sortOf(p) === "pick" && (!pictureIds || pictureIds.includes(p.id)),
      );
      if (!picks.length) throw new FumeError("invalid", "Choose at least one pick.");
      const by = s.rights.photographer && s.rights.photographer !== "Our own" ? `, by ${s.rights.photographer}` : "";
      const brand = workspaceOf(s.workspaceId)?.brandName ?? "The brand";
      const documentIds: Id[] = [];
      for (const p of picks) {
        const opened = await m.api.openDocument({
          workspaceId: s.workspaceId,
          studio: "render",
          modeId: "m-free",
          campaignId,
        });
        const d = db.documents.find((x) => x.id === opened.id)!;
        const format = nearestFormat(p.width, p.height);
        d.title = `${s.name} ${pad(p.number)}`;
        d.slot = `${p.read?.productName ?? `${brand}'s photograph`} · ${s.name} ${pad(p.number)}`;
        d.specs = { ...d.specs, format, productId: p.read?.productId ?? d.specs.productId };
        d.versions = [
          {
            id: m.nextId("rv"),
            number: 1,
            image: p.src,
            at: m.now(),
            by: m.me().id,
            state: "done",
            variables: structuredClone(d.variables),
            specs: structuredClone(d.specs),
            evaluation: { productTruth: "pass", brandRules: "pass", artefacts: "none", notes: [] },
            instruction: `${brand}'s own photograph · ${s.name}${by}`,
            cost: 0,
          },
        ];
        d.pickedVersionId = d.versions[0].id;
        d.updatedAt = m.now();
        p.usedIn.push({ campaignId, campaignName: campaign.name, documentId: d.id, at: m.now() });
        documentIds.push(d.id);
      }
      return wait({ documentIds });
    },
  };
}
