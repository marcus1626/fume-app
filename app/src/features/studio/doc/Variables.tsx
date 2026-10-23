// The desk's right panel (FLOWS §9.1): the mode's variables, grouped by section in folding sections like Photoshop's
// panels, each drawn by the control library (ModeControl) from its `control` kind. The brand's presets lead every
// swatch and select (FLOWS §9.4). In Design, the selected layer's words sit on top.
// Every look section (Light, Camera, a section with a brand preset) says where its look comes from (FLOWS §18):
// Campaign · Brand · Fume · Own · Engine. When the creative belongs to a campaign with a look of its own, Campaign
// comes first and is the default: its colours and backgrounds lead every swatch under the campaign's name, and its
// light is a preset of its own. Campaign, Brand and Fume pick a preset and show its values read-only, with Adjust to
// take them over as Own; Own is the controls; Engine leaves it to the Engine. The first look section says in one line
// what Fume and Engine mean.
// Light has a simple and an advanced way: Advanced is the light board (drag the lights; the creative shows where they
// fall) with a 3D preview beside it. Camera's presets are named cards with a picture of the camera. The Scene section
// has a library (SceneLibrary.tsx). When the Engine proposes a change, the section that holds it opens and the changed
// control is marked until she keeps or undoes it.
import {
  ModeControl,
  StudioCameraPresets,
  StudioEngineNote,
  StudioFolds,
  StudioLightboard,
  StudioPresetPicker,
  StudioSegmented,
  StudioSource,
  StudioSummary,
  StudioText,
  StudioToggle,
  lookSourceNames,
  studioValueWords,
  useToast,
  type StudioFold,
  type StudioLightRig,
  type StudioLookSource,
  type StudioPreset,
  type StudioPresetItem,
  type StudioVariable,
} from "@fume/ui";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { useLookPresets, useSetSource } from "../../../api/hooks";
import type {
  BrandAssetsView,
  BrandPresetKind,
  CameraPreset,
  CampaignLook,
  CreativeDocument,
  Layer,
  LightRig,
  LookSource,
  ModeVariable,
  StudioMode,
  Variables,
  VarValue,
} from "../../../contract";
import type { LightView } from "./CanvasLight";
import { SceneSection } from "./SceneLibrary";

// three.js only loads when a designer opens advanced light.
const Light3D = lazy(() => import("./Light3D"));

export interface VariablesProps {
  doc: CreativeDocument;
  mode?: StudioMode;
  variables: Variables;
  layers: Layer[];
  selectedLayer?: string;
  assets?: BrandAssetsView;
  brandName: string;
  /** The creative's campaign, when it has one; its look (if any) is the first source. */
  campaign?: { name: string; look?: CampaignLook };
  onVariable: (key: string, value: VarValue) => void;
  /** Several variables in one undo step (a preset sets light and camera at once). */
  onVariables: (patch: Variables, key: string) => void;
  onLayers: (layers: Layer[], key: string) => void;
  /** A light on the advanced board is dragged or let go: the board draws it on the creative. */
  onLightView?: (view: LightView) => void;
  /** The variables the Engine's open change touches: their section opens, the controls are marked. */
  proposed?: string[];
}

/** A preset the section can take: what it sets (patch) and what tells that it is in force (match: the rig for light,
 *  since the simple values only follow from the rig's key light). */
type PresetChoice = StudioPresetItem & { patch: Variables; match?: Variables; camera?: CameraPreset };

/** A rig's key light as the simple controls' values, so a preset sets both ways of light at once. */
function lightPatch(rig: LightRig, has: (key: string) => boolean): Variables {
  const out: Variables = {};
  if (has("rig")) out.rig = rig;
  const key = rig.lights.find((l) => l.kind === "key") ?? rig.lights[0];
  if (!key) return out;
  if (has("lightAngle"))
    out.lightAngle = {
      azimuth: Math.round((Math.atan2(key.x - 0.5, key.y - 0.5) * 180) / Math.PI / 5) * 5,
      elevation: key.height,
    };
  if (has("softness")) out.softness = key.softness;
  if (has("warmth")) out.warmth = Math.min(6500, Math.max(2000, Math.round(key.warmth / 100) * 100));
  return out;
}

/** A campaign's light is words ("Hard top light, one bright edge on the glass"): the Engine reads them; the controls
 *  get the nearest rig, so the summary and Adjust start from something close. */
