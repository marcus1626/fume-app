// Round 11 (FLOWS §24.3): opening one client from the agency's places.
// Round 12 (desktop review 20 Oct, DWAY-3; PROPOSED 20 Oct 2026): a client's places name the client in the address
// (/agency/b/:workspaceId/…), and the address switches the session (StudioShell), so opening a client is going to its
// address: "/" is that client's Home, "/campaigns/c-autumn" that campaign under the client's prefix.
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { Id } from "../../contract";
import { hrefIn } from "../../shell/scope";

export function useOpenClient(): (workspaceId: Id, to?: string) => Promise<void> {
  const navigate = useNavigate();
  return useCallback(
    async (workspaceId: Id, to = "/") => {
      navigate(hrefIn("agency", workspaceId, to));
    },
    [navigate],
  );
}
