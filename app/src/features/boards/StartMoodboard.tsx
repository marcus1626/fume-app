// Start a campaign's moodboard on the spot, from its Moodboard tab (FLOWS §26.2). The moodboard is optional: Fume
// proposes one from the brief and the Brand DNA (her brief's references, the products, the pictures she liked), already
// picked; she takes pictures away, adds more from her boards or her own, and starts it, or skips it. The brief form's
// Inspiration uses the same picker (MoodboardPicker) and seeds the moodboard with it.
import {
  Button,
  CreativeGrid,
  CreativeTile,
  Dropzone,
  FieldLegend,
  FieldOptional,
  FieldSet,
  useToast,
  type DropzoneItem,
} from "@fume/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBoards, useCatalogue, useStartMoodboard } from "../../api/hooks";
import type { Brief, Campaign } from "../../contract";
import * as copy from "../../copy";

export interface MoodboardDraft {
  picked: string[];
  uploads: DropzoneItem[];
}

export const emptyMoodboard: MoodboardDraft = { picked: [], uploads: [] };

/** The pictures the new moodboard starts with, in the order they were added. */
export const moodboardImages = (d: MoodboardDraft) => [
  ...d.picked,
  ...d.uploads.filter((u) => u.src).map((u) => u.src!),
];

const FIRST = 8;

/** The brand's pictures to pick from and a drop zone for new ones. Controlled. */
export function MoodboardPicker({
  value,
  onChange,
  optional,
  first,
  legend = "From your boards and products",
}: {
  value: MoodboardDraft;
  onChange: (next: MoodboardDraft) => void;
  optional?: boolean;
  /** Pictures to show first (Fume's proposal), whatever board they come from. */
  first?: string[];
  legend?: string;
}) {
  const boards = useBoards();
  const catalogue = useCatalogue();
  const [all, setAll] = useState(false);

  // The brand's pictures: liked board images first, then product pictures; never a disliked one, never twice.
  const pictures = useMemo(() => {
    const seen = new Set<string>();
    const out: { src: string; from: string }[] = [];
    for (const src of first ?? [])
      if (!seen.has(src)) {
        seen.add(src);
        out.push({ src, from: "Fume’s pick" });
      }
    const add = (src: string | undefined, from: string) => {
      if (src && !seen.has(src)) {
        seen.add(src);
        out.push({ src, from });
      }
    };
    const list = [...(boards.data ?? [])].sort(
      (a, b) => Number(b.kind === "brand_moodboard") - Number(a.kind === "brand_moodboard"),
    );
    for (const b of list)
      for (const item of b.items) if (item.image && item.verdict === "liked") add(item.image, b.name);
    for (const b of list)
      for (const item of b.items) if (item.image && item.verdict !== "disliked") add(item.image, b.name);
    for (const p of catalogue.data?.products ?? []) for (const src of p.images) add(src, p.name);
    return out;
  }, [boards.data, catalogue.data, first]);

  const shown = all ? pictures : pictures.slice(0, FIRST);
  const toggle = (src: string, on: boolean) =>
    onChange({ ...value, picked: on ? [...new Set([...value.picked, src])] : value.picked.filter((x) => x !== src) });

  return (
    <div className="ui-app-stack">
      {pictures.length > 0 && (
        <FieldSet>
          <FieldLegend variant="label">
            {legend} {optional && <FieldOptional />}
          </FieldLegend>
          <CreativeGrid aria-label={`Pictures: ${legend.toLowerCase()}`}>
            {shown.map((img, i) => (
              <CreativeTile
                key={img.src}
                src={img.src}
                ratio={1}
                label={`Picture ${i + 1} from ${img.from}`}
                caption={img.from}
                selected={value.picked.includes(img.src)}
                onSelectedChange={(on) => toggle(img.src, on)}
              />
            ))}
          </CreativeGrid>
          {pictures.length > FIRST && (
            <div className="ui-app-row">
              <Button
                type="button"
                variant="quiet"
                size="sm"
                icon={all ? "chevron-up" : "chevron-down"}
                onClick={() => setAll((a) => !a)}
              >
                {all ? "Show fewer" : `Show all ${pictures.length}`}
              </Button>
            </div>
          )}
        </FieldSet>
      )}
      <FieldSet>
        <FieldLegend variant="label">Add your own {optional && <FieldOptional />}</FieldLegend>
        <Dropzone
          items={value.uploads}
          onFiles={(files) =>
            onChange({
              ...value,
              uploads: [
                ...value.uploads,
                ...files.map((f, i) => ({
                  id: `mb-${Date.now()}-${i}`,
                  name: f.name,
                  bytes: f.size,
                  state: "done" as const,
                  src: URL.createObjectURL(f),
                  kind: "image" as const,
                })),
              ],
            })
          }
          onRemove={(id) => onChange({ ...value, uploads: value.uploads.filter((u) => u.id !== id) })}
          accept="image/jpeg,image/png,image/webp"
          maxBytes={30_000_000}
          maxLabel="30 MB"
          icon="image-plus"
          copy="Drop pictures here or choose them"
          touchCopy="Tap to choose pictures"
          moreCopy="Add more pictures"
          gridLabel="Your pictures"
          target="the moodboard"
          compact
        />
      </FieldSet>
    </div>
  );
}

