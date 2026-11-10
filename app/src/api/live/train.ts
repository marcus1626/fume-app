// Train the Engine on the live backend (20261106160000_train_the_engine.sql): the deck is `train_cards`; a yes or no
// is `teach_engine` (it becomes a lesson for the brand); a word on the check is `judge_detail`. Pictures and the check's
// close-ups are short-lived signed links; a product kept only as a link to the brand's site shows from that link.
import type { FumeApi, TrainCard, TrainDeck, TrainFinding } from "../../contract";
import type { Live } from "./context";
import { signedLinks } from "./signed";
import { command } from "./supabase";

type Calls = "trainDeck" | "trainAnswer" | "trainJudge";

interface Detail {
  n: number;
  kind?: "part" | "print";
  part?: string;
  what: string;
  reads?: string;
  expected?: string;
  ok: boolean;
  note?: string;
}

interface CardRow {
  id: string;
  workspace_id: string;
  brand_name: string;
  made_at: string;
  picture: { bucket: string; path: string };
  details: Detail[] | null;
  details_of: string;
  product: {
    name: string;
    variant: string | null;
    bucket: string | null;
    path: string | null;
    url: string | null;
  } | null;
  labels: { detail: string; verdict: "right" | "wrong"; note: string | null }[];
}

/** The finding's key, as the check names it on the version (findings.detail). */
const keyOf = (d: Detail) => (d.kind === "part" && d.part ? d.part : `print:${d.expected ?? d.what}`);

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Signs many paths, bucket by bucket, in one call each; a path that cannot be read gets none. */
async function sign(paths: { bucket: string; path: string }[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const buckets = new Map<string, string[]>();
  for (const p of paths) buckets.set(p.bucket, [...(buckets.get(p.bucket) ?? []), p.path]);
  await Promise.all(
    [...buckets].map(async ([bucket, list]) => {
      for (const [path, url] of await signedLinks(bucket, list)) out.set(`${bucket}/${path}`, url);
    }),
  );
  return out;
}

export function trainCalls(_live: Live): Pick<FumeApi, Calls> {
  return {
    async trainDeck() {
      const data = await command<{ cards: CardRow[]; answered: number; judged: number }>("train_cards", {
        p_limit: 120,
      });
      const rows = data.cards ?? [];
      const faults = (r: CardRow) => (r.details ?? []).filter((d) => !d.ok && d.note);
      const closeUp = (r: CardRow, d: Detail, ref: boolean) =>
        `${r.workspace_id}/check/${r.details_of}-${d.n}${ref ? "-ref" : ""}.png`;
      const links = await sign([
        ...rows.map((r) => r.picture),
        ...rows.flatMap((r) =>
          r.product?.bucket && r.product.path ? [{ bucket: r.product.bucket, path: r.product.path }] : [],
        ),
        ...rows.flatMap((r) =>
          faults(r).flatMap((d) => [
            { bucket: "workspace-files", path: closeUp(r, d, false) },
            { bucket: "workspace-files", path: closeUp(r, d, true) },
          ]),
        ),
      ]);
      const cards = rows.map((r): TrainCard => {
        const label = (key: string) => r.labels.find((l) => l.detail === key);
        const clean = label("none");
        return {
          id: r.id,
          workspaceId: r.workspace_id,
          brandName: r.brand_name,
          image: links.get(`${r.picture.bucket}/${r.picture.path}`) ?? "",
          madeAt: r.made_at,
          product: r.product
            ? {
                name: [r.product.name, r.product.variant].filter(Boolean).join(" · "),
                image:
                  (r.product.bucket && r.product.path
                    ? links.get(`${r.product.bucket}/${r.product.path}`)
                    : r.product.url) ?? undefined,
              }
            : undefined,
          checked: r.details !== null,
          findings: faults(r).map((d): TrainFinding => {
            const key = keyOf(d);
            const said = label(key);
            return {
              key,
              label: capital(d.what),
              note: d.note ?? "",
              expected: d.expected,
              seen: d.reads,
              seenImage: links.get(`workspace-files/${closeUp(r, d, false)}`),
              expectedImage: links.get(`workspace-files/${closeUp(r, d, true)}`),
              judged: said?.verdict,
              judgedNote: said?.note ?? undefined,
            };
          }),
          clean: clean ? { judged: clean.verdict, note: clean.note ?? undefined } : undefined,
        };
      });
      return { cards: cards.filter((c) => c.image), answered: data.answered, judged: data.judged } satisfies TrainDeck;
    },

    async trainAnswer({ cardId, verdict, why }) {
      await command("teach_engine", { p_candidate_id: cardId, p_verdict: verdict, p_why: why?.trim() || null });
    },

    async trainJudge({ cardId, key, verdict, note }) {
      await command("judge_detail", {
        p_candidate_id: cardId,
        p_detail: key,
        p_verdict: verdict,
        p_note: note?.trim() || null,
      });
    },
  };
}
