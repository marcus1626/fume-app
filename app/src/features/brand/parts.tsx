// What the Brand DNA screens share: who may change what, the words for areas, kinds and sources, the breadcrumb,
// the upload of brand material and the dialog that adds a product. Every fact on these screens says where it came
// from (Product Vision §4.2), so the source words live here once and read the same on every page.
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Dropzone,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldOptional,
  Icon,
  Input,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemMediaImage,
  ItemTitle,
  useToast,
  type DropzoneItem,
  type IconName,
} from "@fume/ui";
import { createContext, useContext, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useCampaigns, usePeople, useSession, useUploadAssets } from "../../api/hooks";
import type {
  BrandDna,
  BrandDnaView,
  BrandRule,
  Confidence,
  FactSource,
  Product,
  ProductFactArea,
  RuleArea,
  SourceAsset,
  SourceAssetKind,
  User,
} from "../../contract";
import * as copy from "../../copy";
import { bytes, date } from "../../lib/time";
import { directory, firstName } from "../../shell/people";
import { useAddProduct } from "./hooks";

// ─── Who may do what ────────────────────────────────────────────────────────

/** Owner, approver and member teach Fume the brand; only owner and approver approve it; a viewer reads. */
export function useRole() {
  const session = useSession().data!;
  const role = session.role;
  return {
    role,
    me: session.user.id,
    canEdit: role === "owner" || role === "approver" || role === "member",
    canApprove: role === "owner" || role === "approver",
  };
}

/**
 * Round 13 (robots' notes, 08-studio-brand): who reads a brand page. The brand's own people read "your" and "you";
 * Fume's people and an agency's read the brand's name and the person's ("LYSNE's taste", "Maja said"), never the
 * customer's own voice.
 */
export function useViewer() {
  const session = useSession().data!;
  const staff = Boolean(session.user.staffRole || session.user.agency);
  const brand = session.workspace.brandName;
  return { staff, brand, your: staff ? `${brand}’s` : "your", Your: staff ? `${brand}’s` : "Your" };
}

/**
 * An AI person Fume saved waits until the first campaign introduces it (ONB-8): before any campaign, Home, the
 * check flow (/brand/check) and the board all hold saved models back, so their counts agree.
 */
export function useModelsHeldBack(): boolean {
  const campaigns = useCampaigns();
  return campaigns.data !== undefined && campaigns.data.length === 0;
}

/** The first name of Fume's expert on this workspace, for "Anna checks every line"; never a made-up name. */
export function useExpertName(): string {
  const expert = usePeople().data?.find((u) => u.staffRole === "expert");
  return expert ? firstName(expert.name) : "Fume's expert";
}

// ─── The Brand page's header actions (round 9, DLAY-13) ────────────────────────
// Brand is one page with three tabs, so one header: a tab's page-level action (Brand DNA's "Confirm 7 finds",
// Products' "Confirm 7 products" with Import and Add as quiet pills to its left) is drawn in that header, right, on
// the title's baseline. A tab's content renders its actions inside <BrandHeaderActions>; the page provides the place.

const BrandHeaderSlot = createContext<HTMLElement | null>(null);
/** BrandBoardPage provides the element in its header's actions. */
export const BrandHeaderSlotProvider = BrandHeaderSlot.Provider;

/** A tab's page-level actions, drawn in the Brand page's header (one Ink at most, the rest secondary or quiet). */
export function BrandHeaderActions({ children }: { children: ReactNode }) {
  const el = useContext(BrandHeaderSlot);
  return el ? createPortal(children, el) : null;
}

// ─── Words ──────────────────────────────────────────────────────────────────

export const ruleArea: Record<RuleArea, string> = {
  logo: "Logo",
  colour: "Colour",
  type: "Type",
  voice: "Voice",
  layout: "Layout",
  imagery: "Imagery",
  claims: "Claims",
};
export const ruleAreas = Object.keys(ruleArea) as RuleArea[];

export const ruleKind: Record<BrandRule["kind"], string> = {
  hard_constraint: "Never broken",
  rule: "Rule",
  preference: "Preference, can bend for a campaign",
};

export const factArea: Record<ProductFactArea, string> = {
  shape: "Shape",
  colour: "Colour",
  material: "Material",
  label: "Label",
  packaging: "Packaging",
  claim: "Claims",
  never: "Never",
};

export const confidence: Record<Confidence, string> = {
  high: "Fume is sure",
  medium: "Fume is fairly sure",
  low: "Fume is not sure",
};

export const dnaState: Record<BrandDna["state"], string> = {
  draft: "Draft",
  in_review: "Waiting for approval",
  approved: "Approved",
};

export const productState: Record<Product["state"], string> = {
  draft: "Fume is reading it",
  needs_you: "Waiting on you",
  verified: "Confirmed",
};

