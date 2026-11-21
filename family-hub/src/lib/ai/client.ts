import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type * as z from "zod/v4";
import { env } from "../env";

let client: Anthropic | null = null;

export function aiConfigured(): boolean {
  return Boolean(env.anthropicKey);
}

function getClient(): Anthropic {
  if (!env.anthropicKey) throw new Error("ANTHROPIC_API_KEY nincs beállítva.");
  client ??= new Anthropic({ apiKey: env.anthropicKey, maxRetries: 3, timeout: 120_000 });
  return client;
}

export class AIRefusal extends Error {}

/**
 * One structured-output call. Stable instructions go first in `system` (cached),
 * per-request content in the user message. Server-side refusal fallbacks are enabled.
 */
export async function callStructured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  context?: string;
  user: string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<S>> {
  const anthropic = getClient();
  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: opts.system }];
  if (opts.context) system.push({ type: "text", text: opts.context, cache_control: { type: "ephemeral" } });
  else system[0].cache_control = { type: "ephemeral" };

  const response = await anthropic.beta.messages.parse({
    model: env.anthropicModel,
    max_tokens: opts.maxTokens ?? 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
    messages: [{ role: "user", content: opts.user }],
  });

  if (response.stop_reason === "refusal") {
    throw new AIRefusal(`AI refused (${response.stop_details?.category ?? "unknown"})`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("AI output truncated (max_tokens)");
  }
  if (!response.parsed_output) throw new Error("AI output could not be parsed");
  return response.parsed_output as z.infer<S>;
}
