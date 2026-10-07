import {
  COMP_WINDOW_DAYS,
  FEES,
  FEE_BASE_ASSUMPTIONS,
  SPEED_GATES_VERDICT_FROM,
  HOME_PLATFORM_BIAS,
  LOW_CONFIDENCE_MAX_COMPS,
  MIN_COMPS,
  MIN_SPEED_SALES,
  SPEED_LOOKBACK_DAYS,
  SPEED_SIGNAL_TEXT,
  platformFee,
} from "../config";
import {
  PLATFORM_LABELS,
  type Comp,
  type DataSource,
  type ExcludedComp,
  type ItemAttributes,
  type PlatformListings,
  type PlatformResult,
  type PriceCheckResult,
  type SellSpeed,
  type Settings,
  type SpeedSignal,
  type UnderstoodBy,
  type Verdict,
} from "../types";
import { iqrBounds, median, quantile } from "./stats";

const LOT_PATTERN = /\b(lot|bundle|bulk|set of \d+|\d+\s*(pc|pcs|piece|pieces))\b/i;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * BR-11: garment groups that can't be the same item as each other. A comp whose title names a group
 * the item doesn't belong to (a "vest" when we're pricing a pullover) is a different item.
 * Tops are left out on purpose: jacket / pullover / hoodie overlap too much in real titles.
 */
const EXCLUSIVE_GROUPS = [
  ["vest"],
  ["pants", "trousers", "joggers"],
  ["shorts"],
  ["jeans"],
  ["hat", "beanie", "cap"],
  ["gloves", "mittens"],
  ["socks"],
  ["shoes", "sneakers"],
  ["boots"],
  ["dress"],
  ["skirt"],
  ["leggings", "tights"],
  ["bag", "backpack", "purse", "tote"],
].map((words) => new RegExp(`\\b(${words.join("|")})\\b`, "i"));

