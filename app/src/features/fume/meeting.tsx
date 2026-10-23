// Booking a meeting with Fume (FLOWS §21): the times Fume offers, as pills in the reader's own way of writing dates
// (always Oslo time, where Fume's people are), a short topic, and one Book action. Used in the conversation (Fume
// offers times), in the person menu and ⌘K (a dialog), and in Settings › Team (the Fume team). A booked meeting
// lands in the calendar.
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
  useToast,
} from "@fume/ui";
import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAgencyPlan, useBookMeeting, useMeetingSlots, useMeetingTopics, useSession, useTeam } from "../../api/hooks";
import type { Meeting, User } from "../../contract";
import { firstName } from "../../shell/people";

export const MEETING_TOPIC = "A call with Fume";
/** The preset that clears the field for her own words. */
const OTHER_TOPIC = "Something else";
const TZ = "Europe/Oslo";

/** "Fri 17 Oct", Oslo's day, in the European order the whole app writes. */
export const slotDay = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TZ,
  }).format(Date.parse(iso));
/** "10:00", the 24-hour clock, Oslo time. */
export const slotTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TZ,
  }).format(Date.parse(iso));
export const slotLabel = (iso: string) => `${slotDay(iso)}, ${slotTime(iso)}`;
/** The day of an instant in Oslo, as YYYY-MM-DD (the calendar's ?d=). */
export const osloDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(Date.parse(iso));

/** The person at Fume who takes meetings for this brand: the operator, else whoever is on the Fume team. */
export function useHost(): User | undefined {
  const team = useTeam().data?.fumeTeam ?? [];
  // An agency's own people are its team, not Fume; its meetings are with its contact at Fume.
  const agency = Boolean(useSession().data?.user.agency);
  const contact = useAgencyPlan(agency).data?.contact;
  if (agency) return contact;
  return team.find((u) => u.staffRole === "operator") ?? team[0];
}

export interface SlotFormProps {
  /** The times to choose from (ISO instants). */
  slots: string[];
  /** For ids: one form per place it appears. */
  idBase: string;
  /** Inside a glass dialog the actions are glass buttons; in the conversation they are page buttons. */
  glass?: boolean;
  /** Where the Book button lives: in the form (conversation) or in a dialog footer (form id). */
  footer?: boolean;
  onBooked?: (meeting: Meeting) => void;
  /** In the conversation Fume confirms the booking itself, so no toast. */
  quiet?: boolean;
  /** What it is about, carried over from the conversation ("Christmas plans"). */
  topic?: string;
}

/** The topic, the times and the Book action. */
export function SlotForm({ slots, idBase, glass, footer, onBooked, quiet, topic: about }: SlotFormProps) {
  const book = useBookMeeting();
  const toast = useToast();
  const navigate = useNavigate();
  const host = useHost();
  const [topic, setTopic] = useState(about ?? MEETING_TOPIC);
  const [at, setAt] = useState("");
  // What a meeting is usually about, as pills like the times; one fills the field, "Something else" empties it for her
  // words.
  const topics = useMeetingTopics().data ?? [];
  const [other, setOther] = useState(false);
  const preset = other ? OTHER_TOPIC : topics.includes(topic) ? topic : "";
  const pickTopic = (value: string) => {
    if (!value) return;
    if (value === OTHER_TOPIC) {
      setOther(true);
      setTopic("");
      requestAnimationFrame(() => document.getElementById(`${idBase}-topic`)?.focus());
      return;
    }
    setOther(false);
    setTopic(value);
  };
  const words = topic.trim() || MEETING_TOPIC;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!at) return;
    book.mutate(
      { at, topic: words },
      {
        onSuccess: (meeting) => {
          if (!quiet)
            toast.done(`Booked: ${slotLabel(meeting.at)}`, {
              description: host ? `${words}, with ${firstName(host.name)} at Fume.` : `${words}.`,
              action: {
                label: "See the calendar",
                onClick: () => navigate(`/calendar?d=${osloDay(meeting.at)}`),
              },
            });
          onBooked?.(meeting);
        },
        onError: () => toast.error("The meeting wasn’t booked. Pick the time again in a moment."),
      },
    );
  };

  const button = (
    <Button
      type="submit"
      form={`${idBase}-form`}
      variant={glass ? "glass-white" : "primary"}
      size={glass ? "md" : "sm"}
      icon="calendar"
      loading={book.isPending}
      disabled={!at}
    >
      {at ? `Book ${slotLabel(at)}` : "Pick a time"}
    </Button>
  );

  const form = (
    <form id={`${idBase}-form`} className="ui-meeting-form" onSubmit={submit}>
      <Field>
        <FieldLabel as="span" id={`${idBase}-times`}>
          A time
        </FieldLabel>
        {slots.length === 0 ? (
          <FieldDescription>
            Fume’s people have no free times this week. Ask Fume in the conversation, and we find one.
          </FieldDescription>
        ) : (
          <ToggleGroup
            type="single"
            value={at}
            onValueChange={setAt}
            variant="outline"
            size="sm"
            loose
            aria-labelledby={`${idBase}-times`}
            className="ui-meeting-slots"
          >
            {slots.map((s) => (
              <ToggleGroupItem key={s} value={s} aria-label={slotLabel(s)}>
                <span className="ui-meeting-slot-day">{slotDay(s)}</span>
                <time className="ui-meeting-slot-time" dateTime={s}>
                  {slotTime(s)}
                </time>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        <FieldDescription>
          30 minutes{host ? ` with ${firstName(host.name)}` : ""}, on a video call. Times are Oslo time.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idBase}-topic`}>What it is about</FieldLabel>
        {topics.length > 0 && (
          <ToggleGroup
            type="single"
            value={preset}
            onValueChange={pickTopic}
            variant="outline"
            size="sm"
            loose
            aria-label="What it is about"
            className="ui-meeting-slots ui-meeting-topics"
          >
            {topics.map((t) => (
              <ToggleGroupItem key={t} value={t}>
                {t}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        <Input
          id={`${idBase}-topic`}
          value={topic}
          maxLength={80}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={other ? "In a few words: what do you want to talk about?" : MEETING_TOPIC}
        />
      </Field>
      {!footer && <div className="ui-app-row">{button}</div>}
    </form>
  );
  if (!footer) return form;
  return (
    <>
      <DialogBody>{form}</DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="glass-clear">Not now</Button>
        </DialogClose>
        {button}
      </DialogFooter>
    </>
  );
}

/** Book a meeting, from anywhere: the person menu, ⌘K, Settings. */
export function BookMeetingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const id = useId().replace(/:/g, "");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && <BookMeetingBody idBase={`book-${id}`} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function BookMeetingBody({ idBase, onDone }: { idBase: string; onDone: () => void }) {
  const slots = useMeetingSlots();
  const host = useHost();
  return (
    <>
      <DialogHeader>
        <DialogTitle>Book a meeting with Fume</DialogTitle>
        <DialogDescription>
          {host ? `${firstName(host.name)} at Fume` : "Someone at Fume"} talks it through with you. The meeting lands in
          your calendar.
        </DialogDescription>
      </DialogHeader>
      {slots.data ? (
        <SlotForm slots={slots.data} idBase={idBase} glass footer onBooked={onDone} />
      ) : (
        <DialogBody>
          <div className="ui-meeting-wait">
            <Spinner label="Finding free times" />
          </div>
        </DialogBody>
      )}
      {!slots.data && (
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="glass-clear">Not now</Button>
          </DialogClose>
        </DialogFooter>
      )}
    </>
  );
}
