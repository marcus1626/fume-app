// Sidebar: the app's navigation, design-system/components/sidebar.css, behaviour ported from sidebar.js (shadcn's parts
// and data attributes: data-state="expanded|collapsed", data-collapsible="icon", data-active, data-mobile).
// Layers, not lines: the sidebar sits on the layer behind; the page (SidebarInset) lies on it as a Porcelain sheet.
// Wide: expanded <-> the icon rail. Narrow (the wrapper under 640 px; the CSS sets --sidebar-mode: drawer): a Smoke glass
// drawer over the scrim; the page goes inert, focus moves in, Escape or the scrim closes it and focus returns to the
// trigger; a link chosen in the drawer closes it. Cmd/Ctrl+B toggles (shortcut).
// SidebarTrigger names itself in a tooltip with its shortcut ("Show or hide the sidebar ⌘B", "Ctrl+B" off a Mac).
// `storageKey` remembers the rail on this computer (localStorage, inside try/catch: a private window simply starts
// expanded), so a person who folds it keeps it folded.
import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { WithTooltip } from "../overlays/tooltip";
import { mergeIntoChild, mergeRefs, useControllable, withClass } from "./internal";

const FOCUSABLE = "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])";

export interface SidebarContextValue {
  /** "expanded" or "collapsed" (the icon rail), on wide screens. */
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  /** The phone drawer. */
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  /** True while the CSS has turned the sidebar into the phone drawer. */
  isMobile: boolean;
  /** Toggles the rail on wide screens and the drawer on a phone; `from` gets focus back when the drawer closes. */
  toggleSidebar: (from?: HTMLElement | null) => void;
  sidebarId: string;
  sidebarRef: MutableRefObject<HTMLElement | null>;
  /** Cmd/Ctrl+B toggles it (the trigger's tooltip says so). */
  shortcut?: boolean;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

/** The sidebar's state, inside a SidebarProvider. */
export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside a SidebarProvider.");
  return ctx;
}

export interface SidebarProviderProps extends HTMLAttributes<HTMLDivElement> {
  /** Wide screens: expanded (true, default) or the icon rail. */
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The phone drawer (controlled, optional). */
  openMobile?: boolean;
  onOpenMobileChange?: (open: boolean) => void;
  /** Cmd/Ctrl+B toggles (default true). */
  shortcut?: boolean;
  /** Remember the wide-screen state (expanded or the rail) under this localStorage key; it wins over defaultOpen. */
  storageKey?: string;
}

function readStored(key: string | undefined): boolean | undefined {
  if (!key) return undefined;
  try {
    const v = window.localStorage.getItem(key);
    return v === "1" ? true : v === "0" ? false : undefined;
  } catch {
    return undefined;
  }
}

