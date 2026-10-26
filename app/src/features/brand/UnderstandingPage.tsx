// The Brand DNA summary, the comprehension check (Product Vision §4.2; ARCHITECTURE §6.1 step 4): before any campaign,
// Fume shows what it understood from the brand material, and three deliberately different test directions. What Fume
// understood is five short lines (what the brand is, the light, the product and people, its rules, who it speaks to),
// each with Confirm · Change; the onboarding ends on the same lines (UnderstoodLines). Everything is saved on the tap
// or when she leaves the field. Open questions about a product live on that product, so they never hold back the
// approval.
// An approved version is a record at the reading measure: the lines as text, the conflict as "Settled: …", the
// directions as "You said: This is us" with her reason, and no controls. "Change something" opens the edit state, and
// only there does a change become a new version to approve. A Brand DNA not approved yet opens straight in that state.
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CardMedia,
  CreativeMedia,
  Field,
  FieldLabel,
  FieldOptional,
  Icon,
  Input,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  PageHeader,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
  useToast,
} from "@fume/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useAnswerUnderstanding,
  useApproveBrandDna,
  useBrandDna,
  useBrandScan,
  useOnboardingProgress,
  usePeople,
  useSaveOnboardingProgress,
} from "../../api/hooks";
import type { BrandDnaView, BrandScan, Understanding, UnderstoodLine } from "../../contract";
import * as copy from "../../copy";
import { date } from "../../lib/time";
import { Back, Page, Query, Section } from "../../shell/Page";
import { directory } from "../../shell/people";
import { dnaState, useRole, useViewer, versionLine } from "./parts";

type Unknown = Understanding["unknowns"][number];
type TestDirection = Understanding["testDirections"][number];

// ─── What Fume understood, in five lines ────────────────────────────────────

export interface Understood {
  id: string;
  label: string;
  text: string;
}

const summaryLabels = ["What the brand is", "The light", "The product and people"];

/** The five lines: the summary's three, then the rules and the audience the reading found. */
export function understoodLines(view: BrandDnaView, scan?: BrandScan | null): Understood[] {
  const out: Understood[] = view.understanding.summary
    .slice(0, 3)
    .map((text, i) => ({ id: `summary-${i}`, label: summaryLabels[i] ?? "What Fume read", text }));
  const ruleFinds = scan?.finds.filter((f) => f.kind === "rule") ?? [];
  const rules = ruleFinds.length ? ruleFinds.map((f) => f.value) : view.rules.slice(0, 2).map((r) => r.statement);
  if (rules.length)
    out.push({ id: "rules", label: "Its rules", text: rules.map((r) => r.replace(/\.?$/, ".")).join(" ") });
  const audience = scan?.finds.find((f) => f.kind === "audience");
  if (audience) out.push({ id: "audience", label: "Who it speaks to", text: audience.value });
  return out;
}

function LineRow({
  line,
  saved,
  canEdit,
  onSaved,
}: {
  line: Understood;
  saved?: UnderstoodLine;
  canEdit: boolean;
  onSaved?: () => void;
}) {
  const save = useSaveOnboardingProgress();
  const toast = useToast();
  const [verdict, setVerdict] = useState<"" | UnderstoodLine["verdict"]>(saved?.verdict ?? "");
  const [reason, setReason] = useState(saved?.reason ?? "");
  const failed = (e: Error) => toast.error("That wasn’t saved", { description: e.message });
  const fieldId = `line-${line.id}`;

  function mark(value: string) {
    const v = value as "" | UnderstoodLine["verdict"];
    setVerdict(v);
    if (v)
      save.mutate(
        { line: { id: line.id, verdict: v, reason: v === "not_quite" ? reason.trim() || undefined : undefined } },
        { onSuccess: onSaved, onError: failed },
      );
  }

  return (
    <li className="ui-ob-line" data-verdict={verdict || undefined}>
      <div className="ui-ob-line-text">
        <p className="ui-ob-line-label">{line.label}</p>
        <p className="ui-ob-line-words">{line.text}</p>
      </div>
      {canEdit && (
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          className="ui-ob-line-actions"
          value={verdict}
          onValueChange={mark}
          aria-label={`${line.label}: is it right?`}
        >
          <ToggleGroupItem value="right" icon="check">
            Confirm
          </ToggleGroupItem>
          <ToggleGroupItem value="not_quite">Change</ToggleGroupItem>
        </ToggleGroup>
      )}
      {canEdit && verdict === "not_quite" && (
        <Field>
          <FieldLabel htmlFor={fieldId}>
            What is right? <FieldOptional />
          </FieldLabel>
          <Input
            id={fieldId}
            value={reason}
            autoFocus={!saved?.reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() =>
              reason.trim() !== (saved?.reason ?? "") &&
              save.mutate(
                { line: { id: line.id, verdict: "not_quite", reason: reason.trim() || undefined } },
                { onSuccess: onSaved, onError: failed },
              )
            }
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            placeholder="In your words; Fume asks before it guesses"
          />
        </Field>
      )}
    </li>
  );
}

