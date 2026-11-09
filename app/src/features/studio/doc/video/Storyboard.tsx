// The Storyboard (FLOWS §34.6, PROPOSED 9 Nov 2026): another way to see the same shots as the timeline, in the same
// place under the player. Each card is a shot on the main track, in order: its picture, its name, where it comes from
// (an upload, or the take the Engine made: "Take 2 of 3"), its length and its camera. The takes lie as a stack behind
// the picture, so she sees at a glance which shots have more to pick from. Picking a card picks the shot (the
// inspector shows it, and a change there shows on both views). The last card says how a shot is added. The look is
// studio-video.css.
import { Icon } from "@fume/ui";
import type { CSSProperties } from "react";
import type { CameraMove, VideoEdit } from "../../../../contract";
import { pickedTake, placed } from "../../../../domain/video";
import { openFindings, takeWords, type Selection } from "./edit";
import { Views } from "./Timeline";

const MOVE: Record<CameraMove, string> = {
  still: "Still",
  push: "Push in",
  pull: "Pull out",
  orbit: "Orbit",
  pan: "Pan",
  tilt: "Tilt",
  handheld: "Handheld",
};

export function Storyboard({
  edit,
  selected,
  readOnly,
  brandName,
  onSelect,
  onBoard,
}: {
  edit: VideoEdit;
  selected?: Selection;
  readOnly: boolean;
  brandName: string;
  onSelect: (s: Selection | undefined, seekTo?: "start") => void;
  onBoard: (on: boolean) => void;
}) {
  const shots = placed(edit.clips);
  return (
    <section className="ui-video-timeline ui-video-board" aria-label="Storyboard">
      <div className="ui-video-heads">
        <Views board onBoard={onBoard} />
      </div>
      <ol className="ui-video-cards" aria-label="The shots, in order">
        {shots.map(({ clip, index, start, end }) => {
          const take = pickedTake(clip);
          const poster = take?.poster ?? clip.recipe?.startImage;
          const on = selected?.kind === "shot" && selected.id === clip.id;
          const stack = Math.min(2, Math.max(0, clip.takes.length - 1));
          const flagged = openFindings(clip).length > 0;
          const from = clip.source === "library" ? `Upload · ${brandName}’s footage` : takeWords(clip);
          return (
            <li key={clip.id}>
              <button
                type="button"
                className="ui-video-card"
                aria-pressed={on}
                disabled={readOnly}
                onClick={() => onSelect(on ? undefined : { kind: "shot", id: clip.id }, "start")}
              >
                <span
                  className="ui-video-card-img"
                  style={{ "--stack": stack } as CSSProperties}
                  aria-label={clip.takes.length > 1 ? `${clip.takes.length} takes` : undefined}
                >
                  {clip.takes
                    .filter((k) => k.id !== take?.id && k.poster)
                    .slice(0, 2)
                    .map((k, i) => (
                      <img key={k.id} src={k.poster} alt="" draggable={false} data-behind={i + 1} />
                    ))}
                  {poster && <img src={poster} alt="" draggable={false} />}
                </span>
                <span className="ui-video-card-text">
                  <span className="ui-video-card-name">
                    {index + 1} · {clip.name}
                  </span>
                  <span className="ui-video-card-from">{from}</span>
                  <span className="ui-video-card-chips">
                    <span className="ui-badge ui-badge--secondary">{(end - start).toFixed(1)} s</span>
                    {clip.recipe && <span className="ui-badge ui-badge--secondary">{MOVE[clip.recipe.move]}</span>}
                    {flagged && (
                      <span className="ui-video-card-flag">
                        <Icon name="triangle-alert" />
                        Flagged
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        <li className="ui-video-card-add">
          <Icon name="plus" />
          <span>
            Add a shot from a master or an upload in the library, or ask the Engine to plan the cards first. It makes
            the takes once you agree.
          </span>
        </li>
      </ol>
    </section>
  );
}
