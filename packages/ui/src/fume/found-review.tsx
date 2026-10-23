// What Fume found (design-system/components/found-review.css), PROPOSED 16 Oct 2026, round 7 (Marcus 16 Oct,
// decided point 3): one review for everything Fume reads in, products from a website, a CSV or an unsorted zip,
// and the brand read again. Items lie as picture tiles marked New, Changed or Unsure; a tile opens in place, across
// the grid, with old and new side by side for a change; "Approve all (N)" is the one main action (round 8: its words can
// say what it does, "Add 2 to the catalogue"), and any one item can be confirmed, changed or removed on its own, none
// of them in Ink. Round 9 (desktop review 19 Oct, DLOAD-1, DLOAD-7; PROPOSED): one verb per action, Confirm · Change ·
// Remove (a change: Use the new · Keep yours), and Fume reads; the Engine only makes creatives.
//   <FoundReview title="What Fume found" summary="On lysne.no: 1 new product, 1 changed."
//     items={[{ id, status: "changed", title: "Pillow Mist", image, before: <…50 ml>, after: <…50 ml · 100 ml> }]}
//     onApproveAll={…} onKeep={(id) => …} onFix={(id) => …} onRemove={(id) => …} />
import { useId, useMemo, useState, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { Btn, Seg } from "./_parts";

export type FoundStatus = "new" | "changed" | "unsure";
export type FoundFilter = "all" | FoundStatus;

/** One more way to answer an item, beside Confirm · Change · Remove (Merge, Split for a zip grouping). */
export interface FoundAction {
  id: string;
  label: string;
  icon?: IconName;
  onSelect: () => void;
}

export interface FoundItem {
  id: string;
  status: FoundStatus;
  title: string;
  /** The second line: a variant, a kind, what changed ("New size: 100 ml"). */
  subtitle?: ReactNode;
  /** The picture; or `images` for a group (up to four as one mosaic). */
  image?: string;
  images?: string[];
  /** The icon when there is no picture (default package). */
  icon?: IconName;
  /** Items with a group are shown under that group's name ("Products", "Colours"). */
  group?: string;
  /** Changed: what Fume holds now and what Fume read, shown side by side. */
  before?: ReactNode;
  after?: ReactNode;
  /** How sure Fume is; low reads as "Fume is not sure". */
  confidence?: "high" | "medium" | "low";
  /** Where Fume read it, in words ("lysne.no/pillow-mist", "spec-sheet-scrub.pdf"). */
  source?: string;
  /** One calm line on the tile and in the open item ("These 3 pictures might be one product"). */
  note?: string;
  /** Confirmed on its own: the tile says so and leaves the Approve all count. */
  kept?: boolean;
  /** More answers for this item (Merge, Split). */
  actions?: FoundAction[];
  /** More inside the open item, under before and after (the grouped files, the fields read). */
  detail?: ReactNode;
}

export interface FoundReviewProps {
  title: string;
  summary?: ReactNode;
  items: FoundItem[];
  onApproveAll: () => void;
  onKeep: (id: string) => void;
  /** Opens the item's fields with what Fume read filled in. Left out: no Change. */
  onFix?: (id: string) => void;
  onRemove: (id: string) => void;
  /** The filter chips' value. With onFilterChange it is controlled; without, it is where the chips start. */
  filter?: FoundFilter;
  onFilterChange?: (filter: FoundFilter) => void;
  /** Hides the filter chips (they hide by themselves when only one status is found). */
  hideFilter?: boolean;
  /** A write is under way: the actions wait. */
  busy?: boolean;
  /** "Approve all"; the count is added in brackets. Or a function of the count, for words that say what the action
   *  does ("Add 2 to the catalogue", round 8). */
  approveLabel?: string | ((n: number) => string);
  /** Under the grid: what Fume set aside, a link to something found elsewhere. */
  footer?: ReactNode;
  /** The title's heading level (default 2). */
  headingLevel?: 2 | 3;
  className?: string;
}

export const FOUND_STATUS_LABEL: Record<FoundStatus, string> = { new: "New", changed: "Changed", unsure: "Unsure" };
const statusIcon: Record<FoundStatus, IconName> = { new: "plus", changed: "refresh-cw", unsure: "circle-alert" };
const confidenceWords = { high: "Fume is sure", medium: "Fume is fairly sure", low: "Fume is not sure" } as const;

function Media({ item }: { item: FoundItem }) {
  const pics = (item.images ?? []).filter(Boolean).slice(0, 4);
  if (pics.length > 1)
    return (
      <span className="ui-found-mosaic" data-count={pics.length}>
        {pics.map((src, i) => (
          <img key={i} src={src} alt="" loading="lazy" draggable={false} />
        ))}
      </span>
    );
  const src = item.image ?? pics[0];
  if (src) return <img src={src} alt="" loading="lazy" draggable={false} />;
  return (
    <span className="ui-found-empty">
      <Icon name={item.icon ?? "package"} />
    </span>
  );
}

function Flag({ item }: { item: FoundItem }) {
  return (
    <span className="ui-found-flag" data-status={item.status} data-kept={item.kept || undefined}>
      <Icon name={item.kept ? "check" : statusIcon[item.status]} />
      {item.kept ? "Confirmed" : FOUND_STATUS_LABEL[item.status]}
    </span>
  );
}

function Panel({
  item,
  id,
  onClose,
  onKeep,
  onFix,
  onRemove,
  busy,
}: {
  item: FoundItem;
  id: string;
  onClose: () => void;
  onKeep: () => void;
  onFix?: () => void;
  onRemove: () => void;
  busy?: boolean;
}) {
  const compare = item.status === "changed" && (item.before !== undefined || item.after !== undefined);
  const facts = [item.source && `Read in ${item.source}`, item.confidence && confidenceWords[item.confidence]].filter(
    Boolean,
  );
  return (
    <li className="ui-found-panel" id={id} data-status={item.status} aria-label={item.title}>
      <div className="ui-found-panel-head">
        <span className="ui-found-panel-media" aria-hidden="true">
          <Media item={item} />
        </span>
        <div className="ui-found-panel-words">
          <Flag item={item} />
          <p className="ui-found-panel-title">{item.title}</p>
          {item.subtitle && <p className="ui-found-panel-line">{item.subtitle}</p>}
          {facts.length > 0 && <p className="ui-found-panel-facts">{facts.join(" · ")}</p>}
        </div>
        <Btn
          variant="quiet"
          size="sm"
          iconOnly
          icon="x"
          aria-label={`Close ${item.title}`}
          className="ui-found-panel-close"
          onClick={onClose}
        />
      </div>
      {item.note && (
        <p className="ui-found-panel-note">
          <Icon name="fume-engine" />
          {item.note}
        </p>
      )}
      {compare ? (
        <div className="ui-found-compare">
          <section className="ui-found-side" data-side="before" aria-label="What Fume holds now">
            <p className="ui-found-side-label">Now</p>
            <div className="ui-found-side-body">{item.before ?? "Nothing yet"}</div>
          </section>
          <section className="ui-found-side" data-side="after" aria-label="What Fume read">
            <p className="ui-found-side-label">
              <Icon name="fume-engine" />
              Fume read
            </p>
            <div className="ui-found-side-body">{item.after ?? "Nothing"}</div>
          </section>
        </div>
      ) : (
        item.after !== undefined && <div className="ui-found-read">{item.after}</div>
      )}
      {item.detail && <div className="ui-found-detail">{item.detail}</div>}
      <div className="ui-found-actions">
        {!item.kept && (
          // Round 8 (MOB-8): the review's one Ink action is the header's; confirming one item is secondary.
          <Btn size="sm" variant="secondary" icon="check" onClick={onKeep} disabled={busy}>
            {item.status === "changed" ? "Use the new" : "Confirm"}
          </Btn>
        )}
        {onFix && (
          <Btn size="sm" variant="quiet" icon="pencil" onClick={onFix} disabled={busy}>
            Change
          </Btn>
        )}
        {item.actions?.map((a) => (
          <Btn key={a.id} size="sm" variant="secondary" icon={a.icon} onClick={a.onSelect} disabled={busy}>
            {a.label}
          </Btn>
        ))}
        <Btn
          size="sm"
          variant="quiet"
          icon={item.status === "changed" ? "rotate-ccw" : "trash"}
          onClick={onRemove}
          disabled={busy}
        >
          {item.status === "changed" ? "Keep yours" : "Remove"}
        </Btn>
      </div>
    </li>
  );
}

/** The whole review: header with Approve all, the filter chips, the picture grid (grouped when items carry a group). */
export function FoundReview({
  title,
  summary,
  items,
  onApproveAll,
  onKeep,
  onFix,
  onRemove,
  filter: filterProp,
  onFilterChange,
  hideFilter,
  busy,
  approveLabel = "Approve all",
  footer,
  headingLevel = 2,
  className,
}: FoundReviewProps) {
  const uid = useId();
  const [own, setOwn] = useState<FoundFilter>(filterProp ?? "all");
  const filter = onFilterChange ? (filterProp ?? "all") : own;
  const setFilter = (f: FoundFilter) => {
    setOpen(null);
    if (onFilterChange) onFilterChange(f);
    else setOwn(f);
  };
  const [open, setOpen] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = { all: items.length, new: 0, changed: 0, unsure: 0 };
    for (const i of items) c[i.status] += 1;
    return c;
  }, [items]);
  const statuses = (["new", "changed", "unsure"] as const).filter((s) => counts[s] > 0);
  const showFilter = !hideFilter && statuses.length > 1;
  const shown = items.filter((i) => filter === "all" || i.status === filter);
  const toApprove = items.filter((i) => !i.kept).length;

  // Groups in the order they first appear; items without one form a nameless group.
  const groups = useMemo(() => {
    const out: { name?: string; items: FoundItem[] }[] = [];
    for (const i of shown) {
      let g = out.find((x) => x.name === i.group);
      if (!g) out.push((g = { name: i.group, items: [] }));
      g.items.push(i);
    }
    return out;
  }, [shown]);

  const H = headingLevel === 2 ? "h2" : "h3";
  const G = headingLevel === 2 ? "h3" : "h4";

  return (
    <section className={cx("ui-found", className)} aria-labelledby={`${uid}-title`}>
      <header className="ui-found-head">
        <div className="ui-found-head-words">
          <H className="ui-found-title" id={`${uid}-title`}>
            {title}
          </H>
          {summary && <p className="ui-found-summary">{summary}</p>}
        </div>
        {toApprove > 0 && (
          <Btn variant="primary" icon="check" className="ui-found-approve" onClick={onApproveAll} disabled={busy}>
            {typeof approveLabel === "function" ? approveLabel(toApprove) : `${approveLabel} (${toApprove})`}
          </Btn>
        )}
      </header>

      {showFilter && (
        <Seg<FoundFilter>
          className="ui-found-filter"
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: <FilterLabel label="All" n={counts.all} /> },
            ...statuses.map((s) => ({
              value: s as FoundFilter,
              label: <FilterLabel label={FOUND_STATUS_LABEL[s]} n={counts[s]} />,
            })),
          ]}
        />
      )}

      {shown.length === 0 ? (
        <p className="ui-found-none">
          Nothing {filter === "all" ? "" : `${FOUND_STATUS_LABEL[filter as FoundStatus].toLowerCase()} `}left to look
          at.
        </p>
      ) : (
        groups.map((g, gi) => (
          <div className="ui-found-group" key={g.name ?? `g${gi}`}>
            {g.name && groups.length > 0 && <G className="ui-found-group-title">{g.name}</G>}
            <ul className="ui-found-grid" aria-label={g.name ?? title}>
              {g.items.map((item) => {
                const isOpen = open === item.id;
                const panelId = `${uid}-${item.id}`;
                return [
                  <li
                    key={item.id}
                    className="ui-found-tile"
                    data-status={item.status}
                    data-selected={isOpen || undefined}
                    data-kept={item.kept || undefined}
                  >
                    <div className="ui-found-frame">
                      <button
                        type="button"
                        className="ui-found-media"
                        aria-expanded={isOpen}
                        aria-controls={isOpen ? panelId : undefined}
                        aria-label={`${item.title}, ${item.kept ? "confirmed" : FOUND_STATUS_LABEL[item.status].toLowerCase()}`}
                        onClick={() => setOpen(isOpen ? null : item.id)}
                      >
                        <Media item={item} />
                      </button>
                      <Flag item={item} />
                    </div>
                    <div className="ui-found-text">
                      <span className="ui-found-name">{item.title}</span>
                      {item.subtitle && <span className="ui-found-line">{item.subtitle}</span>}
                      {item.note && <span className="ui-found-note">{item.note}</span>}
                    </div>
                  </li>,
                  isOpen && (
                    <Panel
                      key={`${item.id}-panel`}
                      item={item}
                      id={panelId}
                      busy={busy}
                      onClose={() => setOpen(null)}
                      onKeep={() => {
                        onKeep(item.id);
                        setOpen(null);
                      }}
                      onFix={onFix ? () => onFix(item.id) : undefined}
                      onRemove={() => {
                        onRemove(item.id);
                        setOpen(null);
                      }}
                    />
                  ),
                ];
              })}
            </ul>
          </div>
        ))
      )}

      {footer && <div className="ui-found-footer">{footer}</div>}
    </section>
  );
}

function FilterLabel({ label, n }: { label: string; n: number }) {
  return (
    <>
      {label} <span className="ui-found-count">{n}</span>
    </>
  );
}

/** A small old/new value list for before and after: an optional picture, then label and value rows; changed rows are marked. */
export function FoundFields({
  rows,
  image,
  imageLabel,
}: {
  rows: { label: string; value: ReactNode; changed?: boolean }[];
  image?: string;
  imageLabel?: string;
}) {
  return (
    <dl className="ui-found-fields">
      {image && (
        <div className="ui-found-field ui-found-field--picture">
          <dt>{imageLabel ?? "Picture"}</dt>
          <dd>
            <img src={image} alt="" loading="lazy" draggable={false} />
          </dd>
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} className="ui-found-field" data-changed={r.changed || undefined}>
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