/** The lines, each with Confirm · Change (a line marked Change asks what is right), saved on the tap. Without
 *  canEdit they are a record: the words only. */
export function UnderstoodLines({
  lines,
  canEdit,
  onSaved,
}: {
  lines: Understood[];
  canEdit: boolean;
  onSaved?: () => void;
}) {
  const progress = useOnboardingProgress();
  if (!progress.data) return null;
  const saved = new Map(progress.data.lines.map((l) => [l.id, l]));
  return (
    <ul className="ui-ob-lines" aria-label="Your Brand DNA in short">
      {lines.map((l) => (
        <LineRow key={l.id} line={l} saved={saved.get(l.id)} canEdit={canEdit} onSaved={onSaved} />
      ))}
    </ul>
  );
}

// ─── Questions and test directions ──────────────────────────────────────────

/** One open question: why Fume asks, and the answer. An answered one can be changed. */
export function QuestionCard({
  unknown,
  canEdit,
  onSaved,
}: {
  unknown: Unknown;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const answer = useAnswerUnderstanding();
  const toast = useToast();
  const [editing, setEditing] = useState(!unknown.answer);
  const [text, setText] = useState(unknown.answer ?? "");
  const id = `answer-${unknown.id}`;

  function save() {
    if (!text.trim()) return;
    answer.mutate(
      { unknownId: unknown.id, answer: text.trim() },
      {
        onSuccess: () => {
          setEditing(false);
          onSaved();
          toast.done("Answer saved", { description: "Fume uses it from the next creative on." });
        },
        onError: (error) => toast.error("The answer wasn’t saved", { description: error.message }),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{unknown.question}</CardTitle>
        <CardDescription>{unknown.why}</CardDescription>
      </CardHeader>
      <CardContent>
        {unknown.answer && !editing ? (
          <p>
            Your answer: {unknown.answer}. {copy.factSource.supplied}.
          </p>
        ) : canEdit ? (
          <Field>
            <FieldLabel htmlFor={id}>Your answer</FieldLabel>
            <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} rows={2} />
          </Field>
        ) : (
          <p>{copy.factSource.unknown}. Someone on your team who can edit Brand DNA answers it.</p>
        )}
      </CardContent>
      {canEdit && (
        <CardFooter>
          {unknown.answer && !editing ? (
            <Button variant="quiet" size="sm" icon="pencil" onClick={() => setEditing(true)}>
              Change the answer
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={save} loading={answer.isPending} disabled={!text.trim()}>
              Save the answer
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

/** One test direction: is this you, saved on the tap, and why, saved when she leaves the field. */
function DirectionCard({
  direction,
  canEdit,
  onSaved,
}: {
  direction: TestDirection;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const answer = useAnswerUnderstanding();
  const toast = useToast();
  const viewer = useViewer();
  const [verdict, setVerdict] = useState<"" | "yes" | "no">(direction.verdict ?? "");
  const [reason, setReason] = useState(direction.reason ?? "");
  const id = `reason-${direction.id}`;
  const failed = (error: Error) => toast.error("That wasn’t saved", { description: error.message });

  function pick(v: string) {
    if (v !== "yes" && v !== "no") return;
    setVerdict(v);
    answer.mutate(
      { directionId: direction.id, verdict: v, reason: reason.trim() || undefined },
      { onSuccess: onSaved, onError: failed },
    );
  }
  function saveReason() {
    if (!verdict || reason.trim() === (direction.reason ?? "")) return;
    answer.mutate(
      { directionId: direction.id, verdict, reason: reason.trim() || undefined },
      { onSuccess: onSaved, onError: failed },
    );
  }

  const words = direction.verdict === "yes" ? "This is us" : "Not us";
  const said = direction.verdict ? `${viewer.staff ? viewer.brand : "You"} said: ${words}` : "Not answered yet";
  // a reason that only repeats the answer ("This is us.") is said once
  const why =
    direction.reason &&
    direction.reason
      .trim()
      .replace(/[.!\s]+$/, "")
      .toLowerCase() !== words.toLowerCase()
      ? direction.reason
      : undefined;
  return (
    <Card>
      <CardMedia>
        <CreativeMedia format="feed" src={direction.image} alt={`Test direction ${direction.name}`} />
      </CardMedia>
      <CardHeader>
        <CardTitle>{direction.name}</CardTitle>
        <CardDescription>{why ? `${said}. “${why}”` : said}</CardDescription>
      </CardHeader>
      {canEdit && (
        <CardContent>
          <ToggleGroup
            type="single"
            variant="outline"
            value={verdict}
            onValueChange={pick}
            aria-label={`Is ${direction.name} you?`}
            size="sm"
          >
            <ToggleGroupItem value="yes" icon="thumbs-up">
              This is us
            </ToggleGroupItem>
            <ToggleGroupItem value="no" icon="x">
              Not us
            </ToggleGroupItem>
          </ToggleGroup>
          {verdict && (
            <Field>
              <FieldLabel htmlFor={id}>
                Why <FieldOptional />
              </FieldLabel>
              <Input
                id={id}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onBlur={saveReason}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
            </Field>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/** The whole summary: the five lines, where the material disagreed, the test directions, what she told Fume, and
 *  Approve. An approved version reads as a record unless `editing` (the page's "Change something"); a version not yet
 *  approved is always in the edit state. */
export function UnderstandingCheck({ view, editing = false }: { view: BrandDnaView; editing?: boolean }) {
  const { canEdit: mayEdit, canApprove, me } = useRole();
  const approve = useApproveBrandDna();
  const scan = useBrandScan();
  const toast = useToast();
  const dir = directory(usePeople().data);
  const u = view.understanding;
  const open = u.unknowns.filter((x) => !x.answer);
  const unanswered = u.testDirections.filter((d) => !d.verdict);
  const approved = view.dna.state === "approved";
  // the controls show only in the edit state: a done version is a record
  const canEdit = mayEdit && (!approved || editing);
  // A change after approval is a new version the customer approves (ARCHITECTURE §5.4).
  const [changedSinceApproval, setChanged] = useState(false);
  const mayApprove = !approved || changedSinceApproval;
  const changed = () => approved && setChanged(true);

  function approveNow() {
    approve.mutate(undefined, {
      onSuccess: (dna) => {
        setChanged(false);
        toast.done(`Brand DNA version ${dna.version} approved`, {
          description: "Every campaign from now on is made and checked against it.",
        });
      },
      onError: (error) => toast.error("Brand DNA wasn’t approved", { description: error.message }),
    });
  }

  return (
    <>
      <Section
        title="What Fume read"
        titleId="und-summary"
        text={
          canEdit
            ? "From your brand material and your answers. Confirm each line, or change one that is not quite right."
            : undefined
        }
      >
        <UnderstoodLines lines={understoodLines(view, scan.data)} canEdit={canEdit} onSaved={changed} />
        {canEdit && (
          <div className="ui-app-row">
            <Button asChild variant="quiet" size="sm" icon="message-square">
              <Link to="/fume">Something else is off? Tell Fume</Link>
            </Button>
          </div>
        )}
      </Section>

      {open.length > 0 && (
        <Section
          title="Fume needs an answer"
          meta={open.length}
          titleId="und-questions"
          text="Fume asks before it guesses. Each answer goes into your Brand DNA as something you gave us."
        >
          <div className="ui-app-grid ui-app-grid--wide">
            {open.map((x) => (
              <QuestionCard key={x.id} unknown={x} canEdit={mayEdit} onSaved={changed} />
            ))}
          </div>
        </Section>
      )}

      {u.conflicts.length > 0 && (
        <Section title="Where your material disagreed" meta={u.conflicts.length} titleId="und-conflicts">
          <ItemGroup as="ul">
            {u.conflicts.map((c) => (
              <Item key={c.id} as="li">
                <ItemMedia variant="icon">
                  <Icon name={c.resolved ? "circle-check" : "triangle-alert"} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{c.text}</ItemTitle>
                  <ItemDescription>
                    {c.resolved
                      ? `Settled: ${c.resolved}`
                      : "Not settled yet. Fume asks you about it before the first campaign."}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </Section>
      )}

      <Section
        title="Three test directions"
        meta={canEdit && unanswered.length ? `${unanswered.length} to answer` : undefined}
        titleId="und-directions"
        text={canEdit ? "Deliberately different, so your yes and no teach Fume where the edges are." : undefined}
      >
        <div className="ui-app-grid">
          {u.testDirections.map((d) => (
            <DirectionCard key={d.id} direction={d} canEdit={canEdit} onSaved={changed} />
          ))}
        </div>
      </Section>

      {u.unknowns.some((x) => x.answer) && (
        <Section title="What you told Fume" titleId="und-answers">
          <ItemGroup as="ul">
            {u.unknowns
              .filter((x) => x.answer)
              .map((x) => (
                <Item key={x.id} as="li">
                  <ItemContent>
                    <ItemTitle>{x.question}</ItemTitle>
                    <ItemDescription>
                      {x.answer} · {copy.factSource.supplied}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
          </ItemGroup>
        </Section>
      )}

      {/* approving belongs to the edit state; a version approved and unchanged says so in the page's intro */}
      {(!approved || changedSinceApproval || editing) && (
        <Section title={approved ? "Approve the change" : "Approve your Brand DNA"} titleId="und-approve">
          {approved && !changedSinceApproval ? (
            <Alert>
              <AlertTitle>{versionLine(view.dna, dir.name, me)}</AlertTitle>
              <AlertDescription>
                Campaigns are made and checked against this version. A change here becomes version{" "}
                {view.dna.version + 1} for you to approve.
              </AlertDescription>
            </Alert>
          ) : canApprove ? (
            <Alert>
              <AlertTitle>
                {approved ? `Version ${view.dna.version + 1} is ready for you` : "Ready when you are"}
              </AlertTitle>
              <AlertDescription>
                Approving tells Fume this is your brand. Every campaign is made and checked against it, and you can
                change it later.
              </AlertDescription>
              <AlertAction>
                <Button icon="check" onClick={approveNow} loading={approve.isPending} disabled={!mayApprove}>
                  Approve Brand DNA v{view.dna.version + 1}
                </Button>
              </AlertAction>
            </Alert>
          ) : (
            <Alert>
              <AlertTitle>{dnaState[view.dna.state]}</AlertTitle>
              <AlertDescription>An owner or an approver on your team approves Brand DNA.</AlertDescription>
            </Alert>
          )}
        </Section>
      )}
    </>
  );
}

/** "What Fume works from. You approved version 3 on 5 Oct." */
function intro(view: BrandDnaView, name: (id?: string) => string, me?: string): string {
  const { dna } = view;
  if (dna.state === "approved" && dna.approvedAt) {
    const who = dna.approvedBy === me ? "You" : name(dna.approvedBy);
    return `What Fume works from. ${who} approved version ${dna.version} on ${date(dna.approvedAt)}.`;
  }
  return "What Fume read from your brand material. Confirm each line or change it, then approve your Brand DNA.";
}

/** /brand/understanding: the Brand DNA summary, a record until "Change something". */
export function UnderstandingPage() {
  const brand = useBrandDna();
  const { canEdit, me } = useRole();
  const dir = directory(usePeople().data);
  const [editing, setEditing] = useState(false);
  const approved = brand.data?.dna.state === "approved";
  return (
    <Page title="Brand DNA summary · Brand" width="reading">
      <PageHeader
        title="Brand DNA summary"
        back={<Back to="/brand" label="Brand" />}
        description={brand.data ? intro(brand.data, dir.name, me) : undefined}
        actions={
          canEdit && approved ? (
            editing ? (
              <Button variant="quiet" onClick={() => setEditing(false)}>
                Done
              </Button>
            ) : (
              <Button variant="secondary" icon="pencil" onClick={() => setEditing(true)}>
                Change something
              </Button>
            )
          ) : undefined
        }
      />
      <Query query={brand} loading="Loading your Brand DNA summary">
        {(view) => <UnderstandingCheck view={view} editing={editing} />}
      </Query>
    </Page>
  );
}
