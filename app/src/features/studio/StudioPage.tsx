// The Studio (FLOWS §5): where Fume's designer takes what the Engine made and gets it right, or makes a slot from
// scratch. A desk tool, desktop first: the RECIPE on the left (Free or a Creative Type, then only the inputs that
// type needs), the CANVAS in the middle (one candidate large, two side by side, zoom, repair a region in words), the
// INSPECTOR on the right (the Engine's evaluation, the lineage, the cost) and the BRANCHES along the bottom. A phone
// shows the work read-only. Staff only: route, model, prompt and seed appear here and nowhere else in the app.
// Rules it keeps (§5.5): a product is its verified Product Truth; the AI-person label is always on; every candidate
// keeps its lineage. Never Amber here except the checked triangle on Send to check; glass only on the canvas tools.
import {
  Badge,
  Button,
  DataList,
  DataListData,
  DataListItem,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  PageHeader,
  RadioCard,
  RadioGroup,
  SegmentedControl,
  SegmentedOption,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  SkeletonEngine,
  SidebarTrigger,
  Textarea,
  TextShimmer,
  WithTooltip,
  useToast,
} from "@fume/ui";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Link, useParams } from "react-router-dom";
import {
  useBrandWorkspace,
  useCampaign,
  useGenerate,
  usePeople,
  usePickGeneration,
  useRepair,
  useSendToCheck,
  useStudioKit,
  useStudioSession,
} from "../../api/hooks";
import type { CreativeType, Format, Generation, Recipe, StudioKit, StudioSession } from "../../contract";
import * as copy from "../../copy";
import { time, when } from "../../lib/time";
import { Loading, Failed, Nothing, Page, Section } from "../../shell/Page";
import { directory } from "../../shell/people";
import { formatName } from "./parts";
import { evaluationWords, generationStateLabel, SessionRow, useOpenInStudio } from "./shared";

const ANGLES = ["Front", "Three quarter", "Side", "Top down", "Back"];
const AREAS = ["Cap", "Label", "Texture", "Glass", "Pour"];
const COUNTS = [1, 2, 4, 6];
const ALL_FORMATS: Format[] = ["feed", "square", "story"];
const usd = (n: number) => `$${n.toFixed(2)}`;
/** "Edges clean" reads "edges clean" mid-sentence; "AI person label" keeps its capitals. */
const lcFirst = (t: string) => (/^[A-Z][a-z]/.test(t) ? t[0]!.toLowerCase() + t.slice(1) : t);

export function StudioPage() {
  const { workspaceId = "", sessionId } = useParams();
  return sessionId ? (
    <StudioDesk key={sessionId} workspaceId={workspaceId} sessionId={sessionId} />
  ) : (
    <StudioStart workspaceId={workspaceId} />
  );
}

// ─── The start: pick a campaign slot, carry on a session, or start free ─────

function StudioStart({ workspaceId }: { workspaceId: string }) {
  const brand = useBrandWorkspace(workspaceId);
  const studio = useOpenInStudio(workspaceId);
  const active = (brand.data?.campaigns ?? []).filter((r) => !["delivered", "closed"].includes(r.campaign.state));
  const [campaignId, setCampaignId] = useState<string>();
  const chosen = campaignId ?? active[0]?.campaign.id;
  const campaign = useCampaign(chosen);
  const name = brand.data?.workspace.brandName;
  const people = directory(usePeople().data);

  return (
    <Page title={name ? `${name} Studio` : "Studio"}>
      <PageHeader
        title="Studio"
        description={`Make a slot from scratch or take what the Engine made and get it right${name ? ` for ${name}` : ""}. Pick a planned creative, carry on a session, or start free.`}
        primaryAction={{ label: "Start free", icon: "plus", busy: studio.pending, onSelect: () => studio.open({}) }}
      />
      {brand.isPending ? (
        <Loading label="Loading the brand" />
      ) : brand.error || !brand.data ? (
        <Failed error={brand.error} onRetry={() => brand.refetch()} />
      ) : (
        <>
          {brand.data.sessions.length > 0 && (
            <Section title="Carry on" meta={brand.data.sessions.length} titleId="studio-sessions">
              <ItemGroup as="ul">
                {brand.data.sessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    workspaceId={workspaceId}
                    campaign={brand.data.campaigns.find((c) => c.campaign.id === s.campaignId)?.campaign.name}
                    by={people.name(s.by)}
                  />
                ))}
              </ItemGroup>
            </Section>
          )}

          <Section
            title="Pick a campaign slot"
            titleId="studio-slots"
            text="Each planned creative of a campaign is a slot. The session fills one, and what you pick goes to check for it."
          >
            {active.length === 0 ? (
              <Nothing
                icon="megaphone"
                title="No campaign in production"
                text="Start free, or wait for a brief to be approved."
              />
            ) : (
              <div className="ui-app-stack ui-studio-gap">
                <div className="ui-studio-seg-scroll">
                  <SegmentedControl value={chosen} onValueChange={setCampaignId} aria-label="Campaign">
                    {active.map((r) => (
                      <SegmentedOption key={r.campaign.id} value={r.campaign.id}>
                        {r.campaign.name}
                      </SegmentedOption>
                    ))}
                  </SegmentedControl>
                </div>
                {campaign.isPending ? (
                  <Loading label="Loading the slots" />
                ) : campaign.data && campaign.data.creatives.length > 0 ? (
                  <ItemGroup as="ul">
                    {campaign.data.creatives.map((c) => {
                      const slot = `${c.title} · ${copy.format[c.format].label.toLowerCase()}`;
                      return (
                        <Item key={c.id} as="li" variant="outline">
                          <ItemContent>
                            <ItemTitle>{c.title}</ItemTitle>
                            <ItemDescription>
                              {formatName(c.format)} · {copy.channel[c.channel]} · V{c.current.number}
                            </ItemDescription>
                          </ItemContent>
                          <ItemActions>
                            <Button
                              size="sm"
                              variant="secondary"
                              icon="layers"
                              disabled={studio.pending}
                              onClick={() => studio.open({ campaignId: c.campaignId, slot })}
                            >
                              Open in the Studio
                            </Button>
                          </ItemActions>
                        </Item>
                      );
                    })}
                  </ItemGroup>
                ) : (
                  <Nothing
                    icon="layers"
                    title="No slots planned yet"
                    text="The slots come with the chosen direction. Open a free session for this campaign meanwhile."
                    action={
                      <Button variant="secondary" icon="plus" onClick={() => studio.open({ campaignId: chosen })}>
                        Free session for this campaign
                      </Button>
                    }
                  />
                )}
              </div>
            )}
          </Section>
        </>
      )}
    </Page>
  );
}

