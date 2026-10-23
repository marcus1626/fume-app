// Planning one creative on the calendar (FLOWS §21): the day, the time and the placement, in a small dialog. On a
// desk a drag onto a day plans it straight away (with the placement its format fits and 09:00), and "Change" opens
// this dialog; on a phone, "Plan" opens it. A planned post opens it too, to move it, change it or take it off.
// Round 13 (Marcus's comment #38; PROPOSED 22 Oct 2026): first the channel (Instagram, Facebook, Meta ads, TikTok,
// Pinterest, or Email and web), then its placement. A channel the brand has not connected says so, with Connect
// (channels.ts; the mock connects at once).
// Round 13 (#37): the day and the time are @fume/ui's DateField and TimeField ("Sat 17 Oct 2026", 24-hour slots every
// 15 minutes), never the browser's date and time inputs, which lit the part being edited in system blue.
import {
  Button,
  DateField,
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
  FieldGroup,
  FieldLabel,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  TimeField,
  useToast,
} from "@fume/ui";
import { useState, type FormEvent } from "react";
import { useMoveEntry, useRemoveEntry, useSchedule } from "../../api/hooks";
import type { CalendarEntry, Format, Id, Placement } from "../../contract";
import { CHANNELS, channelOf, connectChannel, useConnected } from "./channels";
import { clock, dayOf, dayShort, instant, type Day } from "./dates";

/** What is being planned: a creative from the tray, or a post already on the calendar. */
export interface PlanTarget {
  creativeId: Id;
  title: string;
  image?: string;
  format?: Format;
  /** A planned post: the dialog moves or changes it. */
  entry?: CalendarEntry;
  /** The day to start from. */
  day?: Day;
}

/** The placement a creative's format fits first: a feed creative goes to the Instagram feed. */
export const defaultPlacement = (placements: Placement[], format?: Format) => placements.find((p) => p.format === format) ?? placements[0];

export const DEFAULT_TIME = "09:00";

