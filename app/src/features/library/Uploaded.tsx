// The Library's Uploaded half (FLOWS §38.1): the brand's own shoots as cards, newest first. A card shows four of its
// pictures (the picks first once there are picks), its name, what is in it, and where it stands: the Engine reading it
// (the one white shimmer), the picks waiting for an expert, or the picks checked by name (the Amber triangle). A shoot
// whose people are not known yet says so. Opening a card opens the shoot.
import { Card, CheckMark, Icon, TextShimmer } from "@fume/ui";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ShootSummary } from "../../contract";
import * as copy from "../../copy";
import { date } from "../../lib/time";
import { Nothing } from "../../shell/Page";
import { useNames } from "../studio/qa/names";

export function ShootList({
  shoots,
  base,
  customer,
  brandName,
  action,
}: {
  shoots: ShootSummary[];
  base: string;
  customer: boolean;
  /** On all brands: the brand's name before the shoot's. */
  brandName?: (workspaceId: string) => string;
  /** The empty state's way to add the first shoot. */
  action?: ReactNode;
}) {
  const names = useNames();
  if (shoots.length === 0)
    return (
      <Nothing
        icon="image-plus"
        title="No pictures of your own yet"
        text={
          customer
            ? "Upload a shoot: Fume keeps every picture as it is, picks the best and makes creatives from them."
            : "Upload a shoot the brand sent: the Engine picks the best, an expert checks the picks, and they can go into a campaign."
        }
        action={action}
      />
    );
  const reading = shoots.find((s) => s.state === "reading");
  const standing = (s: ShootSummary) => {
    const n = s.counts.photos + s.counts.clips;
    if (s.state === "reading")
      return s === reading ? (
        <TextShimmer>
          {customer ? `Fume is going through ${n} pictures` : `The Engine is going through ${n} pictures`}
        </TextShimmer>
      ) : (
        <span className="ui-library-shoot-state">
          {customer ? "Fume is going through them" : "The Engine is reading it"}
        </span>
      );
    if (s.state === "checked")
      return (
        <CheckMark
          state="checked"
          by={names.name(s.checkedBy)}
          label={`${copy.count(s.counts.picks, "pick")} · checked by ${names.name(s.checkedBy)}`}
        />
      );
    return customer ? (
      <span className="ui-library-shoot-state">Fume is choosing the best</span>
    ) : (
      <CheckMark state="in-check" label={`${copy.count(s.counts.picks, "pick")} to check`} />
    );
  };
  return (
    <ul className="ui-library-shoots" aria-label="Shoots">
      {shoots.map((s) => (
        <li key={s.id}>
          <Card asChild interactive className="ui-library-shoot">
            <Link to={`${base}/shoots/${s.id}`} aria-label={`${s.name}, ${copy.count(s.counts.photos, "picture")}`}>
              <span className="ui-library-shoot-cover" data-count={s.cover.length} aria-hidden>
                {s.cover.map((src) => (
                  <img key={src} src={src} alt="" loading="lazy" />
                ))}
              </span>
              <span className="ui-library-shoot-text">
                <span className="ui-library-shoot-name">
                  {brandName ? `${brandName(s.workspaceId)} · ` : ""}
                  {s.name}
                </span>
                <span className="ui-library-shoot-meta">
                  {[
                    copy.count(s.counts.photos, "picture"),
                    s.counts.clips ? copy.count(s.counts.clips, "clip") : "",
                    s.shotOn ? date(s.shotOn) : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="ui-library-shoot-standing">{standing(s)}</span>
                {s.rights.people === "unsure" && (
                  <span className="ui-library-shoot-warn">
                    <Icon name="triangle-alert" aria-hidden />
                    Not sure who is in them
                  </span>
                )}
                {s.counts.used > 0 && (
                  <span className="ui-library-shoot-meta">Used: {copy.count(s.counts.used, "picture")}</span>
                )}
              </span>
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}