export const assetKind: Record<SourceAssetKind, { label: string; icon: IconName }> = {
  logo: { label: "Logo", icon: "image" },
  guideline: { label: "Guidelines", icon: "file-text" },
  packshot: { label: "Packshot", icon: "camera" },
  campaign: { label: "Earlier campaign", icon: "megaphone" },
  font: { label: "Font", icon: "type" },
  other: { label: "Brand material", icon: "paperclip" },
};

/**
 * Where a fact came from, in words. What the customer gave or confirmed needs no confidence; what Fume read or
 * learned says how sure it is. A confirmation names who made it.
 */
export function sourceWords(
  fact: { source: FactSource; confidence?: Confidence; verifiedBy?: string; verifiedAt?: string },
  ctx?: { me?: string; people?: (id?: string) => User | undefined },
): string {
  if (fact.source === "verified" && fact.verifiedBy) {
    const who = fact.verifiedBy === ctx?.me ? copy.factSource.verified : `Confirmed by ${firstName(ctx?.people?.(fact.verifiedBy)?.name ?? "your team")}`;
    return fact.verifiedAt ? `${who}, ${date(fact.verifiedAt)}` : who;
  }
  const words: string = copy.factSource[fact.source];
  if (fact.source === "supplied" || fact.source === "verified" || fact.source === "unknown" || !fact.confidence) return words;
  return `${words}. ${confidence[fact.confidence]}`;
}

/** What the customer gave or confirmed: it needs no provenance on screen (LOAD-9, round 8). */
export const isConfirmed = (source: FactSource) => source === "supplied" || source === "verified";

/**
 * The line under a rule: how strict it is (a hard constraint says so with its badge instead) and, only while Fume
 * has not had it confirmed, where it came from. A rule you gave or confirmed shows no provenance (LOAD-9).
 */