/** The wrapper (.ui-sidebar-wrapper): holds Sidebar and SidebarInset side by side. */
export const SidebarProvider = forwardRef<HTMLDivElement, SidebarProviderProps>(function SidebarProvider(
  {
    defaultOpen = true,
    open: openProp,
    onOpenChange,
    openMobile: openMobileProp,
    onOpenMobileChange,
    shortcut = true,
    storageKey,
    className,
    onKeyDown,
    onClick,
    children,
    ...props
  },
  ref,
) {
  const [stored] = useState(() => readStored(storageKey));
  const [open, setOpen] = useControllable<boolean>(openProp, stored ?? defaultOpen, onOpenChange);
  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, open ? "1" : "0");
    } catch {
      /* no storage here: the rail is not remembered */
    }
  }, [storageKey, open]);
  const [openMobile, setOpenMobileRaw] = useControllable<boolean>(openMobileProp, false, onOpenMobileChange);
  const [isMobile, setIsMobile] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const returnFocus = useRef(true);
  const wasOpenMobile = useRef(false);
  const sidebarId = `ui-sidebar-${useId().replace(/:/g, "")}`;

  const setOpenMobile = useCallback(
    (next: boolean, focus = true) => {
      returnFocus.current = focus;
      setOpenMobileRaw(next);
    },
    [setOpenMobileRaw],
  );

  // the CSS decides whether the sidebar is a drawer (a container query on the wrapper)
  useLayoutEffect(() => {
    const read = () => {
      const sb = sidebarRef.current;
      if (sb) setIsMobile(getComputedStyle(sb).getPropertyValue("--sidebar-mode").trim() === "drawer");
    };
    read();
    const w = wrapperRef.current;
    if (!w || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", read);
      return () => window.removeEventListener("resize", read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(w);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!isMobile && openMobile) setOpenMobile(false, false);
  }, [isMobile, openMobile, setOpenMobile]);

  // focus moves into the open drawer and back to the trigger when it closes
  useEffect(() => {
    const sb = sidebarRef.current;
    if (openMobile && !wasOpenMobile.current && isMobile && sb) {
      const first =
        sb.querySelector<HTMLElement>('[aria-current="page"], [data-active="true"]') ||
        sb.querySelector<HTMLElement>(FOCUSABLE);
      if (first) window.setTimeout(() => first.focus({ preventScroll: true }), 0);
    } else if (!openMobile && wasOpenMobile.current && returnFocus.current && lastTrigger.current) {
      lastTrigger.current.focus({ preventScroll: true });
    }
    wasOpenMobile.current = openMobile;
  }, [openMobile, isMobile]);

  const toggleSidebar = useCallback(
    (from?: HTMLElement | null) => {
      if (from) lastTrigger.current = from;
      if (isMobile) setOpenMobile(!openMobile);
      else setOpen(!open);
    },
    [isMobile, openMobile, open, setOpen, setOpenMobile],
  );

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shortcut, toggleSidebar]);

  const ctx = useMemo<SidebarContextValue>(
    () => ({
      state: open ? "expanded" : "collapsed",
      open,
      setOpen,
      openMobile,
      setOpenMobile: (v: boolean) => setOpenMobile(v),
      isMobile,
      toggleSidebar,
      sidebarId,
      sidebarRef,
      shortcut,
    }),
    [open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar, sidebarId, shortcut],
  );

  const onKeys = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (!isMobile || !openMobile) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpenMobile(false);
      return;
    }
    if (e.key === "Tab") {
      const sb = sidebarRef.current;
      if (!sb) return;
      const f = Array.from(sb.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault();
        f[0].focus();
      }
    }
  };
  const onClicks = (e: ReactMouseEvent<HTMLDivElement>) => {
    onClick?.(e);
    if (isMobile && openMobile && (e.target as HTMLElement).closest(".ui-sidebar a[href]")) setOpenMobile(false, false);
  };

  return (
    <SidebarContext.Provider value={ctx}>
      <div
        ref={mergeRefs(ref, wrapperRef)}
        data-slot="sidebar-wrapper"
        data-state={open ? "expanded" : "collapsed"}
        data-open-mobile={String(openMobile)}
        className={cx("ui-sidebar-wrapper", className)}
        onKeyDown={onKeys}
        onClick={onClicks}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
});

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  /** The navigation's accessible name; "Fume". */
  "aria-label"?: string;
}

/** The sidebar itself (<aside class="ui-sidebar">) and the phone's scrim after it. */
export const Sidebar = forwardRef<HTMLElement, SidebarProps>(function Sidebar(
  { className, children, "aria-label": label = "Fume", ...props },
  ref,
) {
  const sb = useSidebar();
  const collapsed = sb.state === "collapsed";
  const localRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (localRef.current) localRef.current.inert = sb.isMobile && !sb.openMobile;
  }, [sb.isMobile, sb.openMobile]);
  return (
    <>
      <aside
        ref={mergeRefs(ref, localRef, sb.sidebarRef)}
        id={sb.sidebarId}
        data-slot="sidebar"
        data-state={sb.state}
        data-collapsible={collapsed ? "icon" : ""}
        data-variant="inset"
        data-side="left"
        data-mobile={sb.isMobile ? "" : undefined}
        role={sb.isMobile ? "dialog" : undefined}
        aria-modal={sb.isMobile ? true : undefined}
        aria-label={label}
        className={cx("ui-sidebar", className)}
        {...props}
      >
        {children}
      </aside>
      <div className="ui-sidebar-scrim" aria-hidden="true" onClick={() => sb.setOpenMobile(false)} />
    </>
  );
});

