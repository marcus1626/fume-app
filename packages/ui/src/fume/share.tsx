// Share: who sees a campaign, and the link (design-system/components/share.css, behaviour from share.js).
// DECIDED 13 Oct, round 8. A glass dialog on Radix Dialog (focus trap, Escape, scrim, focus back to the
// trigger); a sheet at the bottom on a phone (the CSS does that). One white button on the glass: Invite.
// Roles say what someone may do: Viewer, Can comment, Can approve (contract viewer, member, approver; the
// owner's row has words). "Can approve" is the customer's right: the expert checks, only the customer approves.
// Invite checks the address and says what is wrong in words under the field. Remove takes the row out (the
// Undo toast is the app's: put the person back in `people`). Copy link says Copied for --ui-share-copied.
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cx } from "../cx";
import { Icon } from "../icons";
import { Avatar, Btn, initialsOf, tokenMs, tokenPx, useAnnouncer, type PersonSign } from "./_parts";

/** Contract CustomerRole. */
export type ShareRole = "owner" | "approver" | "member" | "viewer";
/** The roles you can give (not owner). */
export type ShareGrant = Exclude<ShareRole, "owner">;

export const SHARE_ROLE_LABEL: Record<ShareRole, string> = {
  owner: "Owner",
  approver: "Can approve",
  member: "Can comment",
  viewer: "Viewer",
};
const GRANTS: ShareGrant[] = ["viewer", "member", "approver"];

