// /studio/b/:workspaceId/queue (round 12, desktop review 20 Oct, DWAY-17, DLOAD-11; PROPOSED 20 Oct 2026): the queue is
// Check now, one place by one name in both frames. An old link to a brand's queue opens the brand's Check, with what
// the address asked for (?item=…).
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useSession } from "../../api/hooks";
import { checkPath } from "../../shell/scope";

export function QueuePage() {
  const { workspaceId } = useParams();
  const { search } = useLocation();
  const agency = Boolean(useSession().data?.user.agency);
  return <Navigate to={`${checkPath(agency ? "agency" : "fume", workspaceId)}${search}`} replace />;
}
