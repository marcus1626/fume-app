// Round 13 (walk-through 21 Oct, #3; PROPOSED 22 Oct 2026): Fume sorts the pictures it found into groups, so a look
// that was only for one campaign never steers every creative: Your look (lasting), Campaign looks (temporary, each
// named after its campaign or season), Product shots, Not used. She moves a picture to another group from its Move
// menu. The same groups in the onboarding's Imagery part and on the Brand DNA board. The look is r13-brand.css.
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, useToast } from "@fume/ui";
import type { BrandImage, ImageGroup } from "../../contract";
import { useMoveImage } from "../../api/hooks";

export const imageGroups: ImageGroup[] = ["look", "campaign", "product", "unused"];

export const imageGroupTitle: Record<ImageGroup, string> = {
  look: "Your look",
  campaign: "Campaign looks",
  product: "Product shots",
  unused: "Not used",
};

export const imageGroupLine: Record<ImageGroup, string> = {
  look: "Lasting: the light and setting every creative starts from.",
  campaign: "Only for the campaign or season they were made for. Fume uses them when you ask.",
  product: "Your products as they are. Fume uses them to get each product right, never as a look.",
  unused: "Fume leaves these out of your creatives.",
};

const groupOf = (i: BrandImage): ImageGroup => i.group ?? "look";

/** The pictures by group, in the groups' order; empty groups are left out. */
export function byGroup<T extends BrandImage>(list: T[]): { group: ImageGroup; items: T[] }[] {
  return imageGroups.map((group) => ({ group, items: list.filter((i) => groupOf(i) === group) })).filter((g) => g.items.length > 0);
}

/** The campaigns the brand's campaign looks belong to, for the Move menu. */
export const campaignsOf = (list: BrandImage[]) => [...new Set(list.map((i) => i.campaign).filter((c): c is string => Boolean(c)))];

/** "Campaign look · Spring relaunch 2026", the line a picture carries under its name. */
export const groupWords = (i: BrandImage) => (groupOf(i) === "campaign" && i.campaign ? `Campaign look · ${i.campaign}` : imageGroupTitle[groupOf(i)]);

/** Move a picture to another group: the other groups, and each campaign by name. */
export function MoveImage({ image, campaigns, disabled }: { image: BrandImage; campaigns: string[]; disabled?: boolean }) {
  const move = useMoveImage();
  const toast = useToast();
  const here = groupOf(image);
  const to = (group: ImageGroup, campaign?: string) =>
    move.mutate(
      { imageId: image.id, group, campaign },
      {
        onSuccess: () => toast.done(`${image.caption} moved`, { description: group === "campaign" && campaign ? `To Campaign looks · ${campaign}.` : `To ${imageGroupTitle[group]}.` }),
        onError: (error) => toast.error("The picture wasn’t moved", { description: error.message }),
      },
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="quiet" icon="folder" disabled={disabled || move.isPending} aria-label={`Move ${image.caption} to another group`}>
          Move
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        {here !== "look" && <DropdownMenuItem onSelect={() => to("look")}>{imageGroupTitle.look}</DropdownMenuItem>}
        {campaigns
          .filter((c) => !(here === "campaign" && image.campaign === c))
          .map((c) => (
            <DropdownMenuItem key={c} onSelect={() => to("campaign", c)}>
              Campaign look · {c}
            </DropdownMenuItem>
          ))}
        {here !== "product" && <DropdownMenuItem onSelect={() => to("product")}>{imageGroupTitle.product}</DropdownMenuItem>}
        {here !== "unused" && <DropdownMenuItem onSelect={() => to("unused")}>{imageGroupTitle.unused}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
