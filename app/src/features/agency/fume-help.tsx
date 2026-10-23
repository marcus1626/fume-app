// Round 13 AGENCY (Marcus's video comment #71, 22 Oct 2026: "Burde være book a meeting og borrow manpower funksjon. Og
// customer service."; PROPOSED): an agency's ways to Fume's people. An agency has no Fume people in its plan (#70: "de
// får ikke vår manpower"), so it asks for them:
// - Book a meeting: the customer's meeting dialog (features/fume/meeting.tsx), with Sander, the agency's producer at
//   Fume. It lands in the calendar.
// - Borrow Fume's people: a right panel. Which client and campaign, what (checks, design, renders), about how much and
//   when, a note; it sends a request (askFume) and Sander answers with who and when.
// - Customer service: a right panel. What it is about and the message; Fume answers in a working day.
// Where an agency person finds them: "Help from Fume" at the foot of the sidebar (above the person), the person menu,
// and on the Overview beside the team. Each place holds its own panels (useFumeHelp).
import {
  Button,
  Checkbox,
  Choice,
  ChoiceText,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldOptional,
  FieldSet,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SidebarMenuButton,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
  useToast,
  type IconName,
} from "@fume/ui";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAgencyCampaigns, useAgencyClients, useAgencyPlan, useAskFume } from "../../api/hooks";
import type { BorrowedWork, Id } from "../../contract";
import { due } from "../../lib/time";
import { Section } from "../../shell/Page";
import { firstName } from "../../shell/people";
import { addressBrand } from "../../shell/scope";
import { BookMeetingDialog } from "../fume/meeting";
import { EngineFixToast } from "./EngineFixToast";

export type HelpKind = "meeting" | "borrow" | "support";

/** The three ways to Fume, in the order they are offered everywhere. */
export const helpWays: { kind: HelpKind; label: string; icon: IconName; detail: string }[] = [
  { kind: "meeting", label: "Book a meeting", icon: "calendar", detail: "30 minutes with Fume, on a video call" },
  { kind: "borrow", label: "Borrow Fume’s people", icon: "users", detail: "Experts to check, designers, renders" },
  { kind: "support", label: "Customer service", icon: "mail", detail: "Fume answers within a working day" },
];

/** The person at Fume who answers the agency ("Sander"), once the plan has come. */
function useContact(): string | undefined {
  const contact = useAgencyPlan().data?.contact;
  return contact ? firstName(contact.name) : undefined;
}

/** Opens one of the three, and the panels that do it (render `panels` once where the opener lives). */
export function useFumeHelp() {
  const [open, setOpen] = useState<HelpKind | null>(null);
  const close = (o: boolean) => !o && setOpen(null);
  const panels = (
    <>
      <BookMeetingDialog open={open === "meeting"} onOpenChange={close} />
      <BorrowPanel open={open === "borrow"} onOpenChange={close} />
      <SupportPanel open={open === "support"} onOpenChange={close} />
    </>
  );
  return { open: setOpen, panels };
}

