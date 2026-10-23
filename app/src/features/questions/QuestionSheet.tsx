// One question, one sheet (UX review 19 Oct, WAY-3, LOAD-4; round 8 decision: "a question about a product lives on
// that product and is answered in one shared sheet wherever it is asked"). Home, the Fume chat, a campaign and the
// product page all open this sheet (or, on the product page, show its answer inline): the question, why Fume asks,
// the answer field and "Answer". She stays where she was. The answer lands on the product's own line, and the mock
// spreads it to the brief, the chat and the Brand understanding, so answering once closes it everywhere.
// Round 9 (DWAY-5, DTSK-6, decision 5): on a desk it is the right-side panel, never a centred dialog, and the page stays
// in view. Questions that are all about one product open that product's card instead (ProductCheckPanel: the photo,
// Fume's question first, the lines, Later · Confirm), so a product is confirmed in one place, however it was asked.
// Answer is never greyed out: pressed with nothing written, it says what is missing. The hint is under the field, not
// a placeholder that reads as an answer.
//
// Use:
//   const q = useQuestion({ campaignId });            // or { productId }, { questionId }
//   <QuestionSheet campaignId={id} open={open} onOpenChange={setOpen} />
//   <QuestionAnswer question={q} />                    // inline, on the light ground (the product page)
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Field,
  FieldDescription,
  FieldLabel,
  pickFiles,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
  useNarrowScreen,
  useToast,
} from "@fume/ui";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useAnswerQuestion, useCatalogue, useQuestions } from "../../api/hooks";
import type { Id, OpenQuestion } from "../../contract";
import { ProductCheckPanel } from "../check/ProductCheckHost";
import { AnswerSuggestions } from "./Suggestions";

/** Which question: by its id (or several ids, asked in turn), or the open ones about a product, a product line or a
 *  campaign's brief. Every field given must match. */
export interface QuestionTarget {
  questionId?: Id;
  ids?: Id[];
  productId?: Id;
  factId?: Id;
  campaignId?: Id;
}

const matches = (q: OpenQuestion, t: QuestionTarget) =>
  (!t.questionId || q.id === t.questionId) &&
  (!t.ids || t.ids.includes(q.id)) &&
  (!t.productId || q.productId === t.productId) &&
  (!t.factId || q.factId === t.factId) &&
  (!t.campaignId || q.campaignId === t.campaignId);

/** Every open question that fits the target, in the order Fume needs them. An empty target gives them all. */
export function useOpenQuestions(target: QuestionTarget = {}): { questions: OpenQuestion[]; loading: boolean } {
  const all = useQuestions();
  return { questions: (all.data ?? []).filter((q) => matches(q, target)), loading: all.isLoading };
}

/** The first open question that fits the target (undefined when there is none, or while loading). */
export function useQuestion(target: QuestionTarget): OpenQuestion | undefined {
  return useOpenQuestions(target).questions[0];
}

/** The answer's state and its one action, shared by the sheet and the inline form. */
function useAnswer(
  question: OpenQuestion | undefined,
  onAnswered?: (question: OpenQuestion, answer: string) => void,
  /** The sheet asks several in turn: only the last answer gets a toast, the next question is the answer to the rest. */
  last = true,
) {
  const answer = useAnswerQuestion();
  const toast = useToast();
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<{ name: string; bytes: number; src: string } | null>(null);
  // Answer was pressed with nothing written: the field says so.
  const [tried, setTried] = useState(false);
  // A new question starts empty.
  useEffect(() => {
    setText("");
    setPhoto(null);
    setTried(false);
  }, [question?.id]);

  const ready = question
    ? question.answer === "picture"
      ? Boolean(photo || question.picture)
      : text.trim().length > 0
    : false;

  function send(keepPicture = false) {
    if (!question || answer.isPending) return;
    const said = question.answer === "picture" ? (photo ? "Photo added" : "Photo kept") : text.trim();
    answer.mutate(
      question.answer === "picture"
        ? { questionId: question.id, ...(photo && !keepPicture ? { picture: photo } : { keepPicture: true }) }
        : { questionId: question.id, text: said },
      {
        onSuccess: (left) => {
          const briefDone = question.campaignId && !left.some((q) => q.campaignId === question.campaignId);
          if (last)
            toast.done(question.answer === "picture" ? "Photo saved" : "Answer saved", {
              description: briefDone
                ? "The brief has what it needs now, so the work can start."
                : "Fume uses it everywhere it asked.",
            });
          onAnswered?.(question, said);
        },
        onError: (error) => toast.error("That wasn’t saved", { description: error.message }),
      },
    );
  }

  async function addPhoto() {
    const [file] = await pickFiles("image/*", false);
    if (!file) return;
    setPhoto({ name: file.name, bytes: file.size, src: URL.createObjectURL(file) });
  }

  return { text, setText, photo, addPhoto, ready, send, tried, setTried, busy: answer.isPending };
}

