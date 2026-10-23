// The brand's AI models (FLOWS §9.6): the AI people Fume's designers made in the Studio's Model mode. The part is
// called "AI models" (F-D041: always said to be AI). The customer never sees a designer's drafts (the mock and the
// backend never send them) and never the variables or prompts behind a model.
// On the board a model that waits for the customer carries Confirm · Remove under its portrait, which stays big enough
// to judge. Before the first campaign a saved model is held back (useModelsHeldBack), as on Home.
// Each AI model has a page of its own (/brand/models/:id): the model sheet (front, three-quarter, profile, back, and
// the face close) in a white studio in the same plain clothes; the specs; what the model may and may never be used for;
// how many creatives it is in; who made it and who decided. "AI model" is on every picture of it, always: an AI model
// never poses as a real person. Fume's and an agency's people read the brand's name where the customer reads "your
// brand".
import { DataList, DataListItem, Icon, PageHeader, Proposal, ProposalFoot, useToast } from "@fume/ui";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useBrandAssets, useDecideModel, usePeople } from "../../api/hooks";
import type { BrandModel, ModelAngle } from "../../contract";
import * as copy from "../../copy";
import { Back, Nothing, Page, Query } from "../../shell/Page";
import { directory } from "../../shell/people";
import { BoardPart } from "./board";
import { DecisionActions } from "./decide";
import { useModelsHeldBack, useRole, useViewer } from "./parts";

/** "AI model", on every picture of one: Smoke glass over the picture's corner, never hidden. */
export function AiLabel() {
  return <span className="ui-ai-label">AI model</span>;
}

function ModelCard({
  model,
  who,
  canApprove,
  stays,
}: {
  model: BrandModel;
  who: (id?: string) => string;
  canApprove: boolean;
  stays: (id: string) => void;
}) {
  const decide = useDecideModel();
  const viewer = useViewer();
  const toast = useToast();
  const waiting = model.state === "saved";
  const failed = (error: Error) => toast.error("That wasn’t saved", { description: error.message });
  const answer = (verdict: "approve" | "decline") =>
    decide.mutate(
      { modelId: model.id, verdict },
      {
        onSuccess: () => {
          stays(model.id);
          if (verdict === "decline")
            toast.done(`${model.name} removed`, { description: "Fume will not use this AI model." });
        },
        onError: failed,
      },
    );
  return (
    <Proposal
      state={waiting ? "proposed" : "approved"}
      bare
      className="ui-brand-image"
      data-removed={model.state === "declined" ? "" : undefined}
    >
      <Link
        to={`/brand/models/${model.id}`}
        className="ui-brand-image-media ui-model-card-media"
        tabIndex={-1}
        aria-hidden="true"
      >
        <img src={model.image} alt="" loading="lazy" />
        <AiLabel />
      </Link>
      <Link to={`/brand/models/${model.id}`} className="ui-brand-caption-title ui-model-card-name">
        {model.name}
        <span className="ui-sr-only">, an AI model</span>
      </Link>
      <p className="ui-brand-caption-text">
        {model.look}
        {model.usedIn > 0 ? `. In ${copy.creatives(model.usedIn)}.` : ""}
      </p>
      {(waiting || model.state === "declined") && (
        <ProposalFoot>
          <span className="ui-proposal-tag">
            <Icon name={model.state === "declined" ? "x" : "user"} />
            {model.state === "declined"
              ? "Removed"
              : `${who(model.savedBy ?? model.madeBy)} made ${model.name} for ${viewer.staff ? viewer.brand : "your brand"}`}
          </span>
          {waiting && canApprove && (
            <DecisionActions
              name={model.name}
              onKeep={() => answer("approve")}
              onRemove={() => answer("decline")}
              disabled={decide.isPending}
            />
          )}
          {waiting && !canApprove && <span className="ui-proposal-tag">An owner or an approver confirms it</span>}
        </ProposalFoot>
      )}
    </Proposal>
  );
}

