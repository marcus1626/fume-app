// The video conversation (FLOWS §34.6, PROPOSED 9 Nov 2026): the Engine's side panel on the Video studio. The Engine
// bar under the player takes one change; this panel holds the conversation for the whole video, when she guides the
// Engine through the plan, the shots, the cut and the formats. One conversation per creative, opened from the Engine
// bar. The Engine sees what she sees: what is picked, where the playhead stands, the format and the mode, each a chip
// she can take off. Every change it makes lands on the timeline as an ordinary change, shown before anything is kept
// (Keep or Undo under the player), so nothing hides in the conversation. Staff only: the customer never sees the Engine.
// It takes the inspector's place on the right, on the desk's own surface, so the player and the timeline stay in
// view and in reach; the × puts the inspector back. The look is studio-video.css.
import {
  Bubble,
  Button,
  Composer,
  Icon,
  Marker,
  Message,
  MessageContent,
  MessageHeader,
  MessageScroller,
  MessageStatus,
  MessageText,
  useToast,
} from "@fume/ui";
import { useState } from "react";
import { useEngineEdit, useSession } from "../../../../api/hooks";
import type { CreativeDocument, StudioMode, VideoEdit } from "../../../../contract";
import { placed, timecode } from "../../../../domain/video";
import { time } from "../../../../lib/time";
import { sign } from "../../../../shell/people";
import { MOTION, takeWords, type Selection } from "./edit";

const STARTS = ["Cut it to 12 s on the beat", "Hold shot 4 longer", "No captions"];

export function EnginePanel({
  doc,
  edit,
  mode,
  selected,
  t,
  onClose,
  onBefore,
}: {
  doc: CreativeDocument;
  edit: VideoEdit;
  mode?: StudioMode;
  selected?: Selection;
  t: number;
  onClose: () => void;
  onBefore: () => void;
}) {
  const me = useSession().data?.user;
  const ask = useEngineEdit();
  const toast = useToast();
  const [text, setText] = useState("");
  const [off, setOff] = useState<string[]>([]);

  // What the Engine sees, as chips she can take off.
  const clip = selected?.kind === "shot" ? edit.clips.find((c) => c.id === selected.id) : undefined;
  const layer = selected?.kind === "motion" ? edit.motion.find((m) => m.id === selected.id) : undefined;
  const format = edit.formats.find((f) => f.id === edit.formatId);
  const shotNo = clip ? placed(edit.clips).findIndex((p) => p.clip.id === clip.id) + 1 : 0;
  const context = [
    clip && { id: `picked-${clip.id}`, icon: "film" as const, words: `Shot ${shotNo} · ${takeWords(clip)}` },
    layer && {
      id: `picked-${layer.id}`,
      icon: "type" as const,
      words: `${MOTION[layer.template].name}: ${layer.text}`,
    },
    { id: "time", icon: "clock" as const, words: `At ${timecode(t, true)}` },
    format && { id: "format", icon: "crop" as const, words: `${format.name} ${format.ratio}` },
    mode && { id: "mode", icon: "layers" as const, words: `${mode.name} mode` },
  ].filter((c): c is { id: string; icon: "film" | "type" | "clock" | "crop" | "layers"; words: string } =>
    Boolean(c && !off.includes(c.id)),
  );

  const send = (words: string) => {
    const said = words.trim();
    if (!said) return;
    onBefore();
    ask.mutate(
      { documentId: doc.id, text: said },
      {
        onSuccess: () => setText(""),
        onError: (err) => toast.error("The Engine didn’t take that", { description: err.message }),
      },
    );
  };

  const last = edit.edits.at(-1);

  return (
    <aside className="ui-desk-panel ui-desk-vars ui-video-talk" aria-label="Video conversation">
      <div className="ui-video-inspector-head">
        <hgroup className="ui-video-inspector-title">
          <h2 className="ui-desk-panel-title">Video conversation</h2>
          <p>{doc.title} · only Fume’s team sees it</p>
        </hgroup>
        <Button size="sm" variant="quiet" icon="x" iconOnly aria-label="Close the conversation" onClick={onClose} />
      </div>
      <div className="ui-video-talk-body">
        <MessageScroller
          label={`Your conversation with the Engine about ${doc.title}`}
          announcement={
            last ? `Engine: ${last.changes.length ? last.changes.join(". ") : "nothing to change"}` : undefined
          }
        >
          <Marker icon="fume-engine">
            <span>
              One conversation for this video. The Engine sees what you see; take a chip off to leave it out. Every
              change shows on the timeline first: keep it or undo it under the player.
            </span>
          </Marker>
          {edit.edits.map((e) => (
            <div key={e.id} className="ui-video-talk-turn">
              <Message align="end">
                <MessageHeader author="person" person={sign(me)} name="You" time={time(e.at)} dateTime={e.at} />
                <MessageContent>
                  <Bubble>{e.text}</Bubble>
                </MessageContent>
              </Message>
              <Message>
                <MessageHeader author="engine" />
                <MessageContent>
                  {e.changes.length ? (
                    <>
                      <MessageText>{e.state === "proposed" ? "On the timeline now:" : "I changed:"}</MessageText>
                      <ul className="ui-video-talk-changes">
                        {e.changes.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                      <p className="ui-video-talk-state" data-state={e.state}>
                        <Icon name={e.state === "kept" ? "check" : e.state === "undone" ? "undo-2" : "film"} />
                        {e.state === "proposed"
                          ? "Keep it or undo it under the player."
                          : e.state === "kept"
                            ? "Kept in the edit."
                            : "Undone."}
                      </p>
                    </>
                  ) : (
                    <MessageText>
                      I found nothing to change for that. Try a length, the beat, a shot to slow or hold, or captions.
                    </MessageText>
                  )}
                </MessageContent>
              </Message>
            </div>
          ))}
          {ask.isPending && (
            <Message state="thinking">
              <MessageHeader author="engine" />
              <MessageContent>
                <MessageStatus>The Engine is reading the edit</MessageStatus>
              </MessageContent>
            </Message>
          )}
        </MessageScroller>
      </div>
      <div className="ui-video-talk-foot">
        {!edit.edits.some((e) => e.state === "proposed") && !ask.isPending && (
          <nav className="ui-chat-chips" aria-label="Ways to start">
            {STARTS.map((s) => (
              <Button key={s} variant="secondary" size="sm" icon="fume-engine" onClick={() => send(s)}>
                {s}
              </Button>
            ))}
          </nav>
        )}
        {context.length > 0 && (
          <ul className="ui-video-talk-context" aria-label="What the Engine sees">
            {context.map((c) => (
              <li key={c.id} className="ui-badge ui-badge--secondary ui-video-talk-chip">
                <Icon name={c.icon} />
                <span>{c.words}</span>
                <button
                  type="button"
                  className="ui-video-talk-chip-x"
                  aria-label={`Leave out: ${c.words}`}
                  onClick={() => setOff((o) => [...o, c.id])}
                >
                  <Icon name="x" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Composer
          value={text}
          onValueChange={setText}
          onSubmit={({ text: words }) => send(words)}
          disabled={ask.isPending}
          placeholder="Tell the Engine what the video should do"
          label="Write to the Engine"
          inputLabel="Message to the Engine about this video"
          sendLabel="Send to the Engine"
          inline
        />
      </div>
    </aside>
  );
}
