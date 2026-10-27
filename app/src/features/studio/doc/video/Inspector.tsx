// The Video studio's right panel (FLOWS §27.2): what is selected on the timeline. Nothing selected: the edit itself
// (the format it is cut for, the Engine's checks, the mode's variables, and the other formats made from it). A shot:
// its takes (the Engine makes a few; she picks one, and picking cuts to its clean part), what the Engine read on the
// take, how to make it again, and how it sits in the cut. A word on the video or a sound: its own few controls.
import {
  Button,
  Icon,
  ModeControl,
  Skeleton,
  StudioFolds,
  StudioNumber,
  StudioSegmented,
  StudioSelect,
  StudioSlider,
  StudioText,
  TextShimmer,
  useToast,
  type StudioFold,
  type StudioVariable,
} from "@fume/ui";
import { memo, useState } from "react";
import { useAdaptVideo, useMakeShot, useSession } from "../../../../api/hooks";
import type {
  CameraMove,
  CreativeDocument,
  EditCheck,
  MotionLayer,
  ShotTake,
  StudioMode,
  Transition,
  VarValue,
  Variables,
  VideoClip,
  VideoEdit,
} from "../../../../contract";
import { editLength, pickedTake, placed, timecode } from "../../../../domain/video";
import { MOTION, openFindings, type Selection } from "./edit";

/** Staff only: the video models the Engine can make a shot with (Higgsfield's list, 27 Oct 2026). */
const VIDEO_MODELS = ["auto", "Kling 3.0", "Kling 4.0", "Seedance 2.5", "Cinema Studio 4.0", "MiniMax H3", "Wan 2.6"];
const MOVES: { value: CameraMove; label: string }[] = [
  { value: "still", label: "Still" },
  { value: "push", label: "Push in" },
  { value: "pull", label: "Pull out" },
  { value: "orbit", label: "Orbit" },
  { value: "pan", label: "Pan" },
  { value: "tilt", label: "Tilt" },
  { value: "handheld", label: "Handheld" },
];
const TRANSITIONS = [
  { value: "cut", label: "A cut" },
  { value: "dissolve", label: "A dissolve" },
  { value: "focus", label: "A focus pull" },
];
const MUSIC: Record<string, string> = { "late-light": "Late light · slow piano", stone: "Stone · ambient" };

export type VideoChange = { video?: VideoEdit; variables?: Variables };

