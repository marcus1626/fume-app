// The prompt behind a version, as the live API reads it from engine_prompts (FLOWS §29).
import { describe, expect, it } from "vitest";
import { failureOf, toEnginePrompt, type PromptRow } from "../src/api/live/engine";

const row = (over: Partial<PromptRow> = {}): PromptRow => ({
  id: "p1",
  job_id: "j1",
  attempt_id: "a1",
  status: "validated",
  reason: null,
  image_model: "nano-banana-pro",
  text: "The first picture is the product itself.",
  compile_package: {
    target: { imageType: "campaign_still" },
    concept: { title: "Evening ritual" },
    manifest: [
      { id: "m1", requirement: "Warm light from one side." },
      { id: "m2", requirement: "No spilled oil." },
      { id: "m3", requirement: "The cap is matte." },
    ],
    notVisible: ["The oil's scent"],
  },
  findings: [],
  attempts: [
    {
      n: 1,
      text: "…",
      findings: [],
      decisions: [{ key: "not_visible:0", kind: "not_visible", itemId: null, passed: true }],
    },
  ],
  llm_usd: "0.0021",
  created_at: "2026-11-04T12:00:00Z",
  ...over,
});

describe("the Engine's prompt in the Studio", () => {
  it("carries every item of a prompt that passed, with the code's checks and what it cost", () => {
    const p = toEnginePrompt(row());
    expect(p).toMatchObject({
      status: "validated",
      model: "Nano Banana Pro",
      method: "Campaign still · Evening ritual",
      tries: 1,
      llmUsd: 0.0021,
    });
    expect(p.findings.map((f) => f.verdict)).toEqual(["carried", "carried", "carried", "not_visible"]);
    expect(p.codeChecks.every((c) => c.pass)).toBe(true);
    expect(p).not.toHaveProperty("reason");
  });

  it("says which rules a prompt worked against after its tries, and why it stopped", () => {
    const against = [
      { code: "conflict", message: "The prompt works against: no spilled oil.", manifestItemId: "m2" },
      { code: "manifest_not_expressed", message: "The prompt does not say the cap is matte.", manifestItemId: "m3" },
      { code: "text_request", message: "It asks for printed words." },
    ];
    const tries = [1, 2, 3].map((n) => ({ n, text: "…", findings: against, decisions: [] }));
    const p = toEnginePrompt(
      row({ status: "blocked", reason: "attempts_exhausted", attempts: tries, findings: against }),
    );
    expect(p.findings.filter((f) => f.verdict === "against").map((f) => f.item)).toEqual([
      "No spilled oil.",
      "The cap is matte.",
    ]);
    expect(p.codeChecks.find((c) => c.text === "No words for the picture to print")?.pass).toBe(false);
    expect(p.reason).toMatch(/three tries/);
    expect(failureOf("The prompt did not pass Fume's checks: …", p)).toBe(
      "The prompt worked against 2 rules after 3 tries.",
    );
  });

  it("gives a failed render its first sentence when no prompt is shown", () => {
    expect(failureOf("Higgsfield has no credits left for Fume. Try later.", undefined)).toBe(
      "Higgsfield has no credits left for Fume.",
    );
    expect(failureOf(null, undefined)).toBe("The Engine could not render it.");
  });
});
