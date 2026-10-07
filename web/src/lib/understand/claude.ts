import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Turn } from "../types";
import { UnderstandingSchema, type Understanding } from "./schema";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

const SYSTEM = `You are the listening step of a voice assistant for secondhand clothing resellers. A reseller is standing in a thrift store and describes an item out loud; you turn what they said into structured attributes so we can look up sold prices.

Extract:
- brand, item type (e.g. "fleece pullover", "jeans"), model/variant (e.g. "Synchilla Snap-T", "501"), size, gender/department, condition, notable flaws, era (e.g. "90s vintage").
- tagPrice: the store's price in dollars. Speech is messy: "nine bucks", "four ninety-nine", "the tag says 12" all count.
Use null for anything not said. Normalize brand spelling ("north face" → "The North Face", "levis" → "Levi's").

Decide whether to ask a follow-up question:
- Ask only if a missing or ambiguous detail would materially change the resale price (model/variant, size, gender, condition, or era for vintage). Brand is always required if missing.
- Combine up to two details into one short spoken question, at most 12 words, e.g. "Snap-T or quarter-zip? And what size?"
- Never ask about tag price; we handle a missing price separately.
- If follow-ups are no longer allowed, or nothing price-relevant is missing, set followUpQuestion to null and list any defaults you assumed in assumptions (e.g. "condition: good").`;

export async function understandWithClaude(conversation: Turn[], followUpsAllowed: boolean): Promise<Understanding> {
  const client = new Anthropic();
  const transcript = conversation
    .map((t) => `${t.role === "sourcer" ? "Reseller" : "Assistant"}: ${t.text}`)
    .join("\n");

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "low", format: betaZodOutputFormat(UnderstandingSchema) },
    messages: [
      {
        role: "user",
        content: `${transcript}\n\nFollow-up questions allowed: ${followUpsAllowed ? "yes" : "no"}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("The model declined to process this item.");
  if (!response.parsed_output) throw new Error(`Could not parse item attributes (stop_reason: ${response.stop_reason}).`);
  return response.parsed_output;
}
