// Contact (FLOWS §1.2): the people at Fume, kept apart from the conversation with Fume (AI), so two things never carry
// the name Fume. One thread with the customer's named contact (Sander, Producer) and their expert (Anna, Designer):
// the package, invoices, rights, a creative you are unhappy with, anything off-script. Only people write here.
import {
  Avatar,
  Composer,
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  Marker,
  MessageScroller,
  MessageText,
  PageHeader,
  useNarrowScreen,
  type MessageScrollerHandle,
} from "@fume/ui";
import { Fragment, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMessages, usePeople, useSend, useSession, useTeam, useThreads } from "../../api/hooks";
import type { Session, Thread, User } from "../../contract";
import { Nothing, Page, Query } from "../../shell/Page";
import { directory, firstName, initials } from "../../shell/people";
import { DayMarker, dayLabel, MessageView } from "../fume/parts";

/** What each person at Fume is to the customer. */
const part: Record<NonNullable<User["staffRole"]>, string> = {
  operator: "your contact",
  expert: "your expert",
  admin: "at Fume",
};

export function ContactPage() {
  const session = useSession().data!;
  const threads = useThreads();
  const team = useTeam();
  const narrow = useNarrowScreen("(max-width: 1023px)");
  // The contact first, then the expert: the order a customer meets them in.
  const order = { operator: 0, expert: 1, admin: 2 } as const;
  const fumeTeam = (team.data?.fumeTeam ?? []).slice().sort((a, b) => order[a.staffRole ?? "admin"] - order[b.staffRole ?? "admin"]);
  const names = fumeTeam.map((u) => firstName(u.name));

  return (
    <Page title="Contact" width="fill">
      <div className="ui-app-page">
        <PageHeader
          title="Contact"
          description={
            <>
              {names.length ? `${names.join(" and ")} are people at Fume.` : "The people at Fume who work on your brand."} They answer here
              themselves. For new work, talk to <Link to="/fume">Fume</Link>.
            </>
          }
        />
        {fumeTeam.length > 0 && (
          <div className="ui-app-grid" role="list" aria-label="Your people at Fume">
            {fumeTeam.map((u) => (
              <Item key={u.id} role="listitem" variant="muted">
                <ItemMedia>
                  <Avatar size="lg" src={u.avatar} initials={initials(u.name)} ink={u.staffRole === "expert"} aria-hidden="true" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {u.name}, {u.title}
                  </ItemTitle>
                  <ItemDescription>{u.staffRole ? `A person at Fume, ${part[u.staffRole]}` : "A person at Fume"}</ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </div>
        )}
        <Query query={threads} loading="Opening Contact">
          {(list) => {
            const thread = list.find((t) => t.kind === "contact");
            return thread ? (
              <ContactThread thread={thread} session={session} names={names} docked={narrow} />
            ) : (
              <Nothing
                icon="users"
                title="No one to write to yet"
                text={
                  <>
                    Your contact at Fume joins once your workspace is set up. Until then, <Link to="/fume">Fume</Link> can help.
                  </>
                }
              />
            );
          }}
        </Query>
      </div>
    </Page>
  );
}

function ContactThread({ thread, session, names, docked }: { thread: Thread; session: Session; names: string[]; docked: boolean }) {
  const messages = useMessages(thread.id);
  const people = directory(usePeople().data);
  const send = useSend();
  const scroller = useRef<MessageScrollerHandle>(null);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const who = names.length ? names.join(" or ") : "Your contact";
  const to = names.length ? names.join(" and ") : "your people at Fume";
  const blocked = session.role === null && !session.user.staffRole ? "You are not on this workspace’s team, so you can read this but not write in it." : undefined;

  return (
    <Query query={messages} loading="Opening the conversation">
      {(all) => {
        // People only: Fume and the Engine never speak here.
        const items = all.filter((m) => m.author.kind === "person");
        const last = items[items.length - 1];
        return (
          <>
            <MessageScroller
              ref={scroller}
              label={`Conversation with ${to}`}
              announcement={last ? `${people.author(last.author)}: ${last.text}` : undefined}
            >
              {items.length === 0 && <MessageText>Nothing here yet. Write to {to} about anything.</MessageText>}
              {items.map((m, i) => {
                const day = dayLabel(m.at);
                const newDay = i === 0 || dayLabel(items[i - 1]!.at) !== day;
                return (
                  <Fragment key={m.id}>
                    {newDay && <DayMarker label={day} />}
                    <MessageView message={m} people={people} meId={session.user.id} canAct={false} />
                  </Fragment>
                );
              })}
              {sent && last?.author.kind === "person" && last.author.userId === session.user.id && (
                <Marker icon="clock">{who} answers here, usually within a working day.</Marker>
              )}
            </MessageScroller>
            <Composer
              value={text}
              onValueChange={setText}
              onSubmit={({ text: words }) =>
                send.mutate(
                  { threadId: thread.id, text: words },
                  {
                    onSuccess: () => {
                      setText("");
                      setSent(true);
                      scroller.current?.scrollToEnd(true);
                    },
                  },
                )
              }
              disabled={Boolean(blocked) || send.isPending}
              placeholder={blocked ?? `Write to ${to}`}
              label={`Write to ${to}`}
              inputLabel={`Message to ${to}`}
              sendLabel={`Send to ${to}`}
              error={send.error ? "That didn’t go through. Your message is still here; send it again." : undefined}
              hint
              sticky={docked}
            />
          </>
        );
      }}
    </Query>
  );
}
