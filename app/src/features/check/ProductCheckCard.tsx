// Confirming a product is ONE component everywhere (round 9, DWAY-5, DTSK-6, DTSK-14; decision 5): the product's photo,
// its name and why it waits, the one question Fume has about it first, then its Product Truth lines, each changeable
// in place. The frame around it holds Later and Confirm at its foot: the right-side panel (ProductCheckHost, opened
// from Home, the chat, the brief and the product page) and the queue (/check/products) show exactly this card.
//
// Round 8, kept: Confirm is never greyed out without a reason. Pressed while Fume's question is open, it marks that
// field, says so and puts the focus there. Fume's questions are answered in their own record (closed everywhere); the
// photo question is answered by the photo on the card (kept, or the one she drops or adds).
//
// Use:
//   const check = useProductCheck(productId, { onDone });
//   <CheckCard …>{check.head}{check.body}</CheckCard>  or the panel's header and body;  check.confirm / check.later
import {
  Button,
  CheckAsk,
  CheckLine,
  Field,
  FieldDescription,
  FieldLabel,
  pickFiles,
  Textarea,
  useToast,
} from "@fume/ui";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  useAnswerQuestion,
  useCampaigns,
  useCorrectFact,
  useProduct,
  useProductKinds,
  useQuestions,
  useUploadShot,
  useVerifyProduct,
} from "../../api/hooks";
import type { Campaign, Id, Product, ProductFact } from "../../contract";
import { AnswerSuggestions } from "../questions/Suggestions";
import { ProductTruthSheet } from "../products/truth";

export type CheckVerdict = "confirmed" | "later";

/** The campaign that waits on a product, if any (it goes first in a queue, and the card says so). */
export const waitingOn = (campaigns: Campaign[] | undefined, productId: Id) =>
  (campaigns ?? []).find(
    (c) => !["delivered", "closed", "approved"].includes(c.state) && c.productIds.includes(productId),
  );

/** Round 13 (robot note 02, builder A): every campaign that waits on it, the newest first, so the Christmas brief
 *  that just picked Hand Balm is named, not only the older Hand Balm introduction. */