/** The Studio's own top line: the sidebar trigger, where you are, and the actions at the end. */
function StudioBar({ children, end }: { children: ReactNode; end?: ReactNode }) {
  return (
    <header className="ui-studio-bar">
      <SidebarTrigger />
      <div className="ui-studio-bar-where">{children}</div>
      {end && <div className="ui-studio-bar-end">{end}</div>}
    </header>
  );
}

// ─── The desk ────────────────────────────────────────────────────────────────

type CanvasMode = "view" | "compare" | "repair";
interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

function StudioDesk({ workspaceId, sessionId }: { workspaceId: string; sessionId: string }) {
  const session = useStudioSession(sessionId);
  const kit = useStudioKit(workspaceId);
  const brand = useBrandWorkspace(workspaceId);

  if (session.isPending || kit.isPending)
    return (
      <Page title="Studio" width="fill">
        <StudioBar>
          <span className="ui-studio-bar-title">Studio</span>
        </StudioBar>
        <Loading label="Opening the Studio" />
      </Page>
    );
  if (session.error || !session.data || kit.error || !kit.data)
    return (
      <Page title="Studio">
        <StudioBar>
          <span className="ui-studio-bar-title">Studio</span>
        </StudioBar>
        <Failed error={session.error ?? kit.error} onRetry={() => (session.refetch(), kit.refetch())} />
      </Page>
    );
  const campaign = brand.data?.campaigns.find((c) => c.campaign.id === session.data.campaignId)?.campaign;
  return (
    <Desk
      session={session.data}
      kit={kit.data}
      workspaceId={workspaceId}
      campaignName={campaign?.name}
      brandName={brand.data?.workspace.brandName}
    />
  );
}

