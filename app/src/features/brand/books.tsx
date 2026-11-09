// The brand's books (FLOWS §30, §32): Brand › Tone of Voice (/brand/voice), Brand › Design system (/brand/design) and
// Brand › Look Book (/brand/look). One frame for all three: the version and where it stands in the header's meta, a note when another version is on its way or
// in use, the book, its versions, and the step's foot.
// - Fume writes a version (Write a new version, for Fume's people and the brand's owner or approver); an expert checks
//   the draft (Mark checked, in the foot); only the customer's owner or approver approves it or asks for a change.
// - The approved version stays in use until a newer one is approved: the note says which one the Engine writes from.
// - A customer reads a version once an expert has checked it; never one being written or a draft. ?v=1 opens an older
//   version. The look is brand-book.css.
// Round 14 (FLOWS §34.3, PROPOSED): a book reads like a documentation site, its index on the left (as
// brand.fumecreatives.com and shadcn's docs), and its words are edited in place (edit.tsx): Fume's people straight into
// a draft, the customer into the version she reads, sent to Fume together as the next version.
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
  Field,
  FieldDescription,
  FieldLabel,
  Icon,
  PageFooter,
  PageHeader,
  Textarea,
  useToast,
} from "@fume/ui";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  useApproveBrandBook,
  useAskBrandBookChange,
  useBrandBooks,
  useCheckBrandBook,
  useEditBrandBook,
  useSession,
  useTeam,
  useWriteBrandBook,
} from "../../api/hooks";
import type {
  BookEdit,
  BookEditMark,
  BookProgress,
  BrandBook,
  BrandBookKind,
  DesignBook,
  LookBook,
  VoiceBook,
} from "../../contract";
import { applyEdit } from "../../domain/bookEdits";

type BodyOf = { voice: VoiceBook; design: DesignBook; look: LookBook };
import { date } from "../../lib/time";
import { Back, Nothing, Page, Query } from "../../shell/Page";
import { firstName } from "../../shell/people";
import { PlanIndex } from "../plan/PlanIndex";
import { EditProvider, type EditMode } from "./edit";
import { useRole, useViewer } from "./parts";

export const bookName: Record<BrandBookKind, string> = {
  voice: "Tone of Voice",
  design: "Design system",
  look: "Look Book",
};

/** What a book is for, once approved: the end of "Version 1 stays in use until…" and of the customer's foot. */
const usedFor: Record<BrandBookKind, string> = {
  voice: "Fume writes every word from it",
  design: "the Engine lays out every creative from it",
  look: "the Engine shoots every picture from it",
};

/** A name for the book inside a sentence: "the Tone of Voice", "the design system", "the Look Book". */
const inLine = (kind: BrandBookKind) => (kind === "design" ? "design system" : bookName[kind]);

/** Who the book's lines name: the expert who checks, the customer who approves, and "you". */
function useBookPeople() {
  const session = useSession().data!;
  const team = useTeam().data;
  const me = session.user.id;
  const all = [...(team?.members.map((x) => x.user) ?? []), ...(team?.fumeTeam ?? [])];
  const approver =
    team?.members.find((x) => x.membership.role === "approver") ??
    team?.members.find((x) => x.membership.role === "owner");
  const expert = team?.fumeTeam.find((u) => u.staffRole === "expert");
  const name = (id?: string) => {
    if (!id) return "Someone";
    if (id === me) return "you";
    const u = all.find((x) => x.id === id);
    return u ? firstName(u.name) : "Someone";
  };
  return {
    me,
    name,
    Name: (id?: string) => cap(name(id)),
    approver: approver ? (approver.user.id === me ? "you" : firstName(approver.user.name)) : "the brand",
    expert: expert ? (expert.id === me ? "you" : firstName(expert.name)) : "Fume's expert",
    isExpert: session.user.staffRole === "expert" || Boolean(session.user.agency),
  };
}
type BookPeople = ReturnType<typeof useBookPeople>;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Where a version stands, in a few words. */
function standing(b: BrandBook, p: BookPeople, staff: boolean, list: BrandBook[]): string {
  switch (b.state) {
    case "writing":
      return "Fume is writing it";
    case "failed":
      return "Not written";
    case "draft":
      return `Draft · waits on ${p.expert === "you" ? "your" : `${p.expert}’s`} check`;
    case "checked":
      return `Checked by ${p.name(b.checkedBy)} · ${p.approver === "you" ? "yours to approve" : `waits on ${p.approver}`}`;
    case "changes_asked":
      return `${p.approver === "you" ? "You" : cap(p.approver)} asked for a change`;
    case "approved":
      return `Approved by ${p.name(b.approvedBy)}${b.approvedAt ? `, ${date(b.approvedAt)}` : ""}${staff ? " · in use" : ""}`;
    case "superseded": {
      const next = list.find((x) => x.version > b.version && x.state === "approved");
      return next ? `Replaced by version ${next.version}` : "Replaced";
    }
  }
}