export interface SharePerson {
  id: string;
  name: string;
  /** The second line: their email, or "Fume designer · Quality Gate", or "Invited, not opened yet". */
  email?: string;
  /** Replaces the email in the second line. */
  line?: string;
  role: ShareRole;
  /** Your own row: "you" after the name. */
  you?: boolean;
  avatar?: string;
  initials?: string;
  ink?: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** The invite check, as share.js says it. Returns the words to show, or null when the address will do. */
export function checkInviteEmail(value: string, people: SharePerson[]): string | null {
  const v = value.trim();
  if (!v) return "Write the email of the person you want to invite.";
  if (!EMAIL.test(v)) return "That is not an email address yet. Check the part after the @.";
  if (people.some((p) => (p.email ?? "").toLowerCase() === v.toLowerCase())) return `${v} already has access.`;
  return null;
}

/** The role select: Radix Select with the ui-select markup, its listbox glass. */
export function ShareRoleSelect({
  value,
  onValueChange,
  label,
  disabled,
}: {
  value: ShareGrant;
  onValueChange: (r: ShareGrant) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Select.Root value={value} onValueChange={(v) => onValueChange(v as ShareGrant)} disabled={disabled}>
      <div className="ui-select">
        <Select.Trigger className="ui-select-trigger" aria-label={label}>
          <Select.Value className="ui-select-value">{SHARE_ROLE_LABEL[value]}</Select.Value>
          <svg className="ui-select-icon" aria-hidden="true">
            <use href="#fi-chevrons-up-down" />
          </svg>
        </Select.Trigger>
      </div>
      <Select.Portal>
        {/* select.css places .ui-select-content itself (absolute under its trigger, for select.js); inside Radix's
            positioned wrapper it has to sit in flow, so position and top are reset here (reported as a gap). */}
        <Select.Content
          className="ui-glass ui-menu ui-select-content"
          position="popper"
          sideOffset={tokenPx("--ui-overlay-offset", 8)}
          align="start"
          aria-label={label}
          style={{ position: "relative", top: "auto", left: "auto", minWidth: "var(--radix-select-trigger-width)" }}
        >
          <Select.Viewport>
            {GRANTS.map((r) => (
              <Select.Item key={r} value={r} className="ui-menu-item ui-select-item">
                <Select.ItemText asChild>
                  <span className="ui-select-item-text">{SHARE_ROLE_LABEL[r]}</span>
                </Select.ItemText>
                <svg className="ui-menu-check ui-select-item-indicator" aria-hidden="true">
                  <use href="#fi-check" />
                </svg>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export interface ShareDialogProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Autumn launch": the title says "Share Autumn launch". */
  campaign: string;
  title?: string;
  description?: ReactNode;
  people: SharePerson[];
  /** After the check passes. The app adds the person to `people` (with line "Invited, not opened yet") and shows the toast. */
  onInvite: (invite: { email: string; role: ShareGrant }) => void;
  onRoleChange?: (id: string, role: ShareGrant) => void;
  /** Called once the row has gone (after --ui-motion-base). */
  onRemove?: (person: SharePerson) => void;
  /** The role the invite starts with. */
  inviteRole?: ShareGrant;
  /** Anyone with the link. */
  link?: { on: boolean; url: string; onChange: (on: boolean) => void; onCopy?: (url: string) => void };
  linkOnHint?: string;
  linkOffHint?: string;
  emailPlaceholder?: string;
  closeLabel?: string;
}

/** div.ui-glass.ui-dialog.ui-share[data-link] over div.ui-dialog-overlay. */
export const ShareDialog = forwardRef<HTMLDivElement, ShareDialogProps>(function ShareDialog(
  {
    open,
    onOpenChange,
    campaign,
    title,
    description,
    people,
    onInvite,
    onRoleChange,
    onRemove,
    inviteRole = "member",
    link,
    linkOnHint = "Can see the approved creatives, without signing in.",
    linkOffHint,
    emailPlaceholder = "name@company.com",
    closeLabel = "Close",
    className,
    ...props
  },
  ref,
) {
  const id = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareGrant>(inviteRole);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Set<string>>(() => new Set());
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [copied, setCopied] = useState(false);
  const [live, say] = useAnnouncer();

  // people who arrive while the dialog is open come in with is-new
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!open) {
      known.current = null;
      return;
    }
    const ids = people.map((p) => p.id);
    if (!known.current) {
      known.current = new Set(ids);
      return;
    }
    const added = ids.filter((x) => !known.current!.has(x));
    ids.forEach((x) => known.current!.add(x));
    if (!added.length) return;
    setFresh((s) => new Set([...s, ...added]));
    if (listRef.current) listRef.current.scrollTop = 0;
    const t = window.setTimeout(
      () => setFresh((s) => new Set([...s].filter((x) => !added.includes(x)))),
      tokenMs("--ui-motion-base", 240) + 40,
    );
    return () => window.clearTimeout(t);
  }, [people, open]);

  // Copied turns back after --ui-share-copied
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), tokenMs("--ui-share-copied", 2000));
    return () => window.clearTimeout(t);
  }, [copied]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const words = checkInviteEmail(email, people);
    setError(words);
    if (words) return emailRef.current?.focus();
    onInvite({ email: email.trim(), role });
    setEmail("");
    emailRef.current?.focus();
  };

  const remove = (p: SharePerson, button: HTMLButtonElement) => {
    if (leaving.has(p.id)) return;
    const row = button.closest("li");
    const land =
      row?.nextElementSibling?.querySelector<HTMLElement>("[data-share-remove]") ||
      row?.previousElementSibling?.querySelector<HTMLElement>("[data-share-remove]") ||
      emailRef.current;
    land?.focus();
    setLeaving((s) => new Set(s).add(p.id));
    window.setTimeout(
      () => {
        setLeaving((s) => {
          const n = new Set(s);
          n.delete(p.id);
          return n;
        });
        onRemove?.(p);
      },
      tokenMs("--ui-motion-base", 240),
    );
  };

  const copy = () => {
    if (!link) return;
    const url = "https://" + link.url.replace(/^https?:\/\//, "");
    try {
      void navigator.clipboard?.writeText(url).catch(() => undefined);
    } catch {
      /* no clipboard: the link is still selectable */
    }
    setCopied(false);
    requestAnimationFrame(() => setCopied(true));
    say("Link copied");
    link.onCopy?.(link.url);
  };

  const n = people.filter((p) => !leaving.has(p.id)).length;
  const errId = `${id}-error`;
  const offHint = linkOffHint ?? `Off. Only the people above can open ${campaign}.`;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-dialog-overlay" />
        <Dialog.Content
          ref={ref}
          className={cx("ui-glass ui-dialog ui-share", className)}
          data-link={link ? (link.on ? "on" : "off") : "off"}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            emailRef.current?.focus();
          }}
          {...props}
        >
          <Dialog.Close asChild>
            <Btn
              variant="glass-clear"
              size="sm"
              iconOnly
              icon="x"
              className="ui-dialog-close"
              aria-label={closeLabel}
            />
          </Dialog.Close>
          <div className="ui-dialog-header">
            <Dialog.Title className="ui-dialog-title">{title ?? `Share ${campaign}`}</Dialog.Title>
            <Dialog.Description className="ui-dialog-description">
              {description ??
                `Invite the people who brief, comment and approve. They see every creative in ${campaign}.`}
            </Dialog.Description>
          </div>
          <div className="ui-share-inner">
            <form className="ui-share-invite" noValidate onSubmit={submit}>
              <label className="ui-share-label" htmlFor={`${id}-email`}>
                Invite by email
              </label>
              <div className="ui-share-invite-row">
                <input
                  ref={emailRef}
                  className="ui-input"
                  id={`${id}-email`}
                  type="email"
                  placeholder={emailPlaceholder}
                  autoComplete="off"
                  value={email}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errId : undefined}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                />
                <ShareRoleSelect value={role} onValueChange={setRole} label="Role for the invite" />
                <Btn variant="glass-white" type="submit" icon="send">
                  Invite
                </Btn>
              </div>
              <p className="ui-field-error" id={errId} hidden={!error}>
                <Icon name="circle-alert" />
                <span>{error}</span>
              </p>
            </form>

            <section className="ui-share-people" aria-label="People with access">
              <div className="ui-share-head">
                <h3 className="ui-share-label">People with access</h3>
                <span className="ui-share-count">{n === 1 ? "1 person" : `${n} people`}</span>
              </div>
              <ul ref={listRef} className="ui-share-list">
                {people.map((p) => {
                  const sign: PersonSign = {
                    name: p.name,
                    avatar: p.avatar,
                    initials: p.initials ?? initialsOf(p.name),
                    ink: p.ink,
                  };
                  return (
                    <li
                      key={p.id}
                      className={cx("ui-share-person", fresh.has(p.id) && "is-new", leaving.has(p.id) && "is-leaving")}
                    >
                      <Avatar person={sign} />
                      <span className="ui-share-who">
                        <span className="ui-share-name">
                          {p.name}
                          {p.you && <small>you</small>}
                        </span>
                        {(p.line ?? p.email) && <span className="ui-share-mail">{p.line ?? p.email}</span>}
                      </span>
                      {p.role === "owner" ? (
                        <span className="ui-share-role-text">{SHARE_ROLE_LABEL.owner}</span>
                      ) : (
                        <>
                          <ShareRoleSelect
                            value={p.role}
                            label={`Role for ${p.name}`}
                            onValueChange={(r) => {
                              onRoleChange?.(p.id, r);
                              say(`${p.name}: ${SHARE_ROLE_LABEL[r]}`);
                            }}
                          />
                          <Btn
                            variant="glass-clear"
                            size="sm"
                            iconOnly
                            icon="x"
                            data-share-remove=""
                            aria-label={`Remove ${p.name}`}
                            onClick={(e) => remove(p, e.currentTarget)}
                          />
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {link && (
              <section className="ui-share-link" aria-label="Link">
                <label className="ui-share-switch">
                  <span className="ui-share-switch-text">
                    <span className="ui-share-switch-title">
                      <Icon name="link" />
                      Anyone with the link
                    </span>
                    <span className="ui-share-switch-hint">{link.on ? linkOnHint : offHint}</span>
                  </span>
                  <button
                    className="ui-switch ui-switch--glass"
                    type="button"
                    role="switch"
                    aria-checked={link.on}
                    data-state={link.on ? "checked" : "unchecked"}
                    aria-label="Anyone with the link"
                    onClick={() => link.onChange(!link.on)}
                  >
                    <span className="ui-switch-thumb" data-state={link.on ? "checked" : "unchecked"} />
                  </button>
                </label>
                <div className="ui-share-url-row">
                  <div className="ui-share-url">
                    <span>{link.url.replace(/^https?:\/\//, "")}</span>
                  </div>
                  <Btn
                    variant="glass-clear"
                    className="ui-share-copy"
                    data-state={copied ? "copied" : undefined}
                    icon={copied ? "check" : "link"}
                    onClick={copy}
                  >
                    <span className="ui-share-copy-label">
                      <span>Copy link</span>
                      <span aria-hidden="true">Copied</span>
                    </span>
                  </Btn>
                </div>
              </section>
            )}
          </div>
          <p className="ui-share-live" aria-live="polite">
            {live}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
