// Live updates on the live backend: every new row in the record (a brief sent, a version checked, an approval, a
// delivery) reaches the open screens over Supabase Realtime, which applies the same row-level security as a read.
// The app then reads again what the change touches; a burst of rows becomes one refresh.
import type { FumeApi, FumeEvent } from "../../contract";
import type { Live } from "./context";
import { readCampaigns } from "./map";
import { supabase } from "./supabase";

interface RecordRow {
  workspace_id: string;
  subject_type: string;
  subject_id: string;
  detail: { campaign_id?: string } | null;
}

export function eventCalls(live: Live): Pick<FumeApi, "subscribe"> {
  return {
    subscribe(handler: (event: FumeEvent) => void) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const pending = new Set<string>();
      const flush = async () => {
        const ids = [...pending];
        pending.clear();
        live.forget();
        const campaigns = await readCampaigns(ids.length ? { ids } : { workspaceId: await live.workspaceId() }).catch(
          () => [],
        );
        // "campaign.state" refreshes every open query (api/client.tsx), so one is enough.
        if (campaigns[0]) handler({ type: "campaign.state", campaign: campaigns[0] });
      };
      const channel = supabase()
        .channel(`record-${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "record_events" }, (payload) => {
          const row = payload.new as RecordRow;
          const campaignId = row.detail?.campaign_id ?? (row.subject_type === "campaign" ? row.subject_id : undefined);
          if (campaignId) pending.add(campaignId);
          clearTimeout(timer);
          timer = setTimeout(() => void flush(), 300);
        })
        .subscribe();
      return () => {
        clearTimeout(timer);
        void supabase().removeChannel(channel);
      };
    },
  };
}
