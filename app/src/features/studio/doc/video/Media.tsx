// The Video studio's left panel (FLOWS §27.2): what the edit is made from. The mode on top, as in every studio; then
// the edit's shots in order (a flag where the Engine found something); the campaign's checked masters, each a start
// frame for a new shot the Engine makes; the brand's own footage, used as it is; and the brand's motion design,
// added at the playhead.
import { Icon, StudioFolds, type StudioFold } from "@fume/ui";
import { memo } from "react";
import { useBrandAssets, useDocuments } from "../../../../api/hooks";
import type { CreativeDocument, MotionTemplate, StudioMode, VideoClip, VideoEdit } from "../../../../contract";
import { pickedTake } from "../../../../domain/video";
import { ModePicker } from "../Specs";
import { MOTION, localId, openFindings, shotLine, type Selection } from "./edit";

export const VideoMedia = memo(function VideoMedia({
  doc,
  edit,
  mode,
  modes,
  brandName,
  productName,
  selected,
  onMode,
  onSelect,
  onEdit,
  timeNow,
}: {
  doc: CreativeDocument;
  edit: VideoEdit;
  mode?: StudioMode;
  modes: StudioMode[];
  brandName: string;
  productName?: string;
  selected?: Selection;
  onMode: (id: string) => void;
  onSelect: (s: Selection, seekTo?: "start") => void;
  onEdit: (next: VideoEdit, key: string) => void;
  /** The playhead, read when something is added there. */
  timeNow: () => number;
}) {
  const assets = useBrandAssets(doc.workspaceId).data;
  const others = useDocuments(doc.workspaceId).data ?? [];
  const footage = assets?.footage ?? [];

  // The campaign's masters: the checked ones first, each its picked version.
  const masters = others
    .filter((d) => d.id !== doc.id && d.studio !== "video" && (!doc.campaignId || d.campaignId === doc.campaignId))
    .map((d) => ({ d, v: d.versions.find((v) => v.id === d.pickedVersionId && v.state === "done") }))
    .filter((x): x is { d: CreativeDocument; v: NonNullable<typeof x.v> } => Boolean(x.v))
    .sort((a, b) => Number(b.d.state === "checked") - Number(a.d.state === "checked"))
    .slice(0, 8);
  const anyChecked = masters.some((m) => m.d.state === "checked");

  const addShot = (image: string, name: string) => {
    const clip: VideoClip = {
      id: localId("vc"),
      name,
      source: "engine",
      recipe: { startImage: image, move: "push", amount: 15, action: "", seconds: 5, model: "auto" },
      takes: [],
      in: 0,
      out: 5,
      speed: 1,
      transition: edit.clips.length ? "dissolve" : "cut",
    };
    onEdit({ ...edit, clips: [...edit.clips, clip] }, `add-${clip.id}`);
    onSelect({ kind: "shot", id: clip.id }, "start");
  };
  const addFootage = (f: (typeof footage)[number]) => {
    const clip: VideoClip = {
      id: localId("vc"),
      name: f.name,
      source: "library",
      takes: [
        {
          id: localId("tk"),
          number: 1,
          video: f.video,
          poster: f.poster,
          seconds: f.seconds,
          state: "ready",
          model: `${brandName} footage`,
          cost: 0,
          findings: [],
          at: new Date().toISOString(),
        },
      ],
      in: 0,
      out: Math.min(f.seconds, 3.5),
      speed: 1,
      transition: "cut",
    };
    clip.pickedTakeId = clip.takes[0]!.id;
    onEdit({ ...edit, clips: [...edit.clips, clip] }, `add-${clip.id}`);
    onSelect({ kind: "shot", id: clip.id }, "start");
  };
  const addMotion = (template: MotionTemplate) => {
    const m = MOTION[template];
    const start = Math.round(timeNow() * 10) / 10;
    const text = template === "end" ? brandName : template === "product" && productName ? productName : m.start;
    const layer = {
      id: localId("mo"),
      template,
      text,
      start,
      end: Math.round((start + m.seconds) * 10) / 10,
      enter: template === "product" ? ("rise" as const) : ("soft" as const),
      place: template === "product" || template === "offer" ? ("bottom" as const) : ("centre" as const),
    };
    onEdit({ ...edit, motion: [...edit.motion, layer] }, `add-${layer.id}`);
    onSelect({ kind: "motion", id: layer.id });
  };

  const sections: StudioFold[] = [
    {
      id: "Shots",
      title: "Shots",
      meta: edit.clips.length || undefined,
      children: edit.clips.length ? (
        <ol className="ui-video-list" aria-label="The shots in the edit">
          {edit.clips.map((c, i) => {
            const take = pickedTake(c);
            const flagged = openFindings(c).length > 0;
            const on = selected?.kind === "shot" && selected.id === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className="ui-video-row"
                  aria-pressed={on}
                  onClick={() => onSelect({ kind: "shot", id: c.id }, "start")}
                >
                  <span className="ui-video-row-img">
                    {(take?.poster ?? c.recipe?.startImage) && (
                      <img src={take?.poster ?? c.recipe?.startImage} alt="" draggable={false} />
                    )}
                  </span>
                  <span className="ui-video-row-text">
                    <span className="ui-video-row-name">
                      {i + 1} · {c.name}
                    </span>
                    <span className="ui-video-row-meta">{shotLine(c)}</span>
                  </span>
                  <span className="ui-video-row-end">
                    {flagged ? (
                      <Icon name="triangle-alert" aria-label="The Engine flagged it" className="ui-video-row-flag" />
                    ) : c.source === "engine" ? (
                      <Icon name="fume-engine" aria-label="Made by the Engine" />
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="ui-video-help">No shots yet. Start one from a master, or add {brandName}’s footage.</p>
      ),
    },
    {
      id: "Masters",
      title: anyChecked ? "Checked masters" : "Masters",
      meta: masters.length || undefined,
      children: (
        <>
          <p className="ui-video-help">
            A new shot starts from a master, so the product is right from the first frame.
          </p>
          {masters.length ? (
            <ul className="ui-desk-thumbs" aria-label="Start a shot from a master">
              {masters.map(({ d, v }) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className="ui-desk-thumb"
                    aria-label={`Start a shot from ${d.title}`}
                    title={`Start a shot from ${d.title}`}
                    onClick={() => addShot(v.image, d.title)}
                  >
                    <img src={v.image} alt="" draggable={false} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ui-video-help">No masters in this campaign yet.</p>
          )}
        </>
      ),
    },
    {
      id: "Footage",
      title: `${brandName}’s footage`,
      meta: footage.length || undefined,
      children: footage.length ? (
        <ul className="ui-video-list" aria-label={`${brandName}’s footage`}>
          {footage.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                className="ui-video-row"
                onClick={() => addFootage(f)}
                aria-label={`Add ${f.name} to the edit`}
              >
                <span className="ui-video-row-img">
                  <img src={f.poster} alt="" draggable={false} />
                </span>
                <span className="ui-video-row-text">
                  <span className="ui-video-row-name">{f.name}</span>
                  <span className="ui-video-row-meta">
                    {f.seconds} s · {f.ratio}
                  </span>
                </span>
                <span className="ui-video-row-end">
                  <Icon name="plus" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ui-video-help">{brandName} has no footage in its library yet.</p>
      ),
    },
    {
      id: "Motion",
      title: "Brand motion",
      children: (
        <>
          <p className="ui-video-help">From {brandName}’s design system. Added at the playhead.</p>
          <ul className="ui-video-list" aria-label="Brand motion">
            {(Object.keys(MOTION) as MotionTemplate[]).map((k) => (
              <li key={k}>
                <button type="button" className="ui-video-row" onClick={() => addMotion(k)}>
                  <span className="ui-video-row-img" data-glyph="">
                    {k === "end" ? brandName.slice(0, 1) : "Aa"}
                  </span>
                  <span className="ui-video-row-text">
                    <span className="ui-video-row-name">{MOTION[k].name}</span>
                    <span className="ui-video-row-meta">{MOTION[k].line}</span>
                  </span>
                  <span className="ui-video-row-end">
                    <Icon name="plus" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ),
    },
  ];

  return (
    <aside className="ui-desk-panel ui-desk-specs" aria-label="Media">
      <ModePicker doc={doc} mode={mode} modes={modes.filter((m) => m.studio === "video")} onMode={onMode} />
      <StudioFolds
        key={doc.modeId}
        label="Media"
        sections={sections}
        initialOpen={["Shots", "Masters", "Motion", "Footage"]}
      />
    </aside>
  );
});
