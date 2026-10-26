// TEMPORARY: compares the original mock's behaviour. Delete before reporting.
import { test } from "vitest";
import { createMockApi } from "../src/zz_orig/mock/mockApi";

test("peek", async () => {
  const a = createMockApi({ latency: 0 });
  console.log("before", JSON.stringify((await a.product("pr-oil")).provenance));
  createMockApi({ latency: 0, fresh: true });
  const b = createMockApi({ latency: 0 });
  console.log("after", JSON.stringify((await b.product("pr-oil")).provenance));
});
