import { expect, test } from "vitest";
import { requireShootUse } from "../../src/domain/shoot";

test("unknown people block every shoot use, independent of picture kind and check state", () => {
  expect(() => requireShootUse({ people: "unsure" })).toThrow(/who is in/);
  expect(() => requireShootUse({ people: "none" })).not.toThrow();
  expect(() => requireShootUse({ people: "released" })).not.toThrow();
});
test("usage includes the licence's last day; later use is blocked", () => {
  expect(() => requireShootUse({ people: "released", until: "2026-11-13" }, "2026-11-13")).not.toThrow();
  expect(() => requireShootUse({ people: "released", until: "2026-11-13" }, "2026-11-14")).toThrow(/usage period/);
});
