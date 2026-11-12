// One shoot (FLOWS §38.3): every picture as it was taken, sorted by the Engine's read into Picks, The rest and Left
// out, with the clips on their own. Each picture says why it is where it is; the viewer shows the read, where it is
// used and the rights, and an expert can move a picture before checking the picks. Only a checked pick goes into a
// campaign (§38.4). The customer sees Fume's read once an expert has checked it; until then, every picture.
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  CheckMark,
  CreativeGrid,
  CreativeTile,
  CreativeViewer,
  PageHeader,
  SegmentedControl,
  SegmentedOption,
  TextShimmer,
  formatBytes,
  useToast,
  type ViewerItem,
} from "@fume/ui";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAllBrands, useCheckPicks, useMovePicture, useSession, useShoot } from "../../api/hooks";
import type { OwnPicture, OwnSort } from "../../contract";
import * as copy from "../../copy";
import { canCheckPlan } from "../../domain/permissions";
import { nearestFormat, pad, sortOf } from "../../domain/shoot";
import { date } from "../../lib/time";
import { Back, Nothing, Page, Query } from "../../shell/Page";
import { docHref, useFrameKind } from "../../shell/scope";
import { useNames } from "../studio/qa/names";
import { UseInCampaign } from "./UseInCampaign";
import { SORTS, rightsWords, sortWords, useLibraryBase } from "./words";
import { whatGoesIn } from "./AddShoot";

type Show = OwnSort | "clips" | "all";