/** Fume's proposal for a campaign's moodboard: her brief's references, a picture of each product, then the pictures she
 *  liked on her boards; six at most. */
export function useProposedMoodboard(campaign: Campaign, brief?: Brief): { images: string[]; ready: boolean } {
  const boards = useBoards();
  const catalogue = useCatalogue();
  return useMemo(() => {
    const out = new Set<string>(brief?.references ?? []);
    for (const p of catalogue.data?.products ?? [])
      if (campaign.productIds.includes(p.id) && p.images[0]) out.add(p.images[0]);
    const liked = [...(boards.data ?? [])].sort(
      (a, b) => Number(b.kind === "brand_moodboard") - Number(a.kind === "brand_moodboard"),
    );
    for (const b of liked) for (const item of b.items) if (item.image && item.verdict === "liked") out.add(item.image);
    return { images: [...out].slice(0, 6), ready: Boolean(boards.data && catalogue.data) };
  }, [boards.data, catalogue.data, campaign.productIds, brief?.references]);
}

/** A campaign without a moodboard: Fume's proposal picked (with a brief), pick and add pictures, then start it; or skip
 *  it (onSkip) or go back (onCancel). */
export function StartMoodboard({
  campaign,
  brief,
  onCancel,
  onSkip,
  skipping,
}: {
  campaign: Campaign;
  brief?: Brief;
  onCancel?: () => void;
  onSkip?: () => void;
  skipping?: boolean;
}) {
  const [draft, setDraft] = useState<MoodboardDraft>(emptyMoodboard);
  const proposal = useProposedMoodboard(campaign, brief);
  const seeded = useRef(false);
  // Fume's proposal is picked once it is known; what she changes after that is hers.
  useEffect(() => {
    if (seeded.current || !brief || !proposal.ready) return;
    seeded.current = true;
    setDraft((d) => (d.picked.length || d.uploads.length ? d : { ...d, picked: proposal.images }));
  }, [brief, proposal]);
  const start = useStartMoodboard();
  const toast = useToast();
  const images = moodboardImages(draft);
  return (
    <div className="ui-app-stack">
      <MoodboardPicker value={draft} onChange={setDraft} first={brief ? proposal.images : undefined} />
      <div className="ui-app-row ui-app-row--end">
        {onSkip && (
          <Button type="button" variant="quiet" loading={skipping} onClick={onSkip}>
            Skip the moodboard
          </Button>
        )}
        {onCancel && (
          <Button type="button" variant="quiet" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="button"
          icon="layers"
          loading={start.isPending}
          disabled={images.length === 0}
          onClick={() =>
            start.mutate(
              { campaignId: campaign.id, images },
              {
                onSuccess: () =>
                  toast.done(`${campaign.name} has its moodboard`, {
                    description: `It starts with ${copy.count(images.length, "picture")}. Keep adding to it any time.`,
                  }),
                onError: (e) => toast.error("The moodboard didn’t start", { description: e.message }),
              },
            )
          }
        >
          {images.length ? `Start with ${copy.count(images.length, "picture")}` : "Pick a picture first"}
        </Button>
      </div>
    </div>
  );
}