export function PlanDialog({ target, placements, today, onClose }: { target: PlanTarget | null; placements: Placement[]; today: Day; onClose: () => void }) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">{target && <PlanForm key={target.entry?.id ?? target.creativeId} target={target} placements={placements} today={today} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function PlanForm({ target, placements, today, onClose }: { target: PlanTarget; placements: Placement[]; today: Day; onClose: () => void }) {
  const schedule = useSchedule();
  const move = useMoveEntry();
  const remove = useRemoveEntry();
  const toast = useToast();
  const entry = target.entry;
  const [day, setDay] = useState<string>(entry ? dayOf(entry.start) : (target.day ?? today));
  const [time, setTime] = useState(entry ? clock(entry.start) : DEFAULT_TIME);
  const [placementId, setPlacementId] = useState(entry?.placementId ?? defaultPlacement(placements, target.format)?.id ?? "");
  const placement = placements.find((p) => p.id === placementId);
  const connected = useConnected();
  const [channelId, setChannelId] = useState(() => channelOf(placement).id);
  const channel = CHANNELS.find((c) => c.id === channelId) ?? channelOf(placement);
  // The channels with placements, and this channel's placements (#38)
  const channels = CHANNELS.filter((c) => placements.some((p) => c.groups.includes(p.group) || (c.id === "other" && !CHANNELS.some((x) => x.groups.includes(p.group)))));
  const own = placements.filter((p) => channelOf(p).id === channel.id);
  const groups = [...new Set(own.map((p) => p.group))];
  const pickChannel = (id: string) => {
    setChannelId(id);
    const next = placements.filter((p) => channelOf(p).id === id);
    setPlacementId(defaultPlacement(next, target.format)?.id ?? "");
  };
  const offline = channel.publishes && !connected.has(channel.id);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day) && /^\d{2}:\d{2}$/.test(time) && Boolean(placement);
  const busy = schedule.isPending || move.isPending || remove.isPending;
  const id = `plan-${target.entry?.id ?? target.creativeId}`;

  const done = (verb: string) => {
    toast.done(`${verb}: ${target.title}`, { description: `${placement!.name}, ${dayShort(day)} at ${time}.${offline ? ` Connect ${channel.name} to publish it.` : ""}` });
    onClose();
  };
  const failed = () => toast.error("The calendar didn’t change. Try again in a moment.");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid) return;
    const at = instant(day, time);
    try {
      if (!entry) {
        await schedule.mutateAsync({ creativeId: target.creativeId, placementId, at });
        done("Planned");
      } else if (entry.placementId !== placementId) {
        // A new placement is a new post: the old one leaves, the new one is planned.
        await remove.mutateAsync(entry.id);
        await schedule.mutateAsync({ creativeId: target.creativeId, placementId, at });
        done("Changed");
      } else {
        await move.mutateAsync({ entryId: entry.id, at });
        done("Moved");
      }
    } catch {
      failed();
    }
  };

  const takeOff = () =>
    remove.mutate(entry!.id, {
      onSuccess: () => {
        toast.done(`${target.title} is off the calendar`, { description: "It is still in Ready to plan." });
        onClose();
      },
      onError: failed,
    });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{entry ? `${target.title} on ${placement?.name ?? "the calendar"}` : `Plan ${target.title}`}</DialogTitle>
        <DialogDescription>Fume publishes it then, on the channels you connect.</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <form id={id} onSubmit={submit} className="ui-plan-form">
          {target.image && <img className="ui-plan-form-media" src={target.image} alt="" draggable={false} />}
          <FieldGroup>
            <div className="ui-plan-form-when">
              <Field>
                <FieldLabel htmlFor={`${id}-day`}>Day</FieldLabel>
                <DateField id={`${id}-day`} value={day} onChange={setDay} today={today} required data-ui-autofocus />
              </Field>
              <Field>
                <FieldLabel as="span" id={`${id}-time-label`}>
                  Time
                </FieldLabel>
                <TimeField id={`${id}-time`} aria-labelledby={`${id}-time-label`} value={time} onChange={setTime} required step={15} />
              </Field>
            </div>
            <Field>
              <FieldLabel as="span" id={`${id}-channel`}>
                Channel
              </FieldLabel>
              <Select value={channel.id} onValueChange={(v) => v && pickChannel(v)}>
                <SelectTrigger aria-labelledby={`${id}-channel`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.publishes && !connected.has(c.id) ? `${c.name} · not connected` : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {offline && (
                <div className="ui-plan-form-connect">
                  <FieldDescription>{channel.name} isn’t connected yet. Fume plans it here; connect it to publish.</FieldDescription>
                  <Button
                    type="button"
                    variant="glass-clear"
                    size="sm"
                    icon="link"
                    onClick={() => {
                      connectChannel(channel.id);
                      toast.done(`${channel.name} is connected`, { description: "Planned posts go out on it at their time." });
                    }}
                  >
                    Connect {channel.name}
                  </Button>
                </div>
              )}
            </Field>
            <Field>
              <FieldLabel as="span" id={`${id}-placement`}>
                Placement
              </FieldLabel>
              {/* one Select per channel: its options change with the channel */}
              <Select key={channel.id} value={placementId} onValueChange={(v) => v && setPlacementId(v)}>
                <SelectTrigger aria-labelledby={`${id}-placement`}>
                  <SelectValue placeholder="Choose where it runs" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectGroup key={g}>
                      <SelectLabel>{g}</SelectLabel>
                      {own
                        .filter((p) => p.group === g)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} · {p.ratio}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>Oslo time. The ratio follows the placement.</FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </DialogBody>
      <DialogFooter>
        {entry ? (
          <Button variant="glass-clear" icon="trash" onClick={takeOff} disabled={busy}>
            Take it off
          </Button>
        ) : (
          <DialogClose asChild>
            <Button variant="glass-clear">Later</Button>
          </DialogClose>
        )}
        <Button type="submit" form={id} variant="glass-white" icon="calendar" loading={busy} disabled={!valid}>
          {entry ? "Save" : "Plan it"}
        </Button>
      </DialogFooter>
    </>
  );
}
