// Puts the written slots in the grammar's order; the locked slots always carry the approved text, word for word.
import type { CompilePackage, Finding, SlotText } from "./types.ts";

export type Assembly = { slots: SlotText[]; text: string; findings: Finding[] };

export function assemble(pkg: CompilePackage, written: SlotText[]): Assembly {
  const findings: Finding[] = [];
  // A recipe's fixed slots win over anything written for the same key.
  const fixed = new Set((pkg.fixedSlots ?? []).map((s) => s.slotKey));
  const composed = [...(pkg.fixedSlots ?? []), ...written.filter((s) => !fixed.has(s.slotKey))];
  const known = new Set<string>(pkg.grammar.slots.map((s) => s.key));
  const byKey = new Map<string, SlotText>();
  for (const slot of composed) {
    if (!known.has(slot.slotKey)) {
      findings.push({ code: "unknown_slot", slotKey: slot.slotKey, message: `The grammar has no slot "${slot.slotKey}"; its text was dropped.` });
      continue;
    }
    if (!byKey.has(slot.slotKey)) byKey.set(slot.slotKey, slot);
  }
  const slots: SlotText[] = [];
  for (const def of [...pkg.grammar.slots].sort((a, b) => a.order - b.order)) {
    if (def.filledBy === "locked") {
      // A locked slot claims every manifest item whose home is that slot; coverage still checks the content.
      const sources = pkg.manifest.filter((m) => m.suggestedSlot === def.key).map((m) => m.id);
      const text = def.key === "references" ? pkg.lockedReferenceText : pkg.lockedProductText;
      if (text.trim()) slots.push({ slotKey: def.key, text, sources });
      else if (def.required) findings.push({ code: "empty_slot", slotKey: def.key, message: `The approved ${def.key} text is empty.` });
      continue;
    }
    const slot = byKey.get(def.key);
    if (!slot) {
      if (def.required) findings.push({ code: "missing_slot", slotKey: def.key, message: `The required slot "${def.key}" is missing.` });
      continue;
    }
    if (!slot.text.trim()) {
      if (def.required) findings.push({ code: "empty_slot", slotKey: def.key, message: `The required slot "${def.key}" is empty.` });
      continue;
    }
    slots.push({ slotKey: def.key, text: slot.text.trim(), sources: slot.sources });
  }
  return { slots, text: slots.map((s) => s.text).join("\n\n"), findings };
}
