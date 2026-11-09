// The Video studio's left panel (FLOWS §27.2): what the edit is made from. The mode on top, as in every studio; then
// the edit's shots in order (a flag where the Engine found something); the campaign's checked masters, each a start
// frame for a new shot the Engine makes; the brand's own footage, used as it is; and the brand's motion design,
// added at the playhead.
// Round 14 (FLOWS §34.6, PROPOSED 9 Nov 2026): the library of an editor. Edit mode: Shots, Uploads (the brand's own
// video), Masters, and Brand: the brand's components (its call to action, its end card) and its text, each added at
// the playhead on the shot there, which it then follows. Motion mode: Styles (a set of motion in the brand's colours
// and type, with its energy and pace), the Layers, and Brand.
// Round 16 (PROPOSED 9 Nov 2026): an upload can also be laid over the video (a clip on a video track above Main, at the
// playhead); Sounds adds an effect at the playhead on an audio track; Text presets are the text animators (Typewriter
// and the rest): on the picked words, or on a new line at the playhead.
import { Button, Icon, StudioFolds, StudioSlider, WithTooltip, type StudioFold } from "@fume/ui";
import { memo, type CSSProperties } from "react";
import { useBrandAssets, useDocuments } from "../../../../api/hooks";
import type {
  CreativeDocument,
  MotionLayer,
  MotionTemplate,
  SoundCue,
  StudioMode,
  TextAnimatorId,
  VideoClip,
  VideoEdit,
  VideoOverlay,
} from "../../../../contract";
import { clipAt, pickedTake } from "../../../../domain/video";
import { ModePicker } from "../Specs";
import { MOTION, localId, openFindings, shotLine, type Selection } from "./edit";
import { ANIMATORS, EASES, STYLES, animator, withStyle } from "./motion";
import { MAIN, isAudio, placeNew } from "./tracks";

