// One delivery (FLOWS §3.2): the approved creatives, grouped by collection › product › direction, masters before their
// variants and each in its formats; the rights that come with them; and the download. Each creative carries the name
// she approved it under ("Night Body Oil · Feed"), with the file name that lands on her disk as a small data line under
// it. Its 72 px thumbnail previews at about 320 px under the mouse and opens the creative in the viewer.
// Download all is one zip (download.ts); "By format" shows only with two formats or more. No State column: a delivery
// only holds approved creatives. Once it is downloaded, "Confirm it is live" tells Fume, which closes the loop for
// Creative Memory.
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Icon,
  Button,
  PageHeader,
  Progress,
  ProgressField,
  ProgressHead,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableCreativeThumb,
  TableHead,
  TableHeader,
  TableRow,
  TableTitle,
  useToast,
} from "@fume/ui";
import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useCampaign, useCatalogue, useConfirmLive, useDelivery, useSession } from "../../api/hooks";
import type { Campaign, Creative, Format } from "../../contract";
import * as copy from "../../copy";
import { bytes } from "../../lib/time";
import { Back, Page, Query, Section } from "../../shell/Page";
import { useCustomerNames } from "../review/names";
import { canTake, DeliveryBadge } from "./parts";
import { deliveryTree, type CollectionGroup } from "./grouping";
import { useDeliveryDownload, type DownloadKey } from "./download";

const FORMAT_ORDER: Format[] = ["feed", "square", "story"];

