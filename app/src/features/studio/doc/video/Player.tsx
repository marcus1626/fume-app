// The player: the Video studio's board (FLOWS §27.2). The frame in the format's ratio, the shots stacked in it and
// the one at the playhead shown (a dissolve lays the next over the last for half a second, a focus pull brings it in
// soft to sharp), the brand's motion and the captions drawn over them in the creative's own type, and the placement's
// safe zones when they are on. Each motion layer is drawn from the clock (FLOWS §34.6): its keyframes, its way in,
// its life and its way out, so a paused frame shows what the film shows there. The desk owns the clock; the player follows it, seeking each video to the second of
// its take that the playhead stands on.
// Round 16 (PROPOSED 9 Nov 2026): the tracks are drawn in the timeline's order, the top track in front, as layers: a
// clip on a video track over Main lies over the shots (the whole frame or a picture in the picture), and a hidden
// track is left out. A layer with a text animator comes in a letter, a word or a line at a time.
import { TextShimmer } from "@fume/ui";
import { useEffect, useRef, type CSSProperties } from "react";
import type { MotionLayer, Placement, VideoEdit, VideoOverlay } from "../../../../contract";
import { clipAt, pickedTake, placed } from "../../../../domain/video";
import { SafeZones } from "../formats";
import { gradeLook, ratioOf } from "./edit";
import { layerAt, unitsAt, unitsOf } from "./motion";
import { MAIN, captionTrack, motionTrack, overlayEnd, tracksOf } from "./tracks";

const DISSOLVE = 0.5;
const FOCUS = 0.7;

export function Player({
  edit,
  t,
  playing,
  placement,
  safe,
  brandName,
  title,
  cta,
}: {
  edit: VideoEdit;
  t: number;
  playing: boolean;
  placement?: Placement;
  safe: boolean;
  brandName: string;
  title: string;
  /** The brand's call to action as its design system sets it (the pill's colour and its words' colour). */
  cta?: { fill: string; ink: string };
}) {
  const format = edit.formats.find((f) => f.id === edit.formatId) ?? edit.formats[0];
  const shots = placed(edit.clips);
  const now = clipAt(edit.clips, t);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const captionsOn = format?.captions !== false;

  // How the shot at the playhead comes in: a dissolve over the one before, or a focus pull.
  const into = now ? t - now.start : 0;
  const prev = now && now.index > 0 ? shots[now.index - 1] : undefined;
  const dissolving = now?.clip.transition === "dissolve" && prev && into < DISSOLVE;
  const mix = dissolving ? Math.min(1, into / DISSOLVE) : 1;
  const blur = now?.clip.transition === "focus" && now.index > 0 && into < FOCUS ? 10 * (1 - into / FOCUS) : 0;

  // Each video follows the clock: the one on screen plays (or stands) at its second; the one it dissolves from holds
  // its last frame; the rest wait at their first.
  useEffect(() => {
    for (const s of shots) {
      const v = videos.current.get(s.clip.id);
      if (!v) continue;
      const speed = s.clip.speed || 1;
      if (now && s.index === now.index) {
        if (v.playbackRate !== speed) v.playbackRate = speed;
        if (playing) {
          if (Math.abs(v.currentTime - now.local) > 0.3) v.currentTime = now.local;
          if (v.paused) void v.play().catch(() => undefined);
        } else {
          if (!v.paused) v.pause();
          if (Math.abs(v.currentTime - now.local) > 0.04) v.currentTime = now.local;
        }
      } else {
        if (!v.paused) v.pause();
        const hold = dissolving && prev && s.index === prev.index ? s.clip.out - 0.04 : s.clip.in;
        if (Math.abs(v.currentTime - hold) > 0.1) v.currentTime = hold;
      }
    }
  });

  // Clips over the video play at their own second while the playhead is on them.
  const overs = useRef(new Map<string, HTMLVideoElement>());
  const overlays = edit.overlays ?? [];
  useEffect(() => {
    for (const o of overlays) {
      const v = overs.current.get(o.id);
      if (!v) continue;
      const on = t >= o.start && t < overlayEnd(o);
      const local = o.in + Math.max(0, t - o.start) * (o.speed || 1);
      if (on && playing) {
        if (Math.abs(v.currentTime - local) > 0.3) v.currentTime = local;
        if (v.paused) void v.play().catch(() => undefined);
      } else {
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - local) > 0.04) v.currentTime = local;
      }
    }
  });

  const making = shots.find((s) => !pickedTake(s.clip) && s.clip.takes.some((k) => k.state === "making"));
  const ratio = ratioOf(format?.ratio ?? "9:16");
  // The visual tracks, bottom first: each a layer over the one under it.
  const visual = tracksOf(edit)
    .filter((k) => k.kind !== "audio")
    .reverse();
  const zOf = (id: string) => 2 * (visual.findIndex((k) => k.id === id) + 1);
  const zMain = zOf(MAIN);
  const mainHidden = visual.find((k) => k.id === MAIN)?.hidden;

  return (
    <div
      className="ui-video-frame"
      data-grade={gradeLook(edit.grade)}
      style={{ "--ratio": ratio, "--safe-bottom": placement?.safe.bottom ?? 0.2 } as CSSProperties}
      role="img"
      aria-label={`${title}, ${format ? `${format.name} ${format.ratio}` : "video"}, at ${t.toFixed(1)} s`}
    >
      {shots.map(({ clip, index }) => {
        const take = pickedTake(clip);
        const on = index === now?.index || (dissolving && index === prev?.index);
        const style = {
          "--mix": index === now?.index ? mix : 1,
          "--blur": index === now?.index && blur ? `${blur.toFixed(1)}px` : "0px",
        } as CSSProperties;
        const front = index === now?.index ? "" : undefined;
        if (mainHidden) return null;
        (style as Record<string, unknown>).zIndex = front ? zMain + 1 : zMain;
        if (take?.video)
          return (
            <video
              key={`${clip.id}-${take.id}`}
              ref={(el) => {
                if (el) videos.current.set(clip.id, el);
                else videos.current.delete(clip.id);
              }}
              src={take.video}
              poster={take.poster}
              muted
              playsInline
              preload="auto"
              data-on={on ? "" : undefined}
              data-front={front}
              style={style}
            />
          );
        const still = take?.poster ?? clip.recipe?.startImage;
        return still ? (
          <img
            key={clip.id}
            className="ui-video-still"
            src={still}
            alt=""
            draggable={false}
            data-on={on ? "" : undefined}
            data-front={front}
            style={style}
          />
        ) : null;
      })}
      {!edit.clips.length && (
        <div className="ui-video-empty">
          <span>No shots yet.</span>
          <span>Make one from a master, or add {brandName}’s footage.</span>
        </div>
      )}
      {visual
        .filter((k) => k.id !== MAIN && !k.hidden)
        .map((k) =>
          k.kind === "video" ? (
            overlays
              .filter((o) => o.trackId === k.id && t >= o.start && t < overlayEnd(o))
              .map((o) => <Over key={o.id} o={o} z={zOf(k.id)} refs={overs.current} />)
          ) : (
            <div key={k.id} className="ui-video-words" style={{ zIndex: zOf(k.id) }} aria-hidden="true">
              {k.kind === "captions"
                ? captionsOn &&
                  edit.captions
                    .filter((c) => captionTrack(c) === k.id && t >= c.start && t < c.end)
                    .map((c) => (
                      <p key={c.id} className="ui-video-caption">
                        {c.text}
                      </p>
                    ))
                : edit.motion
                    .filter((m) => motionTrack(m) === k.id && t >= m.start && t < m.end)
                    .map((m) => <Words key={m.id} m={m} t={t} edit={edit} cta={cta} />)}
            </div>
          ),
        )}
      {making && now?.clip.id === making.clip.id && (
        <p className="ui-video-making">
          <TextShimmer>The Engine is making {making.clip.name}</TextShimmer>
        </p>
      )}
      {safe && placement && <SafeZones placement={placement} sourceRatio={ratio} />}
    </div>
  );
}