export function ruleLine(rule: BrandRule): string | undefined {
  const where: Partial<Record<FactSource, string>> = {
    inferred: "Fume read this",
    learned: "Learned from your decisions",
    campaign: "For one campaign",
    unknown: "Fume needs this from you",
  };
  const source = isConfirmed(rule.source) ? "" : `${where[rule.source] ?? ""}${rule.confidence === "low" ? ", not sure yet" : ""}`;
  const parts = [rule.kind === "preference" ? "Can bend for a campaign" : "", source].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

/** The approval line: "Version 3 · Maja approved · 5 Oct" (never "Approved by"), or the state when it is not approved yet. */
export function versionLine(dna: BrandDna, name: (id?: string) => string, me?: string): string {
  if (dna.state === "approved" && dna.approvedAt) {
    const who = dna.approvedBy === me ? "You" : name(dna.approvedBy);
    return `Version ${dna.version} · ${who} approved · ${date(dna.approvedAt)}`;
  }
  return dna.version > 0 ? `Version ${dna.version}, ${dnaState[dna.state].toLowerCase()}` : "Not approved yet";
}

/** What Fume still needs, across Brand DNA: open questions in the comprehension check and open product lines. */
export function needs(view: BrandDnaView) {
  const questions = view.understanding.unknowns.filter((u) => !u.answer);
  const products = view.products.filter((p) => p.state === "needs_you" || p.facts.some((f) => f.source === "unknown"));
  return { questions, products, total: questions.length + products.length };
}

/** "6 lines, all yours or confirmed" or "3 of 4 lines to confirm". */
export function factsLine(p: Product): string {
  if (p.facts.length === 0) return "Fume is reading it";
  const open = p.facts.filter((f) => f.source !== "verified" && f.source !== "supplied").length;
  return open === 0 ? `${copy.count(p.facts.length, "line")}, all yours or confirmed` : `${open} of ${copy.count(p.facts.length, "line")} to confirm`;
}

/** A product's state as a badge: confirmed, needs you, or Fume is reading it. */
export function ProductBadge({ product }: { product: Product }) {
  if (product.state === "verified") return <Badge icon="circle-check">{productState.verified}</Badge>;
  if (product.state === "needs_you") return <Badge variant="ink">{productState.needs_you}</Badge>;
  return <Badge dot="live">{productState.draft}</Badge>;
}

// ─── Brand material ─────────────────────────────────────────────────────────

const FONT = /\.(otf|ttf|woff2?)$/i;

/** A first guess at what a piece of brand material is, from its name and type. Fume reads it properly after. */
function kindOf(file: File): SourceAssetKind {
  const name = file.name.toLowerCase();
  if (FONT.test(name)) return "font";
  if (/logo|wordmark|\bmark\b/.test(name)) return "logo";
  if (name.endsWith(".pdf")) return /campaign/.test(name) ? "campaign" : "guideline";
  if (/campaign|kampanje/.test(name) || file.type.startsWith("video/")) return "campaign";
  if (file.type.startsWith("image/")) return "packshot";
  return "other";
}

/** The upload box for logos, guidelines, packshots and earlier campaigns. What lands shows in the list below it. */
export function SourceUpload({ brand }: { brand: string }) {
  const upload = useUploadAssets();
  const toast = useToast();
  const [items, setItems] = useState<DropzoneItem[]>([]);

  function add(files: File[]) {
    const batch = files.map((f, i) => ({ id: `up-${Date.now()}-${i}`, name: f.name, bytes: f.size, state: "uploading" as const }));
    setItems((now) => [...now, ...batch]);
    const ids = new Set(batch.map((b) => b.id));
    upload.mutate(
      files.map((f) => ({ name: f.name, bytes: f.size, kind: kindOf(f) })),
      {
        onSuccess: () => {
          setItems((now) => now.filter((x) => !ids.has(x.id)));
          toast.done(`${copy.count(files.length, "piece", "pieces")} of brand material added`, { description: "Fume reads them and tells you what it finds." });
        },
        onError: (error) =>
          setItems((now) => now.map((x) => (ids.has(x.id) ? { ...x, state: "error", error: error.message || "This didn’t arrive. Try again." } : x))),
      },
    );
  }

  return (
    <Dropzone
      items={items}
      grid={false}
      onFiles={add}
      onRemove={(id) => setItems((now) => now.filter((x) => x.id !== id))}
      accept="image/*,video/*,.pdf,.svg,.otf,.ttf,.woff,.woff2,.zip"
      maxBytes={200_000_000}
      maxLabel="200 MB"
      target={`${brand}’s Brand DNA`}
      copy="Drop logos, guidelines, packshots and earlier campaigns here, or choose them"
      touchCopy="Tap to choose logos, guidelines and packshots"
      moreCopy="Add more brand material"
      meta="PDF, images, video or fonts · up to 200 MB"
      listLabel="Brand material on its way in"
    />
  );
}

/** The brand material Fume has, each with who added it and when. */
export function SourceList({ assets, people, me }: { assets: SourceAsset[]; people: User[] | undefined; me: string }) {
  const dir = directory(people);
  const sorted = [...assets].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <ItemGroup as="ul" aria-label="Brand material">
      {sorted.map((a) => (
        <Item key={a.id} as="li" size="sm">
          {a.thumbnail ? (
            <ItemMedia variant="image">
              <ItemMediaImage src={a.thumbnail} alt="" />
            </ItemMedia>
          ) : (
            <ItemMedia variant="icon">
              <Icon name={assetKind[a.kind].icon} />
            </ItemMedia>
          )}
          <ItemContent>
            <ItemTitle>{a.name}</ItemTitle>
            <ItemDescription>
              {assetKind[a.kind].label}, {bytes(a.bytes)}. Added by {a.uploadedBy === me ? "you" : dir.name(a.uploadedBy)} on {date(a.at)}
            </ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}

// ─── A new product ──────────────────────────────────────────────────────────

/** Name, variant and an optional page: Fume reads the Product Truth from it, and you confirm every line after. */
export function AddProductDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: (product: Product) => void;
}) {
  const add = useAddProduct();
  const toast = useToast();
  const [name, setName] = useState("");
  const [variant, setVariant] = useState("");
  const [url, setUrl] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    add.mutate(
      { name: name.trim(), variant: variant.trim(), url: url.trim() || undefined },
      {
        onSuccess: (product) => {
          toast.done(`${product.name} added`, { description: "Fume reads it now. Confirm each line once it is there." });
          setName("");
          setVariant("");
          setUrl("");
          onOpenChange(false);
          onAdded?.(product);
        },
        onError: (error) => toast.error("The product wasn’t added", { description: error.message }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a product</DialogTitle>
          <DialogDescription>
            Fume reads what it can from the product page. Nothing is used in a creative until you confirm it.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="add-product" onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="product-name">Name</FieldLabel>
                <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Night Body Oil" required data-ui-autofocus />
              </Field>
              <Field>
                <FieldLabel htmlFor="product-variant">
                  Size or variant <FieldOptional />
                </FieldLabel>
                <Input id="product-variant" value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="100 ml" />
              </Field>
              <Field>
                <FieldLabel htmlFor="product-url">
                  Product page <FieldOptional />
                </FieldLabel>
                <Input id="product-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" aria-describedby="product-url-help" />
                <FieldDescription id="product-url-help">A page alone does not make it true: you confirm every line after.</FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="glass-clear">Later</Button>
          </DialogClose>
          <Button type="submit" form="add-product" variant="glass-white" loading={add.isPending} disabled={!name.trim()}>
            Add the product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
