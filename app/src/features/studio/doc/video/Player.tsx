// The player: the Video studio's board (FLOWS §27.2). The frame in the format's ratio, the shots stacked in it and
// the one at the playhead shown (a dissolve lays the next over the last for half a second, a focus pull brings it in
// soft to sharp), the brand's motion and the captions drawn over them in the creative's own type, and the placement's
// safe zones when they are on. The desk owns the clock; the player follows it, seeking each video to the second of
// its take that the playhead stands on.
import { TextShimmer } from "@fume/ui";
import { useEffect, useRef, type CSSProperties } from "react";
import type { Placement, VideoEdit } from "../../../../contract";
import { clipAt, pickedTake, placed } from "../../../../domain/video";
import { SafeZones } from "../formats";
import { gradeLook, ratioOf } from "./edit";

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
}: {
  edit: VideoEdit;
  t: number;
  playing: boolean;
  placement?: Placement;
  safe: boolean;
  brandName: string;
  title: string;
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

  const making = shots.find((s) => !pickedTake(s.clip) && s.clip.takes.some((k) => k.state === "making"));
  const ratio = ratioOf(format?.ratio ?? "9:16");

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
      <div className="ui-video-words" aria-hidden="true">
        {edit.motion
          .filter((m) => t >= m.start && t < m.end)
          .map((m) => (
            <p
              key={m.id}
              className="ui-video-motion"
              data-template={m.template}
              data-place={m.place}
              data-enter={playing ? m.enter : undefined}
            >
              {m.template === "end" ? m.text.toUpperCase() : m.text}
            </p>
          ))}
        {captionsOn &&
          edit.captions
            .filter((c) => t >= c.start && t < c.end)
            .map((c) => (
              <p key={c.id} className="ui-video-caption">
                {c.text}
              </p>
            ))}
      </div>
      {making && now?.clip.id === making.clip.id && (
        <p className="ui-video-making">
          <TextShimmer>The Engine is making {making.clip.name}</TextShimmer>
        </p>
      )}
      {safe && placement && <SafeZones placement={placement} sourceRatio={ratio} />}
    </div>
  );
}