/** A layer of words at a moment: its keyframes, its way in and out, and its text animator a unit at a time. */
function Words({
  m,
  t,
  edit,
  cta,
}: {
  m: MotionLayer;
  t: number;
  edit: VideoEdit;
  cta?: { fill: string; ink: string };
}) {
  const k = layerAt(m, t, edit.style);
  const text = m.template === "end" ? m.text.toUpperCase() : m.text;
  const a = m.animate;
  const units = a ? unitsOf(text, a.by) : [];
  const away = a ? unitsAt(m, t - m.start) : [];
  // Tracking in draws the whole line together, so it reads the units as one.
  const spread = a?.preset === "tracking-in" ? away.reduce((x, y) => x + y, 0) / Math.max(1, away.length) : 0;
  return (
    <p className="ui-video-motion" data-template={m.template} data-place={m.place}>
      <span
        className="ui-video-motion-key"
        data-animate={a?.preset}
        style={
          {
            "--kx": `${k.x}%`,
            "--ky": `${k.y}%`,
            "--ks": k.scale,
            "--kr": `${k.rotate}deg`,
            "--ko": k.opacity,
            "--kb": `${k.blur.toFixed(1)}px`,
            "--ka": m.anchor ? `${m.anchor.x}% ${m.anchor.y}%` : undefined,
            "--spread": spread ? spread.toFixed(3) : undefined,
            ...(m.template === "cta" && cta ? { "--cta-fill": cta.fill, "--cta-ink": cta.ink } : {}),
          } as CSSProperties
        }
      >
        {a
          ? units.map((u, i) => (
              <span key={i} className="ui-video-unit" style={{ "--u": (away[i] ?? 0).toFixed(3) } as CSSProperties}>
                {u}
              </span>
            ))
          : text}
      </span>
    </p>
  );
}

/** A clip over the video: the whole frame or a picture in the picture, at its opacity. */
function Over({ o, z, refs }: { o: VideoOverlay; z: number; refs: Map<string, HTMLVideoElement> }) {
  const take = o.takes.find((k) => k.id === o.pickedTakeId) ?? o.takes[0];
  if (!take) return null;
  const style = { zIndex: z, opacity: o.opacity ?? 1 } as CSSProperties;
  return take.video ? (
    <video
      className="ui-video-over"
      data-size={o.size ?? "full"}
      ref={(el) => {
        if (el) refs.set(o.id, el);
        else refs.delete(o.id);
      }}
      src={take.video}
      poster={take.poster}
      muted
      playsInline
      preload="auto"
      style={style}
    />
  ) : (
    <img
      className="ui-video-over"
      data-size={o.size ?? "full"}
      src={take.poster}
      alt=""
      draggable={false}
      style={style}
    />
  );
}
