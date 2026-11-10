// A picture's measured half of its card (schema.ts): the numbers of measure.ts on the picture made small, and of
// finish.ts on the picture at its own size, under the schema's keys.
import { measure, type Pixels, shrink } from "../../taste-learn/measure.ts";
import { measureFinish } from "./finish.ts";

/** measure.ts keys that the schema names otherwise, because a read field holds the plain name. */
const RENAMED: Record<string, string> = {
  "light.contrast": "light.contrast_range",
  "composition.headroom": "composition.headroom_measured",
  "detail.sharpness": "finish.sharpness_overall",
  "detail.edges": "composition.busyness",
  "detail.grain": "finish.grain_overall",
};

export function measureCard(px: Pixels): { measured: Record<string, number>; palette: { hex: string; share: number }[] } {
  const small = measure(shrink(px, 256));
  const measured: Record<string, number> = {};
  for (const [k, v] of Object.entries(small.v)) measured[RENAMED[k] ?? k] = v;
  Object.assign(measured, measureFinish(px, small.palette));
  return { measured, palette: small.palette };
}
