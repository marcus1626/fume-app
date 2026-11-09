// Train the Engine in the mock: the deck is the Studio's pictures from the Engine on every brand, newest first; the
// first one carries a fault the check found, so the page shows both kinds of answer. Answers live with the mock's db.
import { FumeError, type FumeApi, type Id, type TrainCard, type TrainVerdict, type CheckVerdict } from "../contract";
import type { Mock } from "./context";
import type { Db } from "./db";

type Calls = "trainDeck" | "trainAnswer" | "trainJudge";

interface Said {
  answers: Map<string, { verdict: TrainVerdict; why?: string }>;
  words: Map<string, { verdict: CheckVerdict; note?: string }>;
}
const said = new WeakMap<Db, Said>();
const of = (db: Db): Said => {
  let s = said.get(db);
  if (!s) said.set(db, (s = { answers: new Map(), words: new Map() }));
  return s;
};
const mine = (m: Mock, id: Id) => `${m.userId}:${id}`;

export function trainCalls(m: Mock): Pick<FumeApi, Calls> {
  const { db, wait } = m;
  /** Fume's own people train the Engine; an agency's people and customers do not. */
  const mustFume = () => {
    if (!m.isStaff() || m.me().agency) throw new FumeError("forbidden", "Only Fume’s own team trains the Engine.");
  };
  const pictures = () =>
    db.sessions
      .flatMap((s) => s.generations.filter((g) => g.state !== "making" && g.image).map((g) => ({ s, g })))
      .sort((a, b) => b.g.at.localeCompare(a.g.at))
      // A picture shown in two sessions is one picture.
      .filter((p, i, all) => all.findIndex((q) => q.g.id === p.g.id) === i);
  const find = (id: Id) => {
    const found = pictures().find((p) => p.g.id === id);
    if (!found) throw new FumeError("not_found", "That picture is gone.");
    return found;
  };

  return {
    async trainDeck() {
      mustFume();
      const s = of(db);
      const all = pictures();
      const cards = all
        .filter(({ g }) => !s.answers.has(mine(m, g.id)))
        .map(({ s: session, g }, i): TrainCard => {
          const product = db.products.find((p) => p.workspaceId === session.workspaceId && p.images.length > 0);
          const word = (key: string) => s.words.get(`${mine(m, g.id)}:${key}`);
          const findings =
            i === 0
              ? [
                  {
                    key: "front-buttons",
                    label: "Front buttons",
                    note: "The picture shows 5 front buttons; the product has 7.",
                    expected: "Seven small four-hole buttons down the front placket.",
                    seen: "Five buttons down the front placket.",
                  },
                ].map((f) => ({ ...f, judged: word(f.key)?.verdict, judgedNote: word(f.key)?.note }))
              : [];
          const clean = word("none");
          return {
            id: g.id,
            workspaceId: session.workspaceId,
            brandName: db.workspaces.find((w) => w.id === session.workspaceId)?.brandName ?? "",
            image: g.image,
            madeAt: g.at,
            product: product ? { name: product.name, image: product.images[0] } : undefined,
            checked: i % 3 !== 2,
            findings,
            clean: clean ? { judged: clean.verdict, note: clean.note } : undefined,
          };
        });
      const answered = [...s.answers.keys()].filter((k) => k.startsWith(`${m.userId}:`)).length;
      const judged = [...s.words.keys()].filter((k) => k.startsWith(`${m.userId}:`)).length;
      return wait({ cards, answered, judged });
    },

    async trainAnswer({ cardId, verdict, why }) {
      mustFume();
      find(cardId);
      if (verdict !== "yes" && verdict !== "no") throw new FumeError("invalid", "The answer is yes or no.");
      const s = of(db);
      const before = s.answers.get(mine(m, cardId));
      const words = why?.trim() || (before?.verdict === verdict ? before.why : undefined);
      s.answers.set(mine(m, cardId), { verdict, why: words });
      return wait(undefined);
    },

    async trainJudge({ cardId, key, verdict, note }) {
      mustFume();
      find(cardId);
      if (!key.trim()) throw new FumeError("invalid", "Say which finding this is about.");
      const s = of(db);
      const at = `${mine(m, cardId)}:${key}`;
      if (verdict === null) s.words.delete(at);
      else if (verdict !== "right" && verdict !== "wrong")
        throw new FumeError("invalid", "The check is right or wrong.");
      else {
        const before = s.words.get(at);
        s.words.set(at, { verdict, note: note?.trim() || (before?.verdict === verdict ? before.note : undefined) });
      }
      return wait(undefined);
    },
  };
}
