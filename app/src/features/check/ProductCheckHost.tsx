// Confirm a product beside whatever page asked (round 9, DWAY-5, DTSK-6; decision 5). One component in one container:
// the product's card (ProductCheckCard: photo, the one question first, the lines) opens as a right-side panel on a
// desk, with the page still in view on the left, and as a sheet from the bottom on a phone. The product is in the
// address (?check=pr-balm), so Back closes the panel and a reload or a link opens it again. Confirm, Later, ✕ and Esc
// take the param out in place (replace), so Back never reopens a product she has already decided on.
//
// Mount <ProductCheckHost /> once, in the workspace shell. Anything inside opens it:
//   const openCheck = useOpenProductCheck();
//   openCheck(productId);                                        // from Home, the chat, the brief, the product page
//   openCheck(productId, { onConfirmed: (id) => tick(id) });     // tick it where she was once it is confirmed
// The same panel without the address (a caller that holds its own open state): <ProductCheckPanel productId onClose />.
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Kbd,
  KbdGroup,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  useNarrowScreen,
  useToast,
} from "@fume/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCampaigns } from "../../api/hooks";
import type { Id, Product } from "../../contract";
import { useProductCheck, waitingOn, type CheckVerdict } from "./ProductCheckCard";

/** The search param that holds the product being confirmed. */
export const CHECK_PARAM = "check";

export interface OpenProductCheckOptions {
  /** After she confirmed it: tick it where she was (the brief's picker, the chat's card). */
  onConfirmed?: (productId: Id) => void;
  /** After the panel closed, confirmed or not (Later, ✕, Esc, Back). */
  onClosed?: (confirmed: boolean) => void;
  /** Where she is, for the toast's words: "Hand Balm confirmed and in the brief." */
  over?: "brief" | "conversation";
  /** Round 13 (builder A): the campaign being briefed where she opened it, named first ("Christmas waits on it"). */
  forCampaign?: string;
}

// What the opener asked for, per product, until the panel closes. Kept outside React: the host is mounted in the shell,
// the opener deep inside a page.
const waiting = new Map<Id, OpenProductCheckOptions>();

/** Opens the panel for a product: puts ?check=<productId> in the address with a push, so Back closes it. */
export function useOpenProductCheck(): (productId: Id, options?: OpenProductCheckOptions) => void {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (productId: Id, options: OpenProductCheckOptions = {}) => {
      waiting.set(productId, options);
      const params = new URLSearchParams(location.search);
      if (params.get(CHECK_PARAM) === productId) return;
      const replace = params.has(CHECK_PARAM);
      params.set(CHECK_PARAM, productId);
      navigate(
        { pathname: location.pathname, search: `?${params.toString()}`, hash: location.hash },
        { replace, preventScrollReset: true, state: { ...(location.state as object | null), productCheck: productId } },
      );
    },
    [navigate, location],
  );
}

/** The product the panel shows now, if any (a page may want to know, e.g. to light its row). */
export function useProductCheckId(): Id | undefined {
  return new URLSearchParams(useLocation().search).get(CHECK_PARAM) ?? undefined;
}

/** The one place the panel lives: reads ?check= and shows the product's card beside the page. */
export function ProductCheckHost() {
  const location = useLocation();
  const navigate = useNavigate();
  const id = new URLSearchParams(location.search).get(CHECK_PARAM) ?? undefined;
  // The last product stays rendered while the panel slides away.
  const [shown, setShown] = useState<Id | undefined>(id);
  useEffect(() => {
    if (id) setShown(id);
  }, [id]);

  // The address as it is now, for a close that comes after an answer was saved.
  const live = useRef(location);
  live.current = location;
  const close = useCallback(
    (confirmed: boolean) => {
      if (!id) return;
      const options = waiting.get(id);
      waiting.delete(id);
      // The panel goes, and the address with it, in place (replace): Back never reopens a product she has decided on,
      // and nothing the opener does next can race a step back through history.
      const now = live.current;
      const params = new URLSearchParams(now.search);
      params.delete(CHECK_PARAM);
      const search = params.toString();
      const { productCheck: _, ...state } = (now.state as { productCheck?: Id } | null) ?? {};
      navigate(
        { pathname: now.pathname, search: search ? `?${search}` : "", hash: now.hash },
        { replace: true, preventScrollReset: true, state: Object.keys(state).length ? state : null },
      );
      // Then the opener ticks it where she was, on the page as it now is.
      window.setTimeout(() => {
        if (confirmed) options?.onConfirmed?.(id);
        options?.onClosed?.(confirmed);
      }, 0);
    },
    [id, navigate],
  );

  if (!shown) return null;
  return <ProductCheckPanel key={shown} productId={shown} open={Boolean(id) && id === shown} onClose={close} over={waiting.get(shown)?.over} forCampaign={waiting.get(shown)?.forCampaign} />;
}

