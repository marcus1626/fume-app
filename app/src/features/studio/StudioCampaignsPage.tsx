// Every campaign across the brands Fume works for (ARCHITECTURE §7.2), or one brand's under /studio/b/:workspaceId. The
// campaigns show as a board first, a column per stage and Done (CampaignBoard); List keeps the table (?view=list), the
// agency's table (campaign-table.tsx). Each row: the campaign and its one status sentence as Fume's people read it
// ("Check the plan · by Fri 16 Oct", "The plan waits on Maja", "6 creatives with Maja"), the Engine's run as a quiet
// line, the brand with who from Fume is on it, the stage dots, the next date with its label, In check (a link into
// Check) and what is with the customer. The whole row opens the campaign's plan.
// Checked work reaches the customer only when it is sent as a set (ARCHITECTURE §5.2): a campaign that holds some says
// "6 creatives to send to Maja", and "Send to Maja" sits above the table. Batches (FLOWS §9.7): large sets ("50
// packshots") are made from here, for a campaign or for the product page alone. The admin's view is limited to brand
// Home and Campaigns (StudioShell), so for her a campaign is not a link, and Make a batch, Open Check and In check are
// not shown.
import {
  Button,
  FieldLegend,
  FieldSet,
  PickGrid,
  PickTile,
  ProductTile,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EngineRun,
  EngineRunAction,
  Field,
  FieldGroup,
  FieldLabel,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemMediaImage,
  ItemTitle,
  NativeSelect,
  PageHeader,
  SegmentedControl,
  SegmentedOption,
  ToggleGroup,
  ToggleGroupItem,
  useToast,
} from "@fume/ui";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  useBatches,
  useCampaign,
  useCatalogue,
  useQaQueue,
  useRelease,
  useSession,
  useStartBatch,
  useStudioCampaigns,
  useStudioKit,
  useStudioModes,
} from "../../api/hooks";
import type { Batch, Format, Id, QaItem, StudioCampaignRow, StudioMode, User } from "../../contract";
import * as copy from "../../copy";
import { Nothing, Page, Query, Section } from "../../shell/Page";
import { firstName } from "../../shell/people";
import { time } from "../../lib/time";
import { CampaignBoard, CampaignTables, type CampaignTableRow } from "./campaign-table";
import { formatName } from "./parts";
import { useNames } from "./qa/names";

/** The row with what waits in Check for its campaign as its In check count (Check's own count, never a second one). */
function withCheck(row: StudioCampaignRow, queue: { item: QaItem }[]): StudioCampaignRow {
  const inCheck = queue.filter((v) => v.item.campaignId === row.campaign.id && v.item.state === "waiting").length;
  return { ...row, campaign: { ...row.campaign, counts: { ...row.campaign.counts, inCheck } } };
}

/** Checked creatives not sent to the customer yet (waits.toSend). */
const toSend = (row: StudioCampaignRow) => Math.min(row.campaign.counts.checked, row.campaign.waits?.toSend ?? 0);
/** "Maja": the person who approves, as the studio's sentences name her. */
const customerOf = (row: StudioCampaignRow) => (row.approver ? firstName(row.approver.name) : undefined);
/** "Anna, Sander": who from Fume is on it. */
const onIt = (row: StudioCampaignRow) =>
  [row.expert, row.operator]
    .filter((u): u is User => Boolean(u))
    .map((u) => firstName(u.name))
    .join(", ");