export const VideoInspector = memo(function VideoInspector({
  doc,
  edit,
  mode,
  variables,
  selected,
  brandName,
  onChange,
  onSelect,
  onFlag,
  onBefore,
}: {
  doc: CreativeDocument;
  edit: VideoEdit;
  mode?: StudioMode;
  variables: Variables;
  selected?: Selection;
  brandName: string;
  onChange: (part: VideoChange, key: string) => void;
  onSelect: (s: Selection | undefined) => void;
  onFlag: (c: EditCheck) => void;
  /** Saves her edit at once, before the Engine starts on it. */
  onBefore: () => void;
}) {
  const me = useSession().data?.user.id;
  const set = (video: VideoEdit, key: string) => onChange({ video }, key);
  let title = "The edit";
  let sections: StudioFold[];
  let foldKey = "edit";

  const clip = selected?.kind === "shot" ? edit.clips.find((c) => c.id === selected.id) : undefined;
  const motion = selected?.kind === "motion" ? edit.motion.find((m) => m.id === selected.id) : undefined;
  const caption = selected?.kind === "caption" ? edit.captions.find((c) => c.id === selected.id) : undefined;
  const sound = selected?.kind === "sound" ? edit.sound.find((s) => s.id === selected.id) : undefined;
  const length = editLength(edit);

  if (clip) {
    const index = edit.clips.indexOf(clip);
    title = `Shot ${index + 1} · ${clip.name}`;
    foldKey = clip.id;
    sections = shotSections({ doc, edit, clip, index, brandName, set, onSelect, onBefore });
  } else if (motion) {
    title = MOTION[motion.template].name;
    foldKey = motion.id;
    const setM = (change: Partial<MotionLayer>, key: string) =>
      set(
        { ...edit, motion: edit.motion.map((m) => (m.id === motion.id ? { ...m, ...change } : m)) },
        `mo-${motion.id}-${key}`,
      );
    sections = [
      {
        id: "Words",
        title: "Words",
        children: (
          <>
            <StudioText
              label="Words"
              id="mo-text"
              rows={1}
              value={motion.text}
              onChange={(text) => setM({ text }, "text")}
            />
            <StudioSelect
              label="Motion"
              id="mo-template"
              value={motion.template}
              options={Object.entries(MOTION).map(([value, m]) => ({ value, label: m.name }))}
              help={MOTION[motion.template].line}
              onChange={(template) => setM({ template: template as MotionLayer["template"] }, "template")}
            />
            <StudioSegmented
              label="Comes in"
              id="mo-enter"
              value={motion.enter}
              options={[
                { value: "soft", label: "Soft to sharp" },
                { value: "fade", label: "Fade" },
                { value: "rise", label: "Rise" },
              ]}
              onChange={(enter) => setM({ enter: enter as MotionLayer["enter"] }, "enter")}
            />
            <StudioSegmented
              label="Place"
              id="mo-place"
              value={motion.place}
              options={[
                { value: "top", label: "Top" },
                { value: "centre", label: "Centre" },
                { value: "bottom", label: "Bottom" },
              ]}
              onChange={(place) => setM({ place: place as MotionLayer["place"] }, "place")}
            />
          </>
        ),
      },
      timing(
        motion,
        length,
        (start, end, key) => setM({ start, end }, key),
        () => {
          set({ ...edit, motion: edit.motion.filter((m) => m.id !== motion.id) }, `mo-${motion.id}-remove`);
          onSelect(undefined);
        },
      ),
    ];
  } else if (caption) {
    title = "Caption";
    foldKey = caption.id;
    const setC = (change: Partial<typeof caption>, key: string) =>
      set(
        {
          ...edit,
          captions: edit.captions.map((c) => (c.id === caption.id ? { ...c, ...change, by: me ?? "staff" } : c)),
        },
        `cp-${caption.id}-${key}`,
      );
    sections = [
      {
        id: "Words",
        title: "Words",
        meta: caption.by === "engine" ? "The Engine’s" : undefined,
        children: (
          <StudioText
            label="Words"
            id="cp-text"
            rows={2}
            value={caption.text}
            help={caption.by === "engine" ? `The Engine wrote it in ${brandName}’s voice.` : undefined}
            onChange={(text) => setC({ text }, "text")}
          />
        ),
      },
      timing(
        caption,
        length,
        (start, end, key) => setC({ start, end }, key),
        () => {
          set({ ...edit, captions: edit.captions.filter((c) => c.id !== caption.id) }, `cp-${caption.id}-remove`);
          onSelect(undefined);
        },
      ),
    ];
  } else if (sound) {
    title = sound.name;
    foldKey = sound.id;
    sections = [
      {
        id: "Sound",
        title: sound.kind === "music" ? "Music" : sound.kind === "voice" ? "Voice" : "Sound",
        children: (
          <>
            <StudioSlider
              label="Level"
              id="sd-level"
              value={sound.level}
              min={-30}
              max={0}
              unit="dB"
              onChange={(level) =>
                set(
                  { ...edit, sound: edit.sound.map((s) => (s.id === sound.id ? { ...s, level } : s)) },
                  `sd-${sound.id}-level`,
                )
              }
            />
            <dl className="ui-desk-sheet-rows ui-video-facts">
              {sound.licence && (
                <div>
                  <dt>Licence</dt>
                  <dd>{sound.licence}</dd>
                </div>
              )}
              {sound.beats?.length ? (
                <div>
                  <dt>Beats</dt>
                  <dd>Every {(sound.beats[1]! - sound.beats[0]!).toFixed(2)} s, marked on the ruler</dd>
                </div>
              ) : null}
              <div>
                <dt>Plays</dt>
                <dd>
                  {timecode(sound.start, true)} to {timecode(sound.end, true)}
                </dd>
              </div>
            </dl>
            {sound.kind !== "music" && (
              <Button
                size="sm"
                variant="quiet"
                icon="trash"
                onClick={() => {
                  set({ ...edit, sound: edit.sound.filter((s) => s.id !== sound.id) }, `sd-${sound.id}-remove`);
                  onSelect(undefined);
                }}
              >
                Remove
              </Button>
            )}
          </>
        ),
      },
    ];
  } else {
    sections = editSections({ doc, edit, mode, variables, onChange, onFlag, onBefore });
  }

  return (
    <aside className="ui-desk-panel ui-desk-vars" aria-label="Inspector">
      <div className="ui-video-inspector-head">
        <h2 className="ui-desk-panel-title">{title}</h2>
        {selected && (
          <Button
            size="sm"
            variant="quiet"
            icon="x"
            iconOnly
            aria-label="Back to the edit"
            onClick={() => onSelect(undefined)}
          />
        )}
      </div>
      <StudioFolds key={foldKey} label="Inspector" sections={sections} />
    </aside>
  );
});

