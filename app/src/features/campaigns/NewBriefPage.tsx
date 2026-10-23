// Write the brief yourself (FLOWS §12; Marcus 15 Oct: "mulighet for å unngå Fume AI chat og bare legge inn brief som
// bestilling også, rent manuelt"). Round 8 (UX review 19 Oct: LOAD-5, TASK-2, TASK-3, TASK-7, TASK-9, WAY-16): short.
// Round 9 (desktop review 19 Oct: DTSK-12, DLOAD-10, DLOAD-20, DTSK-20, DLAY-13; PROPOSED 19 Oct 2026):
// - ONE commit. The form shows everything the brief holds (product, goal, audience, message, channels, formats,
//   creatives with what is left in the package, market).
// Round 10 (PROPOSED 20 Oct 2026, FLOWS §22): she SENDS the brief, never approves it. "Send to Fume" orders the brief
//   and sends it in one step; Fume writes the plan from it, the expert checks it, and she approves the plan before
//   anything is made (the footer says so). She lands on the campaign's Plan tab, where Fume is writing the plan.
//   Someone who may not send it (a member) hands it to the approver instead ("Send to Maja").
// - One rule for "done", the same as the plan page's brief, the chat and the mock's sendBrief: briefGaps (goal, audience,
//   message) plus a product, a channel, a format and a number of creatives the package holds. The button is never
//   greyed out: pressing it with something missing says what, in place, and puts the cursor on the first one; the
//   footer says how many lines are left.
// - One set of names (briefLabel in brief-lines.tsx): the labels are the brief's own (Goal, Product, Audience, …), the
//   plain question under the three that need it.
// - Fume reads the first line: the products it names, the channels ("on Instagram" is Organic social), who it is for,
//   a name. Formats follow the channels and the creatives follow the formats until she sets them herself. Fume's
//   suggestion for Audience and Message shows once the goal is written, never as a placeholder (DLOAD-20).
// - Desktop: the cursor starts in Goal, Enter never sends (only the button or ⌘↵ does), and the commit sits in a footer
//   pinned to the foot of the content column. On a phone it floats above the tab bar.
// - The draft is kept for the visit (sessionStorage), and the first line is shared with the Fume chat through
//   "fume-campaign-draft" = {name?, goal?, text?}, so switching between the two ways never loses what she wrote.
// Round 13 (Marcus's video comments #22, #23, #24, robot note 03; PROPOSED 22 Oct 2026; brief-tools.tsx):
// - "Start from" at the top: Fume's templates and hers ("Like Autumn launch"); picking one fills the form.
// - "Alternatives" for the message, and for the whole brief: three from Fume, again with what she wants changed.
// - Inspiration (folded, optional): pictures she adds or picks from her boards, and links. The pictures start the
//   campaign's moodboard (and are the brief's references); the links go to Fume with the brief.
// - Sent, the plan opens at once (its data fetched before she gets there, so no spinner first). The expert's check of
//   the plan is optional now, so the toast no longer says the expert checks it.
// Round 13 (#37): the go-live day is @fume/ui's DateField ("Sat 17 Oct 2026" and a glass month, Clear while it holds a
//   day), not the browser's date input.
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  ActionBar,
  Button,
  DateField,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldOptional,
  FieldSet,
  Input,
  Kbd,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
  shortcutLabel,
  tokenMs,
  useNarrowScreen,
  useToast,
} from "@fume/ui";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../../api/client";
import { useCatalogue, useHome, useOrderBrief, usePeople, useSendBrief, useSession, useTeam } from "../../api/hooks";
import type { BriefTemplate, Channel, Format } from "../../contract";
import * as copy from "../../copy";
import { todayKey } from "../../lib/time";
import { Back, Nothing, Page } from "../../shell/Page";
import { directory, firstName } from "../../shell/people";
import { emptyMoodboard, moodboardImages } from "../boards/StartMoodboard";
import { usable } from "../products/parts";
import { ProductScopePicker, type Scope } from "../products/ProductScopePicker";
import {
  audienceIn,
  briefGapKeys,
  briefLabel,
  channelsIn,
  formatsFor,
  nameFrom,
  namedIn,
  useBriefSuggestion,
} from "./brief-lines";
import { Alternatives, InspirationPicker, TemplatePicker, type BriefWords, type Inspiration } from "./brief-tools";
import { rights } from "./parts";