/** The AI models part of the board: every model in its own order; one removed earlier is named once at the foot. */
export function Models({ span }: { span?: "full" }) {
  const assets = useBrandAssets();
  const dir = directory(usePeople().data);
  const { me, canApprove } = useRole();
  const who = (id?: string) => (id === me ? "You" : dir.name(id));
  const heldBack = useModelsHeldBack();
  // decided here: it keeps its place (and a removed one stays, dimmed) until the next visit
  const [decided, setDecided] = useState<ReadonlySet<string>>(new Set());
  const stays = (id: string) => setDecided((s) => new Set(s).add(id));
  const models = (assets.data?.models ?? []).filter((m) => !(heldBack && m.state === "saved"));
  if (!assets.data || models.length === 0) return null;
  const shown = models.filter((m) => m.state !== "declined" || decided.has(m.id));
  const declined = models.filter((m) => m.state === "declined" && !decided.has(m.id));

  return (
    <BoardPart id="models" title="AI models" span={span}>
      <div className="ui-brand-images ui-brand-models" data-mode="board">
        {shown.map((m) => (
          <ModelCard key={m.id} model={m} who={who} canApprove={canApprove} stays={stays} />
        ))}
      </div>
      {declined.length > 0 && (
        <p className="ui-brand-caption-text">Removed, never used: {declined.map((m) => m.name).join(", ")}.</p>
      )}
    </BoardPart>
  );
}

/** True when the board shows an AI models part (the section index lists it only then). */
export function useHasModels(): boolean {
  const assets = useBrandAssets();
  const heldBack = useModelsHeldBack();
  return (assets.data?.models ?? []).some((m) => m.state !== "declined" && !(heldBack && m.state === "saved"));
}

// ─── The model's own page ─────────────────────────────────────────────────

const angleWords: Record<ModelAngle, string> = {
  front: "Front",
  "three-quarter": "Three-quarter",
  profile: "Profile",
  back: "Back",
  face: "Face",
  "face-three-quarter": "Face, three-quarter",
  "face-profile": "Face, profile",
};
const bodyAngles: ModelAngle[] = ["front", "three-quarter", "profile", "back"];

function Shot({ image, angle, name }: { image: string; angle: ModelAngle; name: string }) {
  return (
    <figure className="ui-model-shot" data-angle={angle}>
      <span className="ui-model-shot-media">
        <img src={image} alt={`${name}, an AI model: ${angleWords[angle].toLowerCase()}`} loading="lazy" />
        <AiLabel />
      </span>
      <figcaption className="ui-model-shot-caption">{angleWords[angle]}</figcaption>
    </figure>
  );
}