export interface ProductCheckPanelProps {
  productId: Id;
  /** Default true. False lets it slide away before it unmounts. */
  open?: boolean;
  /** Confirmed, or closed without (Later, ✕, Esc). The panel does not close itself: the caller drops it. */
  onClose: (confirmed: boolean) => void;
  over?: OpenProductCheckOptions["over"];
  forCampaign?: string;
}

/** The product's card in a right-side panel (a desk) or a sheet from the bottom (a phone), Later · Confirm at its foot. */
export function ProductCheckPanel({ productId, open = true, onClose, over, forCampaign }: ProductCheckPanelProps) {
  const phone = useNarrowScreen();
  const toast = useToast();
  const campaigns = useCampaigns();
  const done = (verdict: CheckVerdict, p: Product) => {
    if (verdict === "confirmed") {
      const unblocked = waitingOn(campaigns.data, p.id);
      toast.done(over === "brief" ? `${p.name} confirmed and in the brief.` : over === "conversation" ? `${p.name} confirmed and ticked for the campaign.` : `${p.name} confirmed.`, {
        description: over ? undefined : unblocked ? `${unblocked.name} can go on with it now.` : "Fume can use it in any campaign now.",
      });
    }
    onClose(verdict === "confirmed");
  };
  // The panel is the Smoke glass over the page (glass.css): the glass pills, Confirm the one white.
  const check = useProductCheck(productId, { onDone: done, nameAs: phone ? DrawerTitle : SheetTitle, glass: true, forCampaign });
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  const foot = (
    <>
      <Button variant="glass-clear" onClick={check.later} disabled={check.busy || !check.product}>
        Later
      </Button>
      <Button variant="glass-white" icon="check" onClick={check.confirm} loading={check.busy} disabled={!check.product}>
        Confirm
      </Button>
    </>
  );
  const hint = !phone && check.product && (
    <span className="ui-check-panel-hint" aria-hidden="true">
      <KbdGroup>
        <Kbd>{mac ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>↵</Kbd>
      </KbdGroup>
      confirms
    </span>
  );

  // Esc closes the top layer only: a field she is in first (a line she is changing goes back to Fume's words and
  // the focus to its Change; the answer field hands the focus to the panel itself), then the panel (WAY-1, the round 9
  // keyboard rule). The focus never drops to the page behind.
  const onEscapeKeyDown = (e: KeyboardEvent) => {
    const active = document.activeElement as HTMLElement | null;
    const panel = active?.closest<HTMLElement>(".ui-check-panel");
    if (active && panel && active.matches("textarea, input")) {
      const changingLine = !!active.closest(".ui-check-line-field");
      // An empty field the panel focused for her holds nothing to lose: Esc closes at once.
      if (!changingLine && !(active as HTMLInputElement).value.trim()) return;
      e.preventDefault();
      if (!changingLine) panel.focus({ preventScroll: true });
    }
  };

  if (phone)
    return (
      <Drawer open={open} onOpenChange={(o) => !o && onClose(false)}>
        <DrawerContent className="ui-check-panel" tabIndex={-1} onKeyDown={check.onKeyDown} onEscapeKeyDown={onEscapeKeyDown} aria-describedby={`check-${productId}-lead`}>
          <DrawerHeader>{check.head}</DrawerHeader>
          <DrawerBody>{check.body}</DrawerBody>
          <DrawerFooter>{foot}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose(false)}>
      <SheetContent
        side="right"
        size="lg"
        className="ui-check-panel"
        tabIndex={-1}
        closeLabel="Close, confirm later"
        onKeyDown={check.onKeyDown}
        onEscapeKeyDown={onEscapeKeyDown}
        aria-describedby={`check-${productId}-lead`}
        // The card puts the focus in Fume's question once the product is there; until then the panel itself holds it.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
      >
        <SheetHeader>{check.head}</SheetHeader>
        <SheetBody>{check.body}</SheetBody>
        <SheetFooter>
          {hint}
          {foot}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
