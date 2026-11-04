// Checks by code, before any model is asked: what an image model must never be told.
import type { Assembly } from "./assemble.ts";
import type { CompilePackage, Finding } from "./types.ts";

export const DEFAULT_MAX_REFERENCES = 3;

export function containsTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(text);
}

export const EQUIPMENT_TERMS = [
  "softbox", "soft box", "strobe", "ring light", "ringlight", "beauty dish", "light stand", "c-stand", "scrim",
  "octabox", "snoot", "gobo", "reflector", "flash head", "speedlight", "studio light", "studio lights",
  "umbrella light", "diffusion panel",
];

// The words that make a generated picture look generated: they say nothing a camera sees, and models answer them
// with their average glossy picture (Marcus, 4 Nov 2026: "AI-slop").
export const SLOP_TERMS = [
  "stunning", "breathtaking", "hyperrealistic", "hyper-realistic", "hyper realistic", "ultra-detailed", "ultra detailed",
  "highly detailed", "8k", "4k", "masterpiece", "award-winning", "award winning", "photorealistic", "photo-realistic",
  "cinematic", "epic", "flawless", "high quality", "best quality", "professional photo", "trending on", "octane render",
  "unreal engine", "dramatic lighting", "perfect lighting", "beautiful lighting", "vibrant colors", "vibrant colours",
];

const TEXT_REQUESTS: RegExp[] = [
  /\b(text|words?|lettering|caption|headline|slogan|tagline|typography)\s+(that\s+)?(reads?|says?|saying|reading|spells?|spelling)\b/i,
  /\b(sign|signage|label|banner|poster|placard)\s+(text\s+)?(that\s+)?(reads?|says?|saying|reading|spells?|spelling)\b/i,
  /\bwritten\s+(on|across|onto|in)\b/i,
  /\b(text|words?|letters?|lettering|slogan|name|logo|label)\s+(printed|painted|embossed|engraved|stamped)\s+(on|across|onto)\b/i,
  /\bthe words?\b/i,
  /["“„][^"“”„]{2,}["”“]/,
];

const INERT_SYNTAX: RegExp[] = [
  /\([^()]+:\s*\d+(\.\d+)?\)/,
  /\(\([^()]+\)\)/,
  /\[\[[^\]]+\]\]/,
  /(^|\s)--(ar|v|style|stylize|chaos|no|q|seed|niji)\b/i,
  /\bnegative prompt\s*:/i,
];

// A file name in the prompt makes some models fail the request (prototype knowledge, image-models.md).
const FILE_NAME = /\b[\w-]+\.(jpe?g|png|webp|gif|tiff?|heic|avif|psd|pdf)\b/i;

/** Checks one written text: requests for rendered text, forbidden and equipment terms, file names, inert syntax. */
export function lintText(text: string, slotKey: string, opts: { forbiddenTerms: string[] }): Finding[] {
  const findings: Finding[] = [];
  for (const re of TEXT_REQUESTS) {
    const m = text.match(re);
    if (m) {
      findings.push({ code: "text_request", slotKey, message: `Asks for rendered text ("${m[0]}"); text is never generated in the image.` });
      break;
    }
  }
  for (const term of opts.forbiddenTerms)
    if (containsTerm(text, term)) findings.push({ code: "forbidden_term", slotKey, message: `Contains the forbidden term "${term}".` });
  for (const term of EQUIPMENT_TERMS)
    if (containsTerm(text, term))
      findings.push({ code: "equipment_term", slotKey, message: `Names studio equipment ("${term}"); describe how the light falls instead.` });
  for (const term of SLOP_TERMS)
    if (containsTerm(text, term))
      findings.push({ code: "slop_term", slotKey, message: `Uses the empty quality word "${term}"; say what the camera sees instead.` });
  const file = text.match(FILE_NAME);
  if (file) findings.push({ code: "file_name", slotKey, message: `Names a file ("${file[0]}"); refer to the pictures by what they show.` });
  for (const re of INERT_SYNTAX) {
    const m = text.match(re);
    if (m) {
      findings.push({ code: "inert_syntax", slotKey, message: `Uses syntax the model ignores ("${m[0].trim()}").` });
      break;
    }
  }
  return findings;
}

export function lint(assembly: Assembly, pkg: CompilePackage, opts: { maxReferences?: number } = {}): Finding[] {
  const findings: Finding[] = [...assembly.findings];
  for (const slot of assembly.slots) {
    const locked = slot.slotKey === "references" || slot.slotKey === "product";
    if (slot.slotKey === "references" && slot.text !== pkg.lockedReferenceText)
      findings.push({ code: "locked_slot_changed", slotKey: slot.slotKey, message: "The references slot differs from the approved text." });
    if (slot.slotKey === "product" && slot.text !== pkg.lockedProductText)
      findings.push({ code: "locked_slot_changed", slotKey: slot.slotKey, message: "The product slot differs from the approved text." });
    // The approved product text may name what is printed on the product; only the written slots are held to this.
    const found = lintText(slot.text, slot.slotKey, { forbiddenTerms: pkg.forbiddenTerms });
    findings.push(...(locked ? found.filter((f) => f.code !== "text_request" && f.code !== "forbidden_term") : found));
  }
  // The camera slot names the photograph as it is made: a focal length, an aperture and the light's colour temperature.
  const camera = assembly.slots.find((x) => x.slotKey === "camera");
  if (camera) {
    const missing = [
      !/\b\d{2,3}(\s?|-)(mm|millimet(re|er)s?)\b/i.test(camera.text) && "the lens's focal length (written like 85 mm)",
      !/\bf\/\s?\d/i.test(camera.text) && "the aperture (written like f/8)",
      !/\b\d{1,2}[,.\s]?\d{3}\s?(k|kelvin)\b/i.test(camera.text) && "the light's colour temperature (written like 5200 K)",
      !/\b(grain|grainy|clean digital|no grain)\b/i.test(camera.text) && "the grain",
    ].filter(Boolean);
    if (missing.length)
      findings.push({ code: "camera_unspecified", slotKey: "camera", message: `The camera slot leaves out ${missing.join(", ")}.` });
  }
  const limit = Math.min(opts.maxReferences ?? DEFAULT_MAX_REFERENCES, pkg.dialect.maxReferences);
  if (pkg.references.length > limit)
    findings.push({ code: "too_many_references", message: `${pkg.references.length} reference pictures exceed the limit of ${limit}.` });
  return findings;
}
