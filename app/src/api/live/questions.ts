// What Fume still asks, and meetings with Fume, on the live backend. The questions are the product lines a campaign
// waits on (a required fact not yet confirmed, on a product in an open campaign) and the lines Fume could not read
// at all (no statement, or one that is a question). Answering one corrects or confirms the fact, which only the
// brand's owner and approvers may (the database says so to anyone else). Meetings are booked with the brand's person at
// Fume (20261103215000_meetings.sql).
import type { FumeApi, Meeting, OpenQuestion } from "../../contract";
import { FumeError } from "../../contract";
import type { Live } from "./context";
import { command, requestKey, rows, supabase } from "./supabase";

type Calls = "questions" | "answerQuestion" | "meetingSlots" | "meetingTopics" | "bookMeeting" | "meetings";

const MEETING_TOPICS = [
  "Urgent",
  "An update",
  "Feedback on creatives",
  "The plan",
  "Package and billing",
  "Something else",
];
const CLAIMS_WHY =
  "Fume puts only claims you have confirmed on a creative, so the ads stay true to what the product may say.";

interface FactQ {
  id: string;
  product_id: string;
  area: string;
  label: string;
  statement: string;
  required: boolean;
  products: { name: string } | null;
}

const unknown = (s: string) => !s.trim() || s.trim().endsWith("?");

export function questionCalls(live: Live): Pick<FumeApi, Calls> {
  const read = async (): Promise<OpenQuestion[]> => {
    const ws = await live.workspaceId();
    const [facts, open] = await Promise.all([
      rows<FactQ>(
        supabase()
          .from("product_facts")
          .select("id, product_id, area, label, statement, required, products(name)")
          .eq("workspace_id", ws)
          .neq("status", "verified")
          .is("superseded_by", null)
          .overrideTypes<FactQ[], { merge: false }>(),
      ),
      rows<{ campaign_id: string; product_id: string; campaigns: { state: string; created_at: string } | null }>(
        supabase()
          .from("campaign_products")
          .select("campaign_id, product_id, campaigns(state, created_at)")
          .eq("workspace_id", ws)
          .overrideTypes<
            { campaign_id: string; product_id: string; campaigns: { state: string; created_at: string } | null }[],
            { merge: false }
          >(),
      ),
    ]);
    const live_ = open.filter((c) => c.campaigns && !["delivered", "closed"].includes(c.campaigns.state));
    const waitingOn = (productId: string) =>
      live_
        .filter((c) => c.product_id === productId)
        .sort((a, b) => a.campaigns!.created_at.localeCompare(b.campaigns!.created_at))[0];
    const asked = facts.filter((f) => unknown(f.statement) || (f.required && waitingOn(f.product_id)));
    return asked
      .map((f): OpenQuestion => {
        const name = f.products?.name ?? "the product";
        const claims = f.area === "claim";
        const campaign = waitingOn(f.product_id);
        const known = !unknown(f.statement);
        return {
          id: `fact:${f.id}`,
          question: claims
            ? `Which claims may we use for ${name}?`
            : !known && f.statement.trim()
              ? f.statement
              : `What is the ${f.label.toLowerCase()} of ${name}?`,
          why: claims ? CLAIMS_WHY : "Fume makes creatives only of what you have confirmed, so we ask before we guess.",
          line: claims ? `The claims we may use for ${name}` : `${f.label} of ${name}`,
          answer: "text",
          productId: f.product_id,
          factId: f.id,
          ...(campaign ? { campaignId: campaign.campaign_id } : {}),
          ...(known ? { suggestions: [{ label: "As it is", text: f.statement }] } : {}),
          ...(claims ? { hint: "One claim per line, as it may stand on a creative" } : {}),
        };
      })
      .sort((a, b) => Number(Boolean(b.campaignId)) - Number(Boolean(a.campaignId)));
  };

  return {
    questions: read,
    async answerQuestion({ questionId, text }) {
      const factId = questionId.startsWith("fact:") ? questionId.slice(5) : undefined;
      if (!factId) throw new FumeError("not_found", "That question is answered already.");
      const answer = text?.trim();
      if (!answer) throw new FumeError("invalid", "Write the answer first.");
      const fact = await rows<{ statement: string }>(
        supabase().from("product_facts").select("statement").eq("id", factId),
      );
      if (!fact[0]) throw new FumeError("not_found", "That question is answered already.");
      if (fact[0].statement.trim() === answer) await command("verify_fact", { p_fact_id: factId, p_key: requestKey() });
      else await command("correct_fact", { p_fact_id: factId, p_statement: answer, p_key: requestKey() });
      return read();
    },
    async meetingSlots() {
      return command<string[]>("meeting_slots", { p_workspace_id: await live.workspaceId() });
    },
    async meetingTopics() {
      return [...MEETING_TOPICS];
    },
    async bookMeeting({ at, topic }) {
      return command<Meeting>("book_meeting", { p_workspace_id: await live.workspaceId(), p_at: at, p_topic: topic });
    },
    async meetings() {
      const list = await rows<{
        id: string;
        workspace_id: string;
        topic: string;
        at: string;
        minutes: number;
        host_id: string | null;
        guest_ids: string[];
        state: Meeting["state"];
      }>(
        supabase()
          .from("meetings")
          .select("id, workspace_id, topic, at, minutes, host_id, guest_ids, state")
          .eq("workspace_id", await live.workspaceId())
          .neq("state", "cancelled")
          .order("at"),
      );
      return list.map((m) => ({
        id: m.id,
        workspaceId: m.workspace_id,
        topic: m.topic,
        at: new Date(m.at).toISOString(),
        minutes: m.minutes,
        hostId: m.host_id ?? "",
        guestIds: m.guest_ids,
        state: m.state,
      }));
    },
  };
}