function conflictingType(item: ItemAttributes, title: string): string | null {
  if (!item.type) return null;
  const itemText = `${item.type} ${item.variant ?? ""}`;
  for (const group of EXCLUSIVE_GROUPS) {
    const m = title.match(group);
    if (m && !group.test(itemText)) return m[1].toLowerCase();
  }
  return null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** BR-11 + BR-12 + BR-1 window: decide which sold listings count as comps. */
export function selectComps(
  item: ItemAttributes,
  sold: Comp[],
  now: Date,
): { comps: Comp[]; excluded: ExcludedComp[] } {
  const excluded: ExcludedComp[] = [];
  const candidates: Comp[] = [];

  for (const comp of sold) {
    if (LOT_PATTERN.test(comp.title)) {
      excluded.push({ ...comp, reason: "Lot or bundle" });
    } else if (comp.soldAt && now.getTime() - Date.parse(comp.soldAt) > COMP_WINDOW_DAYS * DAY_MS) {
      excluded.push({ ...comp, reason: `Sold more than ${COMP_WINDOW_DAYS} days ago` });
    } else if (item.brand && !norm(comp.title).includes(norm(item.brand))) {
      excluded.push({ ...comp, reason: "Different brand" });
    } else if (conflictingType(item, comp.title)) {
      excluded.push({ ...comp, reason: `Different item (${conflictingType(item, comp.title)})` });
    } else if (item.size && comp.size && norm(comp.size) !== norm(item.size)) {
      excluded.push({ ...comp, reason: `Size ${comp.size}` });
    } else if (item.gender && comp.gender && comp.gender !== item.gender && comp.gender !== "unisex") {
      excluded.push({ ...comp, reason: `${comp.gender}'s` });
    } else {
      candidates.push(comp);
    }
  }

  // Outlier fences need a few points to mean anything.
  if (candidates.length < 4) return { comps: candidates, excluded };

  const { low, high } = iqrBounds(candidates.map((c) => c.price));
  const comps: Comp[] = [];
  for (const comp of candidates) {
    if (comp.price < low || comp.price > high) {
      excluded.push({ ...comp, reason: comp.price < low ? "Unusually low price" : "Unusually high price" });
    } else {
      comps.push(comp);
    }
  }
  return { comps, excluded };
}

/**
 * BR-10: market-level sold/active signal. Unknown (never a guess) when coverage is incomplete,
 * fewer than MIN_SPEED_SALES sold, or no active listings. Not a per-listing days prediction.
 */
export function sellSpeed(listings: PlatformListings, settings: Settings): SellSpeed {
  const threshold = settings.maxDays > 0 ? SPEED_LOOKBACK_DAYS / settings.maxDays : Infinity;
  const sold = listings.soldLast30d;
  const active = listings.activeListings;
  const trusted =
    listings.coverageComplete === true &&
    Number.isFinite(sold) && Number.isFinite(active) &&
    sold >= MIN_SPEED_SALES && active > 0;
  if (!trusted) {
    return { lookbackDays: SPEED_LOOKBACK_DAYS, soldLast30d: null, activeListings: null, sellThrough: null, threshold, signal: "unknown" };
  }
  const sellThrough = sold / active;
  return {
    lookbackDays: SPEED_LOOKBACK_DAYS,
    soldLast30d: sold,
    activeListings: active,
    sellThrough,
    threshold,
    signal: sellThrough >= threshold ? "meets_target" : "below_target",
  };
}

export function purchaseCost(tagPrice: number | null, settings: Settings): number {
  return tagPrice == null ? 0 : tagPrice * (1 + settings.salesTaxRate);
}

/** BR-1, BR-2, BR-3 for one platform. Returns null when nothing usable was found. */
export function evaluatePlatform(
  item: ItemAttributes,
  listings: PlatformListings,
  settings: Settings,
  now: Date,
): PlatformResult | null {
  const { comps, excluded } = selectComps(item, listings.sold, now);
  if (comps.length === 0) return null;

  const prices = comps.map((c) => c.price);
  const expected = median(prices);
  const rule = FEES[listings.platform];
  // Fees are charged on item price + assumed buyer shipping + assumed tax (conservative ESTIMATE).
  const feeBase = expected + FEE_BASE_ASSUMPTIONS.buyerShipping + expected * FEE_BASE_ASSUMPTIONS.salesTaxRate;
  const fees = platformFee(rule, feeBase);
  const shipping = rule.sellerShipping;
  const netProfit = expected - fees - shipping - purchaseCost(item.tagPrice, settings);

  return {
    platform: listings.platform,
    compsUsed: comps.length,
    median: round2(expected),
    p25: round2(quantile(prices, 0.25)),
    p75: round2(quantile(prices, 0.75)),
    fees: round2(fees),
    shipping: round2(shipping),
    netProfit: round2(netProfit),
    speed: sellSpeed(listings, settings),
    comps,
    excluded,
  };
}

/** BR-8: prefer the home platform unless another clearly beats it. */
export function recommendPlatform(results: PlatformResult[], settings: Settings): PlatformResult | null {
  const reliable = results.filter((r) => r.compsUsed >= MIN_COMPS);
  const candidates = reliable.length > 0 ? reliable : results;
  if (candidates.length === 0) return null;

  const best = candidates.reduce((a, b) => (b.netProfit > a.netProfit ? b : a));
  const home = candidates.find((r) => r.platform === settings.homePlatform);
  if (!home || home === best) return best;

  const margin = Math.max(HOME_PLATFORM_BIAS.minDollars, HOME_PLATFORM_BIAS.pctOfHome * Math.abs(home.netProfit));
  return best.netProfit - home.netProfit >= margin ? best : home;
}

/** BR-5 and BR-4 with a known tag price. Unknown speed never yields BUY or PASS by itself. */
export function decideVerdict(
  netProfit: number,
  signal: SpeedSignal,
  settings: Settings,
  speedGates = true,
): Verdict {
  if (netProfit <= 0) return "PASS";
  const profitOk = netProfit >= settings.minProfit;
  // Phase 1: speed is information only.
  if (!speedGates) return profitOk ? "BUY" : "MAYBE";
  if (profitOk && signal === "meets_target") return "BUY";
  if (!profitOk && signal === "below_target") return "PASS";
  return "MAYBE";
}

/**
 * BR-7: highest whole-dollar tag price at which the item still clears min profit
 * (and stays strictly profitable per BR-4). Null when no price works.
 */
export function maxBuyPrice(netBeforeCost: number, settings: Settings): number | null {
  const headroom = netBeforeCost - Math.max(settings.minProfit, 0.01);
  const price = Math.floor(headroom / (1 + settings.salesTaxRate));
  return price >= 1 ? price : null;
}

export interface PriceCheckInput {
  item: ItemAttributes;
  assumptions: string[];
  listings: PlatformListings[];
  settings: Settings;
  now: Date;
  dataSource: DataSource;
  dataAsOf?: string | null;
  understoodBy: UnderstoodBy;
}

export function priceCheck(input: PriceCheckInput): PriceCheckResult {
  const { item, settings, now } = input;
  const platforms = input.listings
    .map((l) => evaluatePlatform(item, l, settings, now))
    .filter((r): r is PlatformResult => r !== null)
    .sort((a, b) => b.netProfit - a.netProfit);

  const totalComps = platforms.reduce((n, r) => n + r.compsUsed, 0);
  const base = {
    item,
    assumptions: input.assumptions,
    platforms,
    dataSource: input.dataSource,
    dataAsOf: input.dataAsOf ?? null,
    understoodBy: input.understoodBy,
  };

  const rec = totalComps >= MIN_COMPS ? recommendPlatform(platforms, settings) : null;
  if (!rec) {
    return finish({
      ...base,
      recommendedPlatform: null,
      verdict: "NOT_ENOUGH_DATA",
      confidence: "low",
      maxBuyPrice: null,
      reason: `Only ${totalComps} matching sale${totalComps === 1 ? "" : "s"} found.`,
    });
  }

  const confidence = rec.compsUsed <= LOW_CONFIDENCE_MAX_COMPS ? "low" : "normal";
  const label = PLATFORM_LABELS[rec.platform];
  const net = Math.round(rec.netProfit);
  const signal = rec.speed.signal;
  const speedGates = now.getTime() >= Date.parse(SPEED_GATES_VERDICT_FROM);
  const fb = FEE_BASE_ASSUMPTIONS;
  base.assumptions = [
    ...base.assumptions,
    `ESTIMATE: fees assume $${fb.buyerShipping} buyer shipping and ${Math.round(fb.salesTaxRate * 100)}% sales tax (assumptions)`,
  ];
  const speedText = SPEED_SIGNAL_TEXT[signal];

  if (item.tagPrice == null) {
    const max = maxBuyPrice(rec.netProfit, settings);
    let verdict: Verdict;
    let reason: string;
    if (max == null) {
      verdict = "PASS";
      reason = `Even free, only about $${net} profit on ${label}.`;
    } else {
      verdict = !speedGates || signal === "meets_target" ? "BUY_UNDER" : "MAYBE";
      reason =
        speedGates && signal === "below_target"
          ? `Slower market. Worth it under $${max} on ${label}.`
          : `Worth it under $${max} on ${label}. ${speedText}.`;
    }
    return finish({ ...base, recommendedPlatform: rec.platform, verdict, confidence, maxBuyPrice: max, reason });
  }

  const verdict = decideVerdict(rec.netProfit, signal, settings, speedGates);
  let reason: string;
  if (rec.netProfit <= 0) {
    reason = `You'd lose about $${Math.abs(net)} on ${label}.`;
  } else if (verdict === "BUY") {
    reason = `Best on ${label}, about $${net} profit (estimate). ${speedText}.`;
  } else {
    reason = `About $${net} profit (estimate) on ${label}. ${speedText}.`;
  }
  return finish({ ...base, recommendedPlatform: rec.platform, verdict, confidence, maxBuyPrice: null, reason });
}

const VERDICT_WORDS: Record<Verdict, string> = {
  BUY: "Buy it.",
  MAYBE: "Maybe.",
  PASS: "Pass.",
  NOT_ENOUGH_DATA: "Can't call it.",
  BUY_UNDER: "",
};

/** BR-14 / BR-15: spoken text is derived from the same result as the card. */
function finish(result: Omit<PriceCheckResult, "spoken">): PriceCheckResult {
  const parts = [
    result.confidence === "low" && result.verdict !== "NOT_ENOUGH_DATA" ? "Low confidence." : "",
    VERDICT_WORDS[result.verdict],
    result.reason,
  ];
  return { ...result, spoken: parts.filter(Boolean).join(" ") };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