function Desk({
  session,
  kit,
  workspaceId,
  campaignName,
  brandName,
}: {
  session: StudioSession;
  kit: StudioKit;
  workspaceId: string;
  campaignName?: string;
  brandName?: string;
}) {
  const toast = useToast();
  const generate = useGenerate();
  const repair = useRepair();
  const pick = usePickGeneration();
  const send = useSendToCheck();
  const gens = session.generations;

  const [selectedId, setSelectedId] = useState<string | undefined>(session.pickedId ?? gens.at(-1)?.id);
  const [compareId, setCompareId] = useState<string>();
  const [mode, setMode] = useState<CanvasMode>("view");
  const [zoom, setZoom] = useState(1);
  const [recipe, setRecipe] = useState<Recipe>(() => structuredClone(session.recipe));

  const selected = gens.find((g) => g.id === selectedId) ?? gens.find((g) => g.id === session.pickedId) ?? gens.at(-1);
  const compare =
    gens.find((g) => g.id === compareId && g.id !== selected?.id) ??
    gens.find((g) => g.id === session.pickedId && g.id !== selected?.id);
  const picked = gens.find((g) => g.id === session.pickedId);
  const sent = gens.find((g) => g.state === "sent_to_check");
  const making = gens.filter((g) => g.state === "making").length;
  const format = selected?.recipe.format ?? recipe.format;
  const type = kit.creativeTypes.find((t) => t.id === selected?.recipe.creativeTypeId);

  const select = (g: Generation) => {
    if (mode === "compare" && selected && g.id !== selected.id) setCompareId(g.id);
    else setSelectedId(g.id);
  };

  const onMake = (r: Recipe) =>
    generate.mutate(
      { sessionId: session.id, recipe: r },
      {
        onSuccess: (s) => {
          const first = s.generations[s.generations.length - Math.min(r.count, 6)];
          if (first) setSelectedId(first.id);
          setMode("view");
        },
        onError: (e) => toast.error("The Engine didn’t start", { description: e.message }),
      },
    );

  const onRepair = (what: string, region: Region) => {
    if (!selected) return;
    const where = `region ${Math.round(region.x * 100)}% from the left, ${Math.round(region.y * 100)}% from the top, ${Math.round(region.w * 100)} × ${Math.round(region.h * 100)}%`;
    repair.mutate(
      { sessionId: session.id, generationId: selected.id, what: `${what} (${where})` },
      {
        onSuccess: (s) => {
          setSelectedId(s.generations.at(-1)?.id);
          setMode("view");
          toast.done("The Engine is repairing it", {
            description: "The repair lands as a new branch; the original stays as it was.",
          });
        },
        onError: (e) => toast.error("The repair didn’t start", { description: e.message }),
      },
    );
  };

  const canPick = selected && (selected.state === "candidate" || selected.state === "discarded");
  const onPick = () =>
    selected &&
    pick.mutate(
      { sessionId: session.id, generationId: selected.id },
      {
        onSuccess: () => toast.done("Picked for the slot", { description: session.slot ?? "This session’s creative" }),
        onError: (e) => toast.error("The pick didn’t go through", { description: e.message }),
      },
    );
  const onSend = () =>
    send.mutate(session.id, {
      onSuccess: () =>
        toast.done("Sent to check", {
          description: `${session.slot ?? "The creative"} waits in the queue for an expert. You cannot check your own work.`,
        }),
      onError: (e) => toast.error("It didn’t go to check", { description: e.message }),
    });

  return (
    <Page title={session.slot ? `${session.slot} · Studio` : "Studio"} width="fill">
      <div className="ui-studio" data-mode={mode}>
        <StudioBar
          end={
            <>
              <Button variant="secondary" icon="bookmark" disabled={!canPick} loading={pick.isPending} onClick={onPick}>
                Pick for the slot
              </Button>
              <Button icon="fume-check" disabled={!picked || Boolean(sent)} loading={send.isPending} onClick={onSend}>
                {sent ? "In check" : "Send to check"}
              </Button>
            </>
          }
        >
          <nav className="ui-studio-crumbs" aria-label="Where you are">
            <Link to={`/studio/b/${workspaceId}`}>{brandName ?? "Brand"}</Link>
            <Icon name="chevron-right" />
            <span>{campaignName ?? "Free session"}</span>
            {session.slot && (
              <>
                <Icon name="chevron-right" />
                <span aria-current="page">{session.slot}</span>
              </>
            )}
          </nav>
          <span className="ui-studio-bar-meta">{formatName(format)}</span>
          {sent ? <Badge check="waiting">In check</Badge> : picked ? <Badge icon="bookmark">Picked</Badge> : null}
        </StudioBar>

        <p className="ui-studio-phone-note">
          <Icon name="info" />
          The Studio is a desk tool. On a phone you can look at the work; make, repair and send to check at a desk.
        </p>

        <RecipePanel kit={kit} recipe={recipe} onChange={setRecipe} onMake={onMake} making={generate.isPending} />

        <Canvas
          selected={selected}
          compare={compare}
          mode={mode}
          onMode={setMode}
          zoom={zoom}
          onZoom={setZoom}
          onRepair={onRepair}
          repairing={repair.isPending}
          making={making}
        />

        <Inspector g={selected} type={type} session={session} kit={kit} />

        <Branches
          gens={gens}
          selectedId={selected?.id}
          compareId={mode === "compare" ? compare?.id : undefined}
          onSelect={select}
          kit={kit}
        />
      </div>
    </Page>
  );
}

// ─── Recipe ──────────────────────────────────────────────────────────────────