// ─── Nothing selected: the edit ──────────────────────────────────────────────

function editSections({
  doc,
  edit,
  mode,
  variables,
  onChange,
  onFlag,
  onBefore,
}: {
  doc: CreativeDocument;
  edit: VideoEdit;
  mode?: StudioMode;
  variables: Variables;
  onChange: (part: VideoChange, key: string) => void;
  onFlag: (c: EditCheck) => void;
  onBefore: () => void;
}): StudioFold[] {
  const format = edit.formats.find((f) => f.id === edit.formatId);
  const flags = edit.checks.filter((c) => c.state === "flag").length;
  // A variable of the mode changes the edit where it can: the grade, the music, captions on, how shots meet.
  const onVariable = (key: string, value: VarValue) => {
    const vars = { ...variables, [key]: value };
    let video = edit;
    if (key === "grade" && typeof value === "string") video = { ...edit, grade: value };
    if (key === "transition" && typeof value === "string")
      video = { ...edit, clips: edit.clips.map((c, i) => (i ? { ...c, transition: value as Transition } : c)) };
    if (key === "captions" && typeof value === "boolean")
      video = { ...edit, formats: edit.formats.map((f) => (f.id === edit.formatId ? { ...f, captions: value } : f)) };
    if (key === "music" && typeof value === "string") {
      const has = edit.sound.some((s) => s.kind === "music");
      video = {
        ...edit,
        sound:
          value === "none"
            ? edit.sound.filter((s) => s.kind !== "music")
            : has
              ? edit.sound.map((s) => (s.kind === "music" ? { ...s, name: MUSIC[value] ?? value } : s))
              : [
                  ...edit.sound,
                  {
                    id: "sd-music",
                    kind: "music" as const,
                    name: MUSIC[value] ?? value,
                    start: 0,
                    end: editLength(edit),
                    level: -6,
                    licence: "Licensed for paid social",
                  },
                ],
      };
    }
    onChange({ variables: vars, video }, `var-${key}`);
  };

  const sections: StudioFold[] = [
    {
      id: "Checks",
      title: "The Engine’s checks",
      meta: flags ? `${flags} to look at` : "All clear",
      children: (
        <ul className="ui-video-checks" aria-label="The Engine’s checks">
          {edit.checks.map((c) => {
            const body = (
              <>
                <Icon name={c.state === "flag" ? "triangle-alert" : "circle-check"} />
                <span className="ui-video-check-text">
                  <span>{c.label}</span>
                  {c.note && <span className="ui-video-check-note">{c.note}</span>}
                </span>
                {c.at !== undefined && <span className="ui-video-check-at">{timecode(c.at, true)}</span>}
              </>
            );
            return (
              <li key={c.id}>
                {c.state === "flag" && c.at !== undefined ? (
                  <button type="button" className="ui-video-check" data-state={c.state} onClick={() => onFlag(c)}>
                    {body}
                  </button>
                ) : (
                  <div className="ui-video-check" data-state={c.state}>
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ),
    },
    {
      id: "Format",
      title: "Format",
      meta: format ? `${format.ratio} · ${format.seconds} s` : undefined,
      children: (
        <>
          <StudioSelect
            label="Cut for"
            id="vf-this"
            value={edit.formatId}
            options={edit.formats.map((f) => ({ value: f.id, label: `${f.name} · ${f.ratio} · ${f.seconds} s` }))}
            help="The others are made from this one."
            onChange={(formatId) => onChange({ video: { ...edit, formatId } }, "format")}
          />
          <AdaptFormats doc={doc} edit={edit} onBefore={onBefore} />
        </>
      ),
    },
  ];
  for (const section of mode?.sections ?? []) {
    const vars = (mode?.variables ?? []).filter((v) => v.section === section);
    if (!vars.length) continue;
    sections.push({
      id: section,
      title: section,
      children: vars.map((v) => (
        <ModeControl
          key={v.key}
          variable={v as StudioVariable}
          value={variables[v.key] ?? (v.default as VarValue)}
          onChange={(value) => onVariable(v.key, value as VarValue)}
        />
      )),
    });
  }
  return sections;
}

/** The other formats, made from this edit: the Engine reframes each to its placement's safe zones and cuts it down
 *  to its length; she looks them over after. */
function AdaptFormats({ doc, edit, onBefore }: { doc: CreativeDocument; edit: VideoEdit; onBefore: () => void }) {
  const adapt = useAdaptVideo();
  const toast = useToast();
  const others = edit.formats.filter((f) => f.id !== edit.formatId);
  const [picked, setPicked] = useState<string[]>(() => others.filter((f) => f.state === "planned").map((f) => f.id));
  const chosen = picked.filter((id) => others.some((f) => f.id === id && f.state === "planned"));
  return (
    <div className="ui-video-adapt">
      <p className="ui-sc-label">Adapt for</p>
      <ul className="ui-video-formats" aria-label="Adapt for">
        {others.map((f) => {
          const on = chosen.includes(f.id);
          const busy = f.state === "making";
          const done = f.state === "ready";
          return (
            <li key={f.id}>
              <button
                type="button"
                className="ui-video-format"
                aria-pressed={done || on}
                disabled={busy || done}
                onClick={() => setPicked((p) => (p.includes(f.id) ? p.filter((x) => x !== f.id) : [...p, f.id]))}
              >
                <span className="ui-video-format-box" data-on={done || on ? "" : undefined}>
                  {(done || on) && <Icon name="check" />}
                </span>
                <span className="ui-video-format-name">{f.name}</span>
                <span className="ui-video-format-meta">
                  {busy ? (
                    <TextShimmer>Making</TextShimmer>
                  ) : done ? (
                    "Made"
                  ) : (
                    `${f.ratio} · ${f.seconds} s${f.seconds < editLength(edit) - 0.5 ? " cut" : ""}`
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Button
        size="sm"
        variant="secondary"
        icon="crop"
        loading={adapt.isPending}
        disabled={!chosen.length}
        onClick={() => {
          onBefore();
          adapt.mutate(
            { documentId: doc.id, formatIds: chosen },
            {
              onSuccess: () =>
                toast.done(`The Engine is making ${chosen.length === 1 ? "1 format" : `${chosen.length} formats`}`, {
                  description: "Each keeps its placement’s safe zones. Look them over before they go to check.",
                }),
              onError: (e) => toast.error("The formats didn’t start", { description: e.message }),
            },
          );
        }}
      >
        Make {chosen.length === 1 ? "1 format" : `${chosen.length || ""} formats`.trim()}
      </Button>
    </div>
  );
}

// ─── A shot ──────────────────────────────────────────────────────────────────

function shotSections({
  doc,
  edit,
  clip,
  index,
  brandName,
  set,
  onSelect,
  onBefore,
}: {
  doc: CreativeDocument;
  edit: VideoEdit;
  clip: VideoClip;
  index: number;
  brandName: string;
  set: (video: VideoEdit, key: string) => void;
  onSelect: (s: Selection | undefined) => void;
  onBefore: () => void;
}): StudioFold[] {
  const setClip = (change: Partial<VideoClip>, key: string) =>
    set(
      { ...edit, clips: edit.clips.map((c) => (c.id === clip.id ? { ...c, ...change } : c)) },
      `shot-${clip.id}-${key}`,
    );
  const take = pickedTake(clip);
  const start = placed(edit.clips)[index]?.start ?? 0;
  const findings = openFindings(clip);
  const making = clip.takes.filter((t) => t.state === "making").length;

  // Picking a take cuts to its clean part when the Engine found one; else it keeps the shot's length.
  const pickTake = (t: ShotTake) => {
    const keep = Math.min(t.seconds, clip.out - clip.in);
    setClip({ pickedTakeId: t.id, in: t.best?.in ?? 0, out: t.best?.out ?? Math.min(t.seconds, keep) }, "take");
  };
  const cleaner = clip.takes.find(
    (t) =>
      t.id !== take?.id &&
      t.state === "ready" &&
      t.findings.every((f) => f.state !== "open" || (t.best && (f.to <= t.best.in || f.from >= t.best.out))),
  );

  const sections: StudioFold[] = [];
  if (clip.takes.length)
    sections.push({
      id: "Takes",
      title: "Takes",
      meta: making ? `${making} on the way` : clip.takes.length,
      children: (
        <>
          <ul className="ui-video-takes" aria-label="Takes">
            {clip.takes.map((t) => {
              // Flagged where it matters: inside the stretch the edit uses (or would use, picking it).
              const used = t.id === take?.id ? { in: clip.in, out: clip.out } : (t.best ?? { in: 0, out: t.seconds });
              const flagged = t.findings.some((f) => f.state === "open" && f.to > used.in && f.from < used.out);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    className="ui-video-take"
                    aria-pressed={t.id === take?.id}
                    disabled={t.state !== "ready"}
                    aria-label={`Take ${t.number}${t.state === "making" ? ", being made" : ""}${flagged ? ", flagged" : ""}`}
                    onClick={() => pickTake(t)}
                  >
                    <span className="ui-video-take-img">
                      {t.state === "ready" ? (
                        <img src={t.poster} alt="" draggable={false} />
                      ) : (
                        <Skeleton shape="creative" ratio="9 / 16" />
                      )}
                    </span>
                    <span className="ui-video-take-line">
                      <span className="ui-video-take-num">T{t.number}</span>
                      {t.state === "making" ? (
                        <TextShimmer>Making</TextShimmer>
                      ) : (
                        flagged && <Icon name="triangle-alert" aria-hidden="true" />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {findings.length > 0 && (
            <ul className="ui-video-checks" aria-label="What the Engine read on this take">
              {findings.map((f, i) => (
                <li key={i}>
                  <div className="ui-video-check" data-state="flag">
                    <Icon name="triangle-alert" />
                    <span className="ui-video-check-text">
                      <span>{f.text}</span>
                      <span className="ui-video-check-note">
                        Take {take?.number}, {f.from.toFixed(1)}–{f.to.toFixed(1)} s
                      </span>
                    </span>
                    <span className="ui-video-check-at">{timecode(start + Math.max(0, f.from - clip.in), true)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {findings.length > 0 && cleaner && (
            <Button size="sm" variant="secondary" icon="check" onClick={() => pickTake(cleaner)}>
              Use take {cleaner.number}
              {cleaner.best ? ` from ${cleaner.best.in.toFixed(1)} s` : ""}
            </Button>
          )}
          {findings.length > 0 && !cleaner && take?.best && (
            <Button size="sm" variant="secondary" icon="crop" onClick={() => pickTake(take)}>
              Use the clean part
            </Button>
          )}
        </>
      ),
    });

  if (clip.source === "engine" && clip.recipe)
    sections.push({
      id: "Make",
      title: clip.takes.length ? "Make it again" : "Make it",
      children: <MakeShot doc={doc} edit={edit} clip={clip} set={setClip} onBefore={onBefore} />,
    });
  else if (clip.source === "library")
    sections.push({
      id: "Source",
      title: "Source",
      children: (
        <p className="ui-video-help">{brandName}’s own footage, used as it is. The grade matches it to the rest.</p>
      ),
    });

  sections.push({
    id: "Cut",
    title: "Cut",
    meta: `${((clip.out - clip.in) / (clip.speed || 1)).toFixed(1)} s`,
    children: (
      <>
        <p className="ui-video-help">
          Uses {clip.in.toFixed(1)}–{clip.out.toFixed(1)} s of the take. Drag its ends on the timeline to trim.
        </p>
        <StudioSegmented
          label="Speed"
          id="shot-speed"
          value={String(clip.speed)}
          options={[
            { value: "0.5", label: "Half" },
            { value: "0.75", label: "Slower" },
            { value: "1", label: "Real time" },
          ]}
          onChange={(v) => setClip({ speed: Number(v) }, "speed")}
        />
        {index > 0 && (
          <StudioSegmented
            label="Comes in with"
            id="shot-transition"
            value={clip.transition}
            options={TRANSITIONS}
            onChange={(v) => setClip({ transition: v as Transition }, "transition")}
          />
        )}
        <div className="ui-desk-row-actions">
          <Button
            size="sm"
            variant="quiet"
            icon="arrow-left"
            disabled={index === 0}
            onClick={() => set({ ...edit, clips: move(edit.clips, index, index - 1) }, `shot-${clip.id}-order`)}
          >
            Earlier
          </Button>
          <Button
            size="sm"
            variant="quiet"
            icon="arrow-right"
            disabled={index === edit.clips.length - 1}
            onClick={() => set({ ...edit, clips: move(edit.clips, index, index + 1) }, `shot-${clip.id}-order`)}
          >
            Later
          </Button>
          <Button
            size="sm"
            variant="quiet"
            icon="trash"
            onClick={() => {
              set({ ...edit, clips: edit.clips.filter((c) => c.id !== clip.id) }, `shot-${clip.id}-remove`);
              onSelect(undefined);
            }}
          >
            Remove
          </Button>
        </div>
      </>
    ),
  });
  return sections;
}

/** How the Engine makes a shot: the start frame, the camera, what moves, the length, the model, how many takes. */
function MakeShot({
  doc,
  edit,
  clip,
  set,
  onBefore,
}: {
  doc: CreativeDocument;
  edit: VideoEdit;
  clip: VideoClip;
  set: (change: Partial<VideoClip>, key: string) => void;
  onBefore: () => void;
}) {
  const make = useMakeShot();
  const toast = useToast();
  const [takes, setTakes] = useState(clip.takes.length ? 2 : 3);
  const recipe = clip.recipe!;
  const setR = (change: Partial<typeof recipe>, key: string) =>
    set({ recipe: { ...recipe, ...change } }, `recipe-${key}`);
  const making = clip.takes.some((t) => t.state === "making");
  const cost = Math.round(recipe.seconds * 0.084 * takes * 100) / 100;
  return (
    <>
      <div className="ui-video-start">
        <span className="ui-video-row-img">
          <img src={recipe.startImage} alt="" draggable={false} />
        </span>
        <p className="ui-video-help">Starts from this frame, so the product is right from the first second.</p>
      </div>
      <StudioText
        label="What moves"
        id="recipe-action"
        rows={3}
        value={recipe.action}
        placeholder="A drop of oil falls from the opening"
        onChange={(action) => setR({ action }, "action")}
      />
      <StudioSelect
        label="Camera"
        id="recipe-move"
        value={recipe.move}
        options={MOVES}
        onChange={(move) => setR({ move: move as CameraMove }, "move")}
      />
      {recipe.move !== "still" && (
        <StudioSlider
          label="How far it travels"
          id="recipe-amount"
          value={recipe.amount}
          unit="%"
          onChange={(amount) => setR({ amount }, "amount")}
        />
      )}
      <StudioSegmented
        label="Length of a take"
        id="recipe-seconds"
        value={String(recipe.seconds)}
        options={[
          { value: "5", label: "5 s" },
          { value: "10", label: "10 s" },
        ]}
        onChange={(s) => setR({ seconds: Number(s) }, "seconds")}
      />
      <StudioSelect
        label="Video model"
        id="recipe-model"
        value={recipe.model}
        options={VIDEO_MODELS.map((m) => ({ value: m, label: m === "auto" ? "The Engine picks" : m }))}
        help="Fume’s people only."
        onChange={(model) => setR({ model }, "model")}
      />
      <StudioNumber label="Takes" id="recipe-takes" value={takes} min={1} max={4} onChange={setTakes} />
      <Button
        size="sm"
        icon="fume-engine"
        loading={make.isPending}
        disabled={making}
        onClick={() => {
          onBefore();
          make.mutate(
            { documentId: doc.id, clipId: clip.id, recipe, takes },
            {
              onSuccess: () =>
                toast.done(`The Engine is making ${takes === 1 ? "a take" : `${takes} takes`} of ${clip.name}`, {
                  description: "It reads each one frame by frame and flags what looks wrong.",
                }),
              onError: (e) => toast.error("The takes didn’t start", { description: e.message }),
            },
          );
        }}
      >
        Make {takes === 1 ? "1 take" : `${takes} takes`}
      </Button>
      <p className="ui-video-help">
        About ${cost.toFixed(2)} · Fume’s people only.{" "}
        {edit.clips.length > 1 ? "The rest of the edit stays as it is." : ""}
      </p>
    </>
  );
}

// ─── Timing for words ────────────────────────────────────────────────────────

function timing(
  item: { start: number; end: number },
  length: number,
  onTime: (start: number, end: number, key: string) => void,
  onRemove: () => void,
): StudioFold {
  const lasts = Math.round((item.end - item.start) * 10) / 10;
  return {
    id: "Timing",
    title: "Timing",
    meta: `${timecode(item.start, true)}–${timecode(item.end, true)}`,
    children: (
      <>
        <StudioSlider
          label="Starts at"
          id="time-start"
          value={Math.round(item.start * 10) / 10}
          min={0}
          max={Math.max(0.1, Math.round((length - 0.5) * 10) / 10)}
          step={0.1}
          unit="s"
          onChange={(start) => onTime(start, start + lasts, "start")}
        />
        <StudioSlider
          label="Lasts"
          id="time-lasts"
          value={lasts}
          min={0.5}
          max={6}
          step={0.1}
          unit="s"
          onChange={(d) => onTime(item.start, Math.round((item.start + d) * 10) / 10, "lasts")}
        />
        <Button size="sm" variant="quiet" icon="trash" onClick={onRemove}>
          Remove
        </Button>
      </>
    ),
  };
}

const move = <T,>(xs: T[], from: number, to: number) => {
  const next = [...xs];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x!);
  return next;
};