export function StudioCampaignsPage() {
  const session = useSession().data!;
  const { workspaceId } = useParams();
  const [params, setParams] = useSearchParams();
  const studio = useStudioCampaigns();
  // What is in check is what Check holds, so the table, the bell and Check give one number.
  const queue = useQaQueue().data;
  const all = { ...studio, data: queue ? studio.data?.map((r) => withCheck(r, queue)) : studio.data };
  const brand = workspaceId ? session.workspaces.find((w) => w.id === workspaceId) : undefined;
  const filter = workspaceId ? "" : (params.get("brand") ?? "");
  // Under one brand (/studio/b/:workspaceId/campaigns), or with a brand picked above the table, only that brand's.
  const only = workspaceId || filter;
  const campaigns = { ...all, data: only ? all.data?.filter((r) => r.workspace.id === only) : all.data };
  const rows = campaigns.data;
  const brands = [...new Map((all.data ?? []).map((r) => [r.workspace.id, r.workspace])).values()];
  const live = rows?.filter((r) => !["approved", "delivered", "closed"].includes(r.campaign.state)) ?? [];
  const checking = live.reduce((n, r) => n + r.campaign.counts.inCheck, 0);
  const plans = live.filter((r) => r.campaign.stage === "plan" && r.campaign.waits?.plan === "in_check").length;
  const sending = live.reduce((n, r) => n + toSend(r), 0);
  const people = rows?.[0] && workspaceId ? onIt(rows[0]) : "";
  const view = params.get("view") === "list" ? "list" : "board";
  // The admin (outside an agency) sees brand Home and Campaigns only: nothing here leads further in.
  const limited = !session.agency && session.user.staffRole === "admin";
  const asRow = (r: StudioCampaignRow) => tableRow(r, limited);
  const show = (v: string) => {
    const out = new URLSearchParams(params);
    if (v === "list") out.set("view", "list");
    else out.delete("view");
    setParams(out, { replace: true });
  };
  const choose = (id: string) => {
    const out = new URLSearchParams(params);
    if (id) out.set("brand", id);
    else out.delete("brand");
    setParams(out, { replace: true });
  };

  return (
    <Page title={brand ? `${brand.brandName} campaigns` : "Campaigns"}>
      <PageHeader
        title="Campaigns"
        actions={
          <SegmentedControl className="ui-seg-hug" aria-label="Show the campaigns as" value={view} onValueChange={show}>
            <SegmentedOption value="board">Board</SegmentedOption>
            <SegmentedOption value="list">List</SegmentedOption>
          </SegmentedControl>
        }
        meta={
          rows
            ? [
                `${copy.count(live.length, "campaign")} under way`,
                copy.toCheck(plans, checking),
                ...(sending ? [copy.send.toSend(sending)] : []),
                ...(people ? [`${people} on it`] : []),
              ]
            : undefined
        }
        tabs={
          !workspaceId && brands.length > 1 ? (
            <div className="ui-agency-filter">
              <ToggleGroup
                type="single"
                size="sm"
                loose
                value={filter || "all"}
                onValueChange={(v) => choose(v === "all" ? "" : v)}
                aria-label="Show the campaigns of"
              >
                <ToggleGroupItem value="all">All brands</ToggleGroupItem>
                {brands.map((b) => (
                  <ToggleGroupItem key={b.id} value={b.id}>
                    {b.brandName}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          ) : undefined
        }
      />

      <Query query={campaigns} loading="Loading the campaigns">
        {(rows) =>
          rows.length === 0 ? (
            <Nothing
              icon="megaphone"
              scene="start"
              title="No campaigns yet"
              text="A campaign shows here once a customer starts a brief with Fume."
            />
          ) : (
            <>
              <ToSend rows={rows.filter((r) => toSend(r) > 0)} />
              {view === "board" ? (
                <CampaignBoard rows={rows.map(asRow)} showBrand={!only} />
              ) : (
                <CampaignTables rows={rows.map(asRow)} showBrand={!only} idPrefix="studio-campaigns" />
              )}
              {!limited && <Batches rows={rows} workspaceIds={only ? [only] : brands.map((b) => b.id)} />}
            </>
          )
        }
      </Query>
    </Page>
  );
}

/** A studio row in the shared table's terms: the sentence Fume's people read, and where the row leads. */
function tableRow(row: StudioCampaignRow, limited = false): CampaignTableRow {
  const { campaign, workspace } = row;
  return {
    campaign,
    brand: workspace,
    brandLine: onIt(row) || undefined,
    status: copy.campaignStatus(campaign, undefined, { viewer: "staff", customerName: customerOf(row), date: false }),
    line: <RunLine campaignId={campaign.id} />,
    // A campaign row opens the campaign for Fume's people: its plan, with the campaign's tabs. Not for the admin, whose
    // view stops at this page.
    ...(limited
      ? {}
      : {
          to: `/studio/b/${workspace.id}/campaigns/${campaign.id}/plan`,
          checkTo: `/studio/b/${workspace.id}/qa?campaign=${campaign.id}`,
        }),
  };
}

/** The Engine's last run, as one quiet line: "The Engine's last run: 9 of 9 made · 6 checked". It names the run, so its
 *  9 is not read as the campaign's 11. Nothing before the first run. */
function RunLine({ campaignId }: { campaignId: Id }) {
  const detail = useCampaign(campaignId).data;
  const run =
    detail?.runs.find((r) => r.state === "running" || r.state === "queued" || r.state === "paused") ??
    detail?.runs.at(-1);
  if (!run) return null;
  const checked = run.steps.find((s) => /check/i.test(s.label))?.detail;
  const done = checked?.match(/^(\d+) of \d+$/)?.[1] ?? checked;
  return (
    <>
      {[`The Engine’s last run: ${run.made} of ${run.total} made`, done ? `${done} checked` : ""]
        .filter(Boolean)
        .join(" · ")}
    </>
  );
}

/** Campaigns holding checked work the customer has not been sent: one row each, "Send to Maja" (operators and
 *  admins; the expert reads who sends it). Shown only while there is some. */
function ToSend({ rows }: { rows: StudioCampaignRow[] }) {
  const session = useSession().data!;
  const canSend = session.user.staffRole === "operator" || session.user.staffRole === "admin";
  const release = useRelease();
  const toast = useToast();
  if (!rows.length) return null;
  return (
    <Section
      title="To send"
      meta={rows.length}
      titleId="studio-to-send"
      text="Checked creatives reach the customer only when they are sent as a set."
    >
      <ItemGroup as="ul">
        {rows.map((row) => {
          const { campaign, workspace, operator } = row;
          const who = customerOf(row) ?? "the customer";
          const n = toSend(row);
          return (
            <Item key={campaign.id} as="li">
              {campaign.cover && (
                <ItemMedia variant="creative">
                  <ItemMediaImage src={campaign.cover} alt="" />
                </ItemMedia>
              )}
              <ItemContent>
                <ItemTitle>{campaign.name}</ItemTitle>
                <ItemDescription>
                  {workspace.brandName} · {copy.send.notSent}: {copy.creatives(n)}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                {canSend ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="send"
                    loading={release.isPending && release.variables === campaign.id}
                    onClick={() =>
                      release.mutate(campaign.id, {
                        onSuccess: () =>
                          toast.done(`${copy.creatives(n)} sent to ${who}`, {
                            description: `${copy.send.withThem(who)} now, to approve.`,
                          }),
                        onError: (e) => toast.error("They weren’t sent", { description: e.message }),
                      })
                    }
                  >
                    {copy.send.action(who)}
                  </Button>
                ) : (
                  <span className="ui-app-section-meta">
                    {operator ? `${firstName(operator.name)} sends them` : "The operator sends them"}
                  </span>
                )}
              </ItemActions>
            </Item>
          );
        })}
      </ItemGroup>
    </Section>
  );
}

// ─── Batches (FLOWS §9.7) ───────────────────────────────────────────────────

/** What a mode makes, in a batch's words: "12 packshots". */
const made = (mode: StudioMode | undefined, n: number) =>
  mode?.id === "m-packshot" ? copy.count(n, "packshot") : copy.creatives(n);
/** A batch's QA items (the Engine chat's batches carry their run's id). */
const ofBatch = (item: QaItem, b: Batch) => (item as QaItem & { runId?: Id }).runId === b.id;

/** The batches of the campaigns shown and of the brands' product pages, newest first, as the Engine's run cards. */
function Batches({ rows, workspaceIds }: { rows: StudioCampaignRow[]; workspaceIds: Id[] }) {
  const batches = useBatches();
  const qa = useQaQueue();
  const modes = useStudioModes().data ?? [];
  const names = useNames();
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const [open, setOpen] = useState(false);
  const shown = new Map(rows.map((r) => [r.campaign.id, r]));
  // A batch made outside a campaign is the product page's: it carries no campaign's name.
  const list = (batches.data ?? []).filter(
    (b) => shown.has(b.campaignId) || (!b.campaignId && workspaceIds.includes(b.workspaceId)),
  );
  const check = workspaceId ? `/studio/b/${workspaceId}/qa` : "/studio/qa";

  return (
    <Section
      title="Batches"
      meta={list.length || undefined}
      titleId="studio-batches"
      text="Large sets, such as 50 packshots, are made here and not in the Studio: for a campaign, or for the product page alone. What the Engine makes lands in Check."
      action={
        <Button variant="secondary" size="sm" icon="layers" onClick={() => setOpen(true)}>
          Make a batch
        </Button>
      }
    >
      {open && <BatchDialog rows={rows} workspaceIds={workspaceIds} open onOpenChange={setOpen} />}
      {list.length > 0 && (
        <div className="ui-app-grid ui-app-grid--wide">
          {list.map((b) => {
            const mode = modes.find((m) => m.id === b.modeId);
            const row = shown.get(b.campaignId);
            const waiting = (qa.data ?? []).filter((v) => ofBatch(v.item, b) && v.item.state === "waiting").length;
            return (
              <EngineRun
                key={b.id}
                title={
                  b.state === "done"
                    ? `The Engine made ${made(mode, b.total)}`
                    : `The Engine is making ${made(mode, b.total)}`
                }
                description={`${row ? row.campaign.name : "Product page"} · ${mode?.name ?? "Batch"} · ${copy.count(b.productIds.length, "product")} × ${b.perProduct} · ${formatName(b.format)} · ${names.name(b.by)} started it at ${time(b.at)}`}
                state={b.state === "queued" ? "queued" : b.state === "running" ? "running" : "done"}
                steps={batchSteps(b, waiting)}
                actions={
                  <EngineRunAction icon="inbox" onClick={() => navigate(check)}>
                    Open Check
                  </EngineRunAction>
                }
              />
            );
          })}
        </div>
      )}
    </Section>
  );
}

function batchSteps(b: Batch, waiting: number) {
  const done = b.state === "done";
  const tiles = Array.from({ length: Math.min(b.total, 4) }, (_, i) =>
    i < b.previews.length
      ? {
          state: "done" as const,
          src: b.previews[i],
          format: b.format === "story" ? ("story" as const) : ("feed" as const),
        }
      : {
          state: i === b.previews.length && !done ? ("active" as const) : ("pending" as const),
        },
  );
  return [
    {
      label: "Making",
      state: done ? ("done" as const) : ("active" as const),
      progress: {
        made: b.made,
        total: b.total,
        label: `${b.made} of ${b.total} made`,
      },
      tiles,
    },
    {
      // Where it is, in numbers Check also shows: never "waiting" for something Check does not hold.
      label: "Check",
      state: !done ? ("pending" as const) : waiting ? ("active" as const) : ("done" as const),
      detail: done
        ? waiting
          ? `${copy.creatives(waiting)} waiting for a check`
          : "Nothing waits for a check"
        : undefined,
    },
  ];
}

const counts = [1, 2, 4, 6, 8, 12];
const formats: Format[] = ["feed", "square", "story"];

/** "none:w-lysne": the product page of a brand, no campaign. */
const NONE = "none:";

/** Make a batch: for the product page (first, no campaign) or a campaign; mode, products or a collection, count per
 *  product, format. The Engine runs it; what it makes lands in Check. */
function BatchDialog({
  rows,
  workspaceIds,
  open,
  onOpenChange,
}: {
  rows: StudioCampaignRow[];
  workspaceIds: Id[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const session = useSession().data!;
  const brandOf = (id: Id) =>
    rows.find((r) => r.workspace.id === id)?.workspace ?? session.workspaces.find((w) => w.id === id);
  const several = workspaceIds.length > 1;
  const live = rows.filter((r) => !["approved", "delivered", "closed"].includes(r.campaign.state));
  // For the product page unless the designer picks a campaign.
  const [target, setTarget] = useState(() => `${NONE}${workspaceIds[0] ?? rows[0]!.workspace.id}`);
  const row = target.startsWith(NONE) ? undefined : rows.find((r) => r.campaign.id === target);
  const campaign = row?.campaign;
  const workspace = row?.workspace ?? brandOf(target.slice(NONE.length)) ?? rows[0]!.workspace;
  const modes = (useStudioModes().data ?? []).filter(
    (m) => m.studio === "render" && m.output === "creative" && m.available,
  );
  const products = useStudioKit(workspace.id).data?.products ?? [];
  // The brand's collections, when the session can read that brand's catalogue.
  const collections = (useCatalogue().data?.collections ?? []).filter(
    (c) => c.workspaceId === workspace.id && c.productIds.length > 0,
  );
  const start = useStartBatch();
  const toast = useToast();
  const [modeId, setModeId] = useState("m-packshot");
  const [by, setBy] = useState<"products" | "collection">("products");
  const [picked, setPicked] = useState<string[]>(() => campaign?.productIds ?? []);
  const pickCampaign = (id: string) => {
    setTarget(id);
    setPicked(rows.find((r) => r.campaign.id === id)?.campaign.productIds ?? []);
  };
  const [collectionId, setCollectionId] = useState<string>();
  const [perProduct, setPerProduct] = useState(4);
  const [format, setFormat] = useState<Format>("square");

  const mode = modes.find((m) => m.id === modeId) ?? modes[0];
  const collection = collections.find((c) => c.id === (collectionId ?? collections[0]?.id));
  const productIds =
    by === "collection" ? (collection?.productIds ?? []) : picked.filter((id) => products.some((p) => p.id === id));
  const total = productIds.length * perProduct;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!mode || total === 0) return;
    start.mutate(
      {
        campaignId: campaign?.id ?? "",
        modeId: mode.id,
        productIds,
        collectionId: by === "collection" ? collection?.id : undefined,
        perProduct,
        format,
      },
      {
        onSuccess: () => {
          toast.done(`The Engine is making ${made(mode, total)}`, {
            description: `For ${campaign ? campaign.name : `${workspace.brandName}’s product page`}. They land in Check as they are made.`,
          });
          onOpenChange(false);
        },
        onError: (e) => toast.error("The batch didn’t start", { description: e.message }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Make a batch</DialogTitle>
          <DialogDescription>The Engine makes them for {workspace.brandName} and they land in Check.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="make-batch" onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="batch-campaign">Campaign</FieldLabel>
                <NativeSelect
                  id="batch-campaign"
                  value={target}
                  onChange={(e) => pickCampaign(e.target.value)}
                  data-ui-autofocus
                >
                  {workspaceIds.map((id) => (
                    <option key={`${NONE}${id}`} value={`${NONE}${id}`}>
                      {several ? `${brandOf(id)?.brandName ?? ""} · ` : ""}No campaign (product page)
                    </option>
                  ))}
                  {live.map((r) => (
                    <option key={r.campaign.id} value={r.campaign.id}>
                      {several ? `${r.workspace.brandName} · ` : ""}
                      {r.campaign.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="batch-mode">Mode</FieldLabel>
                <NativeSelect id="batch-mode" value={mode?.id ?? ""} onChange={(e) => setModeId(e.target.value)}>
                  {modes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>

              {collections.length > 0 && (
                <SegmentedControl
                  className="ui-seg-hug"
                  aria-label="Make it for"
                  value={by}
                  onValueChange={(v) => setBy(v as "products" | "collection")}
                >
                  <SegmentedOption value="products">Products</SegmentedOption>
                  <SegmentedOption value="collection">A collection</SegmentedOption>
                </SegmentedControl>
              )}

              {by === "collection" && collections.length > 0 ? (
                <FieldSet>
                  <FieldLegend variant="label">Collection</FieldLegend>
                  <PickGrid size="sm" aria-label="Collection">
                    {collections.map((c) => (
                      <PickTile
                        key={c.id}
                        title={c.name}
                        line={copy.count(c.productIds.length, "product")}
                        src={c.cover}
                        images={c.productIds
                          .map((id) => products.find((p) => p.id === id)?.images[0])
                          .filter((x): x is string => Boolean(x))}
                        icon="layers"
                        selected={collection?.id === c.id}
                        onSelectedChange={() => setCollectionId(c.id)}
                      />
                    ))}
                  </PickGrid>
                </FieldSet>
              ) : (
                <FieldSet>
                  <FieldLegend variant="label">Products {picked.length > 0 && `· ${picked.length} picked`}</FieldLegend>
                  <PickGrid size="sm" aria-label="Products">
                    {products.map((p) => (
                      <ProductTile
                        key={p.id}
                        name={p.name}
                        variant={p.variant}
                        src={p.images[0]}
                        selected={picked.includes(p.id)}
                        onSelectedChange={(on) =>
                          setPicked((now) => (on ? [...now, p.id] : now.filter((id) => id !== p.id)))
                        }
                      />
                    ))}
                  </PickGrid>
                </FieldSet>
              )}

              <Field>
                <FieldLabel htmlFor="batch-count">Count per product</FieldLabel>
                <NativeSelect
                  id="batch-count"
                  value={String(perProduct)}
                  onChange={(e) => setPerProduct(Number(e.target.value))}
                >
                  {counts.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </NativeSelect>
              </Field>

              <Field>
                <FieldLabel as="span" id="batch-format">
                  Format
                </FieldLabel>
                <SegmentedControl
                  className="ui-seg-hug"
                  aria-labelledby="batch-format"
                  aria-label="Format"
                  value={format}
                  onValueChange={(v) => setFormat(v as Format)}
                >
                  {formats.map((f) => (
                    <SegmentedOption key={f} value={f}>
                      {formatName(f)}
                    </SegmentedOption>
                  ))}
                </SegmentedControl>
              </Field>
            </FieldGroup>
          </form>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="glass-clear">Later</Button>
          </DialogClose>
          <Button
            type="submit"
            form="make-batch"
            variant="glass-white"
            icon="fume-engine"
            loading={start.isPending}
            disabled={total === 0}
          >
            {total === 0 ? "Pick a product" : `Make ${made(mode, total)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
