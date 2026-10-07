import { MAX_FOLLOW_UPS } from "../config";
import type { Turn, UnderstoodBy } from "../types";
import { understandWithClaude } from "./claude";
import { understandWithHeuristics } from "./heuristic";
import type { Understanding } from "./schema";

const hasClaudeCredentials = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

/**
 * Turns the conversation so far into item attributes and an optional follow-up question.
 * BR-6 is enforced here, not trusted to the model: once MAX_FOLLOW_UPS have been asked,
 * no further question is returned.
 */
export async function understand(
  conversation: Turn[],
  followUpsAsked: number,
): Promise<Understanding & { understoodBy: UnderstoodBy }> {
  const followUpsAllowed = followUpsAsked < MAX_FOLLOW_UPS;
  const mode = process.env.UNDERSTAND_MODE ?? "auto";
  const useClaude = mode === "claude" || (mode === "auto" && hasClaudeCredentials());

  const result = useClaude
    ? { ...(await understandWithClaude(conversation, followUpsAllowed)), understoodBy: "claude" as const }
    : { ...understandWithHeuristics(conversation, followUpsAllowed), understoodBy: "heuristic" as const };

  if (!followUpsAllowed) result.followUpQuestion = null;
  return result;
}