export interface SidebarLogoProps extends Omit<HTMLAttributes<HTMLAnchorElement>, "children"> {
  /** The lockup: an <svg> (assets/logo/lockup-horizontal, fill currentColor). It gets .ui-logo-full. */
  logo: ReactNode;
  /** The mark it folds to on the rail: an <svg> (assets/logo/mark). It gets .ui-logo-mark. */
  mark?: ReactNode;
  href?: string;
  /** The link's name; "Fume, home". */
  label?: string;
  /** Render the one child (a router Link) as the link; its own children are replaced by the logo. */
  asChild?: boolean;
  children?: ReactElement;
}

/** The logo link at the top of the sidebar (.ui-sidebar-logo); on the rail the lockup folds to the mark. */
export const SidebarLogo = forwardRef<HTMLAnchorElement, SidebarLogoProps>(function SidebarLogo(
  { logo, mark, href = "/", label = "Fume, home", asChild, className, children, ...props },
  ref,
) {
  const art = (
    <>
      {withClass(logo, "ui-logo-full")}
      {mark !== undefined && withClass(mark, "ui-logo-mark")}
    </>
  );
  const own = { ...props, className: cx("ui-sidebar-logo", className), "aria-label": label };
  if (asChild && isValidElement(children)) return mergeIntoChild(children, own, ref, art);
  return (
    <a ref={ref} href={href} {...own}>
      {art}
    </a>
  );
});

export interface SidebarHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** The lockup <svg>; when given, the header starts with SidebarLogo. */
  logo?: ReactNode;
  /** The mark <svg> the lockup folds to on the rail. */
  mark?: ReactNode;
  logoHref?: string;
  logoLabel?: string;
}
export function SidebarHeader({ logo, mark, logoHref, logoLabel, className, children, ...props }: SidebarHeaderProps) {
  return (
    <div data-slot="sidebar-header" className={cx("ui-sidebar-header", className)} {...props}>
      {logo !== undefined && <SidebarLogo logo={logo} mark={mark} href={logoHref} label={logoLabel} />}
      {children}
    </div>
  );
}

export function SidebarContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="sidebar-content" className={cx("ui-sidebar-content", className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="sidebar-footer" className={cx("ui-sidebar-footer", className)} {...props} />;
}

export function SidebarGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="sidebar-group" className={cx("ui-sidebar-group", className)} {...props} />;
}

export function SidebarGroupLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="sidebar-group-label" className={cx("ui-sidebar-group-label", className)} {...props} />;
}

