// Check across the clients (FLOWS §24.3): the studio's Check as it is (studio/qa/QaPage.tsx). Without a brand in the
// address it shows every brand the signed-in person works on, so for an agency person every client. The checks are the
// agency's own ("Checked by Nora"); only the client approves (§24.2).
import { QaPage } from "../studio/qa/QaPage";

export function AgencyCheckPage() {
  return <QaPage />;
}