export function ShootPage() {
  const { shootId } = useParams();
  const shoot = useShoot(shootId);
  const session = useSession().data!;
  const frame = useFrameKind();
  const { base, customer } = useLibraryBase();
  const brands = useAllBrands().data?.brands.map((b) => b.workspace) ?? session.workspaces;
  const names = useNames();
  const toast = useToast();
  const move = useMovePicture();
  const check = useCheckPicks();
  const limited = !customer && session.user.staffRole === "admin";
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState<number | null>(null);
  const [using, setUsing] = useState(false);

  const back = <Back to={`${base}?from=uploaded`} label="Library" />;
  return (
    <Page title={shoot.data ? `${shoot.data.name} · Library` : "Shoot · Library"}>
      <Query query={shoot} loading="Loading the shoot">
        {(s) => {
          const workspace = brands.find((w) => w.id === s.workspaceId);
          const mayCheck = !customer && !limited && canCheckPlan(session.user, workspace).ok;
          const reading = s.state === "reading";
          const checked = s.state === "checked";
          // Fume's read shows to Fume's people at once, to the customer once checked
          const sorted = !reading && (!customer || checked);
          const photos = s.pictures.filter((p) => p.kind === "photo");
          const clips = s.pictures.filter((p) => p.kind === "clip");
          const inSort = (o: OwnSort) => photos.filter((p) => sortOf(p) === o);
          const count = (v: Show) =>
            v === "all" ? s.pictures.length : v === "clips" ? clips.length : sorted ? inSort(v).length : 0;
          const asked = params.get("show") as Show | null;
          const fallback: Show = sorted ? "pick" : "all";
          const show: Show =
            asked && (asked === "all" || asked === "clips" || (sorted && SORTS.some((o) => o.value === asked)))
              ? asked
              : fallback;
          const setShow = (v: Show) => {
            const p = new URLSearchParams(params);
            if (v === fallback) p.delete("show");
            else p.set("show", v);
            setParams(p, { replace: true });
          };
          const shown =
            show === "all" ? s.pictures : show === "clips" ? clips : photos.filter((p) => sortOf(p) === show);
          const picks = inSort("pick").length;
          const checker = names.name(s.checkedBy);

          /** The mark at a tile's end: a pick says Pick until an expert has checked it, then the Amber triangle. */
          const mark = (p: OwnPicture) => {
            if (!sorted) return undefined;
            if (p.kind === "clip")
              return <span className="ui-library-state">{p.seconds ? `${p.seconds} s` : "Clip"}</span>;
            const o = sortOf(p);
            if (o === "pick")
              return checked ? (
                <CheckMark state="checked" by={checker} />
              ) : (
                <span className="ui-library-state" data-sort="pick">
                  Pick
                </span>
              );
            if (o === "out")
              return (
                <span className="ui-library-state" data-sort="out">
                  Left out
                </span>
              );
            return undefined;
          };
          const why = (p: OwnPicture) =>
            p.moved ? `${names.Who(p.moved.by)} moved it here. ${p.read?.why ?? ""}`.trim() : p.read?.why;

          const moves = (p: OwnPicture) => {
            if (!mayCheck || reading) return null;
            const now = sortOf(p);
            const to: { sort: OwnSort; label: string; icon: "check" | "folder" | "eye-off" }[] = [
              { sort: "pick", label: "Make it a pick", icon: "check" },
              { sort: "rest", label: "Keep for later", icon: "folder" },
              { sort: "out", label: "Leave it out", icon: "eye-off" },
            ];
            return (
              <span className="ui-library-ways">
                {to
                  .filter((t) => t.sort !== now && !(p.kind === "clip" && t.sort === "pick"))
                  .map((t) => (
                    <Button
                      key={t.sort}
                      size="sm"
                      variant="glass-clear"
                      icon={t.icon}
                      loading={move.isPending && move.variables?.pictureId === p.id && move.variables.sort === t.sort}
                      onClick={() =>
                        move.mutate(
                          { pictureId: p.id, sort: t.sort },
                          {
                            onSuccess: () =>
                              toast.done(`${pad(p.number)} moved to ${sortWords(t.sort).tab}`, {
                                description: checked ? "The picks wait for a check again." : undefined,
                              }),
                            onError: (err: Error) => toast.error("Nothing was moved", { description: err.message }),
                          },
                        )
                      }
                    >
                      {t.label}
                    </Button>
                  ))}
              </span>
            );
          };
          const used = (p: OwnPicture) =>
            p.usedIn.length === 0 ? (
              "Not used yet"
            ) : (
              <span className="ui-library-used">
                {p.usedIn.map((u) =>
                  u.documentId && !customer && !limited ? (
                    <Link key={`${u.campaignId}-${u.documentId}`} to={docHref(frame, u.documentId)}>
                      {u.campaignName}
                    </Link>
                  ) : (
                    <span key={`${u.campaignId}-${u.at}`}>{u.campaignName}</span>
                  ),
                )}
              </span>
            );
          const items: ViewerItem[] = shown.map((p) => ({
            src: p.kind === "clip" ? (p.poster ?? p.src) : p.src,
            alt: p.read?.productName ?? p.name,
            name: `${pad(p.number)} · ${p.name}`,
            campaign: s.name,
            product: p.read?.productName,
            format: nearestFormat(p.width, p.height),
            size: p.width && p.height ? `${p.width} × ${p.height}` : undefined,
            check: sorted && checked && sortOf(p) === "pick" ? { state: "checked", by: checker } : undefined,
            facts: [
              ...(sorted && p.read
                ? [
                    {
                      label: customer ? "Fume's read" : "The Engine's read",
                      value: `${sortWords(sortOf(p)!).one}. ${why(p)}`,
                    },
                  ]
                : []),
              ...(p.read?.look !== undefined && sorted
                ? [{ label: "Look", value: `${p.read.look} of 100`, data: true }]
                : []),
              ...(p.kind === "clip" && p.seconds ? [{ label: "Length", value: `${p.seconds} s`, data: true }] : []),
              { label: "Used in", value: used(p) },
              { label: "Rights", value: rightsWords(s.rights).join(" · ") },
              { label: "File", value: `${p.name}${p.bytes ? ` · ${formatBytes(p.bytes)}` : ""}`, data: true },
              ...(mayCheck && !reading ? [{ label: "Move", value: moves(p) }] : []),
            ],
          }));

          const primary =
            mayCheck && s.state === "read"
              ? {
                  label: picks ? `Check the ${copy.count(picks, "pick")}` : "Check the picks",
                  icon: "check" as const,
                  busy: check.isPending,
                  onSelect: () =>
                    check.mutate(s.id, {
                      onSuccess: () =>
                        toast.done(`${copy.count(picks, "pick")} checked`, {
                          description: "They can go into a campaign now.",
                        }),
                      onError: (err: Error) => toast.error("Not checked", { description: err.message }),
                    }),
                }
              : mayCheck && checked && s.rights.people !== "unsure"
                ? { label: "Use in a campaign", icon: "megaphone" as const, onSelect: () => setUsing(true) }
                : undefined;

          const n = photos.length + clips.length;
          return (
            <>
              <PageHeader
                back={back}
                title={s.name}
                meta={[
                  whatGoesIn(photos.length, clips.length),
                  ...(s.shotOn ? [`Shot ${date(s.shotOn)}`] : []),
                  ...(!customer && workspace ? [workspace.brandName] : []),
                ]}
                description={rightsWords(s.rights).join(" · ")}
                primaryAction={primary}
              />
              <div className="ui-library">
                <p className="ui-library-shoot-line">
                  {reading ? (
                    <TextShimmer>
                      {customer
                        ? `Fume is going through your ${copy.count(n, "picture")}`
                        : `The Engine is going through ${copy.count(n, "picture")}`}
                    </TextShimmer>
                  ) : checked ? (
                    <CheckMark
                      state="checked"
                      label={`${copy.count(picks, "pick")} checked by ${checker}${s.checkedAt ? ` · ${date(s.checkedAt)}` : ""}`}
                    />
                  ) : customer ? (
                    <span>Fume is choosing the best. You see the picks once an expert has checked them.</span>
                  ) : (
                    <>
                      <CheckMark state="in-check" label={`${copy.count(picks, "pick")} to check`} />
                      <span>
                        The Engine picked {picks} of {copy.count(photos.length, "picture")} and left{" "}
                        {inSort("out").length} out.{" "}
                        {mayCheck
                          ? "Move any you disagree with, then check the picks."
                          : "An expert checks the picks before any is used."}
                      </span>
                    </>
                  )}
                </p>
                {s.rights.people === "unsure" && (
                  <Alert icon="triangle-alert">
                    <AlertTitle>Not sure who is in them yet</AlertTitle>
                    <AlertDescription>
                      Nothing from this shoot is used until someone says who is in the pictures and that they said yes.
                    </AlertDescription>
                  </Alert>
                )}
                <SegmentedControl
                  className="ui-library-stages"
                  value={show}
                  onValueChange={(v) => setShow(v as Show)}
                  aria-label="Which pictures"
                >
                  {sorted &&
                    SORTS.filter((o) => count(o.value) > 0 || o.value === show).map((o) => (
                      <SegmentedOption key={o.value} value={o.value} count={count(o.value)}>
                        {o.tab}
                      </SegmentedOption>
                    ))}
                  {clips.length > 0 && (
                    <SegmentedOption value="clips" count={clips.length}>
                      Clips
                    </SegmentedOption>
                  )}
                  <SegmentedOption value="all" count={s.pictures.length}>
                    All
                  </SegmentedOption>
                </SegmentedControl>
                {shown.length === 0 ? (
                  <Nothing
                    icon="image"
                    title={show === "out" ? "Nothing left out" : "Nothing here"}
                    text="Every picture of the shoot is under All."
                  />
                ) : (
                  <CreativeGrid className="ui-library-own" aria-label="Pictures">
                    {shown.map((p, i) => (
                      <CreativeTile
                        key={p.id}
                        src={p.kind === "clip" ? undefined : p.src}
                        media={
                          p.kind === "clip" ? (
                            <video src={p.src} poster={p.poster} muted playsInline preload="none" aria-hidden />
                          ) : undefined
                        }
                        alt=""
                        ratio={p.width && p.height ? `${p.width} / ${p.height}` : undefined}
                        label={`${pad(p.number)} · ${p.read?.productName ?? p.name}`}
                        caption={
                          <span className="ui-library-caption">
                            <span className="ui-library-campaign">
                              {pad(p.number)}
                              {p.read?.productName ? ` · ${p.read.productName}` : p.kind === "clip" ? " · Clip" : ""}
                            </span>
                            {sorted && p.read && <span className="ui-library-why">{why(p)}</span>}
                          </span>
                        }
                        check={mark(p)}
                        onOpen={() => setOpen(i)}
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
              {mayCheck && checked && <UseInCampaign shoot={s} open={using} onOpenChange={setUsing} />}
            </>
          );
        }}
      </Query>
    </Page>
  );
}
