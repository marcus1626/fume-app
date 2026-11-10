// Reads the cards a measuring or reading run wrote and prints what the schema says: the brand's profile, its taste
// score, and where another set (the Engine's pictures) departs from it.
//   deno run -A tools/taste/report.ts <cards.json> <brand set> [other set] [out.json]
import { finishOfPhotographs } from "../../supabase/functions/_shared/taste/build.ts";
import { buildProfile, type Card, compare, fit, type Proof, proofOf, tasteScore } from "../../supabase/functions/_shared/taste/profile.ts";

const [file, brandSet, otherSet, out] = Deno.args;
if (!file || !brandSet) throw new Error("usage: report.ts <cards.json> <brand set> [other set] [out.json]");
const sets = JSON.parse(await Deno.readTextFile(file)) as Record<string, Card[]>;
const cardsOf = (name: string) => {
  const s = sets[name];
  if (!s) throw new Error(`no set "${name}"`);
  return s.map((c) => ({ ...c, read: c.read ?? {} }));
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const brandCards = cardsOf(brandSet);
// As build() counts: a card with no photograph in it keeps no finish numbers.
const brand = buildProfile(finishOfPhotographs(brandCards));
// The brand's own fit is counted on a profile built without the picture, so it does not praise itself.
const ownFit = mean(brandCards.map((c) => fit(buildProfile(brandCards.filter((x) => x.id !== c.id)), c).fit));
// Proof is counted like with like: the brand's pictures with a photograph in them against the Engine's.
let proof: Proof | null = null;
let gaps: ReturnType<typeof compare> = [];
let other = null;
if (otherSet) {
  const otherCards = cardsOf(otherSet);
  other = buildProfile(finishOfPhotographs(otherCards));
  proof = proofOf(brandCards, otherCards);
  gaps = compare(brand, other);
}
const score = tasteScore(brand, proof);
const standing: Record<string, number> = {};
for (const f of Object.values(brand.fields)) standing[f.standing] = (standing[f.standing] ?? 0) + 1;
console.log(`${brandSet}: ${brand.pictures} pictures, ${brand.campaigns} campaigns`);
console.log(`taste score ${score.score}/100`, score.parts.map((p) => `${p.label} ${p.points}/${p.of}`).join(", "));
console.log("standing", standing, "own fit over all pictures", ownFit.toFixed(2));
console.log(proof ? `proof on ${proof.own} photographs (${proof.left} left out): engine fit ${proof.engineFit.toFixed(2)}, own fit ${proof.ownFit.toFixed(2)}` : "no proof: too few photographs of the brand, or no Engine pictures");
for (const g of gaps.slice(0, 25)) console.log(`  ${g.distance.toFixed(2)} ${g.standing.padEnd(8)} ${g.key.padEnd(34)} brand ${g.brand} | other ${g.other}`);
if (out) await Deno.writeTextFile(out, JSON.stringify({ brand, other, score, proof, gaps }, null, 1));
