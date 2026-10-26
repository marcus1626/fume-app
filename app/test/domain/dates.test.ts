// Working days (app/src/domain/dates.ts).
import { expect, test } from "vitest";
import { addWorkingDays } from "../../src/domain/dates";

test("working days skip the weekend", () => {
  // Thursday 1 October 2026.
  expect(addWorkingDays("2026-10-01T12:00:00.000Z", 1)).toBe("2026-10-02T12:00:00.000Z");
  expect(addWorkingDays("2026-10-01T12:00:00.000Z", 2)).toBe("2026-10-05T12:00:00.000Z");
  expect(addWorkingDays("2026-10-03T12:00:00.000Z", 1)).toBe("2026-10-05T12:00:00.000Z");
  expect(addWorkingDays("2026-10-01T12:00:00.000Z", 0)).toBe("2026-10-01T12:00:00.000Z");
});
