// Brand Rules (ARCHITECTURE §4.2): what every creative keeps to, by area (logo, colour, type, voice, layout,
// imagery, claims). A hard constraint is never broken; a preference can bend for one campaign. A rule Fume found
// itself says where it came from and how sure Fume is; a rule you gave or confirmed shows only itself (round 8,
// LOAD-9). Owner, approver and member edit and add; a viewer reads. /brand/rules: "← Brand", no tab row (WAY-10).
// Round 9 (desktop review DLAY-7; PROPOSED 19 Oct 2026): the reading measure (760), each area a 120 px column on the
// left of its rules (Logo | rule | pencil), so seven rules fit in one screen with the pencil right after the text; a
// rule is written in a panel on the right (a form, so never a centred dialog), the list still in view.
import {
  Badge,
  Button,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  NativeSelect,
  PageHeader,
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
  SegmentedControl,
  SegmentedOption,
  ToggleGroup,
  ToggleGroupItem,
  useToast,
} from "@fume/ui";
import { useState, type FormEvent } from "react";
import { useBrandDna } from "../../api/hooks";
import type { BrandRule, RuleArea, RulePolarity } from "../../contract";
import { Back, Nothing, Page, Query } from "../../shell/Page";
import { useAddRule, useUpdateRule } from "./hooks";
import { ruleArea, ruleAreas, ruleKind, ruleLine, useExpertName, useRole } from "./parts";

// Round 13 (Marcus's video comment #43, robot note 05; PROPOSED 22 Oct 2026): every rule is a Do or a Don't, said on
// the rule and chosen in the panel, with a filter over the list (All · Do · Don't). A new rule's area is not set to
// Voice before she says anything: Fume guesses it from the words as she writes, or she chooses it.
type Draft = Omit<Pick<BrandRule, "area" | "kind" | "statement" | "polarity">, "area"> & { area: RuleArea | "" };

