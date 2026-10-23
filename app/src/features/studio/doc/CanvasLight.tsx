// The light on the canvas (FLOWS §18): while a light is dragged on the advanced light board, the board's creative
// shows where the light falls (StudioLightOverlay), and fades back when it is let go. The board's markup is Board.tsx's
// own; this finds the shown creative's frame in it (the last .ui-desk-shot, the picked one when two are compared)
// and draws into it through a portal, so the board itself needs no change.
import { StudioLightOverlay, type StudioLightRig } from "@fume/ui";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface LightView {
  /** A light is being dragged now. */
  active: boolean;
  selected?: string;
}

export function CanvasLight({ rig, view }: { rig?: StudioLightRig; view?: LightView }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [frame, setFrame] = useState<HTMLElement | null>(null);
  const on = Boolean(rig && view);

  useLayoutEffect(() => {
    if (!on) return;
    const shots = anchor.current
      ?.closest(".ui-desk-centre")
      ?.querySelectorAll<HTMLElement>(".ui-desk-canvas .ui-desk-shot");
    const next = shots?.length ? shots[shots.length - 1]! : null;
    if (next !== frame) setFrame(next);
  });

  return (
    <>
      <span ref={anchor} hidden />
      {on &&
        frame?.isConnected &&
        createPortal(<StudioLightOverlay rig={rig!} selected={view!.selected} active={view!.active} />, frame)}
    </>
  );
}
