// The Scene section with its library (round 13, Marcus #57, #63). Each of the section's variables is a short row of
// the first few choices (the one in force first) and "More…", which opens the whole library: Fume's scene templates,
// the brand's scenes and backgrounds, surfaces, props and references, with a search, "Upload a background" and
// "Pick from references". A pick applies at once, like every other variable (one undo step each); props are several.
// The library sheet is the product sheet's frame (opaque glass, search, chips, a picture grid).
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icon,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  PickGrid,
  PickTile,
  StudioRow,
  ToggleGroup,
  ToggleGroupItem,
  useToast,
} from "@fume/ui";
import { useMemo, useRef, useState, type ReactNode } from "react";
import type { BrandAssetsView, ModeVariable, VarValue } from "../../../contract";
import { KIND_LABEL, KIND_VAR, addUpload, libraryOf, type LibraryItem, type LibraryKind } from "./sceneLibrary";

/** How many choices a row shows before "More…". */
const FIRST = 4;

export interface SceneSectionProps {
  vars: ModeVariable[];
  valueOf: (key: string) => VarValue | undefined;
  onVariable: (key: string, value: VarValue) => void;
  assets?: BrandAssetsView;
  brandName: string;
  /** The section's other variables, drawn as usual. */
  control: (v: ModeVariable) => ReactNode;
}

const ROWS: { key: "scene" | "surface" | "props"; kinds: LibraryKind[] }[] = [
  { key: "scene", kinds: ["scene", "background", "reference"] },
  { key: "surface", kinds: ["surface"] },
  { key: "props", kinds: ["prop"] },
];

