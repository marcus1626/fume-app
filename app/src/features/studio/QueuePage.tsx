// /studio/b/:workspaceId/queue: an old link to a brand's queue opens the brand's Check, with what the address asked for
// (?item=…).
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useSession } from "../../api/hooks";
import { checkPath } from "../../shell/scope";

export function QueuePage() {
  const { workspaceId } = useParams();
  const { search } = useLocation();
  const agency = Boolean(useSession().data?.user.agency);
  return <Navigate to={`${checkPath(agency ? "agency" : "fume", workspaceId)}${search}`} replace />;
}
