// A creative's check line in a brand an agency runs (FLOWS §24.2, §24.5). An approval the agency recorded says so
// ("Maja approved · recorded by Nora"); a change the client asked for names the client ("Maja asked for changes"). For
// the agency a checked creative is "Checked, not sent" or "With Maja" (sent; she approves it). Everything else is the
// app's one check line (CreativeCheck), with the Amber triangle on checked work.
import { CheckMark } from "@fume/ui";
import type { Creative, User } from "../../contract";
import { useSession } from "../../api/hooks";
import { CreativeCheck } from "../shared/creatives";
import { approvedWords, sendState } from "./clientFlow";

export function ClientCheck({
  creative,
  people,
  waitingOn,
  client,
}: {
  creative: Creative;
  people: (id?: string) => User | undefined;
  waitingOn?: string;
  client?: string;
}) {
  const user = useSession().data?.user;
  const me = user?.id ?? "";
  const v = creative.current;
  if (v.state === "checked" && (waitingOn || user?.agency))
    return <CheckMark className="ui-client-check" state="checked" label={sendState(waitingOn)} />;
  // The agency reads who asked: the client, never "You asked for changes".
  if (v.state === "changes_requested" && user?.agency)
    return (
      <CheckMark className="ui-client-check" state="changes" label={`${client ?? "The client"} asked for changes`} />
    );
  if ((v.state === "approved" || v.state === "delivered") && v.recordedBy)
    return (
      <CheckMark
        className="ui-client-check"
        state="checked"
        label={approvedWords(v, (id) => people(id)?.name ?? "Someone", me)}
      />
    );
  return <CreativeCheck creative={creative} people={people} />;
}
