// Creative Memory (ARCHITECTURE §4.2, §6.2 step 7): what Fume learned from each campaign: what you approved,
// passed on and changed, and what the expert caught in the check. Grouped by campaign, newest first, each group
// with a way into its campaign and one date (round 8, LOAD-21: not a date per lesson). The next campaign starts
// from all of it. /brand/memory, "What Fume learned": "← Brand", no tab row (WAY-10).
// Round 9 (desktop review DLAY-7; PROPOSED 19 Oct 2026): the reading measure (760), so a lesson and its campaign link
// sit close together.
import { Button, Icon, Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle, PageHeader, type IconName } from "@fume/ui";
import { Link } from "react-router-dom";
import { useBrandDna, useCampaigns } from "../../api/hooks";
import type { MemoryEntry } from "../../contract";
import * as copy from "../../copy";
import { date } from "../../lib/time";
import { Back, Nothing, Page, Query, Section } from "../../shell/Page";

const kind: Record<MemoryEntry["kind"], { label: string; icon: IconName }> = {
  approved: { label: "From an approval", icon: "circle-check" },
  rejected: { label: "From something you passed on", icon: "circle-x" },
  changed: { label: "From a change you asked for", icon: "pencil" },
  caught: { label: "Caught in the expert’s check", icon: "eye" },
};

/** What Fume learned, by campaign. Under the Memory tab of Brand DNA. */
export function MemoryContent() {
  const brand = useBrandDna();
  const campaigns = useCampaigns();
  const nameOf = (id: string) => campaigns.data?.find((c) => c.id === id)?.name ?? "A campaign";
  return (
    <>
      <Query query={brand} loading="Loading what Fume learned">
        {(view) => {
          if (view.memory.length === 0)
            return (
              <Nothing
                icon="bookmark"
                title="Nothing learned yet"
                text="Once you approve, pass on or change a creative, Fume writes down what it learned here."
              />
            );
          // Campaigns in the order of their newest lesson; lessons newest first inside each.
          const groups = new Map<string, MemoryEntry[]>();
          [...view.memory]
            .sort((a, b) => b.at.localeCompare(a.at))
            .forEach((m) => groups.set(m.campaignId, [...(groups.get(m.campaignId) ?? []), m]));
          return [...groups.entries()].map(([campaignId, entries]) => (
            <Section
              key={campaignId}
              title={nameOf(campaignId)}
              meta={`${copy.count(entries.length, "lesson")} · ${date(entries[0].at)}`}
              titleId={`memory-${campaignId}`}
              action={
                <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
                  <Link to={`/campaigns/${campaignId}`} aria-label={`Open ${nameOf(campaignId)}`}>
                    Open the campaign
                  </Link>
                </Button>
              }
            >
              <ItemGroup as="ul">
                {entries.map((m) => (
                  <Item key={m.id} as="li" variant="muted">
                    <ItemMedia variant="icon">
                      <Icon name={kind[m.kind].icon} />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{m.lesson}</ItemTitle>
                      <ItemDescription>{kind[m.kind].label}</ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            </Section>
          ));
        }}
      </Query>
    </>
  );
}

export function MemoryPage() {
  return (
    <Page title="What Fume learned · Brand" width="reading">
      <PageHeader title="What Fume learned" back={<Back to="/brand" label="Brand" />} description="Every new campaign starts from these." />
      <MemoryContent />
    </Page>
  );
}
