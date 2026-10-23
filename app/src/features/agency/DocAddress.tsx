// The Studio's desk is one page for both frames, and its address follows the person: an agency's people work at
// /agency/doc/:id, Fume's at /studio/doc/:id. A link to the other frame's address (a studio page reused in the agency,
// an old link) lands on the person's own.
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useSession } from "../../api/hooks";
import { docHref } from "../../shell/scope";
import { DocumentPage } from "../studio/doc/DocumentPage";

export function DocAddress() {
  const { documentId } = useParams();
  const { pathname, search, hash } = useLocation();
  const session = useSession().data;
  const frame = session?.user.agency ? "agency" : "fume";
  const own = documentId ? docHref(frame, documentId) : undefined;
  if (session && own && pathname !== own) return <Navigate to={`${own}${search}${hash}`} replace />;
  return <DocumentPage />;
}