export function DeliveryPage() {
  const { deliveryId } = useParams<"deliveryId">();
  const session = useSession().data!;
  const delivery = useDelivery(deliveryId);
  const catalogue = useCatalogue();
  const campaignView = useCampaign(delivery.data?.campaign.id);
  const confirm = useConfirmLive();
  const toast = useToast();
  const may = canTake(session.role);
  // Which download is on its way (all, a format or one creative), and what this person has taken in this visit.
  const dl = useDeliveryDownload(
    deliveryId,
    delivery.data?.delivery.bytes ?? 0,
    delivery.data?.creatives.length ?? 0,
    delivery.data?.delivery.name,
  );
  const taken = dl.taken.size > 0;
  const fetching = dl.job?.key ?? null;
  // While Fume packs a new delivery, look again every few seconds until it is ready.
  const preparing = delivery.data?.delivery.state === "preparing";
  const { refetch } = delivery;
  useEffect(() => {
    if (!preparing) return;
    const timer = setInterval(() => refetch(), 2000);
    return () => clearInterval(timer);
  }, [preparing, refetch]);

  const all = delivery.data?.creatives ?? [];
  const download = (format?: Format) =>
    dl.start(format ?? "all", format ? all.filter((c) => c.format === format) : all);

  const name = delivery.data?.delivery.name ?? "Delivery";

  return (
    <Page title={name}>
      <PageHeader
        title={name}
        back={<Back to="/deliveries" label="Deliveries" />}
        meta={
          delivery.data
            ? [
                delivery.data.campaign.name,
                copy.creatives(delivery.data.delivery.creativeIds.length),
                bytes(delivery.data.delivery.bytes),
              ]
            : undefined
        }
        primaryAction={
          may && delivery.data && delivery.data.delivery.state !== "preparing"
            ? { label: "Download all", icon: "download", busy: fetching === "all", onSelect: () => download() }
            : undefined
        }
      />

      <Query query={delivery}>
        {({ delivery: d, creatives, campaign }) => {
          const formats = FORMAT_ORDER.map((f) => [f, creatives.filter((c) => c.format === f).length] as const).filter(
            ([, n]) => n > 0,
          );
          const tree = deliveryTree(d, creatives, campaign, catalogue.data, campaignView.data?.directions ?? []);
          const live = d.state === "confirmed_live";
          return (
            <div className="ui-app-cols">
              <div className="ui-app-stack">
                {tree.map((group) => (
                  <CollectionSection
                    key={group.collection?.id ?? "none"}
                    group={group}
                    campaign={campaign}
                    counted={tree.length > 1}
                    take={may && d.state !== "preparing" ? (c) => dl.start(`creative:${c.id}`, [c]) : undefined}
                    taken={dl.taken}
                  />
                ))}
              </div>

              <aside className="ui-app-stack" aria-label="About this delivery">
                <Section title="Where it stands" titleId="delivery-state">
                  <div className="ui-app-row">
                    <DeliveryBadge state={d.state} />
                  </div>
                  {(d.state === "preparing" || live) && (
                    <p className="ui-app-section-text">
                      {d.state === "preparing"
                        ? "Fume is naming and packing the creatives. It is ready to download soon."
                        : "You told Fume this delivery is live."}
                    </p>
                  )}
                  {dl.job && (
                    <ProgressField>
                      <ProgressHead
                        labelId="delivery-progress"
                        label={
                          dl.job.key === "all"
                            ? "Preparing every creative"
                            : `Preparing ${copy.format[dl.job.key as Format]?.label ?? "the creatives"}`
                        }
                        num={`${dl.job.progress} %`}
                      />
                      <Progress value={dl.job.progress} aria-labelledby="delivery-progress" />
                    </ProgressField>
                  )}
                  {!dl.job && taken && (
                    <p className="ui-app-section-text">
                      <Icon name="circle-check" />{" "}
                      {dl.taken.has("all")
                        ? `Every creative downloaded, ${bytes(d.bytes)}.`
                        : "Downloaded in this visit."}
                    </p>
                  )}
                  {may && !live && d.state !== "preparing" && (
                    <div className="ui-app-row">
                      <Button
                        variant="secondary"
                        icon="check"
                        loading={confirm.isPending}
                        onClick={() =>
                          confirm.mutate(d.id, { onSuccess: () => toast.done(`${campaign.name} is live`) })
                        }
                      >
                        Confirm it is live
                      </Button>
                    </div>
                  )}
                  {!may && (
                    <p className="ui-app-section-text">
                      Viewers see deliveries. The owner, approvers and members download them.
                    </p>
                  )}
                </Section>

                {may && d.state !== "preparing" && formats.length > 1 && (
                  <Section
                    title="By format"
                    titleId="delivery-formats"
                    text="Each format in its own download, named for where it goes."
                  >
                    <div className="ui-app-row">
                      {formats.map(([format, n]) => (
                        <Button
                          key={format}
                          variant="secondary"
                          size="sm"
                          icon={dl.taken.has(format) ? "check" : "download"}
                          loading={fetching === format}
                          disabled={Boolean(fetching) && fetching !== format}
                          onClick={() => download(format)}
                        >
                          {copy.format[format].label} {copy.format[format].ratio} · {n}
                        </Button>
                      ))}
                    </div>
                  </Section>
                )}

                <Section title="Rights" titleId="delivery-rights">
                  <Alert variant="info" icon="lock">
                    <AlertTitle>What you may use them for</AlertTitle>
                    <AlertDescription>{d.rightsNote}</AlertDescription>
                  </Alert>
                </Section>
              </aside>
            </div>
          );
        }}
      </Query>
    </Page>
  );
}

/** One collection of the delivery: its products, each with its directions and their creatives. */
interface Take {
  /** Downloads one creative; left out for viewers and while Fume packs. */
  take?: (c: Creative) => void;
  taken: Set<DownloadKey>;
}