export function SceneSection({ vars, valueOf, onVariable, assets, brandName, control }: SceneSectionProps) {
  const toast = useToast();
  const [, setUploaded] = useState(0);
  const [library, setLibrary] = useState<LibraryKind | "" | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const all = libraryOf(assets);
  const has = (key: string) => vars.some((v) => v.key === key);
  const props = (valueOf("props") as string[] | undefined) ?? [];
  const picked = (item: LibraryItem) => (KIND_VAR[item.kind] === "props" ? props.includes(item.value) : valueOf(KIND_VAR[item.kind]) === item.value);
  const pick = (item: LibraryItem, on = true) => {
    const key = KIND_VAR[item.kind];
    if (!has(key)) return;
    if (key === "props") onVariable("props", on ? [...new Set([...props, item.value])] : props.filter((p) => p !== item.value));
    else onVariable(key, item.value);
  };
  const upload = (f: File) => {
    const item = addUpload(f.name.replace(/\.[^.]+$/, ""), URL.createObjectURL(f));
    setUploaded((n) => n + 1);
    pick(item);
    toast.done(`${item.name} is the background`, { description: "The Engine puts the product on it in the next render. Fume keeps uploads once the backend stores them." });
  };

  const rows = ROWS.filter((r) => has(r.key));
  const others = vars.filter((v) => !rows.some((r) => r.key === v.key));
  const origin = (i: LibraryItem) => (i.origin === "fume" ? "Fume" : i.origin === "upload" ? "Upload" : i.origin === "reference" ? "Reference" : brandName);

  return (
    <>
      {rows.map((r) => {
        const v = vars.find((x) => x.key === r.key)!;
        const items = all.filter((i) => r.kinds.includes(i.kind));
        // The one in force first, then the rest in the library's order.
        const first = [...items.filter(picked), ...items.filter((i) => !picked(i))].slice(0, r.key === "props" ? Math.max(FIRST, props.length) : FIRST);
        const current = items.filter(picked);
        const more = (
          <Button size="sm" variant="quiet" className="ui-scene-lib-more" onClick={() => setLibrary(r.kinds[0]!)} aria-label={`More ${v.label.toLowerCase()}s: ${items.length} in the library`}>
            More…
          </Button>
        );
        if (r.key === "props")
          return (
            <StudioRow key={r.key} label={v.label} labelId="scene-props-l" readout={`${current.length} of ${items.length}`} inline={more} className="ui-scene-lib-row">
              <ToggleGroup type="multiple" size="sm" variant="outline" className="ui-sc-chips" aria-labelledby="scene-props-l" value={props} onValueChange={(next) => onVariable("props", next)}>
                {first.map((i) => (
                  <ToggleGroupItem key={i.value} value={i.value}>
                    {i.name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </StudioRow>
          );
        return (
          <StudioRow key={r.key} label={v.label} labelId={`scene-${r.key}-l`} readout={current[0]?.name} inline={more} className="ui-scene-lib-row">
            <ul className="ui-desk-thumbs" aria-labelledby={`scene-${r.key}-l`}>
              {first.map((i) => (
                <li key={i.value}>
                  <button type="button" className="ui-desk-thumb" aria-pressed={picked(i)} title={`${i.name} · ${origin(i)}`} aria-label={`${i.name}, ${origin(i)}`} onClick={() => pick(i)}>
                    <img src={i.image} alt="" />
                    {picked(i) && <Icon name="check" className="ui-desk-thumb-check" />}
                  </button>
                </li>
              ))}
            </ul>
          </StudioRow>
        );
      })}
      {has("scene") && (
        <div className="ui-desk-row-actions">
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="quiet" icon="upload" onClick={() => file.current?.click()}>
            Upload a background
          </Button>
          <Button size="sm" variant="quiet" icon="image" onClick={() => setLibrary("reference")}>
            Pick from references
          </Button>
        </div>
      )}
      {others.map(control)}
      <LibrarySheet
        open={library !== null}
        onOpenChange={(o) => !o && setLibrary(null)}
        start={library ?? ""}
        items={all.filter((i) => has(KIND_VAR[i.kind]))}
        picked={picked}
        onPick={pick}
        origin={origin}
        brandName={brandName}
        onUpload={() => file.current?.click()}
      />
    </>
  );
}

/** The whole library: search, a chip per kind, the pictures; a tap applies (props tick on and off). */
function LibrarySheet({
  open,
  onOpenChange,
  start,
  items,
  picked,
  onPick,
  origin,
  brandName,
  onUpload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  start: LibraryKind | "";
  items: LibraryItem[];
  picked: (i: LibraryItem) => boolean;
  onPick: (i: LibraryItem, on: boolean) => void;
  origin: (i: LibraryItem) => string;
  brandName: string;
  onUpload: () => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<LibraryKind | "">(start);
  const [opened, setOpened] = useState(false);
  // Every opening starts on the row it came from, with no search.
  if (open !== opened) {
    setOpened(open);
    if (open) {
      setQuery("");
      setKind(start);
    }
  }
  const kinds = (Object.keys(KIND_LABEL) as LibraryKind[]).filter((k) => items.some((i) => i.kind === k));
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => (!kind || i.kind === kind) && (!q || `${i.name} ${origin(i)}`.toLowerCase().includes(q)));
  }, [items, kind, query, origin]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="ui-product-sheet ui-scene-lib">
        <DialogHeader>
          <DialogTitle>Scene library</DialogTitle>
          <DialogDescription>Fume’s scene templates and {brandName}’s own scenes, backgrounds and references. A pick goes into the next render.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="ui-product-sheet-body">
            <div className="ui-scene-lib-top">
              <InputGroup role="search" className="ui-product-sheet-search">
                <InputGroupAddon>
                  <Icon name="search" />
                </InputGroupAddon>
                <InputGroupInput value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} placeholder="Search the library" aria-label="Search the library" autoComplete="off" />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton clear aria-label="Clear search" onClick={() => setQuery("")} />
                </InputGroupAddon>
              </InputGroup>
              <Button size="sm" variant="glass-clear" icon="upload" onClick={onUpload}>
                Upload a background
              </Button>
            </div>
            <div className="ui-product-sheet-chips" role="group" aria-label="Show">
              {(["", ...kinds] as const).map((k) => (
                <Button key={k || "all"} type="button" size="sm" variant="glass-clear" icon={kind === k ? "check" : undefined} aria-pressed={kind === k} onClick={() => setKind(k)}>
                  {k ? KIND_LABEL[k] : "All"}
                </Button>
              ))}
            </div>
            <p className="ui-product-sheet-count" aria-live="polite">
              {shown.length} of {items.length}
            </p>
            {shown.length ? (
              <PickGrid size="sm" aria-label="Scene library" className="ui-product-sheet-grid">
                {shown.map((i) => (
                  <PickTile key={i.value} title={i.name} line={origin(i)} src={i.image} icon="package" selected={picked(i)} onSelectedChange={(on) => onPick(i, i.kind === "prop" ? on : true)} />
                ))}
              </PickGrid>
            ) : (
              <div className="ui-product-sheet-empty">
                <p>{query.trim() ? `Nothing matches “${query.trim()}”.` : "Nothing here yet."}</p>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="glass-white">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
