// What the conversation opens (round 13, Marcus's video comments #13, #14, #15 of 21 Oct; PROPOSED 22 Oct 2026).
// #15 ("Når du jumpet til kampanjen, ble jeg usikker her på om man fortsatt er i chatten eller ikke"): a campaign, a
// plan, a creative, a product or a collection the conversation links to opens in the panel beside it on a desk (from
// 1280 px), so she never leaves the talk; the panel's head has "Open full page". The full page then shows one Smoke
// glass pill, "← Back to the conversation", which takes her back to where she was in it. On a smaller screen a link
// goes to the page itself, with the same pill.
// - ChatLinkProvider: the chat says how a link opens (in its panel); outside the chat, useOpenLink goes to the page.
// - ReturnToChat: the pill, mounted once by the frame (Frame.tsx); it shows while she is on the page she opened from
//   the chat, or under it.
import { Button } from "@fume/ui";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ChatLink } from "../../contract";

/** The full page of what a chat link names. */
export function linkHref(link: ChatLink): string {
  switch (link.kind) {
    case "campaign":
      return `/campaigns/${link.campaignId}`;
    case "plan":
      return `/campaigns/${link.campaignId}/plan`;
    case "creative":
      return `/review/${link.campaignId}/c/${link.creativeId}`;
    case "product":
      return `/brand/products/${link.productId}`;
    case "collection":
      return `/products/collections/${link.collectionId}`;
  }
}

/** The same link, as a key (two links are the same thing when their keys are). */
export const linkKey = (link: ChatLink) => `${link.kind}:${Object.values(link).slice(1).join(":")}`;

/** The page she opened from the chat, kept for the visit: the pill shows on it and under it. */
const RETURN = "fume-chat-return";
/** The router state a page opened from the chat carries. */
export interface FromChat {
  fromChat?: true;
}

function keepReturn(path: string | undefined) {
  try {
    if (path) sessionStorage.setItem(RETURN, path);
    else sessionStorage.removeItem(RETURN);
  } catch {
    /* the pill then shows only while the router state says so */
  }
}
function readReturn(): string | undefined {
  try {
    return sessionStorage.getItem(RETURN) ?? undefined;
  } catch {
    return undefined;
  }
}

const ChatLinkContext = createContext<((link: ChatLink) => void) | null>(null);

/** The chat opens its links in its panel (FumePage gives the opener; it decides by screen size). */
export function ChatLinkProvider({ open, children }: { open: (link: ChatLink) => void; children: ReactNode }) {
  return <ChatLinkContext.Provider value={open}>{children}</ChatLinkContext.Provider>;
}

/** Go to a link's full page from the chat: the page shows "Back to the conversation". */
export function useOpenFullPage() {
  const navigate = useNavigate();
  return (link: ChatLink) => {
    const to = linkHref(link);
    keepReturn(to.split("?")[0]);
    navigate(to, { state: { fromChat: true } satisfies FromChat });
  };
}

/** Open a link the conversation shows: in the chat's panel when there is one, else its full page. */
export function useOpenLink() {
  const inChat = useContext(ChatLinkContext);
  const full = useOpenFullPage();
  return inChat ?? full;
}

/** "← Back to the conversation": one Smoke glass pill over a page opened from the chat. */
export function ReturnToChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const [path, setPath] = useState(readReturn);
  const direct = Boolean((location.state as FromChat | null)?.fromChat);
  const inChat = /^\/fume(\/|$)/.test(location.pathname);
  useEffect(() => {
    if (inChat) keepReturn(undefined);
    setPath(readReturn());
  }, [inChat, location.pathname]);
  const shown = !inChat && (direct || (path !== undefined && (location.pathname === path || location.pathname.startsWith(`${path}/`))));
  if (!shown) return null;
  return (
    <div className="ui-glass ui-glass--bar ui-chat-return">
      <Button
        variant="glass-clear"
        icon="arrow-left"
        onClick={() => {
          keepReturn(undefined);
          // Straight from the chat: Back, so the chat finds her place in the conversation; else the chat itself.
          if (direct && location.key !== "default") navigate(-1);
          else navigate("/fume");
        }}
      >
        Back to the conversation
      </Button>
    </div>
  );
}