export interface BookFrameProps<K extends BrandBookKind> {
  kind: K;
  /** The book itself, from the version shown. */
  children: (body: BodyOf[K], book: BrandBook) => ReactNode;
  /** No version to read yet: what the page shows instead (the voice falls back to the five parts from the onboarding). */
  empty: ReactNode;
  description: string;
  /** The book's index on the left: its parts under small group titles. Versions is added at its end. Round 15: with
   *  the version shown, for what the Engine proposes on a draft. */
  index?: (body: BodyOf[K], book: BrandBook) => BookIndexGroup[];
}

export type BookIndexGroup = { title: string; parts: { id: string; label: string }[] };

/** The frame both books share. */
export function BookFrame<K extends BrandBookKind>({ kind, children, empty, description, index }: BookFrameProps<K>) {
  const books = useBrandBooks();
  const title = bookName[kind];
  return (
    <Page title={`${title} · Brand`} width={index ? "default" : "reading"}>
      <Query query={books} loading={`Loading the ${title.toLowerCase()}`}>
        {(view) => (
          <Book
            kind={kind}
            list={view[kind]}
            coming={view.progress?.find((p) => p.kind === kind)}
            empty={empty}
            description={description}
            index={index}
          >
            {children}
          </Book>
        )}
      </Query>
    </Page>
  );
}

