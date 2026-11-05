// Brand › Look Book (/brand/look, FLOWS §32, PROPOSED): the brand's photography as Fume read it from the brand's own
// pictures, so every picture the Engine makes is shot the way the brand shoots. The book's frame (version, check,
// approval, versions) is the one the Tone of Voice and the design system share (books.tsx). The page opens with what
// makes a picture the brand's and the pictures Fume read, then camera, light, colour, texture, composition, styling,
// people, retouching, what it never does, the recipes per kind of scene, and what Fume still needs to know. Every
// claim's picture is named by its number. The look is brand-book.css.
import { DataList, DataListItem, Icon } from "@fume/ui";
import type { ReactNode } from "react";
import type { LookBook, LookPictureKind } from "../../contract";
import { BookFrame, NoBook } from "./books";
import { useViewer } from "./parts";
import { BookEnd } from "./voice";

/** Brand › Look Book. */
export function LookBookPage() {
  const viewer = useViewer();
  return (
    <BookFrame
      kind="look"
      description={`How ${viewer.staff ? `${viewer.brand}’s` : "your"} pictures are shot: the Engine shoots every picture from it.`}
      empty={<NoBook kind="look" staff={viewer.staff} brand={viewer.brand} />}
    >
      {(body) => <LookBookView book={body} />}
    </BookFrame>
  );
}

const kindWord: Record<LookPictureKind, string> = {
  brand: "Brand DNA",
  liked: "Liked in Taste",
  not_us: "Turned down in Taste",
  site: "The website",
};

const grains: LookBook["texture"]["grain"][] = ["none", "fine", "medium", "heavy"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Honey amber #B5651D" as a name and a colour; a colour without a hex has no swatch. */
function swatchOf(entry: string): { name: string; hex?: string } {
  const m = entry.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/i);
  if (!m) return { name: entry };
  return {
    name:
      entry
        .replace(m[0], "")
        .replace(/[\s,·:–-]+$/, "")
        .trim() || m[0],
    hex: m[0].toUpperCase(),
  };
}

/** A part of the Look Book: its title, its line, then what it holds. */
function Part({ id, title, line, children }: { id: string; title: string; line?: string; children: ReactNode }) {
  return (
    <section className="ui-voice-part" id={`look-${id}`} aria-labelledby={`look-${id}-title`}>
      <div className="ui-voice-part-words">
        <h2 className="ui-voice-part-title" id={`look-${id}-title`}>
          {title}
        </h2>
        {line && <p className="ui-voice-part-line">{line}</p>}
      </div>
      {children}
    </section>
  );
}

