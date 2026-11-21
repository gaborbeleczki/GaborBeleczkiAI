import { describe, expect, it } from "vitest";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { Digest, Extraction, QuickAdd, Triage } from "@/lib/ai/schemas";

type Json = Record<string, unknown>;

/** Counts what Claude's structured-output compiler limits: union-typed params and optional params. */
function complexity(schema: Json) {
  let unions = 0;
  let optional = 0;
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as Json;
    if (Array.isArray(n.anyOf) || Array.isArray(n.oneOf) || Array.isArray(n.type)) unions++;
    if (n.properties && typeof n.properties === "object") {
      const req = new Set((n.required as string[]) ?? []);
      for (const k of Object.keys(n.properties as Json)) if (!req.has(k)) optional++;
      if (n.additionalProperties !== false) throw new Error("additionalProperties must be false");
    }
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) v.forEach(visit);
      else visit(v);
    }
  };
  visit(schema);
  return { unions, optional };
}

describe("structured output schemas stay within API limits", () => {
  for (const [name, s] of Object.entries({ Extraction, Triage, Digest, QuickAdd })) {
    it(`${name}: ≤16 union params, ≤24 optional params`, () => {
      const fmt = betaZodOutputFormat(s) as unknown as { schema: Json };
      const c = complexity(fmt.schema);
      expect(c.unions).toBeLessThanOrEqual(16);
      expect(c.optional).toBeLessThanOrEqual(24);
    });
  }
});
