// Round 13 AGENCY (robot note 10-agency, 22 Oct 2026; PROPOSED): Check's number went from 7 to 8 during the chapter
// with nothing on screen saying why. It is the Engine's fix of a creative coming back (the feedback the seed left
// with the Engine, or feedback from Check): it waits for a check again. One toast says so where the agency's person
// is, with the way to Check when they are not there; Check's own row already says "The Engine’s fix is back".
import { useToast } from "@fume/ui";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApi } from "../../api/client";

export function EngineFixToast() {
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const where = useRef(pathname);
  where.current = pathname;
  // One toast per fix: the same item can be sent back and forth, so the feedback it answers is the key.
  const told = useRef(new Set<string>());

  useEffect(
    () =>
      api.subscribe((event) => {
        if (event.type !== "qa.state") return;
        const { item } = event;
        const last = item.feedback.at(-1);
        if (item.state !== "waiting" || last?.state !== "fixed" || told.current.has(last.id)) return;
        told.current.add(last.id);
        const inCheck = where.current.startsWith("/agency/check") || /^\/agency\/b\/[^/]+\/check/.test(where.current);
        toast.info(`${item.title} is back from the Engine`, {
          description: "It waits for your check again.",
          ...(inCheck ? {} : { action: { label: "Open Check", onClick: () => navigate("/agency/check") } }),
        });
      }),
    [api, toast, navigate],
  );
  return null;
}