function Rules({ items, label }: { items: string[]; label?: string }) {
  if (!items.length) return null;
  return (
    <ul className="ui-voice-list" aria-label={label}>
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
}

/** The whole Look Book. */
export function LookBookView({ book }: { book: LookBook }) {
  const { staff, brand } = useViewer();
  const whose = staff ? `${brand}’s` : "your";
  return (
    <div className="ui-voice-book">
      <p className="ui-voice-lead ui-brandbook-summary">{book.summary}</p>

      <Part id="signature" title="The signature" line={`What makes a picture ${staff ? brand : "yours"} at a glance.`}>
        <ol className="ui-lookbook-signature">
          {book.signature.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Part>

      <Part
        id="pictures"
        title={`Read from ${whose} pictures`}
        line={`The ${book.pictures} pictures Fume read, and what each shows. The look rests on them; a number in this book is a picture here.`}
      >
        <ol className="ui-lookbook-pictures">
          {book.evidence.map((e) => (
            <li key={e.picture} className="ui-lookbook-picture" data-kind={e.kind}>
              <span className="ui-lookbook-picture-frame">
                {e.url ? <img src={e.url} alt="" loading="lazy" /> : <Icon name="image" />}
              </span>
              <span className="ui-lookbook-picture-meta">
                <span className="ui-lookbook-picture-num">{e.picture}</span>
                {kindWord[e.kind]}
              </span>
              <span className="ui-lookbook-picture-shows">{e.shows}</span>
            </li>
          ))}
        </ol>
      </Part>

      <Part id="camera" title="Camera" line={book.camera.capture}>
        <ul className="ui-lookbook-lenses" aria-label="Lenses">
          {book.camera.lenses.map((l) => (
            <li key={l.focalMm} className="ui-lookbook-lens">
              <span className="ui-lookbook-lens-num">{l.focalMm} mm</span>
              <span className="ui-lookbook-lens-use">{l.use}</span>
            </li>
          ))}
        </ul>
        <DataList variant="stacked" className="ui-voice-facts">
          <DataListItem label="Aperture">{book.camera.aperture}</DataListItem>
          <DataListItem label="Height">{book.camera.height}</DataListItem>
          <DataListItem label="Distance">{book.camera.distance}</DataListItem>
          <DataListItem label="Motion">{book.camera.motion}</DataListItem>
        </DataList>
      </Part>

      <Part id="light" title="Light" line={book.light.key}>
        <DataList variant="stacked" className="ui-voice-facts">
          <DataListItem label="Quality">{book.light.quality}</DataListItem>
          <DataListItem label="Direction">{book.light.direction}</DataListItem>
          <DataListItem label="Colour temperature">{book.light.colourTemperatureK}</DataListItem>
          <DataListItem label="Contrast">{book.light.contrast}</DataListItem>
          <DataListItem label="Time of day">{book.light.timeOfDay}</DataListItem>
        </DataList>
        <Rules items={book.light.rules} label="Rules for the light" />
      </Part>

      <Part id="colour" title="Colour" line={book.colour.grade}>
        <ul className="ui-brandbook-swatches ui-lookbook-palette" aria-label="The colours the pictures are built from">
          {book.colour.palette.map(swatchOf).map((s) => (
            <li key={s.name} className="ui-brandbook-swatch">
              <span
                className="ui-brandbook-swatch-colour"
                style={s.hex ? { background: s.hex } : undefined}
                aria-hidden="true"
              />
              <span className="ui-brandbook-swatch-name">{s.name}</span>
              {s.hex && <span className="ui-brandbook-swatch-code">{s.hex}</span>}
            </li>
          ))}
        </ul>
        <DataList variant="stacked" className="ui-voice-facts">
          <DataListItem label="Saturation">{book.colour.saturation}</DataListItem>
          <DataListItem label="Blacks">{book.colour.blacks}</DataListItem>
          <DataListItem label="Highlights">{book.colour.highlights}</DataListItem>
          <DataListItem label="White balance">{book.colour.whiteBalance}</DataListItem>
        </DataList>
      </Part>

      <Part id="texture" title="Texture" line={book.texture.grainCharacter}>
        <div className="ui-brandbook-scale ui-lookbook-grain">
          <span className="ui-brandbook-scale-word">Grain</span>
          <span
            className="ui-lookbook-grain-steps"
            role="img"
            aria-label={`Grain: ${book.texture.grain}, of none, fine, medium and heavy`}
          >
            {grains.map((g) => (
              <span key={g} className="ui-lookbook-grain-step" data-at={g === book.texture.grain ? "" : undefined}>
                {cap(g)}
              </span>
            ))}
          </span>
        </div>
        <DataList variant="stacked" className="ui-voice-facts">
          <DataListItem label="Sharpness">{book.texture.sharpness}</DataListItem>
          <DataListItem label="Surfaces">{book.texture.surfaces}</DataListItem>
          <DataListItem label="The lens">{book.texture.lensCharacter}</DataListItem>
        </DataList>
      </Part>

      <Part id="composition" title="Composition" line={book.composition.subjectPlacement}>
        <Rules items={book.composition.rules} label="Rules for the composition" />
        <DataList variant="stacked" className="ui-voice-facts">
          <DataListItem label="Space for words">{book.composition.negativeSpace}</DataListItem>
        </DataList>
      </Part>

      <Part id="styling" title="Styling" line={book.styling.props}>
        <Rules items={book.styling.settings} label="Where the pictures are shot" />
        <DataList variant="stacked" className="ui-voice-facts">
          <DataListItem label="Surfaces">{book.styling.surfaces}</DataListItem>
          <DataListItem label="Wardrobe">{book.styling.wardrobe}</DataListItem>
        </DataList>
      </Part>

      <Part
        id="people"
        title="People"
        line={book.people.shows ? book.people.casting : `${cap(whose)} pictures show no people.`}
      >
        {book.people.shows && (
          <DataList variant="stacked" className="ui-voice-facts">
            <DataListItem label="Direction">{book.people.direction}</DataListItem>
            <DataListItem label="Skin">{book.people.skin}</DataListItem>
          </DataList>
        )}
      </Part>

      <Part id="retouch" title="Retouching">
        <p className="ui-lookbook-prose">{book.retouch}</p>
      </Part>

      <Part id="never" title="Never" line={`What ${whose} pictures never do. The Engine writes every prompt with it.`}>
        <ul className="ui-voice-list ui-lookbook-never">
          {book.never.map((x) => (
            <li key={x}>
              <Icon name="x" />
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </Part>

      <Part
        id="recipes"
        title="Recipes"
        line="One per kind of scene. The Engine takes the one closest to the picture the plan asks for."
      >
        <ul className="ui-lookbook-recipes">
          {book.recipes.map((r) => (
            <li key={r.scene} className="ui-lookbook-recipe">
              <h3 className="ui-lookbook-recipe-scene">{r.scene}</h3>
              <DataList variant="stacked" className="ui-voice-facts">
                <DataListItem label="Camera">{r.camera}</DataListItem>
                <DataListItem label="Light">{r.light}</DataListItem>
                <DataListItem label="Grade">{r.grade}</DataListItem>
                <DataListItem label="Composition">{r.composition}</DataListItem>
              </DataList>
            </li>
          ))}
        </ul>
      </Part>

      <BookEnd gaps={book.gaps} sources={book.sources} />
    </div>
  );
}
