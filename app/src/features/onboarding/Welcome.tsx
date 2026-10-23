// The brand onboarding (FLOWS §0.10, §7), outside the shell, in four steps (round 8, UX review ONB-10):
//   /welcome         1 Your brand: the website's address and Build; beside it on a desk (≥ 1024 px), a drop target
//                      for brand material (two equal ways in, DLAY-11); under it on a phone, as a compact row.
//                      While files are dragged, the whole page takes them (DTSK-22).
//   /welcome/scan    2 Fume reads it: the mind map, then one pill, "Confirm what Fume found".
//   /welcome/review  3 Confirm what Fume found: Logo, Colour, Type, Imagery, Voice, one part at a time (?part=).
//   /welcome/taste   4 Your taste: one deck of six cards; then "What Fume understood" replaces it, with Approve and
//                      start at its foot.
// A new customer is sent here until Brand DNA is approved (shell/Root → /welcome?resume, which opens the furthest
// step she reached; ?fresh in the mock). Once a reading exists, step 1 says "Continue" instead of starting again.
// "Start from nothing" (answer questions instead of a website) is not offered until that path exists (ONB-7).
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  Button,
  Dropzone,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  useNarrowScreen,
  useToast,
  type DropzoneItem,
} from "@fume/ui";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  useBrandBoard,
  useBrandDna,
  useBrandScan,
  useOnboardingProgress,
  usePeople,
  useSession,
  useStartBrandScan,
} from "../../api/hooks";
import { directory, firstName } from "../../shell/people";
import { useRole, versionLine } from "../brand/parts";
import { BuildingDna } from "./BuildingDna";
import { checkParts, resumePath, StepFrame, stepTitle, useOpenAtTop } from "./frame";
import { openIn } from "./found";
import { CheckFound, TasteStep } from "./GoThrough";

/** Strip the scheme and a trailing slash: "https://lysne.no/" reads "lysne.no". */
const bare = (url: string) =>
  url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");

