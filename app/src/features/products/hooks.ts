// The catalogue call api/hooks.ts has no hook for yet, in the same pattern: a write refreshes everything once it
// lands (the mock is small; the real backend sends events). features/brand has its own copy for its screens.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../api/client";
import type { FumeApi, Product } from "../../contract";

/** Adds one product, or several (a CSV), one call each. */
export function useAddProducts() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Parameters<FumeApi["addProduct"]>[0][]): Promise<Product[]> => {
      const added: Product[] = [];
      for (const row of rows) added.push(await api.addProduct(row));
      return added;
    },
    onSuccess: () => client.invalidateQueries(),
  });
}