const channels = Object.keys(copy.channel) as Channel[];
const formats = Object.keys(copy.format) as Format[];

/** Four creatives per format, as Fume plans them when she has not said a number. */
const PER_FORMAT = 4;

/** Where a campaign runs and in which language: the workspace's own first. */
const MARKETS: { market: string; language: string }[] = [
  { market: "Norway", language: "Norwegian" },
  { market: "Norway", language: "English" },
  { market: "Sweden", language: "Swedish" },
  { market: "Denmark", language: "Danish" },
  { market: "Finland", language: "Finnish" },
  { market: "The Nordics", language: "English" },
  { market: "International", language: "English" },
];
const marketKey = (m: { market: string; language: string }) => `${m.market}|${m.language}`;
const marketWords = (m: { market: string; language: string }) => `${m.market}, in ${m.language}`;

/** What she set herself; until then the form keeps what it read from her first line. */
type Touched = "scope" | "channels" | "formats" | "audience" | "creatives";

/** The draft, kept for the visit so leaving the page (or a reload) does not lose it. */
const DRAFT_KEY = "fume.brief-draft";
interface Draft {
  name: string;
  goal: string;
  audience: string;
  message: string;
  mandatory: string;
  never: string;
  scope: Scope;
  picked: Channel[];
  shapes: Format[];
  creatives: string;
  market: string;
  deadline: string;
  notes: string;
  touched: Touched[];
}
const blank: Draft = {
  name: "",
  goal: "",
  audience: "",
  message: "",
  mandatory: "",
  never: "",
  scope: { productIds: [], collectionIds: [] },
  picked: [],
  shapes: ["feed"],
  creatives: "",
  market: "",
  deadline: "",
  notes: "",
  touched: [],
};

/** The first line, shared with the Fume chat (worker CHAT writes {text} from its composer). */
const SHARED_KEY = "fume-campaign-draft";
interface Shared {
  name?: string;
  goal?: string;
  text?: string;
}