function Book<K extends BrandBookKind>({
  kind,
  list,
  coming,
  children,
  empty,
  description,
  index,
}: BookFrameProps<K> & { list: BrandBook[]; coming?: BookProgress }) {
  const viewer = useViewer();
  const { canApprove } = useRole();
  const people = useBookPeople();
  const [params, setParams] = useSearchParams();
  const [asking, setAsking] = useState<"write" | "change" | null>(null);
  const title = bookName[kind];
  const staff = viewer.staff;
  const decides = !staff && canApprove;

  const latest = list[0];
  const written = list.filter((b) => b.body);
  const inUse = list.find((b) => b.state === "approved");
  const asked = Number(params.get("v"));
  // The version shown: the one asked for, else the newest with words (a draft, a checked or the approved one).
  const shown = written.find((b) => b.version === asked) ?? written[0];
  const busy = latest?.state === "writing" || coming?.state === "writing";
  const canWrite = staff || canApprove;

  const back = <Back to="/brand" label="Brand" />;
  const actions = [
    ...(staff && shown
      ? [{ label: "Write a new version", icon: "pencil" as const, onSelect: () => setAsking("write"), disabled: busy }]
      : []),
    ...(decides && shown && shown.state === "approved" && shown.id === inUse?.id
      ? [
          {
            label: "Ask for a change",
            icon: "message-square" as const,
            onSelect: () => setAsking("change"),
            disabled: busy,
          },
        ]
      : []),
  ];

  if (!shown)
    return (
      <>
        <PageHeader title={title} back={back} description={description} />
        {latest && staff && (
          <Status latest={latest} shown={undefined} inUse={inUse} people={people} staff kind={kind} />
        )}
        {empty}
        {canWrite && !busy && (
          <PageFooter
            start={
              staff
                ? `Fume writes it from what it knows about ${viewer.brand}. An expert checks it before ${people.approver} reads it.`
                : "Fume writes it from what it knows about your brand. An expert checks it before you read it."
            }
          >
            <WriteNow kind={kind} again={latest?.state === "failed"} />
          </PageFooter>
        )}
      </>
    );

  const step = foot(shown, people, staff, decides, kind);
  const next = Math.max(...list.map((b) => b.version)) + 1;
  // Who may write in the book here, and how (edit.tsx): Fume's people into a draft, or into the newest version when no
  // draft is open (the first edit starts one); the customer's owner or approver into the version that waits on her or
  // the one in use, when no other is on its way.
  const open = list.some((b) => b.state === "draft" || b.state === "writing") || Boolean(coming);
  // The Tone of Voice is written in place; Round 15 (PROPOSED 9 Nov 2026): Fume's people edit the design system's
  // components in place too (the customer asks for a change there); the Look Book reads (FLOWS §34.4).
  const mode: EditMode =
    !index || kind === "look" || (kind === "design" && !staff)
      ? "read"
      : staff
        ? shown.state === "draft" || (shown.state === "approved" && shown.id === written[0]?.id && !open)
          ? "direct"
          : "read"
        : decides && !open && (shown.state === "checked" || (shown.state === "approved" && shown.id === inUse?.id))
          ? "suggest"
          : "read";
  const header = (
    <PageHeader
      title={title}
      back={back}
      description={description}
      meta={[`Version ${shown.version}`, standing(shown, people, staff, list)]}
      secondaryActions={actions}
    />
  );
  return (
    <InPlace
      book={shown}
      mode={mode}
      people={people}
      onStarted={(made) => setParams({ v: String(made.version) }, { replace: true })}
    >
      {(body, edits, local) => {
        const groups = index?.(body as BodyOf[K], shown);
        const main = (
          <>
            <Status
              latest={latest}
              shown={shown}
              inUse={inUse}
              people={people}
              staff={staff}
              kind={kind}
              coming={coming}
              hint={
                mode !== "read" && (
                  <EditNote
                    key="edit"
                    kind={kind}
                    mode={mode}
                    draft={shown.state === "draft"}
                    next={next}
                    people={people}
                  />
                )
              }
            />
            {children(body as BodyOf[K], shown)}
            {written.length > 1 && <Versions list={written} shown={shown} people={people} staff={staff} />}
          </>
        );
        return (
          <>
            {groups ? (
              <div className="ui-book-docs">
                <PlanIndex
                  label={`In the ${inLine(kind)}`}
                  className="ui-plandoc-index ui-book-index"
                  groups={
                    written.length > 1
                      ? [
                          ...groups.slice(0, -1),
                          {
                            ...groups[groups.length - 1]!,
                            parts: [...groups[groups.length - 1]!.parts, { id: "book-versions", label: "Versions" }],
                          },
                        ]
                      : groups
                  }
                />
                <div className="ui-book-main">
                  {header}
                  {main}
                </div>
              </div>
            ) : (
              <>
                {header}
                {main}
              </>
            )}
            {local && edits.length > 0 ? (
              <SendFoot book={shown} edits={edits} next={next} people={people} onDone={local.reset} />
            ) : (
              <>
                {step === "check" && <CheckFoot book={shown} people={people} />}
                {step === "decide" && (
                  <DecideFoot book={shown} people={people} kind={kind} onChange={() => setAsking("change")} />
                )}
              </>
            )}
            {asking && (
              <AskDialog
                mode={asking}
                book={shown}
                kind={kind}
                next={next}
                people={people}
                onOpenChange={(o) => !o && setAsking(null)}
              />
            )}
          </>
        );
      }}
    </InPlace>
  );
}

/** The book's words, editable in place for whoever may (edit.tsx): what children render, the marks, and the
 *  customer's lines that wait on the page until she sends them. */