function rigFromWords(words: string): LightRig {
  const w = words.toLowerCase();
  const softness = /hard|sharp|crisp/.test(w) ? 15 : /soft|diffuse/.test(w) ? 75 : 45;
  const warmth = /warm|amber|evening|candle/.test(w) ? 2700 : /cool|cold|blue|daylight/.test(w) ? 5600 : 4300;
  const top = /top|above|overhead/.test(w);
  const lights: LightRig["lights"] = [
    {
      id: "cl-key",
      kind: "key",
      x: top ? 0.5 : /left/.test(w) ? 0.15 : 0.85,
      y: top ? 0.55 : 0.4,
      height: top ? 80 : 30,
      warmth,
      strength: 90,
      softness,
    },
  ];
  if (/edge|rim|back/.test(w))
    lights.push({ id: "cl-rim", kind: "rim", x: 0.85, y: 0.15, height: 35, warmth, strength: 70, softness: 10 });
  return { lights };
}

const isLook = (section: string, vars: ModeVariable[]) =>
  section === "Light" || section === "Camera" || vars.some((v) => v.brandPreset);

export function VariablesPanel({
  doc,
  mode,
  variables,
  layers,
  selectedLayer,
  assets,
  brandName,
  campaign,
  onVariable,
  onVariables,
  onLayers,
  onLightView,
  proposed = [],
}: VariablesProps) {
  const looks = useLookPresets(doc.workspaceId).data;
  const setSource = useSetSource();
  const toast = useToast();
  const [chosenSources, setChosenSources] = useState<Record<string, LookSource>>({});
  const [advanced, setAdvanced] = useState(false);
  const [light, setLight] = useState<string>();
  const [focus, setFocus] = useState<{ id: string; n: number }>();
  const bringForward = (id: string) => setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }));
  // The Engine's change opens the section that holds it.
  const proposedKey = proposed.join(",");
  useEffect(() => {
    const section = mode?.variables.find((v) => proposed.includes(v.key))?.section;
    if (section) bringForward(section);
  }, [proposedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const look = campaign?.look;
  /** The campaign's colours of a kind (its backgrounds, its colours), under the campaign's name. */
  const campaignPresets = (kind?: BrandPresetKind): StudioPreset[] =>
    !look || !campaign
      ? []
      : kind === "background"
        ? look.backgrounds.map((b) => ({ name: b.name, hex: b.hex, brand: campaign.name }))
        : kind === "colour"
          ? look.colours.map((c) => ({ name: c.name, hex: c.hex, brand: campaign.name }))
          : [];
  const brandPresets = (kind?: BrandPresetKind): StudioPreset[] =>
    (assets?.presets ?? []).filter((p) => p.kind === kind).map((p) => ({ name: p.name, hex: p.hex, brand: brandName }));
  const presets = (kind?: BrandPresetKind): StudioPreset[] | undefined =>
    kind ? [...campaignPresets(kind), ...brandPresets(kind)] : undefined;
  const valueOf = (key: string) => variables[key] ?? mode?.variables.find((v) => v.key === key)?.default;
  const matches = (patch: Variables) =>
    Object.entries(patch).every(([k, v]) => JSON.stringify(valueOf(k)) === JSON.stringify(v));
  /** The sources that pick presets; the campaign's comes first when it has a look. */
  type Picks = "campaign" | "brand" | "fume";
  const isPick = (s: LookSource): s is Picks => s === "campaign" || s === "brand" || s === "fume";

  /** The presets a look section can take from the campaign, the brand and Fume. */
  const choicesFor = (section: string, vars: ModeVariable[]): Record<Picks, PresetChoice[]> => {
    const has = (key: string) => vars.some((v) => v.key === key);
    if (section === "Light") {
      const item = (p: NonNullable<typeof looks>["lights"][number]): PresetChoice => {
        const patch = lightPatch(p.rig, has);
        return { id: p.id, name: p.name, line: p.value, patch, match: patch.rig ? { rig: patch.rig } : undefined };
      };
      const own: PresetChoice[] = [];
      if (look?.light && campaign) {
        const patch = lightPatch(rigFromWords(look.light), has);
        own.push({
          id: "campaign-light",
          name: `${campaign.name} light`,
          line: look.light,
          patch,
          match: patch.rig ? { rig: patch.rig } : undefined,
        });
      }
      return {
        campaign: own,
        brand: (looks?.lights ?? []).filter((p) => p.origin === "brand").map(item),
        fume: (looks?.lights ?? []).filter((p) => p.origin === "fume").map(item),
      };
    }
    if (section === "Camera" && has("lens")) {
      const item = (c: CameraPreset): PresetChoice => ({
        id: c.id,
        name: c.name,
        line: c.body,
        meta: `${c.lens.focal} mm`,
        image: c.image,
        patch: { lens: c.lens },
        camera: c,
      });
      return {
        campaign: [],
        brand: (looks?.cameras ?? []).filter((c) => c.origin === "brand").map(item),
        fume: (looks?.cameras ?? []).filter((c) => c.origin === "fume").map(item),
      };
    }
    // A section with a brand preset (a packshot's ground): the campaign's colours, the brand's, then the mode's own.
    const fromCampaign: PresetChoice[] = [];
    const brand: PresetChoice[] = [];
    const fume: PresetChoice[] = [];
    for (const v of vars.filter((x) => x.brandPreset)) {
      const theirs = campaignPresets(v.brandPreset);
      const mine = brandPresets(v.brandPreset);
      for (const p of theirs)
        fromCampaign.push({
          id: `${v.key}-c-${p.name}`,
          name: p.name,
          line: `${p.brand}’s ${v.label.toLowerCase()}`,
          hex: p.hex,
          patch: { [v.key]: p.hex ?? p.name },
        });
      for (const p of mine)
        brand.push({
          id: `${v.key}-${p.name}`,
          name: p.name,
          line: `${brandName}’s ${v.label.toLowerCase()}`,
          hex: p.hex,
          patch: { [v.key]: p.hex ?? p.name },
        });
      for (const o of v.options ?? []) {
        if (
          [...theirs, ...mine].some(
            (p) =>
              p.name.toLowerCase() === o.label.toLowerCase() ||
              (p.hex && o.hex && p.hex.toLowerCase() === o.hex.toLowerCase()),
          )
        )
          continue;
        fume.push({ id: `${v.key}-${o.value}`, name: o.label, line: v.label, hex: o.hex, patch: { [v.key]: o.value } });
      }
    }
    return { campaign: fromCampaign, brand, fume };
  };
  // Where a section's look comes from: what the designer chose, what the document says, else the campaign's look when
  // it has one for this section, else the brand's (FLOWS §9.4), else the designer's own.
  const sourceOf = (section: string, choices?: Record<Picks, PresetChoice[]>): LookSource =>
    chosenSources[section] ??
    doc.sources?.[section] ??
    (choices?.campaign.length ? "campaign" : choices?.brand.length ? "brand" : "own");

  const choose = (section: string, source: LookSource, items: PresetChoice[]) => {
    setChosenSources((s) => ({ ...s, [section]: source }));
    bringForward(section);
    setSource.mutate(
      { documentId: doc.id, section, source },
      { onError: (e) => toast.error(`${section} didn’t change`, { description: e.message }) },
    );
    if (isPick(source) && items.length && !items.some((i) => matches(i.match ?? i.patch)))
      onVariables(items[0]!.patch, `source-${section}`);
  };

  const sections: StudioFold[] = [];
  const layer = layers.find((l) => l.id === selectedLayer);
  if (layer) {
    const set = (change: Partial<Layer>, key: string) =>
      onLayers(
        layers.map((l) => (l.id === layer.id ? { ...l, ...change } : l)),
        `layer-${layer.id}-${key}`,
      );
    sections.push({
      id: "layer",
      title: layer.name,
      meta: "Layer",
      children: (
        <>
          {layer.kind === "text" && (
            <StudioText
              label="Words"
              id="layer-text"
              value={layer.text ?? ""}
              onChange={(text) => set({ text }, "text")}
            />
          )}
          {layer.kind === "text" && (
            <StudioSegmented
              label="Type"
              id="layer-style"
              value={layer.style ?? "body"}
              options={[
                { value: "headline", label: "Headline" },
                { value: "body", label: "Body" },
                { value: "small", label: "Small" },
              ]}
              onChange={(style) => set({ style: style as Layer["style"] }, "style")}
            />
          )}
          <StudioToggle
            label="Show"
            id="layer-visible"
            value={layer.visible}
            onChange={(visible) => set({ visible }, "visible")}
          />
        </>
      ),
    });
  }

  const control = (v: ModeVariable) => (
    <div key={v.key} className="ui-desk-var" data-proposed={proposed.includes(v.key) ? "" : undefined}>
      <ModeControl
        variable={v as StudioVariable}
        value={variables[v.key]}
        presets={presets(v.brandPreset)}
        onChange={(value) => onVariable(v.key, value as VarValue)}
      />
    </div>
  );
  let explained = false;

  for (const section of mode?.sections ?? []) {
    const vars = (mode?.variables ?? []).filter((v) => v.section === section);
    if (!vars.length) continue;
    // The Scene section is a short row of choices per variable, with the whole library behind "More…".
    if (section === "Scene" && vars.some((v) => v.key === "scene")) {
      sections.push({
        id: section,
        title: section,
        children: (
          <SceneSection
            vars={vars}
            valueOf={valueOf}
            onVariable={onVariable}
            assets={assets}
            brandName={brandName}
            control={control}
          />
        ),
      });
      continue;
    }
    if (!isLook(section, vars)) {
      sections.push({ id: section, title: section, children: vars.map(control) });
      continue;
    }

    const choices = choicesFor(section, vars);
    const source = sourceOf(section, choices);
    const items = isPick(source) ? choices[source] : [];
    // The preset in force: the one the values match, else the source's first (the Engine renders with it).
    const current = items.find((i) => matches(i.match ?? i.patch)) ?? items[0];
    const rigVar = vars.find((v) => v.control === "lightboard");
    // Once per panel: what the two sources that are not the brand's mean.
    const explain = !explained;
    explained = true;
    const head = (
      <>
        <StudioSource
          label={section}
          value={source as StudioLookSource}
          brand={brandName}
          campaign={look ? campaign?.name : undefined}
          unavailable={(["campaign", "brand", "fume"] as const).filter((s) => !choices[s].length)}
          onChange={(s) => choose(section, s, isPick(s) ? choicesFor(section, vars)[s] : [])}
        />
        {explain && (
          <p className="ui-sc-help ui-desk-source-help">
            Fume: Fume’s house presets · Own: set by hand · Engine: the Engine chooses
          </p>
        )}
      </>
    );

    let body: ReactNode;
    if (source === "engine") {
      body = <StudioEngineNote>The Engine decides the {section.toLowerCase()}</StudioEngineNote>;
    } else if (isPick(source)) {
      const label = `${source === "campaign" ? (campaign?.name ?? "The campaign") : source === "brand" ? brandName : "Fume"}’s ${section.toLowerCase()}`;
      const pick = (id: string) => {
        const item = items.find((i) => i.id === id);
        if (item && !matches(item.match ?? item.patch)) onVariables(item.patch, `preset-${section}`);
      };
      const cams = items.filter((i) => i.camera).map((i) => i.camera!);
      // The values the preset sets, in words: the simple light (the board counts its lights), the lens, the ground.
      const rows = vars
        .filter((v) => !(section === "Light" && v.brandPreset))
        .map((v) => ({
          label: v.label,
          value: studioValueWords(v as StudioVariable, (current?.patch[v.key] ?? valueOf(v.key)) as never),
        }));
      body = (
        <>
          {cams.length ? (
            <StudioCameraPresets label={label} presets={cams} value={current?.id} onPick={(c) => pick(c.id)} />
          ) : (
            <StudioPresetPicker label={label} items={items} value={current?.id} onPick={pick} />
          )}
          <StudioSummary
            rows={rows}
            onAdjust={() => {
              if (current && !matches(current.patch)) onVariables(current.patch, `adjust-${section}`);
              choose(section, "own", []);
            }}
          />
        </>
      );
    } else if (section === "Light" && rigVar) {
      body = (
        <>
          <StudioToggle
            label="Advanced"
            id="light-advanced"
            value={advanced}
            onChange={(on) => {
              setAdvanced(on);
              if (on) bringForward("Light");
            }}
            help={advanced ? undefined : "Several lights on a board, in 3D."}
          />
          {advanced ? (
            <StudioLightboard
              label={rigVar.label}
              id="sc-rig"
              value={valueOf(rigVar.key) as StudioLightRig}
              selected={light}
              onSelect={setLight}
              onChange={(rig) => onVariable(rigVar.key, rig as VarValue)}
              onDragging={(active, id) => onLightView?.({ active, selected: id })}
              preview={
                <Suspense fallback={<div className="ui-sl-3d" data-loading="" aria-label="Loading the 3D view" />}>
                  <Light3D rig={valueOf(rigVar.key) as StudioLightRig} selected={light} />
                </Suspense>
              }
            />
          ) : (
            vars.filter((v) => v !== rigVar).map(control)
          )}
        </>
      );
    } else {
      body = vars.filter((v) => v.control !== "lightboard").map(control);
    }

    sections.push({
      id: section,
      title: section,
      meta: lookSourceNames[source as StudioLookSource],
      children: (
        <>
          {head}
          {body}
        </>
      ),
    });
  }

  return (
    <aside className="ui-desk-panel ui-desk-vars" aria-label="Variables">
      <h2 className="ui-desk-panel-title">{mode ? `${mode.name} variables` : "Variables"}</h2>
      {sections.length ? (
        <StudioFolds
          key={`${mode?.id}-${layer?.id ?? ""}`}
          label="Variables"
          sections={sections}
          newest={focus?.id}
          newestKey={focus?.n}
        />
      ) : (
        <p className="ui-sc-help">This mode has no variables yet.</p>
      )}
    </aside>
  );
}
