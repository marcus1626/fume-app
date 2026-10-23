// What the switcher's screens share: the queue's rows, a board as a card, the Engine's candidates (generations) in
// words and ranked best first, and opening one in the Studio. Fume's people only: lineage and evaluation words appear
// here and never on a customer's screen.
import {
  Badge,
  Card,
  CardDescription,
  CardHeader,
  CardMedia,
  CardTitle,
  CreativeTile,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemMediaImage,
  ItemTitle,
  useToast,
} from "@fume/ui";
import { Link, useNavigate } from "react-router-dom";
import { useOpenDocument } from "../../api/hooks";
import type { Board, BoardKind, CreativeDocument, Format, Generation, Id, QueueItem, StudioSession } from "../../contract";
import * as copy from "../../copy";
import { due, time, when } from "../../lib/time";
import { checkStateLabel, formatName, whatChanged } from "./parts";

/** One row per creative in check: workspace and campaign, format and version, what changed, the state and the clock. */
export function QueueList({ items, showBrand = true }: { items: QueueItem[]; showBrand?: boolean }) {
  return (
    <ItemGroup as="ul">
      {items.map(({ check, creative, campaign, workspace }) => (
        <Item key={check.id} as="li" variant="outline" asChild>
          <Link to={`/studio/check/${check.id}`}>
            <ItemMedia variant="creative">
              <ItemMediaImage src={creative.current.image} alt="" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{creative.title}</ItemTitle>
              <ItemDescription>{showBrand ? `${workspace.brandName} · ${campaign.name}` : campaign.name}</ItemDescription>
              <ItemDescription>
                {formatName(creative.format)} · V{creative.current.number} · {whatChanged(creative)}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              {check.risk === "high" && <Badge variant="ink">High risk</Badge>}
              {check.state !== "waiting" && <Badge check="waiting">{checkStateLabel[check.state]}</Badge>}
              <Badge icon="clock">
                Due {due(check.dueAt)}, {time(check.dueAt)}
              </Badge>
              <Icon name="chevron-right" />
            </ItemActions>
          </Link>
        </Item>
      ))}
    </ItemGroup>
  );
}

export const boardKindLabel: Record<BoardKind, string> = {
  brand_moodboard: "Brand moodboard",
  campaign_moodboard: "Campaign moodboard",
  ideas: "Idea board",
  layout: "Layout",
};

/** "6 pictures", as the board's own page counts them (or its items when it holds no picture). */
const boardCount = (board: Board) => {
  const shown = board.items.filter((i) => i.provenance.state !== "removed");
  const pictures = shown.filter((i) => i.kind === "image" || i.kind === "creative").length;
  return pictures ? copy.count(pictures, "picture") : copy.count(shown.length, "item");
};

/** A board as a card: up to four of its images as the cover, its name, its kind and when it last changed. */
export function BoardCard({ board, to }: { board: Board; to: string }) {
  const images = board.items.filter((i) => i.image).slice(0, 4);
  return (
    <Card interactive asChild>
      <Link to={to}>
        <CardMedia className="ui-studio-board-cover" data-count={images.length}>
          {images.length ? images.map((i) => <img key={i.id} src={i.image} alt="" />) : <Icon name="layout-grid" />}
        </CardMedia>
        <CardHeader>
          <CardTitle>{board.name}</CardTitle>
          <CardDescription>
            {/* round 13 (robots' note 08): the count the board itself says, its pictures (notes and swatches are not) */}
            {boardKindLabel[board.kind]} · {boardCount(board)} · changed {when(board.updatedAt)}
          </CardDescription>
        </CardHeader>
      </Link>
    </Card>
  );
}

// ─── Candidates (generations) ───────────────────────────────────────────────

/** Lower is better: discarded last, then by what the Engine's evaluation flagged. */
export function generationScore(g: Generation): number {
  const e = g.evaluation;
  let s = 0;
  if (e.productTruth === "flag") s += 4;
  if (e.brandRules === "flag") s += 3;
  if (e.artefacts === "minor") s += 1;
  if (e.artefacts === "major") s += 5;
  if (g.state === "discarded") s += 20;
  if (g.state === "making") s += 40;
  if (g.state === "picked" || g.state === "sent_to_check") s -= 2;
  return s;
}

export const bestFirst = (gs: Generation[]) => [...gs].sort((a, b) => generationScore(a) - generationScore(b) || b.at.localeCompare(a.at));

/** "Clean", or what the evaluation flagged: "Product Truth flagged · Cap reads glossy". */
export function evaluationWords(g: Generation): string {
  const e = g.evaluation;
  const flags = [
    e.productTruth === "flag" && "Product Truth flagged",
    e.brandRules === "flag" && "Brand rules flagged",
    e.artefacts !== "none" && `${e.artefacts === "major" ? "Major" : "Minor"} artefacts`,
  ].filter(Boolean) as string[];
  if (!flags.length) return "Clean";
  return [...flags, ...e.notes].join(" · ");
}