function InPlace({
  book,
  mode,
  people,
  onStarted,
  children,
}: {
  book: BrandBook;
  mode: EditMode;
  people: BookPeople;
  /** Fume's person's first edit started a new version: show it. */
  onStarted: (made: BrandBook) => void;
  children: (body: BrandBook["body"], edits: BookEdit[], local: { reset: () => void } | null) => ReactNode;
}) {
  const edit = useEditBrandBook();
  const toast = useToast();
  type Local = { bookId: string; body: BrandBook["body"]; marks: BookEditMark[]; edits: BookEdit[] };
  const [local, setLocal] = useState<Local | null>(null);
  const reset = () => setLocal(null);
  // Another version, or another mode: the lines kept on the page belong to the one before.
  useEffect(() => setLocal(null), [book.id, mode]);
  const mine = local?.bookId === book.id ? local : null;

  function commit(e: BookEdit, label: string) {
    if (mode === "suggest") {
      const base = mine ?? { bookId: book.id, body: book.body, marks: book.edits ?? [], edits: [] };
      const body = structuredClone(base.body);
      const marks = structuredClone(base.marks);
      try {
        applyEdit(body, marks, e, people.me, new Date().toISOString());
      } catch {
        toast.error("That line couldn’t be changed");
        return;
      }
      setLocal({ bookId: book.id, body, marks, edits: [...base.edits, e] });
      return;
    }
    // What undoes it, worked out on a copy before the change goes.
    let undo: BookEdit | undefined;
    try {
      undo = applyEdit(structuredClone(book.body), structuredClone(book.edits ?? []), e, people.me, "");
    } catch {
      undo = undefined;
    }
    edit.mutateAsync({ bookId: book.id, edits: [e] }).then(
      (made) => {
        if (made.id !== book.id) {
          onStarted(made);
          toast.done(`Version ${made.version} started from your edit`, {
            description: `A draft. ${people.expert === "you" ? "You check" : `${cap(people.expert)} checks`} it before the brand reads it.`,
          });
          return;
        }
        // Round 15: a whole block is added, moved or taken out; a setting or a line is saved.
        const done = e.item ? "added" : e.moveTo !== undefined ? "moved" : e.to === null ? "taken out" : "saved";
        toast.done(`${label} ${done}`, {
          ...(undo
            ? {
                action: {
                  label: "Undo",
                  onClick: () =>
                    edit.mutate(
                      { bookId: made.id, edits: [undo!] },
                      { onError: (err) => toast.error("It wasn’t undone", { description: err.message }) },
                    ),
                },
              }
            : {}),
        });
      },
      (err: Error) => toast.error("That line wasn’t saved", { description: err.message }),
    );
  }

  return (
    <EditProvider value={{ mode, marks: mine?.marks ?? book.edits ?? [], commit, who: people.name }}>
      {children(mine?.body ?? book.body, mine?.edits ?? [], mode === "suggest" ? { reset } : null)}
    </EditProvider>
  );
}

/** One line above the book, for whoever may write in it: how. */
function EditNote({
  kind,
  mode,
  draft,
  next,
  people,
}: {
  kind: BrandBookKind;
  mode: EditMode;
  draft: boolean;
  next: number;
  people: BookPeople;
}) {
  const checker = people.expert === "you" ? "you check" : `${people.expert} checks`;
  // Round 15: in the design system it is the components that are written in place.
  const what = kind === "design" ? "Add, change or take out a component." : "Write straight into any line.";
  return (
    <p className="ui-brandbook-note ui-edit-note" data-tone="quiet">
      <Icon name="pencil" />
      <span>
        {mode === "suggest"
          ? `${what} Your lines go to Fume together, as version ${next}; ${checker} it before you approve it.`
          : draft
            ? `${what} It is kept as you go.`
            : `${what} Your first change starts version ${next}, a draft ${checker}.`}
      </span>
    </p>
  );
}

/** The customer's lines, sent to Fume together: the next version is written with them. */
function SendFoot({
  book,
  edits,
  next,
  people,
  onDone,
}: {
  book: BrandBook;
  edits: BookEdit[];
  next: number;
  people: BookPeople;
  onDone: () => void;
}) {
  const change = useAskBrandBookChange();
  const toast = useToast();
  const n = edits.length;
  const lines = `${n} ${n === 1 ? "line" : "lines"}`;
  return (
    <PageFooter
      start={`You changed ${lines}. Fume writes version ${next} with ${n === 1 ? "it" : "them"}; ${people.expert === "you" ? "you check" : `${people.expert} checks`} it before you approve it.`}
    >
      <Button variant="secondary" onClick={onDone} disabled={change.isPending}>
        Discard
      </Button>
      <Button
        icon="send"
        loading={change.isPending}
        onClick={() =>
          change.mutateAsync({ bookId: book.id, ask: `${cap(lines)} changed on the page`, edits }).then(
            (made) => {
              onDone();
              toast.done(`Fume is writing version ${made.version}`, {
                description: `With your ${lines}. ${cap(people.expert)} checks it before you read it.`,
              });
            },
            (e: Error) => toast.error(`Your lines weren’t sent`, { description: e.message }),
          )
        }
      >
        Send {lines}
      </Button>
    </PageFooter>
  );
}

