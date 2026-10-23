// The Studio, strictly like Photoshop (FLOWS §9): one creative document per creative, full screen, outside the studio's
// sidebar. Top bar: the way back to where she came from, the creative's one name with the brand under it, its campaign
// as a chip (picked right there, with its own look beside it), the three studios (Render, Design, Video later), undo
// and redo, and the one action that moves the work on (Send to check; for a model Save as draft / Save to the brand's
// models; for a reference Save to references). Left: specs. Middle: the board with its view tools on a rail, the Engine
// bar docked under it, and the versions. Right: the mode's variables. The page never scrolls; each panel scrolls on its
// own when its open part is tall. Renders are versions (nothing is overwritten); edits between renders are undo and
// redo (⌘Z, ⌘⇧Z); ⌘\ hides both panels so the board takes the screen.
// - No breadcrumb: the back arrow follows history and names the page she came from ("← Check" lands on the item she
//   opened, `?item=` and all); a cold link falls back to "← Studio". The title is plain text; the campaign is a chip.
// - Send to check from a creative opened in Check says the new version left for Check, offers Undo, and takes her back
//   to the item she came from.
// A desk tool: a phone shows the board and the versions read-only, with a note.
import {
  BackLink,
  Badge,
  Button,
  SegmentedControl,
  SegmentedOption,
  Toggle,
  WithTooltip,
  useNarrowScreen,
  useToast,
} from "@fume/ui";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  useBrandAssets,
  useCampaign,
  useDocument,
  usePeople,
  usePlacements,
  useSaveModel,
  useSaveReference,
  useSession,
  useStudioKit,
  useStudioModes,
  useUpdateDocument,
} from "../../../api/hooks";
import type { CreativeDocument, Layer, LightRig, StudioKind, StudioMode } from "../../../contract";
import { Failed, Loading, useBack } from "../../../shell/Page";
import { directory, firstName } from "../../../shell/people";
import { Board, documentName, shownVersion, Versions } from "./Board";
import { CampaignChip, CampaignLookChip } from "./campaign";
import { CanvasLight, type LightView } from "./CanvasLight";
import { MakeFormats } from "./formats";
import { useDocumentHistory } from "./history";
import { SendToCheck } from "./sendCheck";
import { withLibrary } from "./sceneLibrary";
import { EngineLockBar, lockProps, useEngineWork } from "./lock";
import { SpecsPanel } from "./Specs";
import { VariablesPanel } from "./Variables";
import { frameRoot } from "../../../shell/scope";

export function DocumentPage() {
  const role = useSession().data?.user.staffRole;
  // The Studio sits outside the studio shell: it turns customers and admins away itself (FLOWS §20).
  if (!role || role === "admin") return <Navigate to={role ? "/studio" : "/"} replace />;
  return <DocumentScreen />;
}

function DocumentScreen() {
  const { documentId } = useParams();
  const doc = useDocument(documentId);
  const modes = useStudioModes();
  if (doc.isPending || modes.isPending)
    return (
      <div className="ui-desk ui-desk--state">
        <Loading label="Opening the creative" />
      </div>
    );
  if (doc.error || !doc.data)
    return (
      <div className="ui-desk ui-desk--state">
        <Failed error={doc.error} onRetry={() => doc.refetch()} />
      </div>
    );
  return <Desk key={doc.data.id} doc={doc.data} modes={modes.data ?? []} />;
}

/** A new Design document starts from the picked render with a headline, a line and the logo on it. */
function startLayers(doc: CreativeDocument): Layer[] {
  const v = shownVersion(doc);
  return [
    {
      id: "ly-img",
      kind: "image",
      name: v ? `Image v${v.number}` : "Image",
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      image: v?.image,
      visible: true,
      locked: true,
    },
    {
      id: "ly-head",
      kind: "text",
      name: "Headline",
      x: 0.08,
      y: 0.72,
      w: 0.84,
      h: 0.1,
      text: "A headline",
      style: "headline",
      visible: true,
    },
    { id: "ly-logo", kind: "logo", name: "Logo", x: 0.08, y: 0.07, w: 0.2, h: 0.05, visible: true },
  ];
}

/** The pages a creative is opened from that are Check (Fume's and the agency's). */
const isCheck = (href: string) => /\/(qa|check)(\/|\?|$)/.test(href.split("#")[0]!);