function ModelView({ model }: { model: BrandModel }) {
  const people = usePeople().data;
  const dir = directory(people);
  const { me, canApprove } = useRole();
  const viewer = useViewer();
  const decide = useDecideModel();
  const toast = useToast();
  const angles =
    model.angles ?? model.sheet.map((image, i) => ({ angle: (bodyAngles[i] ?? "front") as ModelAngle, image }));
  const body = angles.filter((a) => !a.angle.startsWith("face"));
  const faces = angles.filter((a) => a.angle.startsWith("face"));
  const person = (id?: string) => {
    const u = dir.user(id);
    if (!u) return "Someone";
    return id === me
      ? `You, ${u.title.toLowerCase()}`
      : `${u.name}, ${u.title.toLowerCase()}${u.staffRole ? " at Fume" : ""}`;
  };
  const spec = model.spec;
  const waiting = model.state === "saved";
  const answer = (verdict: "approve" | "decline") =>
    decide.mutate(
      { modelId: model.id, verdict },
      {
        onSuccess: () =>
          toast.done(verdict === "approve" ? `${model.name} confirmed` : `${model.name} removed`, {
            description:
              verdict === "approve" ? "Fume may use this AI model in creatives." : "Fume will not use this AI model.",
          }),
        onError: (error) => toast.error("That wasn’t saved", { description: error.message }),
      },
    );
  return (
    <div className="ui-model-page">
      <section className="ui-model-sheet" aria-label={`${model.name}’s model sheet`}>
        <div className="ui-model-row" data-kind="body">
          {body.map((a) => (
            <Shot key={a.angle} image={a.image} angle={a.angle} name={model.name} />
          ))}
        </div>
        {faces.length > 0 && (
          <div className="ui-model-row" data-kind="face">
            {faces.map((a) => (
              <Shot key={a.angle} image={a.image} angle={a.angle} name={model.name} />
            ))}
          </div>
        )}
        <p className="ui-model-note">
          Every angle in a white studio, in the same plain clothes, so the model looks the same in every creative.
        </p>
      </section>

      <div className="ui-model-specs">
        <div className="ui-model-ai">
          <AiLabel />
          <p className="ui-model-ai-text">
            Made by Fume. {model.name} is not a real person and is never shown as one: every creative with {model.name}{" "}
            says so.
          </p>
        </div>
        {waiting && (
          <div className="ui-model-decide">
            <p className="ui-model-decide-text">{`${dir.name(model.savedBy ?? model.madeBy)} made ${model.name} for ${viewer.staff ? viewer.brand : "your brand"}. Fume uses ${model.name} once it is confirmed.`}</p>
            {canApprove ? (
              <DecisionActions
                name={model.name}
                onKeep={() => answer("approve")}
                onRemove={() => answer("decline")}
                disabled={decide.isPending}
              />
            ) : (
              <span className="ui-proposal-tag">An owner or an approver confirms it</span>
            )}
          </div>
        )}
        {spec && (
          <section className="ui-model-block" aria-labelledby="model-specs">
            <h2 className="ui-model-block-title" id="model-specs">
              Specs
            </h2>
            <DataList>
              <DataListItem label="Age range">{spec.ageRange}</DataListItem>
              <DataListItem label="Height">{spec.height}</DataListItem>
              <DataListItem label="Build">{spec.build}</DataListItem>
              <DataListItem label="Skin tone">{spec.skinTone}</DataListItem>
              <DataListItem label="Hair">{spec.hair}</DataListItem>
              <DataListItem label="Eyes">{spec.eyes}</DataListItem>
              <DataListItem label="Clothing sizes">
                {spec.sizes.map((x) => `${x.label} ${x.value}`).join(" · ")}
              </DataListItem>
              <DataListItem label="On the sheet">{spec.clothing}</DataListItem>
            </DataList>
          </section>
        )}
        {spec && (
          <section className="ui-model-block" aria-labelledby="model-uses">
            <h2 className="ui-model-block-title" id="model-uses">
              Where {model.name} may be used
            </h2>
            <ul className="ui-model-list">
              {spec.allowedUses.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
            <h3 className="ui-model-block-sub">Never</h3>
            <ul className="ui-model-list" data-never="">
              {spec.neverUses.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </section>
        )}
        <section className="ui-model-block" aria-labelledby="model-record">
          <h2 className="ui-model-block-title" id="model-record">
            Record
          </h2>
          <DataList>
            <DataListItem label="Used in">
              {model.usedIn > 0 ? copy.creatives(model.usedIn) : "No creative yet"}
            </DataListItem>
            <DataListItem label="Made by">{person(model.madeBy)}</DataListItem>
            <DataListItem label="Decided by">
              {model.decidedBy
                ? person(model.decidedBy)
                : waiting
                  ? "Waits for an owner or an approver"
                  : model.state === "declined"
                    ? "Removed"
                    : "—"}
            </DataListItem>
          </DataList>
        </section>
      </div>
    </div>
  );
}

/** /brand/models/:modelId: one AI model, its sheet and its specs. */
export function ModelPage() {
  const { modelId } = useParams<"modelId">();
  const assets = useBrandAssets();
  const model = assets.data?.models.find((m) => m.id === modelId);
  return (
    <Page title={`${model?.name ?? "AI model"} · AI models · Brand`}>
      <PageHeader
        title={model?.name ?? "AI model"}
        back={<Back to="/brand" label="Brand" />}
        description={model ? `An AI model: ${model.look}.` : undefined}
      />
      <Query query={assets} loading="Loading the AI model">
        {() =>
          model ? (
            <ModelView model={model} />
          ) : (
            <Nothing
              icon="user"
              title="This AI model isn’t here"
              text="It may have been removed. The brand’s AI models are on Brand DNA."
            />
          )
        }
      </Query>
    </Page>
  );
}
