import type { Platform, Settings } from "./types";

/**
 * BR-3: platform fees and seller shipping live here, never inside business logic.
 *
 * UNVERIFIED PLACEHOLDERS. The Market Research agent replaces these with sourced values
 * (docs/research/fees.md) including source URL and as-of date.
 */
export interface FeeRule {
  /** Fraction of the sale price, e.g. 0.136 for 13.6%. */
  percent: number;
  /** Fixed fee per order in dollars. */
  fixed: number;
  /** Optional flat fee that replaces the percentage below a price threshold. */
  flatBelow?: { threshold: number; flat: number };
  /** Seller-paid shipping assumption for apparel, in dollars. */
  sellerShipping: number;
  source: string | null;
  asOf: string | null;
  verified: boolean;
}

export const FEES: Record<Platform, FeeRule> = {
  ebay: { percent: 0.136, fixed: 0.4, sellerShipping: 0, source: null, asOf: null, verified: false },
  poshmark: {
    percent: 0.2,
    fixed: 0,
    flatBelow: { threshold: 15, flat: 2.95 },
    sellerShipping: 0,
    source: null,
    asOf: null,
    verified: false,
  },
  depop: { percent: 0.033, fixed: 0.45, sellerShipping: 0, source: null, asOf: null, verified: false },
  // Verified 2026-10-07: 10% seller fee, no separate fixed/processing charge (fee schedule effective
  // 2025-01-06). Base is item price + buyer-paid shipping; the engine currently passes item price only,
  // so results are an item-only ESTIMATE (see PR #4 for the fee-base contract). The Oct 19, 2026 rate
  // table is future and must not be used for the Oct 7 demo.
  mercari: {
    percent: 0.1,
    fixed: 0,
    sellerShipping: 0,
    source: "https://www.mercari.com/us/help_center/article/169/",
    asOf: "2026-10-07",
    verified: true,
  },
};

export function platformFee(rule: FeeRule, price: number): number {
  if (rule.flatBelow && price < rule.flatBelow.threshold) return rule.flatBelow.flat;
  return price * rule.percent + rule.fixed;
}

export const DEFAULT_SETTINGS: Settings = {
  homePlatform: "ebay",
  minProfit: 10,
  maxDays: 30,
  salesTaxRate: 0,
};

/** BR-8: another platform must beat home by at least max(abs, pct × home net). */
export const HOME_PLATFORM_BIAS = { minDollars: 5, pctOfHome: 0.15 };

/** BR-5 / BR-13 comp-count thresholds. */
export const MIN_COMPS = 3;
export const LOW_CONFIDENCE_MAX_COMPS = 5;

/** BR-6 */
export const MAX_FOLLOW_UPS = 2;

/** BR-1: comp lookback window. */
export const COMP_WINDOW_DAYS = 90;

/** BR-10 clamp bounds. */
export const DAYS_TO_SELL_BOUNDS = { min: 1, max: 180 };