/** "Help from Fume" at the foot of the agency's sidebar: a glass menu with the three ways, and the agency's Fume plan. */
export function AgencyHelpMenu() {
  const help = useFumeHelp();
  const navigate = useNavigate();
  const contact = useContact();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton icon="info" endIcon="chevron-up" aria-label="Help from Fume: book a meeting, borrow Fume’s people, customer service">
            Help from Fume
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start">
          <DropdownMenuLabel>{contact ? `${contact} at Fume answers you` : "Fume’s people"}</DropdownMenuLabel>
          {helpWays.map((w) => (
            <DropdownMenuItem key={w.kind} icon={w.icon} onSelect={() => help.open(w.kind)}>
              {w.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem icon="package" onSelect={() => navigate("/agency/settings/plan")}>
            Your Fume plan
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {help.panels}
      <EngineFixToast />
    </>
  );
}

/** The three ways as person-menu rows (the agency's person menu). */
export function HelpMenuItems({ onOpen }: { onOpen: (kind: HelpKind) => void }) {
  return (
    <>
      {helpWays.map((w) => (
        <DropdownMenuItem key={w.kind} icon={w.icon} onSelect={() => onOpen(w.kind)}>
          {w.label}
        </DropdownMenuItem>
      ))}
    </>
  );
}

/** On the Overview, beside the team: the three ways as rows, with who answers. */
export function FumeHelpSection() {
  const help = useFumeHelp();
  const contact = useContact();
  return (
    <Section
      title="Help from Fume"
      titleId="overview-help"
      text={`${contact ? `${contact} is your producer at Fume.` : "Fume’s people answer you."} Fume’s people are not in your plan; borrow them when a campaign needs more hands.`}
    >
      <ItemGroup as="ul" aria-labelledby="overview-help">
        {helpWays.map((w) => (
          <Item key={w.kind} as="li" variant="muted" size="sm" asChild>
            <button type="button" onClick={() => help.open(w.kind)}>
              <ItemMedia variant="icon">
                <Icon name={w.icon} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{w.label}</ItemTitle>
                <ItemDescription>{w.kind === "meeting" && contact ? `30 minutes with ${contact}, on a video call` : w.detail}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Icon name="chevron-right" />
              </ItemActions>
            </button>
          </Item>
        ))}
      </ItemGroup>
      {help.panels}
    </Section>
  );
}

// ─── Borrow Fume's people ───────────────────────────────────────────────────

const WORK: { id: BorrowedWork; label: string; hint: string }[] = [
  { id: "checks", label: "Checks", hint: "A Fume expert checks creatives before they go to the client" },
  { id: "design", label: "Design", hint: "A Fume designer works on the creatives in the Studio" },
  { id: "renders", label: "Renders", hint: "A Fume operator runs the Engine for the campaign" },
];
const AMOUNTS = ["10", "25", "50", "more"] as const;
const amountWords = (a: string) => (a === "more" ? "More than 50 creatives" : `About ${a} creatives`);

/** No campaign: the work is for the client's product pages or something not yet a campaign. */
const NONE = "none";

function BorrowPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const id = useId();
  const toast = useToast();
  const ask = useAskFume();
  const contact = useContact();
  const { pathname } = useLocation();
  const clients = useAgencyClients(open).data ?? [];
  const campaigns = useAgencyCampaigns().data ?? [];
  const [client, setClient] = useState<Id>("");
  const [campaign, setCampaign] = useState<string>(NONE);
  const [work, setWork] = useState<Set<BorrowedWork>>(new Set());
  const [amount, setAmount] = useState<string>("25");
  const [when, setWhen] = useState<string>("week");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);

  // Each time it opens: the client of the address (or the first), its campaign that waits on you, checks.
  useEffect(() => {
    if (!open) return;
    const here = addressBrand(pathname)?.workspaceId;
    setClient(here && clients.some((c) => c.workspace.id === here) ? here : (clients[0]?.workspace.id ?? ""));
    setCampaign(NONE);
    setWork(new Set(["checks"]));
    setAmount("25");
    setWhen("week");
    setNote("");
    setTried(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clients.length]);

  const theirs = campaigns.filter((r) => r.client.id === client && !["approved", "delivered", "closed"].includes(r.campaign.state));
  const chosen = theirs.find((r) => r.campaign.id === campaign)?.campaign;
  const clientName = clients.find((c) => c.workspace.id === client)?.workspace.brandName ?? "the client";
  const whenWords = when === "week" ? "This week" : when === "next" ? "Next week" : chosen?.dueAt ? `By ${due(chosen.dueAt)}` : "By the campaign’s date";
  const noWork = tried && work.size === 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ask.isPending) return;
    if (!client || work.size === 0) {
      setTried(true);
      return;
    }
    void ask
      .mutateAsync({ kind: "manpower", clientId: client, campaignId: chosen?.id, work: [...work], amount: amountWords(amount), when: whenWords, text: note.trim() || undefined })
      .then(
        () => {
          toast.done("Request sent to Fume", { description: `${contact ?? "Fume"} answers today with who and when, for ${chosen ? chosen.name : clientName}.` });
          onOpenChange(false);
        },
        (err: Error) => toast.error("The request wasn’t sent", { description: err.message }),
      );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="md">
        <form className="ui-sheet-form" onSubmit={submit} noValidate aria-label="Borrow Fume’s people">
          <SheetHeader>
            <SheetTitle>Borrow Fume’s people</SheetTitle>
            <SheetDescription>Fume’s experts, designers and operators work on one of your clients for a while. You still send the work to the client; only the client approves it.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <div className="ui-agency-form">
              <FieldGroup>
                <Field>
                  <FieldLabel as="span" id={`${id}-client`}>
                    Client
                  </FieldLabel>
                  <Select
                    value={client}
                    onValueChange={(v) => {
                      setClient(v);
                      setCampaign(NONE);
                    }}
                  >
                    <SelectTrigger aria-labelledby={`${id}-client`}>
                      <SelectValue placeholder="Choose a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.workspace.id} value={c.workspace.id}>
                          {c.workspace.brandName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel as="span" id={`${id}-campaign`}>
                    Campaign
                  </FieldLabel>
                  <Select value={campaign} onValueChange={setCampaign}>
                    <SelectTrigger aria-labelledby={`${id}-campaign`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {theirs.map((r) => (
                        <SelectItem key={r.campaign.id} value={r.campaign.id}>
                          {r.campaign.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={NONE}>Not one campaign</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <FieldSet>
                  <FieldLegend variant="label">What they do</FieldLegend>
                  <div className="ui-app-stack ui-app-stack--tight">
                    {WORK.map((w) => (
                      <Choice key={w.id}>
                        <Checkbox
                          checked={work.has(w.id)}
                          onCheckedChange={(on) => {
                            const next = new Set(work);
                            if (on === true) next.add(w.id);
                            else next.delete(w.id);
                            setWork(next);
                          }}
                        />
                        <ChoiceText label={w.label} hint={w.hint} />
                      </Choice>
                    ))}
                  </div>
                  {noWork && <FieldError>Choose what Fume’s people should do.</FieldError>}
                </FieldSet>
                <Field>
                  <FieldLabel as="span" id={`${id}-amount`}>
                    How much
                  </FieldLabel>
                  <ToggleGroup type="single" variant="outline" size="sm" loose value={amount} onValueChange={(v) => v && setAmount(v)} aria-labelledby={`${id}-amount`}>
                    {AMOUNTS.map((a) => (
                      <ToggleGroupItem key={a} value={a}>
                        {a === "more" ? "More" : `About ${a}`}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <FieldDescription>Creatives, roughly. Fume says what it takes.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel as="span" id={`${id}-when`}>
                    When
                  </FieldLabel>
                  <ToggleGroup type="single" variant="outline" size="sm" loose value={when} onValueChange={(v) => v && setWhen(v)} aria-labelledby={`${id}-when`}>
                    <ToggleGroupItem value="week">This week</ToggleGroupItem>
                    <ToggleGroupItem value="next">Next week</ToggleGroupItem>
                    <ToggleGroupItem value="date">{chosen?.dueAt ? `By ${due(chosen.dueAt)}` : "By the campaign’s date"}</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-note`}>
                    A note <FieldOptional />
                  </FieldLabel>
                  <Textarea id={`${id}-note`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="The story formats need a second pair of eyes." />
                </Field>
              </FieldGroup>
            </div>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="glass-clear">Cancel</Button>
            </SheetClose>
            <Button type="submit" variant="glass-white" icon="send" loading={ask.isPending}>
              Send the request
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Customer service ───────────────────────────────────────────────────────

const TOPICS = ["The app", "Licence and usage", "A client’s creatives", "Something else"] as const;

function SupportPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const id = useId();
  const toast = useToast();
  const ask = useAskFume();
  const contact = useContact();
  const [topic, setTopic] = useState<string>(TOPICS[0]);
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTopic(TOPICS[0]);
    setText("");
    setTried(false);
  }, [open]);

  const missing = tried && !text.trim();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ask.isPending) return;
    if (!text.trim()) {
      setTried(true);
      return;
    }
    void ask.mutateAsync({ kind: "support", topic, text }).then(
      () => {
        toast.done("Sent to Fume’s customer service", { description: `${contact ?? "Fume"} answers within a working day.` });
        onOpenChange(false);
      },
      (err: Error) => toast.error("It wasn’t sent", { description: err.message }),
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="md">
        <form className="ui-sheet-form" onSubmit={submit} noValidate aria-label="Customer service">
          <SheetHeader>
            <SheetTitle>Customer service</SheetTitle>
            <SheetDescription>
              {contact ? `${contact}, your producer at Fume, ` : "Fume "}answers within a working day. About one client’s brand, its Fume chat answers at once.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <div className="ui-agency-form">
              <FieldGroup>
                <Field>
                  <FieldLabel as="span" id={`${id}-topic`}>
                    What it is about
                  </FieldLabel>
                  <ToggleGroup type="single" variant="outline" size="sm" loose value={topic} onValueChange={(v) => v && setTopic(v)} aria-labelledby={`${id}-topic`}>
                    {TOPICS.map((t) => (
                      <ToggleGroupItem key={t} value={t}>
                        {t}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </Field>
                <Field invalid={missing}>
                  <FieldLabel htmlFor={`${id}-text`}>Your message</FieldLabel>
                  <Textarea
                    id={`${id}-text`}
                    rows={5}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="What happened, and where in Fume."
                    data-ui-autofocus=""
                    aria-invalid={missing || undefined}
                    aria-describedby={`${id}-text-error`}
                  />
                  <FieldError id={`${id}-text-error`}>{missing ? "Write what it is about." : undefined}</FieldError>
                </Field>
              </FieldGroup>
            </div>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="glass-clear">Cancel</Button>
            </SheetClose>
            <Button type="submit" variant="glass-white" icon="send" loading={ask.isPending}>
              Send to Fume
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** One quiet row of what was asked: "Borrow Fume’s people · LYSNE · Checks, Design · This week". */
export function requestWords(r: { kind: string; work?: string[]; amount?: string; when?: string; topic?: string }, clientName?: string): string {
  if (r.kind === "support") return ["Customer service", r.topic].filter(Boolean).join(" · ");
  const work = (r.work ?? []).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(", ");
  return ["Borrow Fume’s people", clientName, work, r.amount, r.when].filter(Boolean).join(" · ");
}
