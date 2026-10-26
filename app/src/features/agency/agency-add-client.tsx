// Add a client, the agency lead's right panel (FLOWS §24.3): the brand's name, its website (Fume reads the brand from
// it and starts the Brand DNA), where its creatives run, and the client's people to invite. Added, the panel closes, a
// toast says what Fume does next, and the new client lands in the list. The panel's state is in the address (?add=1),
// so Back closes it and a link opens it. ⌘↵ adds; Esc closes.
import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldOptional,
  FieldSet,
  Input,
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
  useToast,
} from "@fume/ui";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAddClient } from "../../api/hooks";
import type { AgencyClient, CustomerRole } from "../../contract";
import * as copy from "../../copy";
import { firstName } from "../../shell/people";

const MARKETS = [
  { market: "Norway", language: "Norwegian" },
  { market: "Norway", language: "English" },
  { market: "Sweden", language: "Swedish" },
  { market: "Denmark", language: "Danish" },
  { market: "Finland", language: "Finnish" },
  { market: "The Nordics", language: "English" },
  { market: "Germany", language: "German" },
  { market: "United Kingdom", language: "English" },
] as const;
const marketKey = (m: { market: string; language: string }) => `${m.market}|${m.language}`;

const ROLES: CustomerRole[] = ["owner", "approver", "member", "viewer"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Person {
  key: number;
  name: string;
  email: string;
  role: CustomerRole;
}

/** ?add=1 on the page that shows the panel: open it, close it, and know whether it is open. */
export function useAddClientParam() {
  const [params, setParams] = useSearchParams();
  const open = params.get("add") === "1";
  const set = (next: boolean, extra?: Record<string, string>) => {
    const out = new URLSearchParams(params);
    if (next) out.set("add", "1");
    else out.delete("add");
    for (const [k, v] of Object.entries(extra ?? {})) out.set(k, v);
    setParams(out, { replace: !next });
  };
  return { open, setOpen: set };
}

/** "https://www.aurea.dk/" → "aurea.dk" */
const host = (url: string) =>
  url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");

export function AddClientPanel({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: (client: AgencyClient) => void;
}) {
  const add = useAddClient();
  const toast = useToast();
  const next = useRef(1);
  const blank = (role: CustomerRole): Person => ({ key: next.current++, name: "", email: "", role });
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [market, setMarket] = useState(marketKey(MARKETS[0]));
  const [people, setPeople] = useState<Person[]>(() => [blank("owner")]);
  const [tried, setTried] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Every time it opens, it starts empty.
  useEffect(() => {
    if (!open) return;
    setName("");
    setWebsite("");
    setMarket(marketKey(MARKETS[0]));
    setPeople([blank("owner")]);
    setTried(false);
  }, [open]);

  const filled = (p: Person) => Boolean(p.name.trim() || p.email.trim());
  const emailProblem = (p: Person) =>
    filled(p) && !EMAIL.test(p.email.trim())
      ? p.email.trim()
        ? "That is not an email address yet."
        : "Write their email; the invitation goes there."
      : undefined;
  const noName = !name.trim();
  const problems = tried ? people.filter((p) => emailProblem(p)).length + (noName ? 1 : 0) : 0;

  const change = (key: number, patch: Partial<Person>) =>
    setPeople((all) => all.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const remove = (key: number) =>
    setPeople((all) => (all.length > 1 ? all.filter((p) => p.key !== key) : [blank("owner")]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (noName) {
      nameRef.current?.focus();
      return;
    }
    const bad = people.find((p) => emailProblem(p));
    if (bad) {
      document.getElementById(`add-client-email-${bad.key}`)?.focus();
      return;
    }
    const m = MARKETS.find((x) => marketKey(x) === market) ?? MARKETS[0];
    const invited = people.filter(filled).map((p) => ({ name: p.name.trim(), email: p.email.trim(), role: p.role }));
    add.mutate(
      {
        brandName: name.trim(),
        website: website.trim() ? `https://${host(website)}` : undefined,
        market: m.market,
        language: m.language,
        people: invited,
      },
      {
        onSuccess: (client) => {
          const who = invited.map((p) => firstName(p.name || p.email));
          const said = [
            website.trim()
              ? `Fume is reading ${host(website)} and starts the Brand DNA.`
              : "Fume needs the website or the brand guide to start the Brand DNA.",
            who.length
              ? `${who.length === 1 ? who[0] : `${who.slice(0, -1).join(", ")} and ${who.at(-1)}`} ${who.length === 1 ? "has" : "have"} an invitation.`
              : "",
          ]
            .filter(Boolean)
            .join(" ");
          toast.done(`${client.workspace.brandName} added`, { description: said });
          onAdded?.(client);
        },
        onError: (err) => toast.error("The client wasn’t added", { description: err.message }),
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <form className="ui-sheet-form" onSubmit={submit} noValidate aria-label="Add a client">
          <SheetHeader>
            <SheetTitle>Add a client</SheetTitle>
            <SheetDescription>
              Fume reads the brand from its website and starts its Brand DNA. The client’s people get an invitation to
              approve the creatives you send them.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <div className="ui-agency-form">
              <FieldGroup>
                <Field invalid={tried && noName}>
                  <FieldLabel htmlFor="add-client-name">Brand name</FieldLabel>
                  <Input
                    ref={nameRef}
                    id="add-client-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="off"
                    data-ui-autofocus=""
                    aria-invalid={tried && noName ? true : undefined}
                    aria-describedby="add-client-name-error"
                  />
                  <FieldError id="add-client-name-error">
                    {tried && noName ? "The brand’s name first, as it is written on the product." : undefined}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="add-client-site">
                    Website <FieldOptional />
                  </FieldLabel>
                  <Input
                    id="add-client-site"
                    type="url"
                    inputMode="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="brand.com"
                    autoComplete="off"
                    aria-describedby="add-client-site-help"
                  />
                  <FieldDescription id="add-client-site-help">
                    Fume reads the brand from it: the logo, colours, type, voice and products.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel as="span" id="add-client-market-label">
                    Market and language
                  </FieldLabel>
                  <Select value={market} onValueChange={setMarket}>
                    <SelectTrigger id="add-client-market" aria-labelledby="add-client-market-label">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKETS.map((m) => (
                        <SelectItem key={marketKey(m)} value={marketKey(m)}>
                          {m.market} · {m.language}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>

              <FieldSet className="ui-agency-people">
                <FieldLegend>The client’s people</FieldLegend>
                <FieldDescription>
                  They approve the creatives you send. Invite them now, or later from the client’s settings.
                </FieldDescription>
                <ul className="ui-agency-people-list">
                  {people.map((p, i) => {
                    const problem = tried ? emailProblem(p) : undefined;
                    const n = i + 1;
                    return (
                      <li key={p.key} className="ui-agency-person" aria-label={`Person ${n}`}>
                        <Field>
                          <FieldLabel htmlFor={`add-client-person-${p.key}`}>Name</FieldLabel>
                          <Input
                            id={`add-client-person-${p.key}`}
                            value={p.name}
                            onChange={(e) => change(p.key, { name: e.target.value })}
                            autoComplete="off"
                          />
                        </Field>
                        <Field invalid={Boolean(problem)}>
                          <FieldLabel htmlFor={`add-client-email-${p.key}`}>Email</FieldLabel>
                          <Input
                            id={`add-client-email-${p.key}`}
                            type="email"
                            inputMode="email"
                            value={p.email}
                            onChange={(e) => change(p.key, { email: e.target.value })}
                            placeholder="name@brand.com"
                            autoComplete="off"
                            aria-invalid={problem ? true : undefined}
                            aria-describedby={`add-client-email-${p.key}-error`}
                          />
                          <FieldError id={`add-client-email-${p.key}-error`}>{problem}</FieldError>
                        </Field>
                        <div className="ui-agency-person-foot">
                          <Field className="ui-agency-person-role">
                            <FieldLabel as="span" id={`add-client-role-${p.key}`}>
                              Role
                            </FieldLabel>
                            <Select value={p.role} onValueChange={(v) => change(p.key, { role: v as CustomerRole })}>
                              <SelectTrigger aria-labelledby={`add-client-role-${p.key}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map((r) => (
                                  <SelectItem key={r} value={r} textValue={copy.role[r]}>
                                    {copy.role[r]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          {(people.length > 1 || filled(p)) && (
                            <Button
                              type="button"
                              variant="glass-clear"
                              size="sm"
                              icon="x"
                              onClick={() => remove(p.key)}
                              aria-label={`Remove person ${n}`}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="ui-app-row">
                  <Button
                    type="button"
                    variant="glass-clear"
                    size="sm"
                    icon="plus"
                    onClick={() => setPeople((all) => [...all, blank("approver")])}
                  >
                    Add another
                  </Button>
                </div>
              </FieldSet>
            </div>
          </SheetBody>
          <SheetFooter>
            {problems > 0 && (
              <span className="ui-agency-foot-note" role="status">
                {problems === 1 ? "One thing to fix" : `${problems} things to fix`}
              </span>
            )}
            <SheetClose asChild>
              <Button variant="glass-clear">Cancel</Button>
            </SheetClose>
            <Button type="submit" variant="glass-white" icon="plus" loading={add.isPending}>
              Add the client
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
