// The one `test` every spec imports: Playwright's, with a guard that fails the test on any console error or uncaught
// page error, in any page the test opens. Warnings (React Router's future flags) are allowed.
import { test as base, expect } from "@playwright/test";

export const test = base.extend<{ noErrors: void }>({
  noErrors: [
    async ({ context }, run) => {
      const errors: string[] = [];
      context.on("console", (message) => {
        if (message.type() === "error") errors.push(`console error: ${message.text()}`);
      });
      context.on("weberror", (error) => errors.push(`page error: ${error.error().message}`));
      // (`run` rather than Playwright's usual `use`: the React hooks lint rule reads `use(...)` as a hook.)
      await run();
      expect(errors, "console errors and page errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
