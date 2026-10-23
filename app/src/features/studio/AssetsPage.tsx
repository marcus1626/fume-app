// Models and references (FLOWS §9.4, §9.6), for Fume's people under one brand: the brand's chosen presets (first in
// every swatch in Studio), its models (AI people, always labelled) and its reference library. Every asset says who made
// it and where it stands: a designer's draft, saved to the brand (waiting for the customer), approved by the customer,
// or declined. Only the customer approves a model; a reference is the designer's to save. Presets are a two-column list
// of rows, and a long state is a line under the name, never a pill that runs out of its card. "Make a model" and "Make
// a reference" open a new document in Studio in Model or Reference maker mode.
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardMedia,
  CardTitle,
  CreativeMedia,
  PageHeader,
  Proposal,
  ProposalTag,
  useToast,
} from "@fume/ui";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useBrandAssets, useBrandWorkspace, useOpenDocument } from "../../api/hooks";
import type { AssetState, BrandModel, BrandPreset, BrandReference } from "../../contract";
import * as copy from "../../copy";
import { date } from "../../lib/time";
import { Nothing, Page, Query, Section } from "../../shell/Page";
import { vars } from "../brand/board";
import { useNames } from "./qa/names";

const presetKind: Record<BrandPreset["kind"], string> = { background: "Background", colour: "Colour", light: "Light" };
const modelOrder: Record<AssetState, number> = { saved: 0, draft: 1, approved: 2, declined: 3 };
const origin: Record<BrandReference["origin"], string> = {
  made: "Made in Studio",
  upload: "Uploaded",
  brand: "From the brand",
};

export function AssetsPage() {
  const { workspaceId } = useParams();
  const assets = useBrandAssets(workspaceId);
  const brand = useBrandWorkspace(workspaceId).data?.workspace.brandName ?? "The brand";
  const open = useOpenDocument();
  const navigate = useNavigate();
  const toast = useToast();

  const make = (modeId: "m-model" | "m-reference") =>
    open.mutate(
      { workspaceId: workspaceId!, studio: "render", modeId },
      {
        onSuccess: (doc) => navigate(`/studio/doc/${doc.id}`),
        onError: (e) => toast.error("Studio didn’t open", { description: e.message }),
      },
    );

  const data = assets.data;
  return (
    <Page title={`${brand} models and references`}>
      <PageHeader
        title="Models and references"
        description={`${brand}’s chosen presets, its models and its reference library. Everything Studio puts first.`}
        meta={
          data
            ? [
                copy.count(data.presets.length, "preset"),
                copy.count(data.models.length, "model"),
                copy.count(data.references.length, "reference"),
              ]
            : undefined
        }
      />
      <Query query={assets} loading="Loading the brand’s models and references">
        {({ presets, models, references }) => (
          <>
            <Section
              title="Presets"
              meta={presets.length}
              titleId="assets-presets"
              text={`First in every swatch and preset in Studio: a packshot’s background starts on ${presets.find((p) => p.kind === "background")?.name ?? "the brand’s chosen white"}.`}
            >
              {presets.length === 0 ? (
                <Nothing
                  icon="palette"
                  title="No presets yet"
                  text="The brand’s chosen colours and light come from its Brand DNA once the customer approves them."
                />
              ) : (
                <ul className="ui-assets-presets">
                  {presets.map((p) => (
                    <Preset key={p.id} preset={p} />
                  ))}
                </ul>
              )}
            </Section>

            <Section
              title="Models"
              meta={models.length}
              titleId="assets-models"
              text="AI people made for the brand. A designer saves a model to the brand; only the customer approves it."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  icon="plus"
                  loading={open.isPending && open.variables?.modeId === "m-model"}
                  onClick={() => make("m-model")}
                >
                  Make a model
                </Button>
              }
            >
              {models.length === 0 ? (
                <Nothing
                  icon="users"
                  title="No models yet"
                  text="Make a model in Studio: every variable it takes, then save it to the brand."
                />
              ) : (
                <div className="ui-app-grid">
                  {[...models]
                    .sort((a, b) => modelOrder[a.state] - modelOrder[b.state] || b.at.localeCompare(a.at))
                    .map((m) => (
                      <Model key={m.id} model={m} />
                    ))}
                </div>
              )}
            </Section>

            <Section
              title="References"
              meta={references.length}
              titleId="assets-references"
              text="Made in Studio with the reference maker, uploaded, or from the brand. Use them in any creative."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  icon="plus"
                  loading={open.isPending && open.variables?.modeId === "m-reference"}
                  onClick={() => make("m-reference")}
                >
                  Make a reference
                </Button>
              }
            >
              {references.length === 0 ? (
                <Nothing
                  icon="image"
                  title="No references yet"
                  text="Make one with the reference maker, a lamp or a surface, then use it in a creative."
                />
              ) : (
                <div className="ui-app-grid">
                  {[...references]
                    .sort((a, b) => (a.state === b.state ? b.at.localeCompare(a.at) : a.state === "draft" ? 1 : -1))
                    .map((r) => (
                      <Reference key={r.id} reference={r} />
                    ))}
                </div>
              )}
            </Section>
          </>
        )}
      </Query>
    </Page>
  );
}

