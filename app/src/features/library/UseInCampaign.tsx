// A real photograph becomes a creative (FLOWS §38.4): the checked picks go into one of the brand's open campaigns,
// each as a creative whose first version is the photograph itself. From there it takes the way every creative takes:
// graphic design (§33), the formats (§16), copy (§31), an expert's check and the customer's approval.
import {
  Button,
  CreativeGrid,
  CreativeTile,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  useToast,
} from "@fume/ui";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useShootInCampaign, useStudioCampaigns } from "../../api/hooks";
import type { Id, Shoot } from "../../contract";
import * as copy from "../../copy";
import { pad, sortOf } from "../../domain/shoot";
import { docHref, useFrameKind } from "../../shell/scope";

export function UseInCampaign({
  shoot,
  open,
  onOpenChange,
}: {
  shoot: Shoot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const frame = useFrameKind();
  const navigate = useNavigate();
  const toast = useToast();
  const use = useShootInCampaign();
  const campaigns = (useStudioCampaigns().data ?? [])
    .map((r) => r.campaign)
    .filter((c) => c.workspaceId === shoot.workspaceId && c.state !== "delivered" && c.state !== "closed");
  const picks = shoot.pictures.filter((p) => p.kind === "photo" && sortOf(p) === "pick");

  const [campaignId, setCampaignId] = useState("");
  const [chosen, setChosen] = useState<Set<Id>>(new Set());
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setCampaignId("");
    setTried(false);
    // The picks not in a campaign yet, or all of them when every one is
    const fresh = picks.filter((p) => p.usedIn.length === 0);
    setChosen(new Set((fresh.length ? fresh : picks).map((p) => p.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shoot.id]);

  const noCampaign = tried && !campaignId;
  const noPick = tried && chosen.size === 0;
  const campaign = campaigns.find((c) => c.id === campaignId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!campaignId || chosen.size === 0) return;
    use.mutate(
      { shootId: shoot.id, campaignId, pictureIds: [...chosen] },
      {
        onSuccess: ({ documentIds }) => {
          onOpenChange(false);
          toast.done(`${copy.count(documentIds.length, "creative")} in ${campaign?.name ?? "the campaign"}`, {
            description:
              "Each one starts from the photograph. Add the design, the formats and the words in the Studio.",
          });
          if (documentIds[0]) navigate(docHref(frame, documentIds[0]));
        },
        onError: (err: Error) => toast.error("Nothing was made", { description: err.message }),
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <form className="ui-sheet-form" onSubmit={submit} noValidate>
          <SheetHeader>
            <SheetTitle>Use in a campaign</SheetTitle>
            <SheetDescription>
              Each pick becomes a creative in the campaign, with the photograph as its first version. Then the usual
              way: the graphic design, the formats and the words, an expert's check, and the customer's approval.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <FieldGroup>
              <Field invalid={noCampaign}>
                <FieldLabel id={`${id}-campaign`}>Campaign</FieldLabel>
                <Select value={campaignId || undefined} onValueChange={setCampaignId}>
                  <SelectTrigger aria-labelledby={`${id}-campaign`} aria-invalid={noCampaign || undefined}>
                    <SelectValue placeholder="Choose the campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {noCampaign ? (
                  <FieldError>Choose the campaign the pictures go into.</FieldError>
                ) : (
                  <FieldDescription>The brand's open campaigns.</FieldDescription>
                )}
              </Field>
              <FieldSet>
                <FieldLegend className="ui-client-legend">
                  <span id={`${id}-picks`}>The picks to use</span>
                  <span className="ui-client-pick-count">
                    <span>
                      {chosen.size} of {picks.length} chosen
                    </span>
                    {picks.length > 1 && (
                      <Button
                        type="button"
                        variant="glass-clear"
                        size="sm"
                        onClick={() =>
                          setChosen(chosen.size === picks.length ? new Set() : new Set(picks.map((p) => p.id)))
                        }
                      >
                        {chosen.size === picks.length ? "Choose none" : "Choose all"}
                      </Button>
                    )}
                  </span>
                </FieldLegend>
                <CreativeGrid className="ui-client-pick" aria-labelledby={`${id}-picks`}>
                  {picks.map((p) => (
                    <CreativeTile
                      key={p.id}
                      src={p.src}
                      alt=""
                      ratio={p.width && p.height ? `${p.width} / ${p.height}` : undefined}
                      label={`${pad(p.number)} · ${p.read?.productName ?? p.name}`}
                      caption={[
                        pad(p.number),
                        p.read?.productName,
                        p.usedIn.length ? `in ${p.usedIn.map((u) => u.campaignName).join(", ")}` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      selected={chosen.has(p.id)}
                      onSelectedChange={(on) => {
                        const next = new Set(chosen);
                        if (on) next.add(p.id);
                        else next.delete(p.id);
                        setChosen(next);
                      }}
                    />
                  ))}
                </CreativeGrid>
                {noPick && <FieldError>Choose at least one pick.</FieldError>}
              </FieldSet>
            </FieldGroup>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="glass-clear">Later</Button>
            </SheetClose>
            <Button type="submit" variant="glass-white" icon="megaphone" loading={use.isPending}>
              {chosen.size ? `Make ${copy.count(chosen.size, "creative")}` : "Make the creatives"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