const waitWords = (campaigns: Campaign[] | undefined, productId: Id, first?: string) => {
  const found = (campaigns ?? [])
    .filter((c) => !["delivered", "closed", "approved"].includes(c.state) && c.productIds.includes(productId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((c) => c.name);
  const all = [...new Set([...(first ? [first] : []), ...found])];
  return all.length > 1
    ? `${all.slice(0, -1).join(", ")} and ${all[all.length - 1]} wait on it.`
    : `${all[0]} waits on it.`;
};

/** The product's own photo: the front reference shot, else its first picture. */
export const photoOf = (p: Product | undefined) => p?.shots?.find((s) => s.slotId === "front")?.image ?? p?.images[0];

/** Focus a field without making a phone raise its keyboard over the card before it is read (MOB-14). */
const finePointer = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches;

type Photo = { name: string; bytes: number; src: string };

export interface ProductCheckOptions {
  /** After Confirm saved everything, or after Later. */
  onDone: (verdict: CheckVerdict, product: Product) => void;
  /** The element the name is (the panel's title, so the panel is named by it); an h2 by default. */
  nameAs?: ComponentType<{ id?: string; className?: string; children?: ReactNode }>;
  /** Put the focus in the first empty answer once the product is there (default true). */
  autoFocus?: boolean;
  /** On the panel's Smoke: the pills are the glass ones (glass-one-white: the panel's Confirm is the one white). */
  glass?: boolean;
  /** The product as a list already has it (the catalogue), shown while its own record loads: no flash between items. */
  fallback?: Product;
  /** Round 13 (builder A): the campaign she is briefing where she opened it (the chat's Christmas brief), named first. */
  forCampaign?: string;
}

export interface ProductCheck {
  product: Product | undefined;
  /** Still loading the product. */
  pending: boolean;
  /** Nothing is left to write: Confirm will save. (Confirm is never disabled; this only words the hint.) */
  ready: boolean;
  busy: boolean;
  confirm: () => void;
  later: () => void;
  /** The photo beside the name, why it waits, and the photo's note: the panel's header, the card's left column. */
  head: ReactNode;
  /** Fume's question first, then the lines: the panel's body, the card's right column. */
  body: ReactNode;
  /** ⌘↵ (Ctrl+Enter) confirms from anywhere in the card: put it on the frame. */
  onKeyDown: (e: KeyboardEvent) => void;
}

/** One product's check: its state, its two actions, and the card's two parts. Key the caller by productId. */
export function useProductCheck(
  productId: Id,
  { onDone, nameAs: Name, autoFocus = true, glass = false, fallback, forCampaign }: ProductCheckOptions,
): ProductCheck {
  const product = useProduct(productId);
  const campaigns = useCampaigns();
  const openQuestions = useQuestions();
  const questions = (openQuestions.data ?? []).filter((q) => q.productId === productId);
  const answer = useAnswerQuestion();
  const correct = useCorrectFact();
  const verify = useVerifyProduct();
  const upload = useUploadShot();
  const kinds = useProductKinds();
  const toast = useToast();
  const [words, setWords] = useState<Record<Id, string>>({});
  const [changing, setChanging] = useState<Set<Id>>(new Set());
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [dropping, setDropping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  // A queue steps through products without remounting the card: everything she typed belongs to one product.
  const [forId, setForId] = useState(productId);
  const focused = useRef(false);
  if (forId !== productId) {
    setForId(productId);
    setWords({});
    setChanging(new Set());
    setPhoto(null);
    setDropping(false);
    setBusy(false);
    setTried(false);
    focused.current = false;
  }
  const p = product.data ?? (fallback?.id === productId ? fallback : undefined);
  const base = `check-${productId}`;

  // What Fume does not know comes first: it is the one line she has to write (round 8 robot walk, 19 Oct).
  const unknown = p ? p.facts.filter((f) => f.source === "unknown") : [];
  const lines = p ? p.facts.filter((f) => f.source !== "unknown") : [];
  const pictureQuestion = questions.find((q) => q.answer === "picture");
  const asked = (f: ProductFact) => questions.find((q) => q.factId === f.id);
  const said = (f: ProductFact) => words[f.id] ?? (f.source === "unknown" ? "" : f.statement);
  const empty = unknown.filter((f) => !said(f).trim());
  const ready = Boolean(p) && empty.length === 0 && lines.every((f) => said(f).trim());
  const blockedBy = waitingOn(campaigns.data, productId);
  const fieldId = (f: ProductFact) => `${base}-ask-${f.id}`;
  const quiet = glass ? "glass-clear" : "quiet";

  // The focus goes to the first empty answer once the product is there (DTSK-6, DWAY-13), on a desk.
  useEffect(() => {
    if (!p || p.id !== productId || focused.current) return;
    focused.current = true;
    if (!autoFocus || !finePointer()) return;
    const first = unknown.find((f) => !said(f).trim());
    if (first)
      window.requestAnimationFrame(() => document.getElementById(fieldId(first))?.focus({ preventScroll: true }));
  }, [p, productId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirm() {
    if (!p || busy) return;
    // Confirm is never greyed out without a reason: pressed with Fume's question open, it says so and goes there.
    if (!ready) {
      setTried(true);
      const first = unknown.find((f) => !said(f).trim()) ?? lines.find((f) => !said(f).trim());
      if (first) {
        if (first.source !== "unknown") setChanging((s) => new Set(s).add(first.id));
        window.requestAnimationFrame(() => document.getElementById(fieldId(first))?.focus());
      }
      return;
    }
    setBusy(true);
    try {
      // Fume's questions first, in their own record: answered here, closed in the brief, the chat and on Home too.
      for (const f of unknown) {
        const q = asked(f);
        if (q) await answer.mutateAsync({ questionId: q.id, text: said(f).trim() });
        else await correct.mutateAsync({ factId: f.id, statement: said(f).trim() });
      }
      if (pictureQuestion)
        await answer.mutateAsync(
          photo
            ? { questionId: pictureQuestion.id, picture: photo }
            : { questionId: pictureQuestion.id, keepPicture: true },
        );
      else if (photo)
        await upload.mutateAsync({
          productId: p.id,
          slotId: "front",
          name: photo.name,
          bytes: photo.bytes,
          src: photo.src,
        });
      for (const f of lines)
        if (said(f).trim() !== f.statement) await correct.mutateAsync({ factId: f.id, statement: said(f).trim() });
      await verify.mutateAsync(p.id);
      onDone("confirmed", p);
    } catch (error) {
      toast.error(`${p.name} wasn’t confirmed`, { description: error instanceof Error ? error.message : undefined });
      setBusy(false);
    }
  }
  const later = () => p && !busy && onDone("later", p);

  // ⌘↵ confirms from anywhere in the card (DTSK-14, DTSK-20).
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.defaultPrevented) {
      e.preventDefault();
      void confirm();
    }
  };

  const take = (file: File | undefined) => {
    if (file && file.type.startsWith("image/"))
      setPhoto({ name: file.name, bytes: file.size, src: URL.createObjectURL(file) });
  };
  async function addPhoto() {
    const [file] = await pickFiles("image/*", false);
    take(file);
  }
  // The photo is a drop target: drag a better packshot onto it from the desktop (DTSK-14).
  const files = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  const drop = {
    onDragEnter: (e: DragEvent) => files(e) && (e.preventDefault(), setDropping(true)),
    onDragOver: (e: DragEvent) => files(e) && e.preventDefault(),
    onDragLeave: (e: DragEvent) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setDropping(false),
    onDrop: (e: DragEvent) => {
      if (!files(e)) return;
      e.preventDefault();
      setDropping(false);
      take(e.dataTransfer.files[0]);
    },
  };

  // A dialog's own title (nameAs) keeps the id the dialog is labelled by; on a page the card is labelled by this one.
  const nameId = Name ? {} : { id: `${base}-name` };

  if (!p) {
    const text = product.isPending ? "Loading the product" : "This product could not be loaded.";
    const H = Name ?? "h2";
    return {
      product: undefined,
      pending: product.isPending,
      ready: false,
      busy: false,
      confirm: () => {},
      later: () => {},
      onKeyDown: () => {},
      head: (
        <div className="ui-check-product-head">
          <span className="ui-check-media" aria-hidden="true" />
          <div className="ui-check-head">
            <H {...nameId} className="ui-check-name">
              {text}
            </H>
          </div>
        </div>
      ),
      body: null,
    };
  }

  const name = p.name;
  const src = photo?.src ?? pictureQuestion?.picture ?? photoOf(p);
  const H = Name ?? "h2";
  const change = (f: ProductFact) => setChanging((s) => new Set(s).add(f.id));

  const head = (
    <div className="ui-check-product-head">
      <figure className="ui-check-media" data-dropping={dropping || undefined} {...drop}>
        {src ? (
          <img src={src} alt={photo ? `Your photo of ${name}` : `${name}, as Fume has it`} />
        ) : (
          <span className="ui-check-media-empty">No photo yet</span>
        )}
        <span className="ui-check-drop" aria-hidden="true">
          Drop a better photo
        </span>
      </figure>
      <div className="ui-check-head">
        <H {...nameId} className="ui-check-name">
          {/* one span, so a title laid out as a row (the sheet's, beside its ✕) keeps the space before the size */}
          <span>
            {name}
            {p.variant && <span className="ui-check-name-variant"> {p.variant}</span>}
          </span>
        </H>
        <p className="ui-check-lead" id={`${base}-lead`}>
          {blockedBy || forCampaign
            ? `${waitWords(campaigns.data, productId, forCampaign)} Is this right?`
            : "Is this right? Change any line that is off."}
        </p>
        <p className="ui-check-media-caption">
          <span>
            {photo
              ? "Your photo. Fume draws it from this one."
              : src
                ? `Fume draws ${name} from this photo.`
                : "Add a photo taken straight on, in soft light."}
          </span>
          <Button size="sm" variant={quiet} icon="upload" onClick={() => void addPhoto()}>
            {photo ? "Another photo" : src ? "Add a better one" : "Add a photo"}
          </Button>
        </p>
      </div>
    </div>
  );

  const body = (
    <div className="ui-check-body">
      {unknown.map((f) => {
        const q = asked(f);
        const id = fieldId(f);
        const missing = tried && !said(f).trim();
        return (
          <CheckAsk
            key={f.id}
            title={q?.question ?? f.statement}
            why={q?.why ?? "Every line on a creative must be true, so Fume asks before it guesses."}
          >
            {/* round 13 (#6, #7, builder A): each suggestion with its words, and what this kind of product usually says */}
            <AnswerSuggestions
              question={q}
              value={said(f)}
              onChange={(text) => setWords((w) => ({ ...w, [f.id]: text }))}
              glass={glass}
            />
            <Field invalid={missing}>
              <FieldLabel htmlFor={id}>Your answer</FieldLabel>
              {/* No placeholder: an empty field must never look answered (DTSK-6). What a good answer looks like is
                  said under it, and the field is marked if Confirm is pressed while it is empty. */}
              <Textarea
                id={id}
                rows={2}
                value={said(f)}
                aria-invalid={missing || undefined}
                aria-describedby={`${id}-help`}
                onChange={(e) => setWords((w) => ({ ...w, [f.id]: e.target.value }))}
              />
              <FieldDescription id={`${id}-help`}>
                {missing
                  ? "Answer this first, then confirm. Or choose Later."
                  : q?.hint
                    ? q.hint.replace(/[^.?]$/, "$&.")
                    : "In your words, as it may stand on a creative."}
              </FieldDescription>
            </Field>
          </CheckAsk>
        );
      })}

      {lines.length > 0 && (
        <ul className="ui-check-lines" aria-label={`What Fume read about ${name}`}>
          {lines.map((f) => {
            const open = changing.has(f.id);
            const changed = said(f).trim() !== f.statement;
            const id = fieldId(f);
            return (
              <CheckLine
                key={f.id}
                label={f.label}
                note={changed ? "Your words" : f.confidence === "low" ? "Fume is not sure" : undefined}
                editing={open}
                action={
                  <Button
                    id={`${base}-change-${f.id}`}
                    size="sm"
                    variant={quiet}
                    icon="pencil"
                    onClick={() => change(f)}
                    aria-label={`Change the ${f.label.toLowerCase()}`}
                  >
                    Change
                  </Button>
                }
              >
                {open ? (
                  <Textarea
                    id={id}
                    aria-label={`${f.label}, in your words`}
                    rows={2}
                    value={said(f)}
                    autoFocus={!tried}
                    aria-invalid={(tried && !said(f).trim()) || undefined}
                    onChange={(e) => setWords((w) => ({ ...w, [f.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      // Esc leaves the line as Fume read it and closes the field (the panel stays open).
                      if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        setWords((w) => {
                          const { [f.id]: _, ...rest } = w;
                          return rest;
                        });
                        setChanging((s) => {
                          const n = new Set(s);
                          n.delete(f.id);
                          return n;
                        });
                        // The focus goes back to the line's Change, never to the page behind.
                        window.requestAnimationFrame(() => document.getElementById(`${base}-change-${f.id}`)?.focus());
                      }
                    }}
                  />
                ) : (
                  f.statement
                )}
              </CheckLine>
            );
          })}
        </ul>
      )}
      {/* round 13 (#46, builder D): everything else Fume holds about it, organised, so she confirms it knowing all of it */}
      {p && !glass && (
        <ProductTruthSheet
          product={p}
          kind={kinds.data?.find((k) => k.id === p.kindId)}
          title={`Everything Fume holds about ${name}`}
        />
      )}
    </div>
  );

  return { product: p, pending: false, ready, busy, confirm: () => void confirm(), later, head, body, onKeyDown };
}