export const generationStateLabel: Record<Generation["state"], string> = {
  making: "The Engine is making it",
  candidate: "Candidate",
  picked: "Picked for the slot",
  discarded: "Set aside",
  sent_to_check: "In check",
};

/** The creative tile's shape for a format (the tile itself knows feed and story; square is a ratio). */
export const tileShape = (format: Format) => (format === "square" ? { ratio: "1 / 1" } : { format });

/** Opens the Studio's creative document for a candidate, a planned creative or a campaign, and goes there (FLOWS
 *  §9.2: one document per creative; an existing one is reopened when the creative is known). */
export function useOpenInStudio(workspaceId: Id) {
  const open = useOpenDocument();
  const navigate = useNavigate();
  const toast = useToast();
  return {
    pending: open.isPending,
    open: (input: { campaignId?: Id; slot?: string; fromGenerationId?: Id; creativeId?: Id; modeId?: Id }) =>
      open.mutate(
        { workspaceId, studio: "render", modeId: input.modeId ?? "m-free", campaignId: input.campaignId, creativeId: input.creativeId, slot: input.slot, title: input.slot, fromGenerationId: input.fromGenerationId },
        {
          onSuccess: (d) => navigate(`/studio/doc/${d.id}`),
          onError: (e) => toast.error("The Studio didn’t open", { description: e.message }),
        },
      ),
  };
}

/** A candidate as a tile: the image, its state and what the evaluation found; opening it opens it in the Studio. */
export function CandidateTile({ g, onOpen }: { g: Generation; onOpen: () => void }) {
  return (
    <CreativeTile
      src={g.image}
      alt=""
      {...tileShape(g.recipe.format)}
      label={`Open in the Studio: ${generationStateLabel[g.state].toLowerCase()}, branch ${g.branch}`}
      caption={evaluationWords(g)}
      check={
        g.state === "picked" ? (
          <Badge icon="bookmark">Picked</Badge>
        ) : g.state === "sent_to_check" ? (
          <Badge check="waiting">In check</Badge>
        ) : g.evaluation.productTruth === "flag" || g.evaluation.brandRules === "flag" ? (
          <Badge icon="triangle-alert">Flagged</Badge>
        ) : undefined
      }
      loading={g.state === "making"}
      onOpen={onOpen}
    />
  );
}

/** A candidate shows once, under the newest run that holds it (a session can follow several runs of one campaign). */
export function distinctOutput<T extends { generations: Generation[] }>(output: T[]): T[] {
  const seen = new Set<Id>();
  return output.map((o) => {
    const generations = o.generations.filter((g) => !seen.has(g.id));
    generations.forEach((g) => seen.add(g.id));
    return { ...o, generations };
  });
}

/** A Studio session as a row: its slot, campaign, how many candidates, who and when; it opens the session. */
export function SessionRow({ session, workspaceId, campaign, by }: { session: StudioSession; workspaceId: string; campaign?: string; by: string }) {
  const picked = session.generations.find((g) => g.id === session.pickedId);
  const cover = picked ?? session.generations.at(-1);
  const sent = session.generations.some((g) => g.state === "sent_to_check");
  return (
    <Item as="li" variant="outline" asChild>
      <Link to={`/studio/b/${workspaceId}/studio/session/${session.id}`}>
        <ItemMedia variant="creative">{cover ? <ItemMediaImage src={cover.image} alt="" /> : <Icon name="layers" />}</ItemMedia>
        <ItemContent>
          <ItemTitle>{session.slot ?? "Free session"}</ItemTitle>
          <ItemDescription>
            {campaign ?? "No campaign"} · {copy.count(session.generations.length, "candidate")} · {by}, {when(session.updatedAt)}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          {sent ? <Badge check="waiting">In check</Badge> : picked ? <Badge icon="bookmark">Picked</Badge> : null}
          <Icon name="chevron-right" />
        </ItemActions>
      </Link>
    </Item>
  );
}

/** A creative document as a row: its title, campaign, version and who changed it last; it opens the desk. */
export function DocumentRow({ doc, campaign, by }: { doc: CreativeDocument; campaign?: string; by: string }) {
  const cover = doc.versions.find((v) => v.id === doc.pickedVersionId) ?? doc.versions.at(-1);
  return (
    <Item as="li" variant="outline" asChild>
      <Link to={`/studio/doc/${doc.id}`}>
        <ItemMedia variant="creative">{cover ? <ItemMediaImage src={cover.image} alt="" /> : <Icon name="layers" />}</ItemMedia>
        <ItemContent>
          <ItemTitle>{doc.slot ?? doc.title}</ItemTitle>
          <ItemDescription>
            {campaign ?? "No campaign"} · {copy.count(doc.versions.length, "version")} · {by}, {when(doc.updatedAt)}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          {doc.state === "in_check" ? <Badge check="waiting">In check</Badge> : cover ? <Badge>V{cover.number}</Badge> : null}
          <Icon name="chevron-right" />
        </ItemActions>
      </Link>
    </Item>
  );
}