export function SidebarMenu({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul data-slot="sidebar-menu" className={cx("ui-sidebar-menu", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return <li data-slot="sidebar-menu-item" className={cx("ui-sidebar-menu-item", className)} {...props} />;
}

/** A workspace's mark in a large row: a soft Ink square with an initial. */
export function SidebarMark({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span aria-hidden="true" className={cx("ui-sidebar-mark", className)} {...props} />;
}

/** A person in a large row: a circle with an initial. */
export function SidebarAvatar({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span aria-hidden="true" className={cx("ui-sidebar-avatar", className)} {...props} />;
}

export interface SidebarMenuButtonProps extends Omit<ButtonHTMLAttributes<HTMLElement>, "type"> {
  /** Render the one child (a router Link) as the row; the child's children become the label. */
  asChild?: boolean;
  /** Renders an <a>. Without href or asChild the row is a <button>. */
  href?: string;
  /** The current place: data-active="true" (and aria-current="page" on a link). */
  isActive?: boolean;
  /** "lg": the workspace switcher and the user (two lines beside a mark or avatar). */
  size?: "default" | "lg";
  /** The row's icon. */
  icon?: IconName;
  /** In place of an icon: a SidebarMark or SidebarAvatar (large rows). */
  leading?: ReactNode;
  /** The second line of a large row ("Brand DNA v3"). */
  description?: ReactNode;
  /** The count at the end ("48"). */
  badge?: ReactNode;
  /** An icon at the very end (chevrons-up-down on the switcher). */
  endIcon?: IconName;
  type?: "button" | "submit" | "reset";
}

/** A row (.ui-sidebar-menu-button). On the rail its label floats out as a small glass tooltip. */
export const SidebarMenuButton = forwardRef<HTMLElement, SidebarMenuButtonProps>(function SidebarMenuButton(
  {
    asChild,
    href,
    isActive,
    size = "default",
    icon,
    leading,
    description,
    badge,
    endIcon,
    type,
    disabled,
    className,
    children,
    ...props
  },
  ref,
) {
  const inner = (label: ReactNode) => (
    <>
      {icon && <Icon name={icon} />}
      {leading}
      <span className="ui-sidebar-label">
        {label}
        {description !== undefined && <small>{description}</small>}
      </span>
      {badge !== undefined && badge !== null && <span className="ui-sidebar-menu-badge">{badge}</span>}
      {endIcon && <Icon name={endIcon} className="ui-sidebar-end" />}
    </>
  );
  const isLink = asChild || href !== undefined;
  const own = {
    ...props,
    "data-slot": "sidebar-menu-button",
    "data-size": size === "lg" ? "lg" : undefined,
    "data-active": isActive ? "true" : undefined,
    "aria-current": isActive && isLink ? ("page" as const) : undefined,
    className: cx("ui-sidebar-menu-button", size === "lg" && "ui-sidebar-menu-button--lg", className),
  };
  if (asChild) {
    const child = Children.only(children);
    if (isValidElement(child)) {
      const childLabel = (child.props as { children?: ReactNode }).children;
      return mergeIntoChild(child, { ...own, "aria-disabled": disabled || undefined }, ref, inner(childLabel));
    }
  }
  if (href !== undefined) {
    return (
      <a
        ref={ref as Ref<HTMLAnchorElement>}
        href={disabled ? undefined : href}
        aria-disabled={disabled || undefined}
        {...own}
      >
        {inner(children)}
      </a>
    );
  }
  return (
    <button ref={ref as Ref<HTMLButtonElement>} type={type ?? "button"} disabled={disabled} {...own}>
      {inner(children)}
    </button>
  );
});

export interface SidebarInsetProps extends HTMLAttributes<HTMLElement> {
  /** The element; main by default. */
  as?: "main" | "div";
}
/** The page: a Porcelain sheet lying on the layer behind (.ui-sidebar-inset); inert while the phone drawer is open. */
export const SidebarInset = forwardRef<HTMLElement, SidebarInsetProps>(function SidebarInset(
  { as = "main", className, ...props },
  ref,
) {
  const sb = useSidebar();
  const localRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (localRef.current) localRef.current.inert = sb.isMobile && sb.openMobile;
  }, [sb.isMobile, sb.openMobile]);
  const Tag = as as "main";
  return (
    <Tag
      ref={mergeRefs(ref, localRef)}
      data-slot="sidebar-inset"
      className={cx("ui-sidebar-inset", className)}
      {...props}
    />
  );
});

export interface SidebarTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Default "Show or hide the sidebar". The tooltip says it, with ⌘B when the shortcut is on. */
  "aria-label"?: string;
  /** false: no tooltip. */
  tooltip?: false;
}
/** The quiet icon button (panel-left) that toggles the rail or opens the drawer. */
export const SidebarTrigger = forwardRef<HTMLButtonElement, SidebarTriggerProps>(function SidebarTrigger(
  { className, onClick, children, "aria-label": label = "Show or hide the sidebar", tooltip, ...props },
  ref,
) {
  const sb = useSidebar();
  const button = (
    <button
      ref={ref}
      type="button"
      data-slot="sidebar-trigger"
      aria-controls={sb.sidebarId}
      aria-expanded={sb.isMobile ? sb.openMobile : sb.open}
      aria-label={label}
      className={cx("ui-btn ui-btn--quiet ui-btn--icon ui-btn--sm", className)}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) sb.toggleSidebar(e.currentTarget);
      }}
      {...props}
    >
      {children ?? <Icon name="panel-left" />}
    </button>
  );
  if (tooltip === false) return button;
  return (
    <WithTooltip label={label} shortcut={sb.shortcut === false ? undefined : "⌘B"} side="bottom">
      {button}
    </WithTooltip>
  );
});