function CollectionSection({
  group,
  campaign,
  counted,
  take,
  taken,
}: { group: CollectionGroup; campaign: Campaign; counted: boolean } & Take) {
  const id = `delivery-${group.collection?.id ?? "campaign"}`;
  const products = group.products.length > 1;
  return (
    <Section
      title={group.collection?.name ?? "Whole campaign"}
      meta={counted ? copy.creatives(group.count) : undefined}
      titleId={id}
    >
      <div className="ui-delivery-tree">
        {group.products.map((p) => (
          <div key={p.productId ?? "all"} className="ui-delivery-product">
            <div className="ui-delivery-product-head">
              <span className="ui-delivery-product-thumb">
                {p.product?.images[0] ? <img src={p.product.images[0]} alt="" /> : <Icon name="package" />}
              </span>
              <div>
                <h3 className="ui-delivery-product-title">{p.product?.name ?? "The campaign’s products"}</h3>
                {(p.product?.variant || products) && (
                  <p className="ui-delivery-meta">
                    {[p.product?.variant, products ? copy.creatives(p.count) : undefined].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
            {p.directions.map((dir) => (
              <div key={dir.directionId} className="ui-delivery-direction">
                <h4 className="ui-delivery-direction-title">
                  {dir.direction ? `Direction ${dir.direction.letter} · ${dir.direction.name}` : "Direction"}
                  {p.directions.length > 1 && <span className="ui-delivery-meta">{dir.creatives.length}</span>}
                </h4>
                <CreativeTable creatives={dir.creatives} campaign={campaign} take={take} taken={taken} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Where the preview stands: beside the thumbnail under the mouse, inside the screen. */
interface Preview {
  src: string;
  format: Format;
  x: number;
  y: number;
}

const PREVIEW_HEIGHT = 400; // the preview's height in px (delivery-tree.css: .ui-delivery-preview), 320 wide for a Feed
const PREVIEW_GAP = 16;

/** A direction's creatives, masters first, each under the customer's name with its file name (the data face). The
 *  72 px thumbnail opens the creative in the viewer; under a mouse it previews at about 320 px beside the row. */
function CreativeTable({ creatives, campaign, take, taken }: { creatives: Creative[]; campaign: Campaign } & Take) {
  const named = useCustomerNames(campaign);
  const [preview, setPreview] = useState<Preview | null>(null);
  useEffect(() => {
    if (!preview) return;
    const close = () => setPreview(null);
    window.addEventListener("scroll", close, { capture: true, once: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [preview]);
  const show = (e: ReactPointerEvent<HTMLElement>, c: Creative) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const y = Math.min(
      Math.max(PREVIEW_GAP, r.top + r.height / 2 - PREVIEW_HEIGHT / 2),
      window.innerHeight - PREVIEW_HEIGHT - PREVIEW_GAP,
    );
    setPreview({ src: c.current.image, format: c.format, x: r.right + PREVIEW_GAP, y });
  };
  return (
    <>
      <TableContainer>
        <Table className="ui-delivery-table">
          <TableHeader>
            <TableRow>
              <TableHead>
                <span className="ui-sr-only">Preview</span>
              </TableHead>
              <TableHead>Creative</TableHead>
              <TableHead>Shape</TableHead>
              {take && (
                <TableHead>
                  <span className="ui-sr-only">Download</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {creatives.map(named).map((c) => (
              <TableRow key={c.id}>
                <TableCell media>
                  <Link
                    className="ui-delivery-thumb"
                    to={`/review/${campaign.id}/c/${c.id}`}
                    aria-label={`Open ${c.title}`}
                    onPointerEnter={(e) => show(e, c)}
                    onPointerLeave={() => setPreview(null)}
                    onClick={() => setPreview(null)}
                  >
                    <TableCreativeThumb src={c.current.image} alt="" data-format={c.format} />
                  </Link>
                </TableCell>
                <TableCell>
                  <TableTitle sub={<span className="ui-delivery-name">{c.name}</span>}>
                    {c.current.number > 1 ? `${c.title} · version ${c.current.number}` : c.title}
                  </TableTitle>
                </TableCell>
                <TableCell trail>
                  <TableTitle sub={copy.format[c.format].size}>{copy.format[c.format].ratio}</TableTitle>
                </TableCell>
                {take && (
                  <TableCell actions>
                    <Button
                      variant="quiet"
                      size="sm"
                      iconOnly
                      icon={taken.has(`creative:${c.id}`) ? "check" : "download"}
                      aria-label={`Download ${c.title}, ${copy.format[c.format].label}`}
                      onClick={() => take(c)}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {preview && (
        <div
          className="ui-delivery-preview"
          data-format={preview.format}
          style={{ "--preview-x": `${preview.x}px`, "--preview-y": `${preview.y}px` } as CSSProperties}
          aria-hidden="true"
        >
          <img src={preview.src} alt="" />
        </div>
      )}
    </>
  );
}