/** Which step the foot carries: the expert's check of a draft, or the customer's word on a checked version. */
function foot(b: BrandBook, p: BookPeople, staff: boolean, decides: boolean, _kind: BrandBookKind) {
  if (staff && p.isExpert && b.state === "draft") return "check";
  if (decides && b.state === "checked") return "decide";
  return undefined;
}

/** A line above the book when another version than the one shown is on its way, failed or in use. */
function Status({
  latest,
  shown,
  inUse,
  people,
  staff,
  kind,
  coming,
  hint,
}: {
  latest: BrandBook | undefined;
  shown: BrandBook | undefined;
  inUse: BrandBook | undefined;
  people: BookPeople;
  staff: boolean;
  kind: BrandBookKind;
  coming?: BookProgress;
  /** How to write in the book, for whoever may: the last line. */
  hint?: ReactNode;
}) {
  const lines: ReactNode[] = [];
  // To a customer, a version she cannot read yet is only its number and where it is: never its words.
  if (coming && !staff && coming.version > (shown?.version ?? 0))
    lines.push(
      <p key="coming" className="ui-brandbook-note" data-tone="working" role="status">
        <Icon
          name={coming.state === "writing" ? "loader-circle" : "info"}
          className={coming.state === "writing" ? "ui-brandbook-note-spin" : undefined}
        />
        <span>
          {coming.state === "draft"
            ? `${cap(people.expert)} is checking version ${coming.version}. You read it once it is checked.`
            : `Fume is writing version ${coming.version}. ${cap(people.expert)} checks it before you read it.`}
        </span>
      </p>,
    );
  if (latest && latest.id !== shown?.id && latest.state === "writing")
    lines.push(
      <p key="writing" className="ui-brandbook-note" data-tone="working" role="status">
        <Icon name="loader-circle" className="ui-brandbook-note-spin" />
        <span>
          Fume is writing version {latest.version}
          {latest.ask ? ` for “${latest.ask}”` : ""}. It takes about a minute
          {staff ? `; ${people.expert === "you" ? "you check" : `${people.expert} checks`} it then.` : "."}
        </span>
      </p>,
    );
  if (latest && latest.id !== shown?.id && latest.state === "failed")
    lines.push(
      <div key="failed" className="ui-brandbook-note" data-tone="failed" role="alert">
        <Icon name="circle-alert" />
        <span>
          Version {latest.version} wasn’t written. {latest.error}
        </span>
        <WriteNow kind={kind} again ask={latest.ask} quiet />
      </div>,
    );
  if (shown && inUse && inUse.id !== shown.id && shown.version > inUse.version)
    lines.push(
      <p key="in-use" className="ui-brandbook-note">
        <Icon name="info" />
        <span>
          Version {inUse.version} stays in use until{" "}
          {people.approver === "you" ? "you approve" : `${people.approver} approves`} this one: {usedFor[kind]}.
        </span>
      </p>,
    );
  if (shown?.ask)
    lines.push(
      <p key="ask" className="ui-brandbook-note" data-tone="quiet">
        <Icon name="message-square" />
        <span>
          Written for {people.name(shown.askedBy) === "you" ? "your" : `${people.Name(shown.askedBy)}’s`} words: “
          {shown.ask}”
        </span>
      </p>,
    );
  if (hint) lines.push(hint);
  if (!lines.length) return null;
  return <div className="ui-brandbook-notes">{lines}</div>;
}

