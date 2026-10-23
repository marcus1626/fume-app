// The Brand DNA calls that api/hooks.ts has no hook for yet, in the same pattern: one hook per call, and a write
// refreshes everything once it lands (the mock is small; the real backend sends events).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../api/client";
import type { BrandRule, FumeApi } from "../../contract";

const m = <A, R>(fn: (api: FumeApi, args: A) => Promise<R>) => {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({ mutationFn: (args: A) => fn(api, args), onSuccess: () => client.invalidateQueries() });
};

export const useUpdateRule = () => m((a, rule: BrandRule) => a.updateRule(rule));
export const useAddRule = () => m((a, rule: Parameters<FumeApi["addRule"]>[0]) => a.addRule(rule));
export const useAddProduct = () => m((a, input: Parameters<FumeApi["addProduct"]>[0]) => a.addProduct(input));
