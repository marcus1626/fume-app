// /studio/check/:checkId (round 12, desktop review 20 Oct, DLAY-2, DWAY-7; PROPOSED 20 Oct 2026): the full-screen
// Quality Gate is retired. One creative had two check screens with other buttons, other words and a "Back to the queue"
// that went to Overview; now there is one, Check (studio/qa/QaPage.tsx). An old link to a check opens that creative in
// its brand's Check (/studio/b/:workspaceId/qa?item=…), or the brand's Check when it is no longer there. Its per-rule
// list lives on in Check's panel, under "What it is checked against". An admin follows the work and has no Check
// (FLOWS §20); a customer lands on her Home.
import { Navigate, useParams } from "react-router-dom";
import { useCheck, useQaQueue, useSession } from "../../api/hooks";
import type { Id } from "../../contract";
import { Loading } from "../../shell/Page";
import { checkPath } from "../../shell/scope";

export function CheckPage() {
  const session = useSession().data!;
  const { checkId } = useParams<"checkId">();
  if (!session.user.staffRole || !checkId) return <Navigate to="/" replace />;
  if (session.user.staffRole === "admin") return <Navigate to="/studio" replace />;
  return <ToCheck checkId={checkId} frame={session.user.agency ? "agency" : "fume"} />;
}

function ToCheck({ checkId, frame }: { checkId: Id; frame: "fume" | "agency" }) {
  const check = useCheck(checkId);
  const queue = useQaQueue();
  if (check.error) return <Navigate to={checkPath(frame)} replace />;
  if (!check.data || !queue.data) return <Loading label="Opening Check" />;
  const { creative, workspace } = check.data;
  const item = queue.data.find((v) => v.item.creativeId === creative.id && v.item.format === creative.format);
  return <Navigate to={`${checkPath(frame, workspace.id)}${item ? `?item=${encodeURIComponent(item.item.id)}` : ""}`} replace />;
}