function RecipePanel({
  kit,
  recipe,
  onChange,
  onMake,
  making,
}: {
  kit: StudioKit;
  recipe: Recipe;
  onChange: (r: Recipe) => void;
  onMake: (r: Recipe) => void;
  making: boolean;
}) {
  const set = (patch: Partial<Recipe>) => onChange({ ...recipe, ...patch });
  const type = recipe.mode === "type" ? kit.creativeTypes.find((t) => t.id === recipe.creativeTypeId) : undefined;
  const needs = new Set(recipe.mode === "free" ? (["product", "variant"] as const) : (type?.needs ?? []));
  const product = kit.products.find((p) => p.id === recipe.productId);
  const blocked = kit.products.filter((p) => p.state !== "verified");
  const cast = kit.cast.find((c) => recipe.castIds.includes(c.id));
  const scene = kit.scenes.find((s) => s.id === recipe.sceneId);
  const formats = type?.formats ?? ALL_FORMATS;
  const references = useMemo(() => [...new Set(kit.references)].slice(0, 9), [kit.references]);

  // What is still missing before the Engine can make anything, in words.
  const missing =
    recipe.mode === "type" && !type
      ? "Choose a Creative Type"
      : needs.has("product") && recipe.mode === "type" && !product
        ? "Choose a product"
        : product && product.state !== "verified"
          ? `${product.name}’s facts are not approved yet`
          : needs.has("cast") && !cast
            ? "Choose a person from the cast"
            : needs.has("scene") && !scene
              ? "Choose a scene"
              : recipe.mode === "free" && !recipe.direction?.trim()
                ? "Write the direction"
                : undefined;

  const make = () => {
    const parts = [
      type ? type.family : "Free",
      recipe.mode === "free" ? recipe.direction?.trim() : undefined,
      product
        ? `${brandless(product.name)} ${product.variants?.find((v) => v.id === recipe.variantId)?.name ?? product.variant}`
        : undefined,
      needs.has("angle") ? recipe.angle : undefined,
      cast ? `AI model: ${cast.name}, ${cast.look}` : undefined,
      scene ? `${scene.name}, ${scene.light}` : undefined,
      `${copy.format[recipe.format].label} ${copy.format[recipe.format].ratio}`,
      product ? "label front and true to the Product Truth" : undefined,
    ].filter(Boolean);
    onMake({
      ...recipe,
      castIds: needs.has("cast") ? recipe.castIds : [],
      prompt: parts.join(" · "),
      seed: Math.floor(Math.random() * 90000) + 10000,
    });
  };

  return (
    <aside className="ui-studio-recipe" aria-label="Recipe">
      <div className="ui-studio-panel-scroll">
        <h2 className="ui-studio-panel-title">Recipe</h2>
        <FieldGroup>
          <Field>
            <FieldLabel as="span" id="rc-mode">
              Mode
            </FieldLabel>
            <SegmentedControl
              value={recipe.mode}
              onValueChange={(m) => set({ mode: m as Recipe["mode"] })}
              aria-labelledby="rc-mode"
              aria-label="Mode"
            >
              <SegmentedOption value="free">Free</SegmentedOption>
              <SegmentedOption value="type">Creative Type</SegmentedOption>
            </SegmentedControl>
            <FieldDescription>
              {recipe.mode === "free"
                ? "A written direction, a product and references. The Engine still applies the Brand DNA and the Product Truth."
                : "A preset that fixes the recipe’s shape and asks only for what it needs."}
            </FieldDescription>
          </Field>

          {recipe.mode === "type" && (
            <Field>
              <FieldLabel as="span" id="rc-type">
                Creative Type
              </FieldLabel>
              <RadioGroup
                cards
                className="ui-studio-cards"
                value={recipe.creativeTypeId ?? ""}
                onValueChange={(id) => {
                  const t = kit.creativeTypes.find((x) => x.id === id);
                  set({
                    creativeTypeId: id,
                    format: t && !t.formats.includes(recipe.format) ? t.formats[0]! : recipe.format,
                  });
                }}
                aria-labelledby="rc-type"
              >
                {kit.creativeTypes.map((t) => (
                  <RadioCard
                    key={t.id}
                    value={t.id}
                    title={t.name}
                    preview={<img className="ui-studio-card-img" src={t.cover} alt="" />}
                  />
                ))}
              </RadioGroup>
              {type && (
                <FieldDescription>
                  {type.description} Imagery family {type.family}.
                </FieldDescription>
              )}
            </Field>
          )}

          {needs.has("product") && (
            <Field>
              <FieldLabel as="span" id="rc-product">
                Product
              </FieldLabel>
              <RadioGroup
                cards
                className="ui-studio-cards"
                value={recipe.productId ?? ""}
                onValueChange={(id) => {
                  const p = kit.products.find((x) => x.id === id);
                  set({ productId: id, variantId: p?.variants?.[0]?.id });
                }}
                aria-labelledby="rc-product"
              >
                {kit.products.map((p) => (
                  <RadioCard
                    key={p.id}
                    value={p.id}
                    title={p.name}
                    meta={p.state === "verified" ? "Verified" : "Not verified"}
                    disabled={p.state !== "verified"}
                    preview={p.images[0] ? <img className="ui-studio-card-img" src={p.images[0]} alt="" /> : undefined}
                  />
                ))}
              </RadioGroup>
              {blocked.length > 0 && (
                <FieldDescription>
                  {blocked.map((p) => p.name).join(", ")} can’t be used yet: {blocked.length === 1 ? "its" : "their"}{" "}
                  facts wait for the customer’s approval in Products.
                </FieldDescription>
              )}
            </Field>
          )}

          {needs.has("variant") && product && (product.variants?.length ?? 0) > 0 && (
            <Field>
              <FieldLabel as="span" id="rc-variant">
                Variant
              </FieldLabel>
              <Select value={recipe.variantId} onValueChange={(variantId) => set({ variantId })}>
                <SelectTrigger aria-labelledby="rc-variant">
                  <SelectValue placeholder="Choose a variant" />
                </SelectTrigger>
                <SelectContent>
                  {product.variants!.map((v) => (
                    <SelectItem key={v.id} value={v.id} meta={v.sku}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {needs.has("angle") && (
            <Field>
              <FieldLabel as="span" id="rc-angle">
                Angle
              </FieldLabel>
              <Select value={recipe.angle ?? ANGLES[0]} onValueChange={(angle) => set({ angle })}>
                <SelectTrigger aria-labelledby="rc-angle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANGLES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {needs.has("area") && (
            <Field>
              <FieldLabel as="span" id="rc-area">
                Area
              </FieldLabel>
              <Select
                value={recipe.angle && AREAS.includes(recipe.angle) ? recipe.angle : AREAS[0]}
                onValueChange={(angle) => set({ angle })}
              >
                <SelectTrigger aria-labelledby="rc-area">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {needs.has("cast") && (
            <Field>
              <FieldLabel as="span" id="rc-cast">
                Cast
              </FieldLabel>
              <RadioGroup
                cards
                className="ui-studio-cards"
                value={recipe.castIds[0] ?? ""}
                onValueChange={(id) => set({ castIds: [id] })}
                aria-labelledby="rc-cast"
              >
                {kit.cast.map((c) => (
                  <RadioCard
                    key={c.id}
                    value={c.id}
                    title={c.name}
                    itemLabel={`${c.name}, AI model`}
                    preview={
                      <span className="ui-studio-card-shot">
                        <img className="ui-studio-card-img" src={c.image} alt="" />
                        <span className="ui-studio-ai-label">AI model</span>
                      </span>
                    }
                  />
                ))}
              </RadioGroup>
              <FieldDescription>
                {cast ? `${cast.look}. Allowed for ${cast.allowedUses.map(lcFirst).join(", ")}. ` : ""}Every creative
                with a person from the cast carries the AI-person label; never as a customer or a review.
              </FieldDescription>
            </Field>
          )}

          {needs.has("scene") && (
            <Field>
              <FieldLabel as="span" id="rc-scene">
                Scene
              </FieldLabel>
              <RadioGroup
                cards
                className="ui-studio-cards"
                value={recipe.sceneId ?? ""}
                onValueChange={(sceneId) => set({ sceneId })}
                aria-labelledby="rc-scene"
              >
                {kit.scenes.map((s) => (
                  <RadioCard
                    key={s.id}
                    value={s.id}
                    title={s.name}
                    preview={<img className="ui-studio-card-img" src={s.image} alt="" />}
                  />
                ))}
              </RadioGroup>
              {scene && <FieldDescription>Light: {scene.light}.</FieldDescription>}
            </Field>
          )}

          {needs.has("layout") && (
            <Field>
              <FieldLabel as="span">Layout</FieldLabel>
              <FieldDescription>
                Headline, logo, offer and legal line come from a layout board, built from the brand’s own components.
                Layout boards open with OpenPencil.
              </FieldDescription>
            </Field>
          )}

          {recipe.mode === "free" && (
            <Field>
              <FieldLabel htmlFor="rc-direction">Direction</FieldLabel>
              <Textarea
                id="rc-direction"
                value={recipe.direction ?? ""}
                onChange={(e) => set({ direction: e.target.value })}
                placeholder="The oil on warm stone at dusk, the bottle low with air above it"
                rows={3}
              />
            </Field>
          )}

          {references.length > 0 && (
            <Field>
              <FieldLabel as="span" id="rc-refs">
                References
              </FieldLabel>
              <div className="ui-studio-refs" role="group" aria-labelledby="rc-refs">
                {references.map((src, i) => {
                  const on = recipe.references.includes(src);
                  return (
                    <button
                      key={src}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      aria-label={`Reference ${i + 1} from the boards`}
                      className="ui-studio-ref"
                      onClick={() =>
                        set({
                          references: on ? recipe.references.filter((r) => r !== src) : [...recipe.references, src],
                        })
                      }
                    >
                      <img src={src} alt="" />
                      {on && <Icon name="check" />}
                    </button>
                  );
                })}
              </div>
              <FieldDescription>From the brand’s moodboards: liked images only.</FieldDescription>
            </Field>
          )}

          <Field>
            <FieldLabel as="span" id="rc-format">
              Format
            </FieldLabel>
            <SegmentedControl
              value={recipe.format}
              onValueChange={(f) => set({ format: f as Format })}
              aria-label="Format"
            >
              {formats.map((f) => (
                <SegmentedOption key={f} value={f}>
                  {copy.format[f].label}
                </SegmentedOption>
              ))}
            </SegmentedControl>
          </Field>

          <Field>
            <FieldLabel as="span" id="rc-count">
              How many
            </FieldLabel>
            <SegmentedControl
              value={String(recipe.count)}
              onValueChange={(n) => set({ count: Number(n) })}
              aria-label="How many"
            >
              {COUNTS.map((n) => (
                <SegmentedOption key={n} value={String(n)}>
                  {n}
                </SegmentedOption>
              ))}
            </SegmentedControl>
          </Field>
        </FieldGroup>
      </div>

      <div className="ui-studio-make">
        <p className="ui-studio-make-line">
          {missing ?? `${copy.count(recipe.count, "candidate")} · ${formatName(recipe.format)}`}
          <span className="ui-studio-data">{usd(0.12 * recipe.count)}</span>
        </p>
        <Button
          size="lg"
          icon="fume-engine"
          className="ui-studio-make-button"
          disabled={Boolean(missing)}
          loading={making}
          onClick={make}
        >
          Make
        </Button>
      </div>
    </aside>
  );
}

/** "LYSNE Night Body Oil" reads "Night Body Oil" in a prompt line; the brand is in the brand world already. */
const brandless = (name: string) => name.replace(/^LYSNE\s+/i, "");

// ─── Canvas ──────────────────────────────────────────────────────────────────

function Canvas({
  selected,
  compare,
  mode,
  onMode,
  zoom,
  onZoom,
  onRepair,
  repairing,
  making,
}: {
  selected?: Generation;
  compare?: Generation;
  mode: CanvasMode;
  onMode: (m: CanvasMode) => void;
  zoom: number;
  onZoom: (z: number) => void;
  onRepair: (what: string, region: Region) => void;
  repairing: boolean;
  making: number;
}) {
  const [region, setRegion] = useState<Region>();
  const [what, setWhat] = useState("");
  const drag = useRef<{ x: number; y: number } | null>(null);
  const toggle = (m: CanvasMode) => {
    onMode(mode === m ? "view" : m);
    setRegion(undefined);
    if (m === "compare") onZoom(1);
  };

  useEffect(() => {
    if (mode !== "repair") setRegion(undefined);
  }, [mode]);

  const frac = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1),
      y: Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1),
    };
  };
  const regionEvents =
    mode === "repair" && selected && selected.state !== "making"
      ? {
          onPointerDown: (e: PointerEvent<HTMLElement>) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = frac(e);
            setRegion({ ...drag.current, w: 0, h: 0 });
          },
          onPointerMove: (e: PointerEvent<HTMLElement>) => {
            if (!drag.current) return;
            const p = frac(e);
            const s = drag.current;
            setRegion({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
          },
          onPointerUp: () => {
            drag.current = null;
            setRegion((r) => (r && r.w > 0.02 && r.h > 0.02 ? r : undefined));
          },
        }
      : {};

  const shot = (g: Generation | undefined, label?: string, withRegion?: boolean) =>
    !g ? null : (
      <figure className="ui-studio-figure">
        <span
          className="ui-studio-shot"
          data-format={g.recipe.format}
          data-drawing={withRegion && mode === "repair" ? "" : undefined}
          {...(withRegion ? regionEvents : {})}
        >
          {g.state === "making" ? (
            <Skeleton shape="creative" ratio={ratioOf(g.recipe.format)} className="ui-studio-shot-skeleton">
              <SkeletonEngine meta={making > 1 ? `Making · ${making} on their way` : "Making"} />
            </Skeleton>
          ) : (
            <img src={g.image} alt={`Candidate from branch ${g.branch}`} draggable={false} />
          )}
          {withRegion && region && (
            <span
              className="ui-studio-region"
              style={
                {
                  "--x": `${region.x * 100}%`,
                  "--y": `${region.y * 100}%`,
                  "--w": `${region.w * 100}%`,
                  "--h": `${region.h * 100}%`,
                } as CSSProperties
              }
              aria-hidden="true"
            />
          )}
        </span>
        {label && (
          <figcaption className="ui-studio-figcaption">
            <span className="ui-studio-data">{label}</span> {generationStateLabel[g.state]} · branch {g.branch}
          </figcaption>
        )}
      </figure>
    );

  return (
    <section className="ui-studio-canvas" aria-label="Canvas" data-zoom={zoom}>
      {selected && (
        <div className="ui-glass ui-glass--bar ui-studio-tools" role="toolbar" aria-label="Canvas tools">
          <WithTooltip label="Zoom out" shortcut="−">
            <Button
              variant="glass-clear"
              iconOnly
              icon="zoom-out"
              aria-label="Zoom out"
              disabled={zoom <= 1 || mode === "compare"}
              onClick={() => onZoom(Math.max(1, zoom / 2))}
            />
          </WithTooltip>
          <output className="ui-studio-zoom" aria-live="polite">
            {zoom === 1 ? "Fit" : `${zoom * 100} %`}
          </output>
          <WithTooltip label="Zoom in" shortcut="+">
            <Button
              variant="glass-clear"
              iconOnly
              icon="zoom-in"
              aria-label="Zoom in"
              disabled={zoom >= 4 || mode === "compare"}
              onClick={() => onZoom(Math.min(4, zoom * 2))}
            />
          </WithTooltip>
          <span className="ui-studio-tools-gap" aria-hidden="true" />
          <WithTooltip label="Compare two side by side">
            <Button
              variant={mode === "compare" ? "glass-white" : "glass-clear"}
              icon="columns-2"
              aria-pressed={mode === "compare"}
              onClick={() => toggle("compare")}
              className="ui-studio-desk-only"
            >
              Compare
            </Button>
          </WithTooltip>
          <WithTooltip label="Select a region and say what is wrong">
            <Button
              variant={mode === "repair" ? "glass-white" : "glass-clear"}
              icon="pencil"
              aria-pressed={mode === "repair"}
              disabled={selected.state === "making"}
              onClick={() => toggle("repair")}
              className="ui-studio-desk-only"
            >
              Repair
            </Button>
          </WithTooltip>
          <span className="ui-studio-tools-gap ui-studio-desk-only" aria-hidden="true" />
          <WithTooltip label="Reframe to another format, coming later">
            <Button
              variant="glass-clear"
              iconOnly
              icon="crop"
              aria-label="Reframe to another format, coming later"
              aria-disabled="true"
              className="ui-studio-desk-only"
            />
          </WithTooltip>
          <WithTooltip label="Upscale, coming later">
            <Button
              variant="glass-clear"
              iconOnly
              icon="maximize-2"
              aria-label="Upscale, coming later"
              aria-disabled="true"
              className="ui-studio-desk-only"
            />
          </WithTooltip>
        </div>
      )}

      <div className="ui-studio-stage" data-compare={mode === "compare" && compare ? "" : undefined}>
        {!selected ? (
          <div className="ui-studio-empty">
            <Icon name="fume-engine" />
            <p>
              Nothing made in this session yet. Set the recipe and press Make; the candidates land along the bottom.
            </p>
          </div>
        ) : mode === "compare" ? (
          <>
            {shot(selected, "A")}
            {compare ? (
              shot(compare, "B")
            ) : (
              <p className="ui-studio-hint">Choose a second candidate along the bottom to set it beside this one.</p>
            )}
          </>
        ) : (
          shot(selected, undefined, true)
        )}
      </div>

      {mode === "repair" && selected && (
        <form
          className="ui-glass ui-studio-repair"
          aria-label="Repair a region"
          onSubmit={(e) => {
            e.preventDefault();
            if (region && what.trim()) {
              onRepair(what.trim(), region);
              setWhat("");
              setRegion(undefined);
            }
          }}
        >
          {region ? (
            <>
              <label className="ui-field-label" htmlFor="repair-what">
                What is wrong here, in words
              </label>
              <Textarea
                id="repair-what"
                value={what}
                onChange={(e) => setWhat(e.target.value)}
                rows={2}
                placeholder="The cap reads glossy; make it matte"
                autoFocus
              />
              <div className="ui-studio-repair-actions">
                <Button variant="glass-clear" onClick={() => setRegion(undefined)}>
                  Draw again
                </Button>
                <Button
                  type="submit"
                  variant="glass-white"
                  icon="fume-engine"
                  disabled={!what.trim()}
                  loading={repairing}
                >
                  Repair
                </Button>
              </div>
            </>
          ) : (
            <p className="ui-studio-repair-hint">
              Drag over the part that is wrong. The Engine repairs only that region, as a new branch.
            </p>
          )}
        </form>
      )}
    </section>
  );
}

const ratioOf = (f: Format) => (f === "square" ? "1 / 1" : f === "story" ? "9 / 16" : "4 / 5");

// ─── Inspector ───────────────────────────────────────────────────────────────

function Inspector({
  g,
  type,
  session,
  kit,
}: {
  g?: Generation;
  type?: CreativeType;
  session: StudioSession;
  kit: StudioKit;
}) {
  const total = session.generations.reduce((n, x) => n + x.cost, 0);
  if (!g)
    return (
      <aside className="ui-studio-inspector" aria-label="Inspector">
        <div className="ui-studio-panel-scroll">
          <h2 className="ui-studio-panel-title">Inspector</h2>
          <p className="ui-studio-quiet">
            Choose a candidate to see what the Engine found, where it came from and what it cost.
          </p>
        </div>
      </aside>
    );
  const e = g.evaluation;
  const r = g.recipe;
  const product = kit.products.find((p) => p.id === r.productId);
  const cast = kit.cast.filter((c) => r.castIds.includes(c.id));
  const scene = kit.scenes.find((s) => s.id === r.sceneId);
  return (
    <aside className="ui-studio-inspector" aria-label="Inspector">
      <div className="ui-studio-panel-scroll">
        <section className="ui-studio-block" aria-labelledby="in-eval">
          <h2 className="ui-studio-panel-title" id="in-eval">
            Evaluation
          </h2>
          {g.state === "making" ? (
            <p className="ui-studio-quiet">
              <TextShimmer>The Engine is making it</TextShimmer>
            </p>
          ) : (
            <DataList>
              <DataListItem label="Product Truth">
                {e.productTruth === "pass" ? (
                  <Badge icon="circle-check">Pass</Badge>
                ) : (
                  <Badge variant="ink" icon="triangle-alert">
                    Flagged
                  </Badge>
                )}
              </DataListItem>
              <DataListItem label="Brand rules">
                {e.brandRules === "pass" ? (
                  <Badge icon="circle-check">Pass</Badge>
                ) : (
                  <Badge variant="ink" icon="triangle-alert">
                    Flagged
                  </Badge>
                )}
              </DataListItem>
              <DataListItem label="Artefacts">
                {e.artefacts === "none" ? (
                  <Badge icon="circle-check">None</Badge>
                ) : e.artefacts === "minor" ? (
                  <Badge icon="triangle-alert">Minor</Badge>
                ) : (
                  <Badge variant="danger">Major</Badge>
                )}
              </DataListItem>
            </DataList>
          )}
          {e.notes.length > 0 && (
            <ul className="ui-studio-notes">
              {e.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          {type && type.checks.length > 0 && (
            <p className="ui-studio-quiet">
              {type.name} adds to the check: {type.checks.map(lcFirst).join(", ")}.
            </p>
          )}
        </section>

        <section className="ui-studio-block" aria-labelledby="in-recipe">
          <h2 className="ui-studio-panel-title" id="in-recipe">
            Made from
          </h2>
          <DataList>
            <DataListItem label="Mode">{r.mode === "free" ? "Free" : (type?.name ?? "Creative Type")}</DataListItem>
            {product && (
              <DataListItem label="Product">{`${product.name}${r.variantId ? `, ${product.variants?.find((v) => v.id === r.variantId)?.name ?? ""}` : ""}`}</DataListItem>
            )}
            {r.angle && <DataListItem label="Angle">{r.angle}</DataListItem>}
            {cast.length > 0 && (
              <DataListItem label="Cast">
                {cast.map((c) => c.name).join(", ")} <Badge>AI model</Badge>
              </DataListItem>
            )}
            {scene && <DataListItem label="Scene">{scene.name}</DataListItem>}
            <DataListItem label="Format">{formatName(r.format)}</DataListItem>
          </DataList>
          {g.repair && <p className="ui-studio-quiet">Repair asked: “{g.repair}”</p>}
        </section>

        <section className="ui-studio-block" aria-labelledby="in-lineage">
          <div className="ui-studio-block-head">
            <h2 className="ui-studio-panel-title" id="in-lineage">
              Lineage
            </h2>
            <Badge icon="lock">Staff only</Badge>
          </div>
          <DataList>
            <DataListItem label="Route">
              {r.route ? `${r.route.provider} · ${r.route.model}` : "The Engine chooses"}
            </DataListItem>
            <DataListItem label="Seed">
              <DataListData>{r.seed ?? "Not set"}</DataListData>
            </DataListItem>
            <DataListItem label="Branch">
              <DataListData>{g.branch}</DataListData>
            </DataListItem>
            <DataListItem label="Made">
              <DataListData>
                {when(g.at) === time(g.at) ? `Today ${time(g.at)}` : `${when(g.at)} ${time(g.at)}`}
              </DataListData>
            </DataListItem>
          </DataList>
          {r.prompt && (
            <div className="ui-studio-prompt">
              <span className="ui-studio-prompt-label">Prompt</span>
              <p>{r.prompt}</p>
            </div>
          )}
        </section>

        <section className="ui-studio-block" aria-labelledby="in-cost">
          <h2 className="ui-studio-panel-title" id="in-cost">
            Cost
          </h2>
          <DataList>
            <DataListItem label="This candidate">
              <DataListData>{usd(g.cost)}</DataListData>
            </DataListItem>
            <DataListItem label="This session">
              <DataListData>{`${usd(total)} · ${session.generations.length}`}</DataListData>
            </DataListItem>
          </DataList>
        </section>

        <section className="ui-studio-block" aria-labelledby="in-notes">
          <h2 className="ui-studio-panel-title" id="in-notes">
            Notes
          </h2>
          <p className="ui-studio-quiet">
            {evaluationWords(g) === "Clean" ? "No notes. The Engine found nothing to flag." : evaluationWords(g)}
          </p>
        </section>
      </div>
    </aside>
  );
}

// ─── Branches ────────────────────────────────────────────────────────────────

function Branches({
  gens,
  selectedId,
  compareId,
  onSelect,
  kit,
}: {
  gens: Generation[];
  selectedId?: string;
  compareId?: string;
  onSelect: (g: Generation) => void;
  kit: StudioKit;
}) {
  const branches = useMemo(() => {
    const by = new Map<number, Generation[]>();
    for (const g of gens) by.set(g.branch, [...(by.get(g.branch) ?? []), g]);
    return [...by.entries()].sort((a, b) => b[0] - a[0]);
  }, [gens]);
  const order = branches.flatMap(([, gs]) => gs);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = order.findIndex((g) => g.id === selectedId);
    const next = order[Math.min(Math.max(i + (e.key === "ArrowRight" ? 1 : -1), 0), order.length - 1)];
    if (next) {
      e.preventDefault();
      onSelect(next);
      (e.currentTarget.querySelector(`[data-id="${next.id}"]`) as HTMLElement | null)?.focus();
    }
  };

  return (
    <section className="ui-studio-branches" aria-label="Branches">
      {gens.length === 0 ? (
        <p className="ui-studio-quiet">The candidates land here, one branch per Make or repair.</p>
      ) : (
        <div
          className="ui-studio-strip"
          role="listbox"
          aria-label="Candidates by branch"
          aria-orientation="horizontal"
          onKeyDown={onKey}
        >
          {branches.map(([branch, gs]) => {
            const r = gs[0]!;
            const type = kit.creativeTypes.find((t) => t.id === r.recipe.creativeTypeId);
            const label = r.repair
              ? `Repair: ${r.repair}`
              : r.recipe.mode === "free"
                ? "Free"
                : (type?.name ?? "Creative Type");
            return (
              <div key={branch} role="group" aria-label={`Branch ${branch}, ${label}`} className="ui-studio-branch">
                <div className="ui-studio-branch-head">
                  <span className="ui-studio-branch-name">Branch {branch}</span>
                  <span className="ui-studio-branch-what" title={label}>
                    {label}
                  </span>
                </div>
                <div className="ui-studio-frames">
                  {gs.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      role="option"
                      data-id={g.id}
                      aria-selected={g.id === selectedId}
                      aria-label={`${generationStateLabel[g.state]}, ${evaluationWords(g)}`}
                      tabIndex={g.id === selectedId ? 0 : -1}
                      className="ui-studio-frame"
                      data-state={g.state}
                      data-compare={g.id === compareId ? "" : undefined}
                      data-format={g.recipe.format}
                      onClick={() => onSelect(g)}
                    >
                      {g.state === "making" ? (
                        <Skeleton shape="creative" ratio={ratioOf(g.recipe.format)} index={gs.indexOf(g)} />
                      ) : (
                        <img src={g.image} alt="" />
                      )}
                      {g.state === "picked" && (
                        <span className="ui-studio-frame-tag">
                          <Icon name="bookmark" />
                        </span>
                      )}
                      {g.state === "sent_to_check" && (
                        <span className="ui-studio-frame-tag">
                          <Icon name="fume-check" />
                        </span>
                      )}
                      {g.state !== "making" &&
                        (g.evaluation.productTruth === "flag" || g.evaluation.brandRules === "flag") && (
                          <span className="ui-studio-frame-flag">
                            <Icon name="triangle-alert" />
                          </span>
                        )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
