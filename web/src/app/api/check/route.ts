import { getCompsSource } from "@/lib/comps";
import { BudgetExceededError } from "@/lib/comps/price-index";
import { DEFAULT_SETTINGS } from "@/lib/config";
import { priceCheck } from "@/lib/pricing/engine";
import { PLATFORMS, type CheckRequest, type CheckResponse, type Settings } from "@/lib/types";
import { understand } from "@/lib/understand";

/** Live eBay lookups take ~20s; allow headroom. */
export const maxDuration = 90;

function sanitizeSettings(input: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...input };
  return {
    homePlatform: PLATFORMS.includes(s.homePlatform) ? s.homePlatform : DEFAULT_SETTINGS.homePlatform,
    minProfit: Number.isFinite(s.minProfit) ? Math.max(0, s.minProfit) : DEFAULT_SETTINGS.minProfit,
    maxDays: Number.isFinite(s.maxDays) ? Math.max(1, s.maxDays) : DEFAULT_SETTINGS.maxDays,
    salesTaxRate: Number.isFinite(s.salesTaxRate) ? Math.min(Math.max(0, s.salesTaxRate), 0.2) : 0,
  };
}

export async function POST(request: Request): Promise<Response> {
  let body: CheckRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ kind: "error", message: "Invalid JSON body." } satisfies CheckResponse, { status: 400 });
  }

  const conversation = Array.isArray(body.conversation) ? body.conversation.slice(-10) : [];
  if (!conversation.some((t) => t.role === "sourcer" && t.text?.trim())) {
    return Response.json({ kind: "error", message: "Say or type an item first." } satisfies CheckResponse, { status: 400 });
  }

  try {
    const u = await understand(conversation, Number(body.followUpsAsked) || 0);
    if (u.followUpQuestion) {
      return Response.json({
        kind: "followup",
        question: u.followUpQuestion,
        item: u.item,
        understoodBy: u.understoodBy,
      } satisfies CheckResponse);
    }

    const source = getCompsSource();
    const now = new Date();
    const comps = await source.fetch(u.item, now);
    const result = priceCheck({
      item: u.item,
      assumptions: u.assumptions,
      listings: comps.listings,
      settings: sanitizeSettings(body.settings),
      now,
      dataSource: source.dataSource,
      dataAsOf: comps.asOf,
      understoodBy: u.understoodBy,
    });
    // TODO(Pricing Data, BR-16): persist the scan once the backend is chosen.
    return Response.json({ kind: "result", result } satisfies CheckResponse);
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      return Response.json(
        {
          kind: "error",
          message: "New price lookups are paused for today to stay on budget. Items checked before still work.",
        } satisfies CheckResponse,
        { status: 429 },
      );
    }
    console.error("price check failed", error);
    return Response.json(
      {
        kind: "error",
        message: "Couldn't get sold prices right now. Try again in a moment.",
      } satisfies CheckResponse,
      { status: 500 },
    );
  }
}
