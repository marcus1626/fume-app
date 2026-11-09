// What a video needs to play (FLOWS §27, §34.7): its clock, one playhead in seconds played a frame at a time and stopping
// at the end, and the brand's call to action as its design system sets it. The Video studio and the video in Check
// share them, so a video plays the same in both.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBrandBooks } from "../../../../api/hooks";

/** The brand's call to action: the pill's colour and its words' colour, from its design system. */
export function useBrandCta(): { fill: string; ink: string } | undefined {
  const books = useBrandBooks().data;
  return useMemo(() => {
    const book = books?.design.find((b) => b.kind === "design" && b.body);
    const colours = book?.kind === "design" ? book.body?.colours : undefined;
    const fill = colours?.find((c) => c.role === "cta")?.hex;
    const ink = colours?.find((c) => c.role === "cta_text")?.hex;
    return fill && ink ? { fill, ink } : undefined;
  }, [books]);
}

export function useVideoClock(length: number) {
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const time = useRef(0);
  const lengthRef = useRef(length);
  lengthRef.current = length;

  // A shorter edit (a cut, a trim, the Engine's ask) brings the playhead back inside it.
  useEffect(() => {
    if (time.current > length) {
      time.current = Math.max(0, length - 0.05);
      setT(time.current);
    }
  }, [length]);

  const seek = useCallback((to: number) => {
    time.current = Math.max(0, to);
    setT(time.current);
  }, []);
  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p && time.current >= lengthRef.current - 0.05) seek(0);
      return !p;
    });
  }, [seek]);

  // One frame at a time while playing; it stops at the end.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = time.current + (now - last) / 1000;
      last = now;
      if (next >= lengthRef.current) {
        seek(lengthRef.current);
        setPlaying(false);
        return;
      }
      seek(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, seek]);

  return { t, time, playing, setPlaying, seek, toggle };
}