/** Both panels hidden (⌘\), remembered on this computer: a per-viewer convenience, safe to lose. */
const BARE = "fume.desk.bare";
function useBare() {
  const [bare, setBare] = useState(() => {
    try {
      return localStorage.getItem(BARE) === "1";
    } catch {
      return false;
    }
  });
  const toggle = useCallback(() => {
    setBare((b) => {
      try {
        localStorage.setItem(BARE, b ? "0" : "1");
      } catch {
        /* private mode: it lasts until the page closes */
      }
      return !b;
    });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key !== "\\") return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);
  return [bare, toggle] as const;
}

function Desk({ doc, modes }: { doc: CreativeDocument; modes: StudioMode[] }) {
  const session = useSession().data;
  const campaign = useCampaign(doc.campaignId);
  const assets = useBrandAssets(doc.workspaceId).data;
  const peopleList = usePeople().data;
  const people = directory(peopleList);
  const product = useStudioKit(doc.workspaceId).data?.products.find((p) => p.id === doc.specs.productId);
  const update = useUpdateDocument();
  const saveModel = useSaveModel();
  const saveReference = useSaveReference();
  const toast = useToast();
  const readOnly = useNarrowScreen("(max-width: 899px)");
  const history = useDocumentHistory(doc);
  const [selectedLayer, setSelectedLayer] = useState<string>();
  const [formatsOpen, setFormatsOpen] = useState(false);
  const [lightView, setLightView] = useState<LightView>();
  const [bare, toggleBare] = useBare();
  // The versions compared side by side on the board; the strip adds and removes them.
  const [compare, setCompare] = useState<string[]>([]);
  const placements = usePlacements().data ?? [];

  // The scene library's templates, backgrounds, surfaces and props are options of the mode's own variables.
  const mode = withLibrary(
    modes.find((m) => m.id === doc.modeId),
    assets,
  );
  const brandName = session?.workspaces.find((w) => w.id === doc.workspaceId)?.brandName ?? "The brand";
  const approver = campaign.data
    ? firstName(campaign.data.approver.name)
    : firstName(approverOf(peopleList) ?? "the customer");
  const title = documentName(doc, mode, product?.name);
  // While the Engine works on this creative, the desk is locked (Wait or Take over).
  const work = useEngineWork(doc, title);
  const locked = Boolean(work) && !readOnly;
  const { state } = history;
  const name = (id: string | undefined) =>
    session && id === session.user.id ? firstName(session.user.name) : id === "u-tuva" ? "Tuva" : people.name(id);
  // The way back follows history: "← Check" when she came from Check, else the page she came from. A cold link goes
  // back to the frame's own Studio (/agency/b/… for an agency's person).
  const back = useBack({
    to: `${frameRoot[session?.user.agency ? "agency" : "fume"]}/b/${doc.workspaceId}/studio`,
    label: "Studio",
  });
  const fromCheck = !back.cold && isCheck(back.href);
  const goBack = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    back.back();
  };
  // The browser tab names the creative and where it is: "Master 3 · Feed 4:5 · Studio · Fume".
  useEffect(() => {
    document.title = `${title} · Studio · Fume`;
  }, [title]);

  const switchStudio = (studio: StudioKind) => {
    if (studio === doc.studio || studio === "video") return;
    const next = modes.find((m) => m.studio === studio && m.available);
    if (!next) return;
    history.flush();
    update.mutate(
      {
        documentId: doc.id,
        change: {
          studio,
          modeId: next.id,
          ...(studio === "design" && !doc.layers.length ? { layers: startLayers(doc) } : {}),
        },
      },
      { onSuccess: () => history.reset() },
    );
  };
  // The creative's campaign, picked on its chip; its look leads the look sections.
  const switchCampaign = (picked: { id: string; name: string; look?: unknown } | undefined) => {
    history.flush();
    update.mutate(
      { documentId: doc.id, change: { campaignId: picked?.id } },
      {
        onSuccess: () =>
          toast.done(picked ? `${title} belongs to ${picked.name} now` : `${title} has no campaign now`, {
            description: picked?.look ? `${picked.name}’s look leads the look sections.` : undefined,
          }),
        onError: (e) => toast.error("The campaign didn’t change", { description: e.message }),
      },
    );
  };
  const switchMode = (modeId: string) => {
    history.flush();
    update.mutate(
      { documentId: doc.id, change: { modeId } },
      {
        onSuccess: () => history.reset(),
        onError: (e) => toast.error("The mode didn’t change", { description: e.message }),
      },
    );
  };

  const model = assets?.models.find((m) => m.documentId === doc.id);
  const reference = assets?.references.find((r) => r.documentId === doc.id);
  const noVersion = !doc.versions.some((v) => v.state === "done");

  let actions: React.ReactNode;
  if (mode?.output === "model") {
    const save = (s: "draft" | "saved") => {
      history.flush();
      saveModel.mutate(
        { documentId: doc.id, name: doc.title, state: s },
        {
          onSuccess: (m) =>
            toast.done(
              s === "saved" ? `${m.name} saved to ${brandName}’s models` : `${m.name} kept as a draft`,
              s === "saved" ? { description: `${approver} can approve the AI model now.` } : undefined,
            ),
          onError: (e) => toast.error("The model didn’t save", { description: e.message }),
        },
      );
    };
    actions = (
      <>
        {model && (
          <Badge>
            {model.state === "approved"
              ? `${approver} approved`
              : model.state === "saved"
                ? `Saved · waiting for ${approver}`
                : model.state === "declined"
                  ? `${approver} declined`
                  : "Draft"}
          </Badge>
        )}
        <Button size="sm" variant="secondary" disabled={noVersion || saveModel.isPending} onClick={() => save("draft")}>
          Save as draft
        </Button>
        <Button
          size="sm"
          icon="users"
          loading={saveModel.isPending}
          disabled={noVersion || model?.state === "approved"}
          onClick={() => save("saved")}
        >
          Save to {brandName}’s models
        </Button>
      </>
    );
  } else if (mode?.output === "reference") {
    actions = (
      <>
        {reference && <Badge>{reference.state === "saved" ? "In the library" : "Draft"}</Badge>}
        <Button
          size="sm"
          icon="image-plus"
          loading={saveReference.isPending}
          disabled={noVersion || reference?.state === "saved"}
          onClick={() => {
            history.flush();
            saveReference.mutate(
              { documentId: doc.id, name: doc.title, state: "saved" },
              {
                onSuccess: (r) =>
                  toast.done(`${r.name} saved to the references`, {
                    description: "Use it in any creative from the References section.",
                  }),
                onError: (e) => toast.error("The reference didn’t save", { description: e.message }),
              },
            );
          }}
        >
          Save to references
        </Button>
      </>
    );
  } else {
    actions =
      doc.state === "draft" ? (
        <SendToCheck
          doc={doc}
          name={title}
          disabled={!doc.pickedVersionId || noVersion}
          onBefore={history.flush}
          onSent={fromCheck ? back.back : undefined}
        />
      ) : (
        <Badge check={doc.state === "checked" ? "approved" : "waiting"}>
          {doc.state === "checked" ? "Checked" : "In check"}
        </Badge>
      );
  }

  return (
    <div
      className="ui-desk"
      data-studio={doc.studio}
      data-readonly={readOnly ? "" : undefined}
      data-bare={bare && !readOnly ? "" : undefined}
    >
      <header className="ui-desk-bar">
        <div className="ui-desk-bar-start">
          <WithTooltip label={`Back to ${back.label}`} side="bottom">
            <BackLink className="ui-desk-back" href={back.href} label={back.label} onClick={goBack} />
          </WithTooltip>
          <div className="ui-desk-title">
            <h1 className="ui-desk-title-name">{title}</h1>
            <p className="ui-desk-title-meta">
              {brandName}
              {mode ? ` · ${mode.name}` : ""}
            </p>
          </div>
          {readOnly ? (
            campaign.data && <Badge icon="megaphone">{campaign.data.campaign.name}</Badge>
          ) : (
            <CampaignChip
              workspaceId={doc.workspaceId}
              campaign={doc.campaignId ? campaign.data?.campaign : undefined}
              disabled={update.isPending}
              onPick={switchCampaign}
            />
          )}
          {!readOnly && doc.campaignId && campaign.data?.campaign.look && (
            <CampaignLookChip campaign={campaign.data.campaign} workspaceId={doc.workspaceId} />
          )}
        </div>
        {!readOnly && (
          <SegmentedControl
            className="ui-desk-studios"
            aria-label="Studio"
            value={doc.studio}
            onValueChange={(s) => switchStudio(s as StudioKind)}
            {...lockProps(locked)}
          >
            <SegmentedOption value="render">Image</SegmentedOption>
            <SegmentedOption value="design">Design</SegmentedOption>
            <SegmentedOption value="video" disabled aria-disabled="true" title="Video is coming later">
              Video <span className="ui-desk-later">Later</span>
            </SegmentedOption>
          </SegmentedControl>
        )}
        <div className="ui-desk-bar-end" {...lockProps(locked)}>
          {!readOnly && (
            <>
              <span className="ui-desk-undo" role="group" aria-label="Undo and redo">
                <WithTooltip label="Undo" shortcut="⌘Z">
                  <Button
                    size="sm"
                    variant="quiet"
                    iconOnly
                    icon="undo-2"
                    aria-label="Undo"
                    disabled={!history.canUndo}
                    onClick={history.undo}
                  />
                </WithTooltip>
                <WithTooltip label="Redo" shortcut="⌘⇧Z">
                  <Button
                    size="sm"
                    variant="quiet"
                    iconOnly
                    icon="redo-2"
                    aria-label="Redo"
                    disabled={!history.canRedo}
                    onClick={history.redo}
                  />
                </WithTooltip>
              </span>
              {mode?.output === "creative" && doc.studio === "render" && (
                <Toggle
                  size="sm"
                  variant="outline"
                  icon="crop"
                  pressed={formatsOpen}
                  disabled={noVersion}
                  onPressedChange={setFormatsOpen}
                >
                  Make formats
                </Toggle>
              )}
              {actions}
            </>
          )}
        </div>
      </header>

      {readOnly && (
        <p className="ui-desk-phone-note">
          The Studio is made for a larger screen. Here you can look at the board and its versions.
        </p>
      )}

      {!readOnly && !bare && (
        <div className="ui-desk-lockable" {...lockProps(locked)}>
          <SpecsPanel
            doc={doc}
            mode={mode}
            modes={modes}
            specs={state.specs}
            layers={state.layers}
            assets={assets}
            brandName={brandName}
            approver={approver}
            name={name}
            onSpecs={(specs, key) => history.change({ specs }, `spec-${key}`)}
            onLayers={(layers, key) => history.change({ layers }, key)}
            onMode={switchMode}
            selectedLayer={selectedLayer}
            onSelectLayer={setSelectedLayer}
          />
        </div>
      )}

      <main className="ui-desk-centre">
        <Board
          doc={{ ...doc, variables: state.variables, specs: state.specs }}
          mode={mode}
          layers={state.layers}
          brandName={brandName}
          selectedLayer={selectedLayer}
          onSelectLayer={setSelectedLayer}
          readOnly={readOnly}
          onBeforeRender={history.flush}
          onVariable={(key, value) =>
            history.change({ variables: { ...state.variables, [key]: value } }, `engine-${key}`)
          }
          bare={bare}
          onToggleBare={toggleBare}
          compare={compare}
          onCompare={setCompare}
          realProduct={product?.images[0] ? { name: product.name, image: product.images[0] } : undefined}
          lock={locked && work ? <EngineLockBar item={work} title={title} /> : undefined}
        />
        {formatsOpen && !readOnly ? (
          <MakeFormats
            doc={doc}
            placements={placements}
            source={doc.versions.find((v) => v.id === doc.pickedVersionId && v.state === "done")}
            onClose={() => setFormatsOpen(false)}
          />
        ) : (
          <div className="ui-desk-lockable" {...lockProps(locked)}>
            <Versions doc={doc} readOnly={readOnly} compare={compare} onCompare={setCompare} />
          </div>
        )}
        <CanvasLight rig={state.variables.rig as LightRig | undefined} view={lightView} />
      </main>

      {!readOnly && !bare && (
        <div className="ui-desk-lockable" {...lockProps(locked)}>
          <VariablesPanel
            key={doc.campaignId ?? "no-campaign"}
            doc={doc}
            mode={mode}
            variables={state.variables}
            layers={state.layers}
            selectedLayer={selectedLayer}
            assets={assets}
            brandName={brandName}
            campaign={
              doc.campaignId && campaign.data
                ? { name: campaign.data.campaign.name, look: campaign.data.campaign.look }
                : undefined
            }
            proposed={proposedKeys(doc)}
            onVariable={(key, value) =>
              history.change({ variables: { ...state.variables, [key]: value } }, `var-${key}`)
            }
            onVariables={(patch, key) => history.change({ variables: { ...state.variables, ...patch } }, key)}
            onLayers={(layers, key) => history.change({ layers }, key)}
            onLightView={setLightView}
          />
        </div>
      )}
    </div>
  );
}

/** The variables the Engine's open change touches, and the ones it would change if asked. */
function proposedKeys(doc: CreativeDocument): string[] {
  const edit = [...doc.edits].reverse().find((e) => e.state === "proposed");
  if (!edit) return [];
  return [
    ...new Set([
      ...edit.changes.map((c) => c.key),
      ...(edit.parts ?? []).flatMap((p) => (p.suggestion ? [p.suggestion.key] : [])),
    ]),
  ];
}

/** Without a campaign, the customer who approves is the workspace's first person who is not Fume's. */
function approverOf(people: { name: string; staffRole?: string }[] | undefined) {
  return people?.find((p) => !p.staffRole)?.name;
}
