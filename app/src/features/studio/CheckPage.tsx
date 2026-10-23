// /studio/check/:checkId: an old link to a full-screen check. A creative has one check screen, Check
// (studio/qa/QaPage.tsx), so this opens that creative in its brand's Check (/studio/b/:workspaceId/qa?item=…), or the
// brand's Check when it is no longer there. An admin follows the work and has no Check (FLOWS §20); a customer lands on
// her Home.
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
  return (
    <Navigate
      to={`${checkPath(frame, workspace.id)}${item ? `?item=${encodeURIComponent(item.item.id)}` : ""}`}
      replace
    />
  );
}
