// Check across the clients (FLOWS §24.3, round 11, PROPOSED 20 Oct 2026): every creative waiting for the agency's
// check, across its clients. It is the studio's Check as it is (studio/qa/QaPage.tsx): without a brand in the
// address it shows every brand the signed-in person works on, so for an agency person every client. Pick one and it
// opens large: Mark checked (C), Tell the Engine (F), Open in Studio (S). The checks are the agency's own ("Checked
// by Nora"); only the client approves (§24.2).
import { QaPage } from "../studio/qa/QaPage";

export function AgencyCheckPage() {
  return <QaPage />;
}