// ─── Presets ────────────────────────────────────────────────────────────────

/** One preset as a row: the swatch, its name and hex, what it is for, and where it comes from. */
function Preset({ preset }: { preset: BrandPreset }) {
  const names = useNames();
  const p = preset.provenance;
  const state = p.state === "removed" ? "approved" : p.state;
  return (
    <li>
      <Proposal state={state} className="ui-assets-preset">
        <div
          className="ui-brand-swatch-colour"
          style={preset.hex ? vars({ "--swatch": preset.hex }) : undefined}
          role="img"
          aria-label={preset.hex ? `${preset.name}, ${preset.hex}` : `${preset.name}: ${preset.value ?? ""}`}
        />
        <div className="ui-assets-preset-text">
          <span className="ui-brand-caption-title">{preset.name}</span>
          <span className="ui-brand-caption-meta">
            {[preset.hex?.toUpperCase(), presetKind[preset.kind], preset.use].filter(Boolean).join(" · ")}
          </span>
        </div>
        <div className="ui-proposal-foot">
          <ProposalTag
            origin={p.origin}
            state={state}
            evidence={p.evidence}
            by={p.by ? names.name(p.by) : undefined}
            when={p.at ? date(p.at) : undefined}
          />
        </div>
      </Proposal>
    </li>
  );
}

// ─── Models (AI people) ─────────────────────────────────────────────────────

function Model({ model }: { model: BrandModel }) {
  const names = useNames();
  const made = `Made by ${names.name(model.madeBy)}`;
  const saved = model.savedBy ? `saved by ${names.name(model.savedBy)}` : undefined;
  const decided = model.decidedBy ? names.name(model.decidedBy) : "the customer";
  // A long state is a line under the name, not a pill; the pills stay short.
  const where: Record<AssetState, ReactNode> = {
    draft: <Badge>Draft</Badge>,
    saved: <Badge dot="idle">Saved</Badge>,
    approved: <Badge icon="user">{decided} approved</Badge>,
    declined: <Badge variant="danger">{decided} declined</Badge>,
  };
  return (
    <AssetCard
      to={model.documentId ? `/studio/doc/${model.documentId}` : undefined}
      image={model.image}
      alt={`${model.name}, an AI model`}
      title={model.name}
      description={model.look}
      badges={
        <>
          <Badge icon="user">AI model</Badge>
          {where[model.state]}
        </>
      }
      meta={[
        [made, saved].filter(Boolean).join(", "),
        model.usedIn ? `In ${copy.creatives(model.usedIn)}` : `Since ${date(model.at)}`,
      ]}
      state={model.state === "saved" ? `Saved to the brand, waiting for ${decided}` : undefined}
    />
  );
}

// ─── References ─────────────────────────────────────────────────────────────

function Reference({ reference }: { reference: BrandReference }) {
  const names = useNames();
  const by =
    reference.origin === "made"
      ? `Made by ${names.name(reference.madeBy)}`
      : reference.origin === "upload"
        ? `Uploaded by ${names.name(reference.madeBy)}`
        : `From ${names.name(reference.madeBy)}`;
  return (
    <AssetCard
      to={reference.documentId ? `/studio/doc/${reference.documentId}` : undefined}
      image={reference.image}
      alt={reference.name}
      title={reference.name}
      badges={
        <>
          <Badge>{origin[reference.origin]}</Badge>
          {reference.state === "draft" ? <Badge>Draft</Badge> : <Badge icon="bookmark">Saved to the brand</Badge>}
        </>
      }
      meta={[by, date(reference.at)]}
    />
  );
}

// ─── One asset ──────────────────────────────────────────────────────────────

function AssetCard({
  to,
  image,
  alt,
  title,
  description,
  badges,
  meta,
  state,
}: {
  to?: string;
  image: string;
  alt: string;
  title: string;
  description?: string;
  badges: ReactNode;
  meta: string[];
  /** Where it stands, in words, when that is longer than a pill. */
  state?: string;
}) {
  const body = (
    <>
      <CardMedia>
        <CreativeMedia ratio={1} src={image} alt={alt} />
      </CardMedia>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <CardDescription>{meta.join(" · ")}</CardDescription>
        {state && <CardDescription>{state}</CardDescription>}
      </CardHeader>
      <CardFooter>
        <div className="ui-app-row">{badges}</div>
      </CardFooter>
    </>
  );
  return to ? (
    <Card asChild>
      <Link to={to} aria-label={`${title}, open in Studio`}>
        {body}
      </Link>
    </Card>
  ) : (
    <Card>{body}</Card>
  );
}
