// Round 13 (robots' notes 08 and 10, Marcus's video comment #49; PROPOSED 22 Oct 2026): Fume's people have a profile
// of their own, in the studio (/studio/settings/profile): the person menu's "Your profile" opens it, never the
// customer's Settings with a brand's tabs and roles. The form is the customer's own (ProfileForm): name, title and
// email changed in place, Save changes. An agency's people get the same form on their Settings page
// (/agency/settings/profile, the agency's Settings).
import { DataList, DataListItem, PageHeader } from "@fume/ui";
import { useSession } from "../../api/hooks";
import { Back, Page } from "../../shell/Page";
import { ProfileForm } from "./parts";

const staffWork = {
  expert: "Checks every creative before the customer sees it",
  operator: "Runs the Engine for the brands’ campaigns",
  admin: "Runs Fume",
} as const;

/** Fume's person's own profile, in the studio. */
export function StaffProfilePage() {
  const session = useSession().data!;
  const { user } = session;
  const brands = session.workspaces.map((w) => w.brandName);
  return (
    <Page title="Your profile · Studio" width="reading">
      <PageHeader
        title="Your profile"
        back={<Back to="/studio" label="Studio" />}
        description="You, as the brands and your team see you."
      />
      <ProfileForm
        user={user}
        about={
          <DataList>
            <DataListItem label="At Fume">
              {user.staffRole
                ? `${user.title}: ${staffWork[user.staffRole].charAt(0).toLowerCase()}${staffWork[user.staffRole].slice(1)}`
                : user.title}
            </DataListItem>
            <DataListItem label="Brands">{brands.length ? brands.join(", ") : "None yet"}</DataListItem>
          </DataList>
        }
      />
    </Page>
  );
}