/** Every version the reader may see, the one shown marked. */
function Versions({
  list,
  shown,
  people,
  staff,
}: {
  list: BrandBook[];
  shown: BrandBook;
  people: BookPeople;
  staff: boolean;
}) {
  return (
    <section className="ui-brandbook-versions" id="book-versions" aria-labelledby="book-versions-title">
      <h2 className="ui-voice-sub" id="book-versions-title">
        Versions
      </h2>
      <ul className="ui-brandbook-version-list">
        {list.map((b) => (
          <li key={b.id}>
            <Link
              to={{ search: `?v=${b.version}` }}
              className="ui-brandbook-version"
              aria-current={b.id === shown.id ? "page" : undefined}
            >
              <span className="ui-brandbook-version-name">Version {b.version}</span>
              <span className="ui-brandbook-version-meta">{standing(b, people, staff, list)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The expert's step: Mark checked. The customer reads it then. */
function CheckFoot({ book, people }: { book: BrandBook; people: BookPeople }) {
  const check = useCheckBrandBook();
  const toast = useToast();
  const name = bookName[book.kind];
  // Round 15: what the Engine proposed and nobody added stays out of the version.
  const open = book.proposals?.filter((p) => p.state === "open").length ?? 0;
  const left = open
    ? open === 1
      ? " The Engine’s proposal stays out of it unless you add it."
      : ` The Engine’s ${open} proposals stay out of it unless you add them.`
    : "";
  return (
    <PageFooter start={`Marked checked, ${people.approver} reads version ${book.version} and approves it.${left}`}>
      <Button
        icon="check"
        loading={check.isPending}
        // mutateAsync, not mutate: the foot leaves the page once the book is checked, and the toast must still come
        onClick={() =>
          check.mutateAsync(book.id).then(
            () =>
              toast.done(`${name}, version ${book.version} checked`, {
                description: `${cap(people.approver)} sees it now.`,
              }),
            (e: Error) => toast.error(`The ${inLine(book.kind)} wasn’t marked checked`, { description: e.message }),
          )
        }
      >
        Mark checked
      </Button>
    </PageFooter>
  );
}

/** The customer's step: Approve, or Ask for a change. */
function DecideFoot({
  book,
  people,
  kind,
  onChange,
}: {
  book: BrandBook;
  people: BookPeople;
  kind: BrandBookKind;
  onChange: () => void;
}) {
  const approve = useApproveBrandBook();
  const toast = useToast();
  const name = bookName[kind];
  return (
    <PageFooter start={`${people.Name(book.checkedBy)} checked it. Approved, ${usedFor[kind]}.`}>
      <Button variant="secondary" icon="message-square" onClick={onChange}>
        Ask for a change
      </Button>
      <Button
        icon="check"
        loading={approve.isPending}
        onClick={() =>
          approve.mutateAsync(book.id).then(
            () =>
              toast.done(`${name} approved`, {
                description: `${cap(usedFor[kind]).replace(/ from it$/, "")} from version ${book.version} now.`,
              }),
            (e: Error) => toast.error(`The ${inLine(kind)} wasn’t approved`, { description: e.message }),
          )
        }
      >
        Approve
      </Button>
    </PageFooter>
  );
}

/** Write the first version, or try again after a failure. */
function WriteNow({
  kind,
  again,
  ask,
  quiet,
}: {
  kind: BrandBookKind;
  again?: boolean;
  ask?: string;
  quiet?: boolean;
}) {
  const write = useWriteBrandBook();
  const toast = useToast();
  return (
    <Button
      variant={quiet ? "secondary" : "primary"}
      size={quiet ? "sm" : undefined}
      icon={again ? "refresh-cw" : "pencil"}
      loading={write.isPending}
      onClick={() =>
        write.mutateAsync({ kind, ...(ask ? { ask } : {}) }).then(
          () => toast.done(`Fume is writing the ${inLine(kind)}`, { description: "It takes about a minute." }),
          (e: Error) => toast.error(`The ${inLine(kind)} wasn’t started`, { description: e.message }),
        )
      }
    >
      {again ? "Try again" : `Write the ${inLine(kind)}`}
    </Button>
  );
}

/** Fume's people write a new version (what to change is optional); the customer asks for a change in her words. */
function AskDialog({
  mode,
  book,
  kind,
  next,
  people,
  onOpenChange,
}: {
  mode: "write" | "change";
  book: BrandBook;
  kind: BrandBookKind;
  next: number;
  people: BookPeople;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = useState("");
  const write = useWriteBrandBook();
  const change = useAskBrandBookChange();
  const toast = useToast();
  const id = `book-ask-${mode}`;
  const busy = write.isPending || change.isPending;
  const ready = mode === "write" || text.trim().length > 0;
  // The version Fume writes comes back from the call: a customer does not see a draft, so it may be later than `next`.
  const done = (made: BrandBook) => {
    onOpenChange(false);
    toast.done(`Fume is writing version ${made.version}`, {
      description:
        mode === "change"
          ? `With your words. ${cap(people.expert)} checks it before you read it.`
          : `It takes about a minute. ${people.expert === "you" ? "You check" : `${people.expert} checks`} it then.`,
    });
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    const onError = (err: Error) => toast.error("The new version wasn’t started", { description: err.message });
    const made =
      mode === "change"
        ? change.mutateAsync({ bookId: book.id, ask: text.trim() })
        : write.mutateAsync({ kind, ...(text.trim() ? { ask: text.trim() } : {}) });
    made.then(done, onError);
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "change" ? "Ask for a change" : `Write version ${next}`}</DialogTitle>
          <DialogDescription>
            {mode === "change"
              ? `Fume writes a new version of the ${inLine(kind)} from version ${book.version} and your words. Version ${book.version} stays in use until you approve the new one.`
              : `Fume writes it from version ${book.version} and what it knows about the brand now.`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id={id} onSubmit={submit}>
            <Field>
              <FieldLabel htmlFor={`${id}-text`}>
                What should change{mode === "write" ? " (if anything)" : ""}?
              </FieldLabel>
              <Textarea
                id={`${id}-text`}
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={2000}
                aria-describedby={`${id}-help`}
                data-ui-autofocus
              />
              <FieldDescription id={`${id}-help`}>{example[kind]}</FieldDescription>
            </Field>
          </form>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="glass-clear">Cancel</Button>
          </DialogClose>
          <Button type="submit" form={id} variant="glass-white" loading={busy} disabled={!ready}>
            {mode === "change" ? "Ask Fume" : "Write it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** What a change to each book can sound like. */
const example: Record<BrandBookKind, string> = {
  voice: "For example: More words for the gift season. Never “du” in English.",
  design: "For example: The call to action in Night brown, not Burgundy.",
  look: "For example: A night look of its own. Never a top-down shot of the bottle.",
};

/** Where Fume writes each book from, to a customer and to Fume's people. */
const writtenFrom: Record<BrandBookKind, { staff: (brand: string) => string; customer: string }> = {
  voice: {
    staff: (brand) =>
      `Fume writes ${brand}’s Tone of Voice from its Brand DNA, its rules, its products and its website.`,
    customer: "Fume writes it from your Brand DNA, your rules, your products and your website.",
  },
  design: {
    staff: (brand) =>
      `Fume writes ${brand}’s design system from its Brand DNA, its rules, its products and its website.`,
    customer: "Fume writes it from your Brand DNA, your rules, your products and your website.",
  },
  look: {
    staff: (brand) =>
      `Fume reads ${brand}’s photography from its own pictures: its Brand DNA imagery, the pictures its people liked or turned down, and the pictures on its website.`,
    customer:
      "Fume reads it from your own pictures: your Brand DNA imagery, the pictures you liked or turned down, and the pictures on your website.",
  },
};

/** Nothing to read yet. */
export function NoBook({ kind, staff, brand }: { kind: BrandBookKind; staff: boolean; brand: string }) {
  return (
    <Nothing
      icon={kind === "voice" ? "message-square" : kind === "look" ? "camera" : "palette"}
      title={`No ${inLine(kind)} yet`}
      text={
        staff
          ? writtenFrom[kind].staff(brand)
          : `${writtenFrom[kind].customer} An expert at Fume checks it before you read it.`
      }
    />
  );
}
