// The Library (FLOWS §37, PROPOSED 10 Nov 2026): everything made for a brand in one place, whatever stage it is at.
// Marcus, testing the app on 10 Nov: "I don't know where the asset library is, where I find already-checked ads; I
// can't find the Nike ads you made." A creative used to live in Check, Campaigns, the Studio, Engine output or
// Deliveries depending on how far it had come; here it is one grid, newest first.
// - Where it stands is the first choice, as a row of counts: All · In the Studio · Being made · To check · Checked ·
//   Changes asked · Approved · Delivered (a stage with nothing in it is left out). ?show= keeps it in the address, so
//   "Checked" can be linked to.
// - Under it the filter bar: search, then Brand (every brand only), Campaign, Format and Kind; the sort at its end.
// - A tile is the creative in its format: the campaign and format under it, and where it stands at its end with the
//   check's own words (the Amber triangle only on checked work; a draft says "In the Studio").
// - A tile opens the viewer: the creative large, and beside it where it stands, who made it, its version, and the way
//   to the place to work on it (Studio, Check or its campaign). Fume's admin reads the Library too, without those ways.
import {
  Button,
  CheckMark,
  CreativeGrid,
  CreativeTile,
  CreativeViewer,
  FilterBar,
  PageHeader,
  SegmentedControl,
  SegmentedOption,
  type FilterDef,
  type FilterValue,
  type ViewerItem,
} from "@fume/ui";
import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAllBrands, useLibrary, useSession } from "../../api/hooks";
import type { Format, LibraryItem, LibraryState, StudioKind } from "../../contract";
import * as copy from "../../copy";
import { date } from "../../lib/time";
import { Nothing, Page, Query } from "../../shell/Page";
import { brandBase, checkPath, frameRoot, useFrameKind } from "../../shell/scope";
import { FilterSheet } from "../campaigns/parts";
import { useNames } from "../studio/qa/names";

type Show = "all" | LibraryState;

/** The stages in the order a creative moves through them, with the row's words. */
const STAGES: { value: LibraryState; label: string }[] = [
  { value: "studio", label: "In the Studio" },
  { value: "making", label: "Being made" },
  { value: "to_check", label: "To check" },
  { value: "checked", label: "Checked" },
  { value: "changes", label: "Changes asked" },
  { value: "approved", label: "Approved" },
  { value: "delivered", label: "Delivered" },
];

const KIND: Record<StudioKind, string> = { render: "Picture", design: "Design", video: "Video" };
const FORMATS: Format[] = ["feed", "story", "square"];

