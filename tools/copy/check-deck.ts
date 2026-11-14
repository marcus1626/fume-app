// Runs the copy Engine's checks on a deck written by hand or by a model, with no model call.
// deno run -A tools/copy/check-deck.ts <deck.json> <context.json> [report.json]
// A deck is either { brand, pieces } or a presentation { brand, sections: [{ blocks }] } whose blocks of type
// "piece" hold pieces and blocks of type "beats" hold a video's spoken lines and text on screen.
import { checkDeck, reportText, type CopyContext, type CopyDeck, type CopyPiece } from "../../supabase/functions/_shared/copy/index.ts";

type Block = { type: string; piece?: CopyPiece; id?: string; rows?: { beat: string; s: string; said?: string; screen?: string }[] };

export function deckOf(doc: { brand: string; pieces?: CopyPiece[]; sections?: { blocks: Block[] }[] }): CopyDeck {
  if (doc.pieces) return { brand: doc.brand, pieces: doc.pieces };
  const pieces: CopyPiece[] = [];
  for (const s of doc.sections ?? [])
    for (const b of s.blocks) {
      if (b.type === "piece" && b.piece) pieces.push(b.piece);
      if (b.type === "beats" && b.id && b.rows)
        pieces.push({
          id: b.id,
          fields: b.rows.flatMap((r, i) => [
            ...(r.said ? [{ ref: `${b.id}/${i + 1}.said`, format: "video.spoken", text: r.said }] : []),
            ...(r.screen ? [{ ref: `${b.id}/${i + 1}.screen`, format: i === 0 ? "video.hook" : "video.onscreen", text: r.screen }] : []),
          ]),
        });
    }
  return { brand: doc.brand, pieces };
}

if (import.meta.main) {
  const [deckPath, ctxPath, out] = Deno.args;
  const deck = deckOf(JSON.parse(await Deno.readTextFile(deckPath)));
  const ctx: CopyContext = JSON.parse(await Deno.readTextFile(ctxPath));
  const report = checkDeck(deck, ctx);
  console.log(reportText(report));
  if (out) await Deno.writeTextFile(out, JSON.stringify(report, null, 2));
  Deno.exit(report.clean ? 0 : 1);
}
