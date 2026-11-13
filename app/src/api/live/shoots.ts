// FLOWS §38 originals, rights, expert picks and zero-cost photo masters. Vision assessment runs in shoot-read; reads poll its stored result.
import { FumeError, type FumeApi, type Id, type OwnPicture, type Shoot } from "../../contract";
import { requireShootUse, summarise } from "../../domain/shoot";
import type { Live } from "./context";
import { fileUrls, uploadFile } from "./map";
import { command, supabase } from "./supabase";

type StoredShoot = Omit<Shoot, "pictures"> & { pictures: (Omit<OwnPicture, "src"> & { fileId: Id })[] };
type Calls =
  "shoots" | "shoot" | "addShoot" | "updateShootRights" | "movePicture" | "checkPicks" | "useShootInCampaign";

async function original(s: StoredShoot): Promise<Shoot> {
  const urls = new Map<Id, { url: string }>();
  // Bound IN lists and avoid PostgREST's row cap for large shoots.
  for (let start = 0; start < s.pictures.length; start += 100) {
    const batch = await fileUrls(s.pictures.slice(start, start + 100).map((p) => p.fileId));
    for (const [id, file] of batch) urls.set(id, file);
  }
  return {
    ...s,
    pictures: s.pictures.map(({ fileId, ...p }) => {
      const src = urls.get(fileId)?.url;
      if (!src) throw new FumeError("unavailable", "The original picture could not be opened. Try again.");
      return { ...p, src };
    }),
  };
}

export function shootCalls(live: Live): Pick<FumeApi, Calls> {
  const mustWrite = async (workspaceId: Id) => {
    const me = await live.me();
    if (me.staffRole === "admin" || (!me.staffRole && (await live.role()) === "viewer"))
      throw new FumeError("forbidden", "Only the brand team and Fume add pictures or edit rights.");
    if (!(await live.workspaces()).some((w) => w.id === workspaceId))
      throw new FumeError("forbidden", "This brand is not yours.");
  };
  const asked = new Map<Id, number>();
  const reading = (s: StoredShoot) => {
    if (
      s.state === "reading" &&
      s.rights.people !== "unsure" &&
      (!s.rights.until || s.rights.until >= new Date().toISOString().slice(0, 10)) &&
      Date.now() - (asked.get(s.id) ?? 0) >= 60_000
    ) {
      asked.set(s.id, Date.now());
      // The worker answers at once; failures keep the shoot retryable on the next poll, after a minute.
      void supabase()
        .functions.invoke("shoot-read", { body: { shootId: s.id } })
        .catch(() => undefined);
    }
    return original(s);
  };
  const shoot = async (id: Id) => reading(await command<StoredShoot>("get_shoot", { p_shoot_id: id }));
  return {
    shoot,
    async shoots(workspaceId) {
      const me = await live.me();
      if (!me.staffRole) workspaceId = await live.workspaceId();
      const list = await command<StoredShoot[]>("list_shoots", { p_workspace_id: workspaceId ?? null });
      return Promise.all(list.map(async (s) => summarise(await reading(s), !me.staffRole)));
    },
    async addShoot({ workspaceId, name, shotOn, rights, files }) {
      await mustWrite(workspaceId);
      if (!name.trim() || !files.length) throw new FumeError("invalid", "Give the shoot a name and pictures.");
      // Fetch only browser-owned originals; never persist a blob URL or accept a remote URL as an upload.
      for (const f of files)
        if (!f.src.startsWith("blob:") && !f.src.startsWith("data:"))
          throw new FumeError("invalid", "Choose the original picture from your device.");
      const pictures = [];
      // Keep only one fetched original in memory while uploading a whole shoot.
      for (const f of files) {
        const response = await fetch(f.src);
        if (!response.ok) throw new FumeError("unavailable", "The original picture could not be read.");
        let blob = await response.blob();
        if (!blob.size || blob.size > 2_000_000_000)
          throw new FumeError("invalid", "Each picture or clip must be at most 2 GB.");
        // Browsers often give HEIC/RAW and MOV originals no MIME type. Keep the bytes, supply the type.
        if (!blob.type || blob.type === "application/octet-stream") {
          const ext = f.name.split(".").at(-1)?.toLowerCase() ?? "";
          const mime: Record<string, string> = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            webp: "image/webp",
            heic: "image/heic",
            heif: "image/heif",
            mp4: "video/mp4",
            mov: "video/quicktime",
          };
          if (mime[ext]) blob = blob.slice(0, blob.size, mime[ext]);
        }
        const fileId = await uploadFile(workspaceId, blob, {
          name: f.name,
          purpose: "source",
          width: f.width,
          height: f.height,
        });
        pictures.push({ fileId, kind: f.kind, seconds: f.seconds ?? null });
      }
      return reading(
        await command<StoredShoot>("add_shoot", {
          p_workspace_id: workspaceId,
          p_name: name.trim(),
          p_shot_on: shotOn || null,
          p_rights: rights,
          p_pictures: pictures,
        }),
      );
    },
    async updateShootRights(id, rights) {
      const s = await command<StoredShoot>("get_shoot", { p_shoot_id: id });
      await mustWrite(s.workspaceId);
      return reading(await command<StoredShoot>("update_shoot_rights", { p_shoot_id: id, p_rights: rights }));
    },
    async movePicture(pictureId, sort) {
      return original(await command<StoredShoot>("move_shoot_picture", { p_picture_id: pictureId, p_sort: sort }));
    },
    async checkPicks(shootId) {
      return original(await command<StoredShoot>("check_shoot_picks", { p_shoot_id: shootId }));
    },
    async useShootInCampaign({ shootId, campaignId, pictureIds }) {
      const me = await live.me();
      if (!me.staffRole || me.staffRole === "admin" || me.agency)
        throw new FumeError("forbidden", "Only Fume starts creatives from a shoot.");
      requireShootUse((await shoot(shootId)).rights);
      return command<{ documentIds: Id[] }>("use_shoot_in_campaign", {
        p_shoot_id: shootId,
        p_campaign_id: campaignId,
        p_picture_ids: pictureIds ?? null,
      });
    },
  };
}