type AnswerState = ReturnType<typeof useAnswer>;

/** The field (or the photo) and Fume's suggestions. */
function AnswerFields({
  question,
  state,
  formId,
  autoFocus,
  glass,
}: {
  question: OpenQuestion;
  state: AnswerState;
  formId: string;
  autoFocus?: boolean;
  glass?: boolean;
}) {
  const fieldId = `${formId}-text`;
  const missing = state.tried && !state.text.trim();
  // On the sheet's glass the one white pill is Answer; Fume's suggestions are clear (glass-one-white).
  const pill = glass ? "glass-clear" : "secondary";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (state.ready) state.send(question.answer === "picture" && !state.photo);
    else if (question.answer === "picture") void state.addPhoto();
    else {
      state.setTried(true);
      document.getElementById(fieldId)?.focus();
    }
  };
  if (question.answer === "picture") {
    const src = state.photo?.src ?? question.picture;
    return (
      <form id={formId} className="ui-qs-form" onSubmit={submit}>
        {src ? (
          <figure className="ui-qs-picture">
            <img src={src} alt={state.photo ? `Your photo, ${state.photo.name}` : "The photo Fume found"} />
            <figcaption className="ui-qs-picture-caption">
              {state.photo ? "Your photo" : "The photo Fume found"}
            </figcaption>
          </figure>
        ) : (
          <p className="ui-qs-note">No photo yet. Add one taken straight on, in soft light.</p>
        )}
        <div className="ui-qs-suggest">
          <Button type="button" size="sm" variant={pill} icon="upload" onClick={() => void state.addPhoto()}>
            {src ? "Add a better photo" : "Add a photo"}
          </Button>
        </div>
      </form>
    );
  }
  return (
    <form id={formId} className="ui-qs-form" onSubmit={submit}>
      {/* round 13 (#6, #7): each suggestion with its words, and what this kind of product usually says */}
      <AnswerSuggestions question={question} value={state.text} onChange={state.setText} glass={glass} />
      <Field invalid={missing}>
        <FieldLabel htmlFor={fieldId}>Your answer</FieldLabel>
        <Textarea
          id={fieldId}
          value={state.text}
          onChange={(e) => state.setText(e.target.value)}
          rows={3}
          aria-invalid={missing || undefined}
          aria-describedby={`${fieldId}-help`}
          {...(autoFocus ? { "data-ui-autofocus": "" } : {})}
        />
        <FieldDescription id={`${fieldId}-help`}>
          {missing
            ? "Write your answer first, or choose Later."
            : question.hint
              ? question.hint.replace(/[^.?]$/, "$&.")
              : "In your words, as it may stand on a creative."}
        </FieldDescription>
      </Field>
    </form>
  );
}

/** The words on the one action. */
const actionLabel = (question: OpenQuestion, state: AnswerState) =>
  question.answer === "picture"
    ? state.photo
      ? "Use this photo"
      : question.picture
        ? "Confirm this photo"
        : "Add a photo"
    : "Answer";

export interface QuestionAnswerProps {
  question: OpenQuestion;
  /** After the answer is saved. */
  onAnswered?: (question: OpenQuestion, answer: string) => void;
  /** "Later" beside Answer (the confirm queue); left out, there is only Answer. */
  onLater?: () => void;
}

/** The answer inline, on the light ground: the product page's "Fume needs this from you" card and the confirm queue.
 *  The question and why are the caller's heading; this is the field, the suggestions and Answer. */