const COMPONENTS: MotionTemplate[] = ["cta", "end"];
const TEXT: MotionTemplate[] = ["title", "line", "product", "offer"];
/** The sound library's effects (a stand-in until the backend sends the brand's and the licensed library's). */
const SOUNDS: { name: string; seconds: number; line: string }[] = [
  { name: "Glass on stone", seconds: 0.8, line: "The bottle set down" },
  { name: "Cap off", seconds: 0.5, line: "A soft click" },
  { name: "Oil on skin", seconds: 1.2, line: "Close and quiet" },
  { name: "Room tone, evening", seconds: 4, line: "A still room, for under words" },
];

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
  cta,
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
  /** The brand's call to action as its design system sets it. */
  cta?: { fill: string; ink: string };
}) {
  const motionMode = mode?.id === "m-video-motion";
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
    const style = edit.style ? STYLES[edit.style.id] : undefined;
    const end = Math.round((start + m.seconds) * 10) / 10;
    // On its kind's track when that is free there, else on a free one, else on a new text track above.
    const brandish = template === "cta" || template === "end";
    const placed = placeNew(
      edit,
      (k) => k.kind === "text" || (brandish && k.kind === "brand"),
      brandish ? "t-brand" : "t-text",
      "text",
      start,
      end,
      localId("t"),
    );
    const layer = {
      id: localId("mo"),
      template,
      text,
      start,
      end,
      trackId: placed.trackId,
      enter: style?.enter ?? (template === "product" || template === "cta" ? ("rise" as const) : ("soft" as const)),
      exit: style?.exit ?? ("fade" as const),
      loop: style?.loop,
      ease: style?.ease ?? ("soft-out" as const),
      place:
        template === "product" || template === "offer" || template === "cta"
          ? ("bottom" as const)
          : ("centre" as const),
      // It follows the shot it lands on, so it moves when the shot does.
      clipId: clipAt(edit.clips, start)?.clip.id,
    };
    onEdit({ ...placed.edit, motion: [...placed.edit.motion, layer] }, `add-${layer.id}`);
    onSelect({ kind: "motion", id: layer.id });
  };
  // An upload over the video: on the top video track over Main, or a new one ("Video 2") when there is none.
  const layOver = (f: (typeof footage)[number]) => {
    const start = Math.round(timeNow() * 10) / 10;
    const out = Math.min(f.seconds, 2.5);
    // The top video track over Main that is free there, else a new one above it.
    const { edit: next, trackId } = placeNew(
      edit,
      (k) => k.kind === "video" && k.id !== MAIN,
      undefined,
      "video",
      start,
      start + out,
      localId("t"),
    );
    const takeId = localId("tk");
    const over: VideoOverlay = {
      id: localId("ov"),
      trackId,
      name: f.name,
      source: "library",
      takes: [
        {
          id: takeId,
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
      pickedTakeId: takeId,
      in: 0,
      out,
      speed: 1,
      start,
      size: "inset",
      opacity: 1,
    };
    onEdit({ ...next, overlays: [...(next.overlays ?? []), over] }, `add-${over.id}`);
    onSelect({ kind: "overlay", id: over.id });
  };
  // A sound effect at the playhead, on the first audio track that is not the music's.
  const addSound = (x: (typeof SOUNDS)[number]) => {
    const start = Math.round(timeNow() * 10) / 10;
    const end = Math.round((start + x.seconds) * 10) / 10;
    const placed = placeNew(
      edit,
      (k) => isAudio(k) && k.id !== "t-music",
      "t-effects",
      "audio",
      start,
      end,
      localId("t"),
    );
    const cue: SoundCue = {
      id: localId("sd"),
      kind: "effect",
      name: x.name,
      start,
      end,
      level: -14,
      licence: "Licensed for paid social",
      trackId: placed.trackId,
    };
    onEdit({ ...placed.edit, sound: [...placed.edit.sound, cue] }, `add-${cue.id}`);
    onSelect({ kind: "sound", id: cue.id });
  };
  // A text preset: on the picked words, or on a new line at the playhead.
  const pickedText = selected?.kind === "motion" ? edit.motion.find((m) => m.id === selected.id) : undefined;
  const textTarget =
    pickedText && pickedText.template !== "cta" && pickedText.template !== "end" ? pickedText : undefined;
  const preset = (id: TextAnimatorId) => {
    if (textTarget) {
      onEdit(
        { ...edit, motion: edit.motion.map((m) => (m.id === textTarget.id ? { ...m, animate: animator(id) } : m)) },
        `mo-${textTarget.id}-anim-${id}`,
      );
      return;
    }
    const start = Math.round(timeNow() * 10) / 10;
    const end = Math.round((start + Math.max(2, ANIMATORS[id].over + 1)) * 10) / 10;
    const placed = placeNew(edit, (k) => k.kind === "text", "t-text", "text", start, end, localId("t"));
    const layer: MotionLayer = {
      id: localId("mo"),
      template: "line",
      text: MOTION.line.start,
      start,
      end,
      trackId: placed.trackId,
      enter: "fade",
      exit: "fade",
      ease: "soft-out",
      place: "centre",
      animate: animator(id),
      clipId: clipAt(edit.clips, start)?.clip.id,
    };
    onEdit({ ...placed.edit, motion: [...placed.edit.motion, layer] }, `add-${layer.id}`);
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
      id: "Uploads",
      title: "Uploads",
      meta: footage.length || undefined,
      children: (
        <>
          <p className="ui-video-help">
            {brandName}’s own video, used as it is: added after the shots, or laid over them at the playhead (the layers
            button). Ask the Engine for takes of one when you want options.
          </p>
          {footage.length ? (
            <ul className="ui-video-list" aria-label={`${brandName}’s uploads`}>
              {footage.map((f) => (
                <li key={f.id} className="ui-video-row-pair">
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
                  <WithTooltip label="Lay it over the video, at the playhead">
                    <Button
                      size="sm"
                      variant="quiet"
                      iconOnly
                      icon="layers"
                      aria-label={`Lay ${f.name} over the video at the playhead`}
                      onClick={() => layOver(f)}
                    />
                  </WithTooltip>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ui-video-help">{brandName} has no video in its library yet.</p>
          )}
        </>
      ),
    },
  ];

  const brand: StudioFold = {
    id: "Brand",
    title: "Brand",
    children: (
      <>
        <p className="ui-video-help">From {brandName}’s design system. Added at the playhead, on the shot there.</p>
        <p className="ui-video-sub">Components</p>
        <ul className="ui-video-list" aria-label="Components">
          {COMPONENTS.map((k) => (
            <li key={k}>
              <button
                type="button"
                className="ui-video-row"
                aria-label={`Add ${MOTION[k].name.toLowerCase()} at the playhead`}
                onClick={() => addMotion(k)}
              >
                {k === "cta" ? (
                  <span
                    className="ui-video-row-img ui-video-row-cta"
                    style={cta ? ({ "--cta-fill": cta.fill, "--cta-ink": cta.ink } as CSSProperties) : undefined}
                  >
                    <span aria-hidden="true" />
                  </span>
                ) : (
                  <span className="ui-video-row-img" data-glyph="" data-ink="">
                    {brandName.slice(0, 1)}
                  </span>
                )}
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
        <p className="ui-video-sub">Text</p>
        <ul className="ui-video-list" aria-label="Text">
          {TEXT.map((k) => (
            <li key={k}>
              <button
                type="button"
                className="ui-video-row"
                aria-label={`Add ${MOTION[k].name.toLowerCase()} at the playhead`}
                onClick={() => addMotion(k)}
              >
                <span className="ui-video-row-img" data-glyph="">
                  Aa
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
  };

  // Motion mode: the style for the whole film, then its layers.
  const style = edit.style ?? { id: "showcase" as const, energy: STYLES.showcase.energy, pace: STYLES.showcase.pace };
  const setStyle = (change: Partial<NonNullable<VideoEdit["style"]>>, key: string) =>
    onEdit({ ...edit, style: { ...style, ...change } }, `style-${key}`);
  const styles: StudioFold = {
    id: "Styles",
    title: "Styles",
    meta: STYLES[style.id].name,
    children: (
      <>
        <p className="ui-video-help">
          A set of motion in {brandName}’s colours and type. Try another: the words, the timing and the keys stay.
        </p>
        <ul className="ui-video-styles" aria-label="Motion styles">
          {(Object.keys(STYLES) as (keyof typeof STYLES)[]).map((id) => (
            <li key={id}>
              <button
                type="button"
                className="ui-video-style"
                data-style={id}
                aria-pressed={style.id === id}
                onClick={() => onEdit(withStyle(edit, id), `style-${id}`)}
              >
                <span className="ui-video-style-name">{STYLES[id].name}</span>
                <span className="ui-video-style-line">{STYLES[id].line}</span>
              </button>
            </li>
          ))}
        </ul>
        <StudioSlider
          label="Energy"
          id="style-energy"
          value={style.energy}
          min={0}
          max={100}
          help="How far the words travel, and how soft they start"
          onChange={(energy) => setStyle({ energy }, "energy")}
        />
        <StudioSlider
          label="Pace"
          id="style-pace"
          value={style.pace}
          min={0}
          max={100}
          help={`How quickly they come in and go out · ${EASES[STYLES[style.id].ease].name}`}
          onChange={(pace) => setStyle({ pace }, "pace")}
        />
      </>
    ),
  };
  const layers: StudioFold = {
    id: "Layers",
    title: "Layers",
    meta: edit.motion.length || undefined,
    children: edit.motion.length ? (
      <ol className="ui-video-list" aria-label="The layers">
        {edit.motion.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className="ui-video-row"
              aria-pressed={selected?.kind === "motion" && selected.id === m.id}
              onClick={() => onSelect({ kind: "motion", id: m.id })}
            >
              <span className="ui-video-row-img" data-glyph="">
                {m.template === "end" ? brandName.slice(0, 1) : "Aa"}
              </span>
              <span className="ui-video-row-text">
                <span className="ui-video-row-name">{m.text}</span>
                <span className="ui-video-row-meta">
                  {[MOTION[m.template].name, m.keys?.length ? `${m.keys.length} keys` : undefined]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    ) : (
      <p className="ui-video-help">No layers yet. Add text or a component from Brand.</p>
    ),
  };

  const presets: StudioFold = {
    id: "Text presets",
    title: "Text presets",
    children: (
      <>
        <p className="ui-video-help">
          {textTarget
            ? `On “${textTarget.text}”: the words come in a letter, a word or a line at a time.`
            : "A new line at the playhead with the preset on. Pick words first to put it on them."}
        </p>
        <ul className="ui-video-styles" aria-label="Text presets">
          {(Object.keys(ANIMATORS) as TextAnimatorId[]).map((id) => (
            <li key={id}>
              <button
                type="button"
                className="ui-video-style"
                data-animator={id}
                aria-pressed={textTarget?.animate?.preset === id}
                aria-label={
                  textTarget ? `${ANIMATORS[id].name} on ${textTarget.text}` : `Add a line with ${ANIMATORS[id].name}`
                }
                onClick={() => preset(id)}
              >
                <span className="ui-video-style-name">{ANIMATORS[id].name}</span>
                <span className="ui-video-style-line">{ANIMATORS[id].line}</span>
              </button>
            </li>
          ))}
        </ul>
      </>
    ),
  };
  const sounds: StudioFold = {
    id: "Sounds",
    title: "Sounds",
    meta: SOUNDS.length,
    children: (
      <>
        <p className="ui-video-help">Added at the playhead on an audio track. The music is the mode’s.</p>
        <ul className="ui-video-list" aria-label="Sounds">
          {SOUNDS.map((x) => (
            <li key={x.name}>
              <button
                type="button"
                className="ui-video-row"
                aria-label={`Add the sound ${x.name} at the playhead`}
                onClick={() => addSound(x)}
              >
                <span className="ui-video-row-img" data-glyph="">
                  <Icon name="music" />
                </span>
                <span className="ui-video-row-text">
                  <span className="ui-video-row-name">{x.name}</span>
                  <span className="ui-video-row-meta">
                    {x.line} · {x.seconds} s
                  </span>
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
  };

  const folds = motionMode ? [styles, layers, presets, brand] : [...sections, brand, presets, sounds];

  return (
    <aside className="ui-desk-panel ui-desk-specs" aria-label="Library">
      <ModePicker doc={doc} mode={mode} modes={modes.filter((m) => m.studio === "video")} onMode={onMode} />
      <StudioFolds
        key={motionMode ? "motion" : "edit"}
        label="Library"
        sections={folds}
        initialOpen={motionMode ? ["Styles", "Layers"] : ["Shots", "Uploads", "Brand"]}
      />
    </aside>
  );
});
