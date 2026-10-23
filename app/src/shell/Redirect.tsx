// An older address that now lives inside one of the four places (UX review 15 Oct, §2.3): it sends you on and keeps
// what the address said (/calendar?d=2026-10-20 opens that day in Campaigns' calendar view).
import { Navigate, useLocation, useParams } from "react-router-dom";

export function Redirect({ to, add }: { to: string; add?: Record<string, string> }) {
  const { search, hash } = useLocation();
  const params = new URLSearchParams(search);
  for (const [k, v] of Object.entries(add ?? {})) params.set(k, v);
  const query = params.toString();
  return <Navigate to={`${to}${query ? `?${query}` : ""}${hash}`} replace />;
}

/** /products/:id now lives at /brand/products/:id (walk-through 19 Oct, WAY-11). */
export function ProductRedirect() {
  const { productId } = useParams<"productId">();
  return <Redirect to={`/brand/products/${productId}`} />;
}