export function QuestionAnswer({ question, onAnswered, onLater }: QuestionAnswerProps) {
  const formId = `qa-${useId().replace(/:/g, "")}`;
  const state = useAnswer(question, onAnswered);
  return (
    <div className="ui-qs-inline">
      <AnswerFields question={question} state={state} formId={formId} />
      <div className="ui-qs-actions">
        <Button type="submit" form={formId} size="sm" icon="check" loading={state.busy}>
          {actionLabel(question, state)}
        </Button>
        {onLater && (
          <Button type="button" size="sm" variant="quiet" onClick={onLater}>
            Later
          </Button>
        )}
      </div>
    </div>
  );
}

export interface QuestionSheetProps extends QuestionTarget {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After each answer is saved. The sheet moves on to the next question of the same target, and closes after the last. */
  onAnswered?: (question: OpenQuestion, answer: string) => void;
}

/** The one product every question is about, if they are all about the same one. */
const oneProduct = (questions: OpenQuestion[]): Id | undefined => {
  const id = questions[0]?.productId;
  return id && questions.every((q) => q.productId === id) ? id : undefined;
};

/**
 * The one sheet for a question Fume asks: the right-side panel on a desk, a sheet from the bottom on a phone. Give it a
 * target (questionId, productId, factId or campaignId). When every question is about one product, it is that product's
 * card (ProductCheckPanel), which answers them and confirms the product. Otherwise, when more than one fits (a brief
 * that waits on two products), it asks them one at a time ("1 of 2") and closes after the last.
 */
export function QuestionSheet({ open, onOpenChange, onAnswered, ...target }: QuestionSheetProps) {
  const narrow = useNarrowScreen();
  const { questions, loading } = useOpenQuestions(target);
  // The set as it was when the sheet opened, so "1 of 2" stays true while answers close them, and the product stays
  // on its card while Confirm answers its questions.
  const [held, setHeld] = useState<{ ids: Id[]; productId?: Id } | null>(null);
  const [step, setStep] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setHeld(null);
      setStep(0);
    }
  }
  if (open && !loading && held === null) setHeld({ ids: questions.map((q) => q.id), productId: oneProduct(questions) });
  const ids = held?.ids ?? [];
  const productId = held ? held.productId : open && !loading ? oneProduct(questions) : undefined;

  const current = questions.find((q) => q.id === ids[step]) ?? (ids.length === 0 ? questions[0] : undefined);
  const products = useCatalogue().data?.products;
  const product = current?.productId ? products?.find((p) => p.id === current.productId) : undefined;
  const state = useAnswer(
    current,
    (q, said) => {
      onAnswered?.(q, said);
      if (step + 1 < ids.length) setStep(step + 1);
      else onOpenChange(false);
    },
    step + 1 >= ids.length,
  );
  const formId = "question-sheet";

  if (productId)
    return (
      <ProductCheckPanel
        productId={productId}
        open={open}
        onClose={(confirmed) => {
          if (confirmed)
            for (const q of questions.filter((x) => ids.includes(x.id) || x.productId === productId))
              onAnswered?.(q, "");
          onOpenChange(false);
        }}
      />
    );

  const title = current?.question ?? (loading ? "Loading the question" : "Nothing to answer");
  const description = current
    ? current.why
    : loading
      ? ""
      : "Fume has what it needs here. Someone may have answered it already.";
  const count = ids.length > 1 ? `${Math.min(step + 1, ids.length)} of ${ids.length}` : undefined;
  const about = product ? `${product.name} ${product.variant}`.trim() : undefined;

  const body = current ? (
    <div className="ui-app-stack">
      {(about || count) && (
        <p className="ui-qs-about">
          {product?.images[0] && <img className="ui-qs-about-thumb" src={product.images[0]} alt="" />}
          <span className="ui-qs-about-name">{about}</span>
          {count && <span className="ui-qs-about-count">{count}</span>}
        </p>
      )}
      <AnswerFields question={current} state={state} formId={formId} autoFocus={!narrow} glass />
    </div>
  ) : null;
  const actions = (
    <>
      <Button type="button" variant="glass-clear" onClick={() => onOpenChange(false)}>
        {current ? "Later" : "Close"}
      </Button>
      {current && (
        <Button type="submit" form={formId} variant="glass-white" icon="check" loading={state.busy}>
          {actionLabel(current, state)}
        </Button>
      )}
    </>
  );

  if (narrow)
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          {body && <DrawerBody>{body}</DrawerBody>}
          <DrawerFooter>{actions}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel="Close, answer later"
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        {body && <SheetBody>{body}</SheetBody>}
        <SheetFooter>{actions}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
