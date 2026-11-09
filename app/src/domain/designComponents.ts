// The design system's components are the brand's own (Round 15, PROPOSED 9 Nov 2026). Marcus, 9 Nov: "Are the
// components hard-coded? Can the Engine add components to the design system?" Fume writes the nine the design engine
// places words with, each named by its role; the brand's people add their own from a base, name them, set them in the
// brand's tokens, and take any out. One rule for the page, the mock and the server: a component is found by its role,
// a role is held by one component at most, every setting is one of the brand's own tokens, and names are unique.
import type {
  DesignBook,
  DesignComponent,
  DesignComponentBase,
  DesignComponentName,
  DesignRole,
  VoiceTrait,
} from "../contract";

export const componentRoles: DesignComponentName[] = [
  "headline",
  "subline",
  "body",
  "cta",
  "price",
  "badge",
  "legal",
  "product_name",
  "logo",
];
const isRole = (x: unknown): x is DesignComponentName => componentRoles.includes(x as DesignComponentName);

/** The nine roles in words, for the page and for what the rules say. */
export const roleWords: Record<DesignComponentName, string> = {
  headline: "Headline",
  subline: "Subline",
  body: "Body",
  cta: "Call to action",
  price: "Price",
  badge: "Badge",
  legal: "Small print",
  product_name: "Product name",
  logo: "Logo",
};
/** A component's name in words: the nine by their role's word, the brand's own as named. */
export const componentName = (c: Pick<DesignComponent, "name">) => (isRole(c.name) ? roleWords[c.name] : c.name);
export const componentBases: DesignComponentBase[] = ["text", "button", "badge", "shape", "image", "logo"];
export const radii = ["none", "small", "large", "pill"] as const;

/** What the design engine places with a component: its role, or the role it is named by (the nine Fume writes). */
export function componentRole(c: Pick<DesignComponent, "name" | "role">): DesignComponentName | undefined {
  return c.role ?? (isRole(c.name) ? c.name : undefined);
}

/** What a component is built from: its base, or the base its role stands for. */
export function componentBase(c: Pick<DesignComponent, "name" | "role" | "base">): DesignComponentBase {
  if (c.base) return c.base;
  const role = componentRole(c);
  return role === "cta" ? "button" : role === "badge" ? "badge" : role === "logo" ? "logo" : "text";
}

/** The component that holds a role: what code that places words reads. */
export function componentFor(book: Pick<DesignBook, "components">, role: DesignComponentName) {
  return book.components.find((c) => componentRole(c) === role);
}

/** A name as a CSS class and an anchor: "Offer wheel" → "offer-wheel", "product_name" → "product-name". */
export function componentSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "component"
  );
}

/** The spacing steps a padding may take: none, or a step of the brand's scale. */
export const paddingSteps = (book: Pick<DesignBook, "spacing">) => [
  0,
  ...book.spacing.scale.map((m) => m * book.spacing.unitPx),
];

/** A new component of the brand's own, from a base, in the brand's own tokens (the first of each it has). */
export function newComponent(book: DesignBook, base: DesignComponentBase, name: string): DesignComponent {
  const roles = new Set(book.colours.map((c) => c.role));
  const styles = new Set(book.styles.map((s) => s.name));
  const pick = <T extends string>(have: Set<T>, ...want: T[]) => want.find((x) => have.has(x)) ?? [...have][0]!;
  const role = (...want: DesignRole[]) => pick(roles, ...want);
  const style = (...want: DesignComponent["style"][]) => pick(styles, ...want);
  const steps = paddingSteps(book);
  const near = (px: number) => steps.reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a), 0);
  const common = { name: name.trim(), base, rules: [] as string[] };
  switch (base) {
    case "button":
      return {
        ...common,
        purpose: "A button with a few words.",
        style: style("cta", "label", "body"),
        colour: role("cta_text", "on_primary", "text"),
        background: role("cta", "primary"),
        radius: "pill",
        paddingPx: near(24),
        sample: "Se mer",
      };
    case "badge":
      return {
        ...common,
        purpose: "A small mark on a creative.",
        style: style("label", "caption", "body"),
        colour: role("on_primary", "text"),
        background: role("secondary", "primary"),
        radius: "small",
        paddingPx: near(12),
        sample: "Ny",
      };
    case "shape":
      return {
        ...common,
        purpose: "A form in the brand's colour.",
        style: style("label", "body"),
        colour: role("text"),
        background: role("accent", "secondary", "primary"),
        radius: "none",
        paddingPx: 0,
        sizePx: 120,
      };
    case "image":
      return {
        ...common,
        purpose: "A picture inside the creative.",
        style: style("caption", "body"),
        colour: role("text"),
        background: null,
        radius: "large",
        paddingPx: 0,
        sizePx: 320,
      };
    case "logo":
      return {
        ...common,
        purpose: "The wordmark, as a mark of its own.",
        style: style("label", "body"),
        colour: role("primary", "text"),
        background: null,
        radius: "none",
        paddingPx: 0,
      };
    default:
      return {
        ...common,
        purpose: "A line of words.",
        style: style("body", "caption"),
        colour: role("text"),
        background: null,
        radius: "none",
        paddingPx: 0,
        sample: "Litt ro.",
      };
  }
}

/** Why a component cannot stand in this book, or undefined. `at` is its place in the list (its own place is not a
 *  clash with itself). */
export function componentProblem(book: DesignBook, c: DesignComponent, at = -1): string | undefined {
  if (typeof c?.name !== "string" || !c.name.trim()) return "A component needs a name.";
  if (c.name.length > 40) return "Give it a shorter name.";
  const slug = componentSlug(c.name);
  const others = book.components.filter((_, i) => i !== at);
  const same = others.find((x) => componentSlug(x.name) === slug);
  if (same) return `There is a component called ${componentName(same)} already.`;
  if (typeof c.purpose !== "string" || !Array.isArray(c.rules) || c.rules.some((r) => typeof r !== "string"))
    return "A component needs a purpose and its rules.";
  if (!book.styles.some((s) => s.name === c.style)) return "Use one of the brand's type styles.";
  const roles = new Set(book.colours.map((x) => x.role));
  if (!roles.has(c.colour)) return "Use one of the brand's colours.";
  if (c.background !== null && !roles.has(c.background)) return "Use one of the brand's colours, or none.";
  if (!radii.includes(c.radius)) return "Use one of the brand's corners.";
  if (typeof c.paddingPx !== "number" || c.paddingPx < 0 || c.paddingPx > 200) return "Padding from 0 to 200 px.";
  if (c.sizePx !== undefined && (typeof c.sizePx !== "number" || c.sizePx < 16 || c.sizePx > 1080))
    return "A size from 16 to 1080 px.";
  if (c.base !== undefined && !componentBases.includes(c.base)) return "No such base.";
  if (c.role !== undefined) {
    if (!isRole(c.role)) return "No such role.";
    const holder = others.find((x) => componentRole(x) === c.role);
    if (holder) return `${componentName(holder)} holds that role already.`;
  }
  if (c.sample !== undefined && (typeof c.sample !== "string" || c.sample.length > 80)) return "Fewer words.";
  return undefined;
}

/** Why a Tone of Voice block cannot stand, or undefined. */
export function blockProblem(t: VoiceTrait): string | undefined {
  const fields = [t?.trait, t?.means, t?.do, t?.dont];
  if (fields.some((x) => typeof x !== "string")) return "A block has a name, what it means, a do and a don’t.";
  if (!t.trait.trim()) return "A block needs a name.";
  if (fields.some((x) => x.length > 600)) return "Say it in fewer words.";
  return undefined;
}