function WaysIn() {
  const session = useSession().data!;
  const brand = useBrandDna();
  const scan = useBrandScan();
  const board = useBrandBoard();
  const progress = useOnboardingProgress();
  const dir = directory(usePeople().data);
  const { me, canEdit } = useRole();
  const start = useStartBrandScan();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [url, setUrl] = useState(scan.data?.url ?? "lysne.no");
  const [files, setFiles] = useState<(DropzoneItem & { file: File })[]>([]);
  const [again, setAgain] = useState(false);
  // A desk: the two ways in side by side, the drop target a box to aim at; a phone: one under the other, a row.
  const desk = useNarrowScreen("(min-width: 1024px)");
  const site = bare(url);
  const ready = site.length > 3 || files.length > 0;
  const dna = brand.data?.dna;
  const brandName = session.workspace.brandName;
  const p = progress.data;
  const reading = scan.data;
  const resume = Boolean(reading && p && p.step !== "");

  // Sent here by the root (/welcome?resume): open the furthest step she reached.
  const sentHere = params.has("resume");
  useEffect(() => {
    if (sentHere && p && p.step !== "") navigate(resumePath(p), { replace: true });
  }, [sentHere, p, navigate]);

  function build(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    const source = site && files.length ? "both" : site ? "website" : "upload";
    start.mutate(
      { source, url: site || undefined, files: files.map((f) => ({ name: f.name, bytes: f.bytes })) },
      {
        onSuccess: () => navigate("/welcome/scan"),
        onError: (error) => toast.error("Fume couldn’t start reading", { description: error.message }),
      },
    );
  }

  // "Continue: Check what Fume found · Colour", and how far she is.
  const identity = board.data?.identity;
  const partsDone = identity ? checkParts.filter((x) => openIn(identity, x.id) === 0).length : 0;
  const partLabel = p?.step === "review" ? checkParts.find((x) => x.id === (p.part ?? "logo"))?.label : undefined;
  const continueWords = p ? `${stepTitle(p.step)}${partLabel ? ` · ${partLabel}` : ""}` : "";

  return (
    <StepFrame
      step=""
      title="Welcome to Fume"
      foot={
        resume && !again ? (
          <Button size="lg" iconEnd="arrow-right" onClick={() => navigate(resumePath(p))}>
            Continue
          </Button>
        ) : undefined
      }
      footAlign="end"
    >
      <header className="ui-welcome-head">
        <p className="ui-welcome-eyebrow">Hi {firstName(session.user.name)}</p>
        <h1 className="ui-welcome-title">Welcome to Fume, {brandName}</h1>
        <p className="ui-welcome-lede">
          Show us your brand and Fume builds your Brand DNA: the brand rules every creative follows. Nothing is used
          until you confirm it.
        </p>
      </header>

      {dna?.state === "approved" && (
        <Alert>
          <AlertTitle>{versionLine(dna, dir.name, me)}</AlertTitle>
          <AlertDescription>
            A new reading proposes changes. Your Brand DNA stays as it is until you confirm them.
          </AlertDescription>
          <AlertAction>
            <Button asChild variant="secondary" size="sm" iconEnd="arrow-right">
              <Link to="/brand">Open Brand DNA</Link>
            </Button>
          </AlertAction>
        </Alert>
      )}

      {resume && !again ? (
        <section className="ui-welcome-continue" aria-labelledby="continue-title">
          <p className="ui-welcome-continue-label">Where you left off</p>
          <h2 className="ui-welcome-continue-title" id="continue-title">
            {continueWords}
          </h2>
          <p className="ui-welcome-continue-text">
            {p?.step === "review"
              ? `${partsDone} of ${checkParts.length} parts done. Fume read ${reading?.url ?? "your material"}; everything you confirmed is saved.`
              : `Fume read ${reading?.url ?? "your material"}; everything you confirmed is saved.`}
          </p>
          {canEdit && (
            <Button variant="quiet" size="sm" icon="refresh-cw" onClick={() => setAgain(true)}>
              Read my website again
            </Button>
          )}
        </section>
      ) : (
        <form className="ui-welcome-form" onSubmit={build} aria-label="How Fume should read your brand">
          <div className="ui-welcome-way">
            <Field>
              <FieldLabel htmlFor="ways-url">Your website</FieldLabel>
              <Input
                id="ways-url"
                type="text"
                inputMode="url"
                autoComplete="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="yourbrand.com"
                disabled={!canEdit}
              />
              <FieldDescription>
                Fume reads your public pages: the logo, colours, type, pictures, products and how you write. Nothing on
                your site changes.
              </FieldDescription>
            </Field>
            <div className="ui-welcome-go">
              <Button
                type="submit"
                size="lg"
                icon="fume-engine"
                loading={start.isPending}
                disabled={!ready || !canEdit}
              >
                Build my Brand DNA
              </Button>
              {!canEdit && (
                <p className="ui-welcome-note">Someone on your team who can edit Brand DNA starts the reading.</p>
              )}
            </div>
          </div>
          <div className="ui-welcome-way ui-welcome-more">
            <p className="ui-welcome-more-label" id="ways-material">
              Or add brand material
            </p>
            <Dropzone
              compact={!desk}
              grid={false}
              dropAnywhere
              aria-labelledby="ways-material"
              items={files}
              onFiles={(list) =>
                setFiles((now) => [
                  ...now,
                  ...list.map((f, i) => ({
                    id: `in-${Date.now()}-${i}`,
                    name: f.name,
                    bytes: f.size,
                    state: "done" as const,
                    file: f,
                  })),
                ])
              }
              onRemove={(id) => setFiles((now) => now.filter((f) => f.id !== id))}
              accept="image/*,video/*,.pdf,.svg,.otf,.ttf,.woff,.woff2,.zip"
              maxBytes={200_000_000}
              maxLabel="200 MB"
              target={`${brandName}’s Brand DNA`}
              copy="Drop your brand material here, or choose it"
              touchCopy="Choose your brand material"
              moreCopy="Add more brand material"
              meta="Guidelines, logos, fonts or packshots · up to 200 MB"
              listLabel="Brand material to read"
              disabled={!canEdit}
            />
            <p className="ui-welcome-note">With your website or instead of it.</p>
          </div>
        </form>
      )}
    </StepFrame>
  );
}

export function Welcome() {
  const { step } = useParams<"step">();
  useOpenAtTop();
  if (step === "scan") return <BuildingDna />;
  if (step === "review") return <CheckFound />;
  if (step === "taste") return <TasteStep />;
  // What Fume understood is now the last card of the taste deck.
  if (step === "understanding") return <Navigate to="/welcome/taste" replace />;
  return <WaysIn />;
}