function readDraft(): Draft {
  let draft = blank;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw) draft = { ...blank, ...(JSON.parse(raw) as Partial<Draft>) };
  } catch {
    /* nothing kept */
  }
  // What she last wrote in either way wins: the chat's composer text becomes the goal.
  try {
    const shared = JSON.parse(sessionStorage.getItem(SHARED_KEY) ?? "{}") as Shared;
    const goal = shared.goal?.trim() || shared.text?.trim();
    if (goal) draft = { ...draft, goal };
    if (shared.name?.trim()) draft = { ...draft, name: shared.name.trim() };
  } catch {
    /* nothing shared */
  }
  return draft;
}
function writeShared(name: string, goal: string) {
  try {
    const n = name.trim();
    const g = goal.trim();
    if (!n && !g) return sessionStorage.removeItem(SHARED_KEY);
    const text = n && !g.toLowerCase().includes(n.toLowerCase()) ? `${n}. ${g}`.trim() : g;
    sessionStorage.setItem(
      SHARED_KEY,
      JSON.stringify({ ...(n ? { name: n } : {}), ...(g ? { goal: g } : {}), text } satisfies Shared),
    );
  } catch {
    /* the chat just starts empty */
  }
}
function forgetDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
    sessionStorage.removeItem(SHARED_KEY);
  } catch {
    /* nothing kept */
  }
}
/** "Night brown, the tin; the label" → one line each. */
const lines = (text: string) =>
  text
    .split(/[;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Scroll the scroller the field lives in (the shell's .ui-sidebar-inset, or the window) so the field sits in the
 *  upper third, and put the cursor in it (or on its first control). */
function reveal(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const target = el.matches("input, textarea, select, button")
    ? el
    : (el.querySelector<HTMLElement>("[data-reveal]") ??
      el.querySelector<HTMLElement>(
        "[tabindex='0']:not([disabled]), input:not([disabled]), textarea, button:not([disabled])",
      ) ??
      el);
  const inset = el.closest<HTMLElement>(".ui-sidebar-inset");
  const scroller =
    inset && inset.scrollHeight > inset.clientHeight ? inset : (document.scrollingElement as HTMLElement | null);
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (scroller) {
    const port = scroller === inset ? scroller.getBoundingClientRect() : { top: 0, height: window.innerHeight };
    // The line's top in the upper quarter; if that leaves the control low (under the pinned footer), the control mid-screen.
    let y = scroller.scrollTop + el.getBoundingClientRect().top - port.top - port.height / 4;
    const box = target.getBoundingClientRect();
    if (box.bottom - el.getBoundingClientRect().top > port.height * 0.6)
      y = scroller.scrollTop + box.top - port.top - port.height / 2;
    scroller.scrollTo({ top: Math.max(0, y), behavior: smooth ? "smooth" : "auto" });
  }
  target.focus({ preventScroll: true });
}

interface Need {
  id: string;
  label: string;
  error: string;
  more?: boolean;
}

export function NewBriefPage() {
  const session = useSession().data!;
  const can = rights(session.role);
  const order = useOrderBrief();
  const send = useSendBrief();
  const team = useTeam();
  const catalogue = useCatalogue();
  const usage = useHome().data?.usage;
  const people = directory(usePeople().data);
  const api = useApi();
  const queries = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const narrow = useNarrowScreen();
  const hint = useBriefSuggestion();
  const form = useRef<HTMLFormElement>(null);
  const goalRef = useRef<HTMLTextAreaElement>(null);
  const footEnd = useRef<HTMLSpanElement>(null);
  const [stuck, setStuck] = useState(false);

  const [first] = useState(readDraft);
  const [name, setName] = useState(first.name);
  const [goal, setGoal] = useState(first.goal);
  const [audience, setAudience] = useState(first.audience);
  const [message, setMessage] = useState(first.message);
  const [mandatory, setMandatory] = useState(first.mandatory);
  const [never, setNever] = useState(first.never);
  const [scope, setScope] = useState<Scope>(first.scope);
  const [picked, setPicked] = useState<Channel[]>(first.picked);
  const [shapes, setShapes] = useState<Format[]>(first.shapes);
  const [creatives, setCreatives] = useState(first.creatives);
  const [market, setMarket] = useState(first.market);
  const [deadline, setDeadline] = useState(first.deadline);
  const [notes, setNotes] = useState(first.notes);
  const [touched, setTouched] = useState<Touched[]>(first.touched);
  // Round 13: the template it started from (#22) and her inspiration (#23), for this visit
  const [template, setTemplate] = useState("");
  const [inspiration, setInspiration] = useState<Inspiration>({ pictures: emptyMoodboard, links: [] });
  const [more, setMore] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  // The line to bring into view once the page has drawn its marks (and, in More details, once the fold has opened).
  const [jump, setJump] = useState<{ id: string; wait: number } | null>(null);
  const touch = (k: Touched) => setTouched((t) => (t.includes(k) ? t : [...t, k]));
  const has = (k: Touched) => touched.includes(k);

  useEffect(() => {
    const draft: Draft = {
      name,
      goal,
      audience,
      message,
      mandatory,
      never,
      scope,
      picked,
      shapes,
      creatives,
      market,
      deadline,
      notes,
      touched,
    };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* the draft just isn't kept */
    }
  }, [
    name,
    goal,
    audience,
    message,
    mandatory,
    never,
    scope,
    picked,
    shapes,
    creatives,
    market,
    deadline,
    notes,
    touched,
  ]);
  useEffect(() => writeShared(name, goal), [name, goal]);
  useEffect(() => {
    if (!jump) return;
    const timer = window.setTimeout(() => {
      reveal(jump.id);
      setJump(null);
    }, jump.wait);
    return () => window.clearTimeout(timer);
  }, [jump]);
  // DTSK-20: with a mouse and a keyboard the cursor starts in Goal, after what she already wrote. On a touch screen the
  // keyboard does not rise before she has read the page.
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const timer = window.setTimeout(() => {
      const el = goalRef.current;
      if (!el || document.activeElement === el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
    }, 120);
    return () => window.clearTimeout(timer);
  }, []);

  // The pinned footer shows its one line only while the form runs on under it: the sentinel under it is out of view.
  useEffect(() => {
    const end = footEnd.current;
    if (!end || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top > 0));
    io.observe(end);
    return () => io.disconnect();
  }, [narrow]);

  // What the first line says, kept until she sets that line herself.
  const products = catalogue.data?.products ?? [];
  const named = namedIn(goal, products);
  const namedReady = named.filter(usable).map((p) => p.id);
  const scopeNow: Scope = has("scope") ? scope : { productIds: namedReady, collectionIds: [] };
  const read = channelsIn(goal);
  const channelsNow = has("channels") ? picked : read;
  const formatsNow = has("formats") ? shapes : channelsNow.length ? formatsFor(channelsNow) : [];
  const creativesNow = has("creatives") ? creatives : formatsNow.length ? String(formatsNow.length * PER_FORMAT) : "";
  const count = Number(creativesNow);
  const audienceRead = audienceIn(goal);
  const audienceNow = has("audience") ? audience : (audienceRead ?? "");
  const pickedNames = products.filter((p) => scopeNow.productIds.includes(p.id) && usable(p)).map((p) => p.name);
  const nameNow = name.trim() || nameFrom(goal, pickedNames);
  const scoped =
    scopeNow.productIds.filter((id) => products.some((p) => p.id === id && usable(p))).length +
    scopeNow.collectionIds.length;
  const home = { market: session.workspace.market, language: session.workspace.language };
  const markets = [home, ...MARKETS.filter((m) => marketKey(m) !== marketKey(home))];
  const marketNow = markets.find((m) => marketKey(m) === market) ?? home;
  const left = usage ? Math.max(usage.creativeCap - usage.creativesUsed, 0) : undefined;

  // One rule (the same as sendBrief): briefGaps for the brief's own lines, then what a campaign needs to start.
  const gaps = briefGapKeys({ objective: goal, audience: audienceNow, message, offer: "" });
  const suggest = (key: "audience" | "message") => (goal.trim() ? hint.brief?.[key]?.trim() || undefined : undefined);
  const needs = (
    [
      gaps.includes("objective") && {
        id: "brief-goal",
        label: briefLabel.objective,
        error: "Say in a line what the campaign is for.",
      },
      scoped === 0 && {
        id: "brief-products",
        label: briefLabel.products,
        error: "Pick a product, or confirm one first.",
      },
      gaps.includes("audience") && {
        id: "brief-audience",
        label: briefLabel.audience,
        error: suggest("audience") ? "Say who it should reach, or use Fume’s suggestion." : "Say who it should reach.",
      },
      gaps.includes("message") && {
        id: "brief-message",
        label: briefLabel.message,
        error: suggest("message") ? "Say what it should say, or use Fume’s suggestion." : "Say what it should say.",
      },
      channelsNow.length === 0 && { id: "brief-channels", label: briefLabel.channels, error: "Pick where it runs." },
      formatsNow.length === 0 && { id: "brief-formats", label: briefLabel.formats, error: "Pick at least one format." },
      (!Number.isInteger(count) || count < 1) && {
        id: "brief-creatives",
        label: briefLabel.creatives,
        error: "Say how many creatives, one or more.",
      },
      Number.isInteger(count) &&
        left !== undefined &&
        count > left && {
          id: "brief-creatives",
          label: briefLabel.creatives,
          error: `Your package has ${left} left. Ask for ${left} or fewer, or ask Fume about more.`,
        },
    ] as (Need | false)[]
  ).filter((n): n is Need => Boolean(n));
  const error = (id: string) => (tried ? needs.find((n) => n.id === id)?.error : undefined);
  const go = (n: Need) => {
    const opening = Boolean(n.more) && !more.includes("more");
    if (opening) setMore(["more"]);
    setJump({ id: n.id, wait: opening ? tokenMs("--ui-motion-base", 240) + 40 : 16 });
  };
  const filled = [name, deadline, mandatory, never, notes].filter((x) => x.trim()).length;
  // Who sends the brief to Fume when she may not: the workspace's approver (or owner).
  const approverUser = team.data?.members.find(
    (m) => m.user.id !== session.user.id && (m.membership.role === "approver" || m.membership.role === "owner"),
  )?.user;
  const approver = approverUser ? firstName(approverUser.name) : "the approver";
  const commit = can.approve ? "Send to Fume" : `Send to ${approver}`;
  // What happens next, once nothing is missing (the same sentence as the chat's brief panel).
  const footNote = needs.length
    ? `${copy.count(needs.length, "line")} to go`
    : can.approve
      ? "Fume writes the plan from it. You approve the plan before anything is made."
      : `${approver} sends it to Fume. Nothing is made before the plan is approved.`;

  async function submit(event: FormEvent) {
    // A product confirmed in a panel over the form submits the panel's own form; React bubbles that submit through
    // the portal to this one. Only the brief's own button (or ⌘↵) sends the brief.
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    setTried(true);
    if (needs.length) return go(needs[0]);
    if (busy) return;
    setBusy(true);
    const pictures = moodboardImages(inspiration.pictures);
    // Robot note 03: the plan opens with its data, never a spinner first.
    const ready = (id: string) =>
      Promise.all([
        queries.prefetchQuery({ queryKey: ["campaign", id], queryFn: () => api.campaign(id) }),
        queries.prefetchQuery({ queryKey: ["plan", id], queryFn: () => api.plan(id) }),
      ]).catch(() => undefined);
    try {
      const campaign = await order.mutateAsync({
        name: nameNow,
        goal: goal.trim(),
        productIds: scopeNow.productIds,
        collectionIds: scopeNow.collectionIds,
        channels: channelsNow,
        formats: formatsNow,
        creatives: count,
        market: marketNow.market,
        language: marketNow.language,
        deadline: deadline ? new Date(`${deadline}T16:00:00`).toISOString() : undefined,
        // the links go to Fume with her notes (#23)
        notes: [notes.trim(), inspiration.links.length ? `Links for inspiration: ${inspiration.links.join(" ")}` : ""]
          .filter(Boolean)
          .join("\n\n"),
        audience: audienceNow.trim(),
        message: message.trim(),
        mandatory: lines(mandatory),
        never: lines(never),
        // the pictures start the campaign's moodboard (#23)
        references: pictures,
        ...(pictures.length ? { moodboard: { images: pictures } } : {}),
      });
      forgetDraft();
      // The form is done: it leaves the history, so Back from the plan goes where she came from.
      const plan = `/campaigns/${campaign.id}/plan`;
      if (!can.approve) {
        toast.done(`${campaign.name} is with ${people.name(campaign.approverId)}`, {
          description: `${people.name(campaign.approverId)} sends the brief to Fume. Nothing is made before the plan is approved.`,
        });
        await ready(campaign.id);
        navigate(plan, { replace: true });
        return;
      }
      try {
        // The same send as the chat and the plan page, by the same rule: one step for her, two calls here.
        await send.mutateAsync(campaign.id);
      } catch (e) {
        toast.error(`${campaign.name} is saved, but not sent yet`, {
          description: e instanceof Error ? e.message : undefined,
        });
        await ready(campaign.id);
        navigate(plan, { replace: true });
        return;
      }
      await ready(campaign.id);
      toast.done(`${campaign.name} is sent to Fume`, {
        description: "Fume writes the plan. Nothing is made before you approve it.",
      });
      navigate(plan, { replace: true });
    } catch (e) {
      toast.error("The brief wasn’t sent", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  /** Enter in a one-line field never sends the brief; ⌘↵ (Ctrl+Enter) does, from anywhere. */
  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    const el = event.target as HTMLElement;
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      form.current?.requestSubmit();
    } else if (el instanceof HTMLInputElement && el.form === form.current) event.preventDefault();
  }

  /** A template fills the form (#22); she changes anything after. */
  const fill = (t: BriefTemplate) => {
    setTemplate(t.id);
    setGoal(t.goal);
    setAudience(t.audience);
    setMessage(t.message);
    setPicked(t.channels);
    setShapes(t.formats);
    if (t.creatives)
      setCreatives(String(left !== undefined ? Math.min(t.creatives, left || t.creatives) : t.creatives));
    setMandatory((t.mandatory ?? []).join("; "));
    setNever((t.never ?? []).join("; "));
    setTouched((k) => [
      ...new Set<Touched>([...k, "audience", "channels", "formats", ...(t.creatives ? (["creatives"] as const) : [])]),
    ]);
  };
  const words: BriefWords = { goal, audience: audienceNow, message };
  const header = (
    <PageHeader
      title="New campaign"
      back={<Back to="/campaigns" label="Campaigns" />}
      actions={
        <Button asChild variant="secondary" icon="message-square">
          <Link to="/fume?new=1">{narrow ? "With Fume" : "Talk it through with Fume"}</Link>
        </Button>
      }
    />
  );

  if (!can.start)
    return (
      <Page title="New campaign" width="reading">
        {header}
        <Nothing
          icon="megaphone"
          title="Campaigns are started by the team"
          text={`${session.workspace.brandName}’s owner, approvers and members start campaigns.`}
        />
      </Page>
    );

  const fromLine = <FieldDescription>Fume read this from your line.</FieldDescription>;
  const suggestion = (key: "audience" | "message", label: string, use: (s: string) => void) => {
    const s = suggest(key);
    if (!s) return null;
    return (
      <div className="ui-brief-suggest">
        <FieldDescription>Fume suggests “{s.replace(/[.\s]+$/, "")}”</FieldDescription>
        <Button
          variant="secondary"
          size="sm"
          icon="check"
          aria-label={`Use Fume’s suggestion for ${label}`}
          onClick={() => use(s)}
        >
          Use it
        </Button>
      </div>
    );
  };

  return (
    <Page title="New campaign" width="reading">
      {header}
      <form
        id="brief-form"
        ref={form}
        onSubmit={(e) => void submit(e)}
        onKeyDown={onKeyDown}
        noValidate
        className="ui-brief-form"
        aria-label="The brief"
      >
        <TemplatePicker value={template} onPick={fill} />
        <FieldGroup>
          <Field invalid={Boolean(error("brief-goal"))}>
            <FieldLabel htmlFor="brief-goal">{briefLabel.objective}</FieldLabel>
            <FieldDescription id="brief-goal-help">What is the campaign for, in a line?</FieldDescription>
            <Textarea
              id="brief-goal"
              ref={goalRef}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="A Christmas gift campaign for the Night Body Oil, on Instagram"
              aria-describedby="brief-goal-help"
              aria-invalid={Boolean(error("brief-goal"))}
              rows={2}
            />
            <div className="ui-brief-alts-slot">
              <Alternatives
                part="brief"
                label="Alternatives for the whole brief"
                now={words}
                productIds={scopeNow.productIds}
                onPick={(b) => {
                  setGoal(b.goal);
                  setAudience(b.audience);
                  setMessage(b.message);
                  touch("audience");
                }}
              />
            </div>
            <FieldError>{error("brief-goal")}</FieldError>
          </Field>

          <FieldSet id="brief-products" aria-invalid={Boolean(error("brief-products")) || undefined}>
            <FieldLegend variant="label">{briefLabel.products}</FieldLegend>
            {!has("scope") && namedReady.length > 0 && fromLine}
            <FieldError>{error("brief-products")}</FieldError>
            <ProductScopePicker
              value={scopeNow}
              onChange={(s) => {
                setScope(s);
                touch("scope");
              }}
              named={named.map((p) => p.id)}
              size="sm"
            />
          </FieldSet>

          <Field invalid={Boolean(error("brief-audience"))}>
            <FieldLabel htmlFor="brief-audience">{briefLabel.audience}</FieldLabel>
            <FieldDescription id="brief-audience-help">Who should it reach?</FieldDescription>
            <Input
              id="brief-audience"
              value={audienceNow}
              onChange={(e) => {
                setAudience(e.target.value);
                touch("audience");
              }}
              aria-describedby="brief-audience-help"
              aria-invalid={Boolean(error("brief-audience"))}
              autoComplete="off"
            />
            {!has("audience") && audienceRead && fromLine}
            {!audienceNow.trim() &&
              suggestion("audience", "the audience", (s) => {
                setAudience(s);
                touch("audience");
              })}
            <FieldError>{error("brief-audience")}</FieldError>
          </Field>

          <Field invalid={Boolean(error("brief-message"))}>
            <FieldLabel htmlFor="brief-message">{briefLabel.message}</FieldLabel>
            <FieldDescription id="brief-message-help">What should it say?</FieldDescription>
            <Input
              id="brief-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              aria-describedby="brief-message-help"
              aria-invalid={Boolean(error("brief-message"))}
              autoComplete="off"
            />
            {!message.trim() && suggestion("message", "the message", setMessage)}
            <div className="ui-brief-alts-slot">
              <Alternatives
                part="message"
                label="Alternatives"
                now={words}
                productIds={scopeNow.productIds}
                onPick={(b) => setMessage(b.message)}
              />
            </div>
            <FieldError>{error("brief-message")}</FieldError>
          </Field>
        </FieldGroup>

        <FieldGroup>
          <FieldSet id="brief-channels">
            <FieldLegend variant="label">{briefLabel.channels}</FieldLegend>
            <ToggleGroup
              type="multiple"
              variant="outline"
              loose
              value={channelsNow}
              onValueChange={(v) => {
                setPicked(v as Channel[]);
                touch("channels");
              }}
              aria-label={briefLabel.channels}
              aria-invalid={Boolean(error("brief-channels")) || undefined}
            >
              {channels.map((c) => (
                <ToggleGroupItem key={c} value={c}>
                  {copy.channel[c]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {!has("channels") && read.length > 0 && fromLine}
            <FieldError>{error("brief-channels")}</FieldError>
          </FieldSet>

          <FieldSet id="brief-formats">
            <FieldLegend variant="label">{briefLabel.formats}</FieldLegend>
            <ToggleGroup
              type="multiple"
              variant="outline"
              loose
              value={formatsNow}
              onValueChange={(v) => {
                setShapes(formats.filter((f) => v.includes(f)));
                touch("formats");
              }}
              aria-label={briefLabel.formats}
              aria-invalid={Boolean(error("brief-formats")) || undefined}
            >
              {formats.map((f) => (
                <ToggleGroupItem key={f} value={f}>
                  {copy.format[f].label} {copy.format[f].ratio}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {!has("formats") && formatsNow.length > 0 && (
              <FieldDescription>Fume picked them from the channels.</FieldDescription>
            )}
            <FieldError>{error("brief-formats")}</FieldError>
          </FieldSet>

          <div className="ui-brief-pair">
            <Field invalid={Boolean(error("brief-creatives"))}>
              <FieldLabel htmlFor="brief-creatives">{briefLabel.creatives}</FieldLabel>
              <Input
                id="brief-creatives"
                type="number"
                inputMode="numeric"
                min={1}
                max={left}
                step={1}
                value={creativesNow}
                onChange={(e) => {
                  setCreatives(e.target.value);
                  touch("creatives");
                }}
                aria-describedby="brief-creatives-help"
                aria-invalid={Boolean(error("brief-creatives"))}
              />
              <FieldDescription id="brief-creatives-help">
                {session.workspace.agencyId
                  ? "Counted in this month’s usage"
                  : left !== undefined
                    ? `${left} left in your package`
                    : "From your package"}
                {!has("creatives") && formatsNow.length > 0 ? ` · ${PER_FORMAT} per format` : ""}
              </FieldDescription>
              <FieldError>{error("brief-creatives")}</FieldError>
            </Field>
            <Field>
              <FieldLabel as="span" id="brief-market-label">
                {briefLabel.market}
              </FieldLabel>
              <Select value={marketKey(marketNow)} onValueChange={setMarket}>
                <SelectTrigger id="brief-market" aria-labelledby="brief-market-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {markets.map((m) => (
                    <SelectItem key={marketKey(m)} value={marketKey(m)}>
                      {marketWords(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FieldGroup>

        <Accordion value={more} onValueChange={setMore}>
          <AccordionItem value="inspiration">
            <AccordionTrigger meta={inspirationMeta(inspiration)} headingLevel={2}>
              Inspiration
            </AccordionTrigger>
            <AccordionContent>
              <div className="ui-accordion-body">
                <InspirationPicker value={inspiration} onChange={setInspiration} />
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="more">
            <AccordionTrigger meta={filled ? `${filled} filled in` : "Optional"} headingLevel={2}>
              More details
            </AccordionTrigger>
            <AccordionContent>
              <div className="ui-accordion-body">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="brief-name">
                      Name <FieldOptional />
                    </FieldLabel>
                    <Input
                      id="brief-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={nameNow}
                      aria-describedby="brief-name-help"
                      autoComplete="off"
                    />
                    <FieldDescription id="brief-name-help">
                      {name.trim()
                        ? "Your name for it."
                        : goal.trim()
                          ? `Fume names it “${nameNow}” from your first line.`
                          : "Fume names it from your first line."}
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="brief-deadline">
                      {briefLabel.live} <FieldOptional />
                    </FieldLabel>
                    <DateField
                      id="brief-deadline"
                      value={deadline}
                      onChange={setDeadline}
                      today={todayKey()}
                      aria-describedby="brief-deadline-help"
                    />
                    <FieldDescription id="brief-deadline-help">
                      Fume plans back from it and tells you if your package needs longer.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="brief-mandatory">
                      {briefLabel.mandatory} <FieldOptional />
                    </FieldLabel>
                    <Input
                      id="brief-mandatory"
                      value={mandatory}
                      onChange={(e) => setMandatory(e.target.value)}
                      placeholder="The label, front on"
                      autoComplete="off"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="brief-never">
                      {briefLabel.never} <FieldOptional />
                    </FieldLabel>
                    <Input
                      id="brief-never"
                      value={never}
                      onChange={(e) => setNever(e.target.value)}
                      placeholder="Price tags; hands that cover the label"
                      aria-describedby="brief-lists-help"
                      autoComplete="off"
                    />
                    <FieldDescription id="brief-lists-help">
                      Several things? Put a semicolon between them.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="brief-notes-text">
                      Notes <FieldOptional />
                    </FieldLabel>
                    <Textarea
                      id="brief-notes-text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="An offer, a date that matters, anything else Fume should know"
                      rows={2}
                    />
                  </Field>
                </FieldGroup>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {tried && needs.length > 0 && (
          <div className="ui-app-stack ui-app-stack--tight" role="status">
            <FieldError>Still needed</FieldError>
            <div className="ui-app-row">
              {needs.map((n) => (
                <Button key={n.id + n.error} variant="secondary" size="sm" onClick={() => go(n)}>
                  {n.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {narrow ? (
          // The floating bar holds a short line: what happens next, in a few words.
          <ActionBar
            open
            aria-label={commit}
            label={needs.length ? footNote : can.approve ? "Fume writes the plan" : `${approver} sends it to Fume`}
          >
            <Button type="submit" variant="glass-white" icon="send" loading={busy}>
              {commit}
            </Button>
          </ActionBar>
        ) : (
          // DLAY-13: the step's one action, in a footer pinned to the foot of the content column; what it costs beside it.
          <div className="ui-brief-foot" data-stuck={stuck || undefined}>
            <p className="ui-brief-foot-note" aria-live="polite">
              {footNote}
            </p>
            <div className="ui-brief-foot-actions">
              <Button asChild variant="quiet">
                <Link to="/campaigns" onClick={forgetDraft}>
                  Cancel
                </Link>
              </Button>
              <Kbd className="ui-brief-foot-key" aria-hidden="true">
                {shortcutLabel("⌘↵")}
              </Kbd>
              <Button type="submit" icon="send" loading={busy} aria-keyshortcuts="Meta+Enter Control+Enter">
                {commit}
              </Button>
            </div>
          </div>
        )}
        {!narrow && <span ref={footEnd} className="ui-brief-foot-end" aria-hidden="true" />}
      </form>
    </Page>
  );
}

/** "3 pictures, 1 link", or "Optional": what Inspiration holds, on its fold. */
function inspirationMeta(i: Inspiration): string {
  const n = moodboardImages(i.pictures).length;
  const parts = [n ? copy.count(n, "picture") : "", i.links.length ? copy.count(i.links.length, "link") : ""].filter(
    Boolean,
  );
  return parts.length ? parts.join(", ") : "Optional";
}