export const polarityWord: Record<RulePolarity, string> = { do: "Do", dont: "Don’t" };
/** A rule that starts with No, Never or Don't is a Don't. */
export const polarityOf = (r: Pick<BrandRule, "polarity" | "statement">): RulePolarity =>
  r.polarity ?? (/^(no|never|don[’']t|avoid)\b/i.test(r.statement.trim()) ? "dont" : "do");

/** The area a rule is about, guessed from its words; undefined when nothing says. */
function guessArea(text: string): RuleArea | undefined {
  const t = text.toLowerCase();
  if (/\blogo|wordmark/.test(t)) return "logo";
  if (/\bclaim|promise|result|natural|organic|percent|%/.test(t)) return "claims";
  if (/\bfont|typeface|type\b|letter|capitals|serif/.test(t)) return "type";
  if (/colou?r|\bhex\b|#[0-9a-f]{3}|blue|amber|neutral|saturat|palette/.test(t)) return "colour";
  if (/\bword|say|tone|write|sentence|exclamation|emoji|headline|copy\b|“|"/.test(t)) return "voice";
  if (/layout|frame|grid|\bair\b|margin|crop|composition/.test(t)) return "layout";
  if (/photo|picture|image|light|face|model|people|person|skin|stone|linen/.test(t)) return "imagery";
  return undefined;
}

/** Edit a rule, or add one when there is none to edit, in the right panel. Saving a rule makes it confirmed by you (the
 *  mock sets source "verified"). */
function RulePanel({
  open,
  onOpenChange,
  rule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: BrandRule;
}) {
  const update = useUpdateRule();
  const add = useAddRule();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(
    rule ? { ...rule, polarity: polarityOf(rule) } : { area: "", kind: "rule", statement: "" },
  );
  // what she chose herself is never guessed over
  const [chose, setChose] = useState({ area: Boolean(rule), polarity: Boolean(rule) });
  const busy = update.isPending || add.isPending;
  const set = (change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change }));
  const guessed = !rule && !chose.area && draft.area !== "";
  function write(statement: string) {
    const change: Partial<Draft> = { statement };
    if (!chose.area) change.area = guessArea(statement) ?? "";
    if (!chose.polarity) change.polarity = statement.trim() ? polarityOf({ statement }) : undefined;
    set(change);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const statement = draft.statement.trim();
    if (!statement || !draft.area) return;
    const area = draft.area;
    const polarity = draft.polarity ?? polarityOf({ statement });
    const done = {
      onSuccess: () => {
        toast.done(rule ? "Rule changed" : "Rule added", { description: "Fume follows it from the next creative on." });
        onOpenChange(false);
      },
      onError: (error: Error) =>
        toast.error(rule ? "The rule wasn’t changed" : "The rule wasn’t added", { description: error.message }),
    };
    if (rule) update.mutate({ ...rule, ...draft, area, polarity, statement }, done);
    else add.mutate({ ...draft, area, polarity, statement }, done);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{rule ? "Change the rule" : "Add a rule"}</SheetTitle>
          <SheetDescription>
            Write it the way you would tell a designer. Every creative is made and checked against it.
          </SheetDescription>
        </SheetHeader>
        <form className="ui-sheet-form" onSubmit={submit}>
          <SheetBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="rule-statement">The rule</FieldLabel>
                <Textarea
                  id="rule-statement"
                  value={draft.statement}
                  onChange={(e) => write(e.target.value)}
                  rows={3}
                  required
                  data-ui-autofocus
                />
              </Field>
              <Field>
                <FieldLabel id="rule-polarity-label">Do or don’t</FieldLabel>
                {/* a segmented control, glass-aware on the panel: the chosen one is the white pill (round 13 after-check of #43) */}
                <SegmentedControl
                  value={draft.polarity ?? ""}
                  onValueChange={(v) => {
                    if (!v) return;
                    setChose((c) => ({ ...c, polarity: true }));
                    set({ polarity: v as RulePolarity });
                  }}
                  aria-labelledby="rule-polarity-label"
                >
                  <SegmentedOption value="do">Do</SegmentedOption>
                  <SegmentedOption value="dont">Don’t</SegmentedOption>
                </SegmentedControl>
              </Field>
              <Field>
                <FieldLabel htmlFor="rule-area">Area</FieldLabel>
                <NativeSelect
                  id="rule-area"
                  value={draft.area}
                  aria-describedby={guessed ? "rule-area-help" : undefined}
                  onChange={(e) => {
                    setChose((c) => ({ ...c, area: true }));
                    set({ area: e.target.value as RuleArea });
                  }}
                >
                  {draft.area === "" && (
                    <option value="" disabled>
                      Choose an area
                    </option>
                  )}
                  {ruleAreas.map((a) => (
                    <option key={a} value={a}>
                      {ruleArea[a]}
                    </option>
                  ))}
                </NativeSelect>
                {guessed && (
                  <FieldDescription id="rule-area-help">
                    Fume chose it from your words. Change it if it is not right.
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="rule-kind">How strict</FieldLabel>
                <NativeSelect
                  id="rule-kind"
                  value={draft.kind}
                  onChange={(e) => set({ kind: e.target.value as BrandRule["kind"] })}
                  aria-describedby="rule-kind-help"
                >
                  <option value="hard_constraint">{ruleKind.hard_constraint}</option>
                  <option value="rule">{ruleKind.rule}</option>
                  <option value="preference">{ruleKind.preference}</option>
                </NativeSelect>
                <FieldDescription id="rule-kind-help">
                  A rule that is never broken stops a creative in the check. A preference can bend for one campaign.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="glass-clear">
                Cancel
              </Button>
            </SheetClose>
            <Button
              type="submit"
              variant="glass-white"
              loading={busy}
              disabled={!draft.statement.trim() || !draft.area}
            >
              {rule ? "Save the rule" : "Add the rule"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** The rules by area (the area a column on their left from 600 px), with Change for whoever may edit. Add sits in the
 *  page header. */
export function RulesContent({ onAdd, onEdit }: { onAdd?: () => void; onEdit?: (id: string) => void }) {
  const brand = useBrandDna();
  const [show, setShow] = useState<"all" | RulePolarity>("all");
  return (
    <Query query={brand} loading="Loading your Brand Rules">
      {(view) =>
        view.rules.length === 0 ? (
          <Nothing
            icon="list"
            title="No rules yet"
            text="Fume reads rules from your guidelines, and you can write your own."
            action={
              onAdd && (
                <Button variant="secondary" icon="plus" onClick={onAdd}>
                  Add a rule
                </Button>
              )
            }
          />
        ) : (
          <div className="ui-brand-rules">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              className="ui-rules-filter"
              value={show}
              onValueChange={(v) => v && setShow(v as typeof show)}
              aria-label="Show the rules"
            >
              <ToggleGroupItem value="all">All {view.rules.length}</ToggleGroupItem>
              {(["do", "dont"] as const).map((p) => (
                <ToggleGroupItem key={p} value={p}>
                  {polarityWord[p]} {view.rules.filter((r) => polarityOf(r) === p).length}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {ruleAreas
              .filter((a) => view.rules.some((r) => r.area === a && (show === "all" || polarityOf(r) === show)))
              .map((a) => (
                <section key={a} className="ui-brand-rules-area" aria-labelledby={`rules-${a}`}>
                  <h2 id={`rules-${a}`} className="ui-brand-rules-label">
                    {ruleArea[a]}
                  </h2>
                  <ItemGroup as="ul" aria-labelledby={`rules-${a}`}>
                    {view.rules
                      .filter((r) => r.area === a && (show === "all" || polarityOf(r) === show))
                      .map((r) => (
                        <Item key={r.id} as="li" variant="muted" size="sm" data-polarity={polarityOf(r)}>
                          <ItemContent>
                            <ItemTitle>
                              <span className="ui-rule-polarity">{polarityWord[polarityOf(r)]}</span>
                              {r.statement}
                            </ItemTitle>
                            {ruleLine(r) && <ItemDescription>{ruleLine(r)}</ItemDescription>}
                          </ItemContent>
                          <ItemActions>
                            {r.kind === "hard_constraint" && <Badge variant="ink">{ruleKind.hard_constraint}</Badge>}
                            {onEdit && (
                              <Button
                                variant="quiet"
                                size="sm"
                                iconOnly
                                icon="pencil"
                                aria-label={`Change the rule: ${r.statement}`}
                                onClick={() => onEdit(r.id)}
                              />
                            )}
                          </ItemActions>
                        </Item>
                      ))}
                  </ItemGroup>
                </section>
              ))}
          </div>
        )
      }
    </Query>
  );
}

/** /brand/rules: "← Brand", the title, who checks against them, Add a rule; then the rules by area (WAY-10). */
export function BrandRules() {
  const brand = useBrandDna();
  const { canEdit } = useRole();
  const expert = useExpertName();
  // Which dialog is open: a rule's id, "new", or nothing. A key per opening gives the dialog a fresh draft.
  const [editing, setEditing] = useState<string | null>(null);
  const [opened, setOpened] = useState(0);
  const open = (id: string) => {
    setOpened((n) => n + 1);
    setEditing(id);
  };
  const rule = brand.data?.rules.find((r) => r.id === editing);
  const hasRules = (brand.data?.rules.length ?? 0) > 0;

  return (
    <Page title="Rules · Brand" width="reading">
      <PageHeader
        title="Rules"
        back={<Back to="/brand" label="Brand" />}
        description={`${expert} checks every creative against these.`}
        actions={
          canEdit && hasRules ? (
            <Button variant="secondary" icon="plus" onClick={() => open("new")}>
              Add a rule
            </Button>
          ) : undefined
        }
      />
      <RulesContent onAdd={canEdit ? () => open("new") : undefined} onEdit={canEdit ? open : undefined} />
      {canEdit && editing && <RulePanel key={opened} open onOpenChange={(o) => !o && setEditing(null)} rule={rule} />}
    </Page>
  );
}
