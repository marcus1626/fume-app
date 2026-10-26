// What the customer sees of a creative and how a campaign counts them (app/src/domain/creatives.ts).
import { describe, expect, test } from "vitest";
import type { Campaign, ClientSend, Creative, CreativeVersion, Direction } from "../../src/contract";
import {
  canBeApproved,
  countCreatives,
  customerSees,
  customerSeesDirection,
  isFullyApproved,
  waitsForAgencySend,
} from "../../src/domain/creatives";

const version = (state: CreativeVersion["state"], id = "v-1") => ({ id, state }) as CreativeVersion;
const creative = (state: CreativeVersion["state"], id = "v-1") => ({ current: version(state, id) }) as Creative;
const campaign = (state: Campaign["state"]) => ({ state }) as Campaign;

describe("approving", () => {
  test("only a checked version is approved", () => {
    expect(canBeApproved(version("checked"))).toBe(true);
    for (const s of ["making", "in_check", "approved", "changes_requested"] as const)
      expect(canBeApproved(version(s))).toBe(false);
  });
});

describe("what the customer sees", () => {
  test("never a creative before it is checked", () => {
    for (const s of ["making", "in_check", "correcting", "held"] as const)
      expect(customerSees(version(s), campaign("in_review"), false)).toBe(false);
  });

  test("checked work once it is released and sent", () => {
    expect(customerSees(version("checked"), campaign("in_review"), false)).toBe(true);
    expect(customerSees(version("checked"), campaign("in_production"), false)).toBe(false);
    expect(customerSees(version("checked"), campaign("in_review"), true)).toBe(false);
  });

  test("what she approved, asked to change or got delivered, always", () => {
    for (const s of ["approved", "changes_requested", "delivered"] as const)
      expect(customerSees(version(s), campaign("in_production"), true)).toBe(true);
  });

  test("a direction only once the expert has checked it", () => {
    const d = (state: Direction["state"]) => ({ state }) as Direction;
    expect(customerSeesDirection(d("making"))).toBe(false);
    expect(customerSeesDirection(d("in_check"))).toBe(false);
    expect(customerSeesDirection(d("proposed"))).toBe(true);
    expect(customerSeesDirection(d("chosen"))).toBe(true);
  });
});

describe("sending to the client", () => {
  const sent = [{ versionIds: ["v-2"] }] as ClientSend[];

  test("a checked creative in an agency brand waits until the agency sends it", () => {
    expect(waitsForAgencySend(creative("checked"), { agencyId: "a-1" }, sent)).toBe(true);
    expect(waitsForAgencySend(creative("checked", "v-2"), { agencyId: "a-1" }, sent)).toBe(false);
  });

  test("nothing waits outside agency work or once it is past checked", () => {
    expect(waitsForAgencySend(creative("checked"), {}, [])).toBe(false);
    expect(waitsForAgencySend(creative("checked"), undefined, [])).toBe(false);
    expect(waitsForAgencySend(creative("approved"), { agencyId: "a-1" }, [])).toBe(false);
  });
});

describe("counting", () => {
  const all = [
    creative("making"),
    creative("in_check"),
    creative("held"),
    creative("checked"),
    creative("approved"),
    creative("delivered"),
    creative("changes_requested"),
  ];

  test("a campaign counts what is in check, checked, approved and delivered", () => {
    expect(countCreatives(all)).toEqual({ creatives: 7, inCheck: 3, checked: 1, approved: 2, delivered: 1 });
  });

  test("a campaign in review is approved once every creative in it is approved", () => {
    const counts = countCreatives([creative("approved"), creative("delivered")]);
    expect(isFullyApproved({ state: "in_review", counts })).toBe(true);
    expect(isFullyApproved({ state: "in_production", counts })).toBe(false);
    expect(isFullyApproved({ state: "in_review", counts: countCreatives(all) })).toBe(false);
    expect(isFullyApproved({ state: "in_review", counts: countCreatives([]) })).toBe(false);
  });
});