export function LibraryPage() {
  const { workspaceId } = useParams();
  const frame = useFrameKind();
  const session = useSession().data!;
  const limited = frame === "fume" && session.user.staffRole === "admin";
  const library = useLibrary(workspaceId);
  const brands = useAllBrands().data?.brands.map((b) => b.workspace) ?? session.workspaces;
  const brandName = (id: string) => brands.find((w) => w.id === id)?.brandName ?? "";
  const brand = workspaceId ? brandName(workspaceId) : undefined;
  const names = useNames();

  const [params, setParams] = useSearchParams();
  const asked = params.get("show") as Show | null;
  const show: Show = asked && (asked === "all" || STAGES.some((s) => s.value === asked)) ? asked : "all";
  const setShow = (s: Show) => {
    const p = new URLSearchParams(params);
    if (s === "all") p.delete("show");
    else p.set("show", s);
    setParams(p, { replace: true });
  };
  const [query, setQuery] = useState("");
  const [value, setValue] = useState<FilterValue>({});
  const [sort, setSort] = useState("time:desc");
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const all = useMemo(() => library.data ?? [], [library.data]);
  const counts = (s: LibraryState) => all.filter((i) => i.state === s).length;

  const filters: FilterDef[] = [
    ...(workspaceId
      ? []
      : [
          {
            key: "brand",
            label: "Brand",
            options: [...new Set(all.map((i) => i.workspaceId))]
              .map((id) => ({ value: id, label: brandName(id) }))
              .sort((a, b) => a.label.localeCompare(b.label)),
          },
        ]),
    {
      key: "campaign",
      label: "Campaign",
      options: [...new Map(all.map((i) => [i.campaignId ?? "none", i.campaignName ?? "No campaign"])).entries()]
        .map(([v, label]) => ({ value: v, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    },
    {
      key: "format",
      label: "Format",
      options: FORMATS.filter((f) => all.some((i) => i.format === f)).map((f) => ({
        value: f,
        label: copy.format[f].label,
        meta: copy.format[f].ratio,
      })),
    },
    {
      key: "kind",
      label: "Kind",
      alignEnd: true,
      options: (Object.keys(KIND) as StudioKind[])
        .filter((k) => all.some((i) => i.studio === k))
        .map((k) => ({ value: k, label: KIND[k] })),
    },
  ];
  const pick = (key: string, v: string) => !value[key]?.length || value[key]!.includes(v);
  const q = query.trim().toLowerCase();
  const inStage = all.filter((i) => show === "all" || i.state === show);
  const shown = inStage
    .filter(
      (i) =>
        (!q ||
          [i.title, i.name, i.campaignName, i.productName, brandName(i.workspaceId)].some((t) =>
            t?.toLowerCase().includes(q),
          )) &&
        pick("brand", i.workspaceId) &&
        pick("campaign", i.campaignId ?? "none") &&
        pick("format", i.format) &&
        pick("kind", i.studio),
    )
    .sort((a, b) =>
      sort === "campaign:asc"
        ? (a.campaignName ?? "~").localeCompare(b.campaignName ?? "~") || b.at.localeCompare(a.at)
        : sort === "time:asc"
          ? a.at.localeCompare(b.at)
          : b.at.localeCompare(a.at),
    );

  /** Where it stands, in the check's own words. */
  const standing = (i: LibraryItem, long = false): string => {
    switch (i.state) {
      case "studio":
        return long ? `In the Studio with ${names.name(i.madeBy)}` : "In the Studio";
      case "making":
        return "The Engine is making it";
      case "to_check":
        return "Waiting for a check";
      case "checked":
        return long ? `Checked by ${names.name(i.checkedBy)}` : names.name(i.checkedBy);
      case "changes":
        return "Changes asked";
      case "approved":
        return i.approvedBy ? copy.approvedBy(names.name(i.approvedBy)) : "Approved";
      case "delivered":
        return "Delivered";
    }
  };
  const mark = (i: LibraryItem) =>
    i.state === "studio" ? (
      <span className="ui-library-state">In the Studio</span>
    ) : (
      <CheckMark
        state={
          i.state === "making"
            ? "generating"
            : i.state === "to_check"
              ? "in-check"
              : i.state === "changes"
                ? "changes"
                : "checked"
        }
        by={i.state === "checked" ? names.name(i.checkedBy) : undefined}
        label={i.state === "approved" || i.state === "delivered" ? standing(i) : undefined}
      />
    );
  const formatWords = (i: LibraryItem) =>
    `${copy.format[i.format].label} · ${copy.format[i.format].ratio}${i.version > 1 ? ` · V${i.version}` : ""}`;

  /** The way to the place to work on it: Check while it waits, else the Studio, and its campaign. */
  const ways = (i: LibraryItem) => {
    if (limited) return null;
    const base = brandBase(frame, i.workspaceId);
    const check = i.checkItemId ? `${checkPath(frame, i.workspaceId)}?item=${i.checkItemId}` : undefined;
    const studio = i.documentId ? `${frameRoot[frame]}/doc/${i.documentId}` : undefined;
    const campaign = i.campaignId
      ? frame === "fume"
        ? `${base}/campaigns/${i.campaignId}/plan`
        : `${base}/campaigns/${i.campaignId}`
      : undefined;
    return (
      <span className="ui-library-ways">
        {check && (
          <Button asChild size="sm" variant="glass-clear" icon="inbox">
            <Link to={check}>Open in Check</Link>
          </Button>
        )}
        {studio && !check && (
          <Button asChild size="sm" variant="glass-clear" icon="layers">
            <Link to={studio}>Open in Studio</Link>
          </Button>
        )}
        {campaign && (
          <Button asChild size="sm" variant="glass-clear" icon="megaphone">
            <Link to={campaign}>The campaign</Link>
          </Button>
        )}
      </span>
    );
  };
  const items: ViewerItem[] = shown.map((i) => ({
    src: i.image ?? "",
    alt: i.title,
    name: i.title,
    campaign: workspaceId
      ? (i.campaignName ?? "No campaign")
      : `${i.campaignName ?? "No campaign"} · ${brandName(i.workspaceId)}`,
    product: i.productName,
    format: i.format,
    check:
      i.state === "checked" || i.state === "approved" || i.state === "delivered" || i.state === "changes"
        ? { state: "checked", by: names.name(i.checkedBy), time: i.checkedAt ? date(i.checkedAt) : undefined }
        : i.state === "to_check"
          ? { state: "in_check" }
          : undefined,
    facts: [
      // The check line says a check already; every other stage says where it stands here
      ...(i.state === "checked" || i.state === "to_check"
        ? []
        : [{ label: "Where it stands", value: `${standing(i, true)} · ${date(i.at)}` }]),
      { label: "Version", value: `V${Math.max(1, i.version)}`, data: true },
      ...(i.madeBy && i.state !== "studio" ? [{ label: "Made by", value: names.name(i.madeBy) }] : []),
      { label: "Kind", value: KIND[i.studio] },
      ...(i.name ? [{ label: "File name", value: i.name, data: true }] : []),
      ...(limited ? [] : [{ label: "Open", value: ways(i) }]),
    ],
  }));

  const title = "Library";
  return (
    <Page title={brand ? `${brand} Library` : title}>
      <PageHeader
        title={title}
        description={
          brand
            ? `Everything made for ${brand} in one place, from a draft in the Studio to the file delivered.`
            : "Everything made for every brand in one place, newest first."
        }
      />
      <Query query={library} loading="Loading the Library">
        {() =>
          all.length === 0 ? (
            <Nothing
              icon="folder"
              title="Nothing made yet"
              text={`Every creative made for ${brand ?? "your brands"} shows here, from the first draft in the Studio to the file delivered.`}
            />
          ) : (
            <div className="ui-library">
              <SegmentedControl
                className="ui-library-stages"
                value={show}
                onValueChange={(s) => setShow(s as Show)}
                aria-label="Where it stands"
              >
                <SegmentedOption value="all" count={all.length}>
                  All
                </SegmentedOption>
                {STAGES.filter((s) => counts(s.value) > 0 || s.value === show).map((s) => (
                  <SegmentedOption key={s.value} value={s.value} count={counts(s.value)}>
                    {s.label}
                  </SegmentedOption>
                ))}
              </SegmentedControl>
              <FilterBar
                query={query}
                onQueryChange={setQuery}
                searchPlaceholder={workspaceId ? "Search creatives" : "Search creatives and brands"}
                filters={filters}
                value={value}
                onValueChange={setValue}
                sort={sort}
                sortOptions={[
                  { value: "time:desc", label: "Newest first" },
                  { value: "time:asc", label: "Oldest first" },
                  { value: "campaign:asc", label: "By campaign" },
                ]}
                onSortChange={setSort}
                shown={shown.length}
                total={inStage.length}
                onOpenSheet={() => setSheet(true)}
              />
              <FilterSheet
                open={sheet}
                onOpenChange={setSheet}
                filters={filters}
                value={value}
                onValueChange={setValue}
                shown={shown.length}
                noun={["creative", "creatives"]}
              />
              {shown.length === 0 ? (
                <Nothing
                  icon="search"
                  title="No creative matches"
                  text={
                    show === "all"
                      ? "Try another word or filter, or clear the filters."
                      : "Try another stage above, or clear the filters."
                  }
                />
              ) : (
                <CreativeGrid aria-label="Creatives">
                  {shown.map((i, n) => (
                    <CreativeTile
                      key={i.id}
                      src={i.image}
                      alt={i.title}
                      format={i.format}
                      label={`${i.campaignName ?? "No campaign"} · ${i.title}`}
                      caption={
                        <span className="ui-library-caption">
                          <span className="ui-library-campaign">
                            {workspaceId ? "" : `${brandName(i.workspaceId)} · `}
                            {i.campaignName ?? "No campaign"}
                          </span>
                          <span className="ui-library-format">{formatWords(i)}</span>
                        </span>
                      }
                      check={mark(i)}
                      onOpen={() => setOpen(n)}
                    />
                  ))}
                </CreativeGrid>
              )}
              <CreativeViewer
                items={items}
                index={open ?? 0}
                onIndexChange={setOpen}
                open={open !== null && items.length > 0}
                onOpenChange={(o) => !o && setOpen(null)}
              />
            </div>
          )
        }
      </Query>
    </Page>
  );
}
