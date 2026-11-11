// How well the Engine's pictures keep the brand's taste, counted two ways for each kind of picture: over every field
// the brand keeps to, and over what the brief left open (the fields that describe the place are left out, so a picture
// is not counted down for being on a street when the brief asked for a street). The brand's own pictures and the floor
// (the brand's pictures of its other kinds) are counted the same way beside them.
//   deno run -A tools/taste/open.ts <cards.json>[,<more.json>] <brand set>[,<more>] <engine set>[,<more>]
import { ofThePlace } from "../../supabase/functions/_shared/taste/direction.ts";
import { buildProfile, byKind, type Card, fit, type Kind, kindOf, KINDS, photographic } from "../../supabase/functions/_shared/taste/profile.ts";
import { type Field, FIELDS } from "../../supabase/functions/_shared/taste/schema.ts";

const [files, brandSets, engineSets] = Deno.args;
if (!files || !brandSets || !engineSets) throw new Error("usage: open.ts <cards.json>[,<more.json>] <brand set>[,<more>] <engine set>[,<more>]");
const sets: Record<string, Card[]> = {};
for (const file of files.split(",")) Object.assign(sets, JSON.parse(await Deno.readTextFile(file)));
const cardsOf = (name: string) => {
  const s = sets[name];
  if (!s) throw new Error(`no set "${name}"`);
  return s.map((c) => ({ ...c, read: c.read ?? {} }));
};

const brand = brandSets.split(",").flatMap(cardsOf).filter(photographic);
const kinds = byKind(brand);
const place = FIELDS.map((f) => f.key).filter(ofThePlace);
// What the picture carries before the design layer sets words on it (profile.ts proofOf).
const levers: Field["lever"][] = ["plan", "prompt", "reference", "finish", "select"];
const middle = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : 0;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x: number) => `${Math.round(x * 100)} %`;

for (const kind of KINDS) {
  const own = kinds[kind];
  if (!own) continue;
  const profile = buildProfile(own);
  const others = brand.filter((c) => kindOf(c.shows) !== null && kindOf(c.shows) !== kind);
  console.log(`\n${kind} (${own.length} of the brand's pictures)`);
  for (const [name, skip] of [["every field", ["kind.type"]], ["left open by the brief", ["kind.type", ...place]]] as [string, string[]][]) {
    const of = (c: Card) => fit(profile, c, { levers, skip }).fit;
    // The brand's own against the profile they are part of: close enough for the middle, and quick.
    console.log(`  ${name}: the brand's own ${pct(middle(own.map(of)))}, floor ${others.length ? pct(middle(others.map(of))) : "none"}`);
    for (const set of engineSets.split(",")) {
      const cards = cardsOf(set).filter((c) => kindOf(c.shows) === (kind as Kind));
      if (!cards.length) continue;
      console.log(`    ${set} (${cards.length}): middle ${pct(middle(cards.map(of)))}, mean ${pct(mean(cards.map(of)))}   ${cards.map((c) => `${c.id.replace(/^.*\//, "").replace(/\.\w+$/, "")} ${Math.round(of(c) * 100)}`).join(", ")}`);
    }
  }
}
console.log(`\n${place.length} fields are of the place.`);
