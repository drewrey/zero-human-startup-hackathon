export const PLATFORMS = ["ebay", "poshmark", "depop", "mercari"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  ebay: "eBay",
  poshmark: "Poshmark",
  depop: "Depop",
  mercari: "Mercari",
};

export type Gender = "men" | "women" | "unisex" | "kids";
export type Condition = "new_with_tags" | "excellent" | "good" | "fair" | "poor";

export interface ItemAttributes {
  brand: string | null;
  type: string | null;
  variant: string | null;
  size: string | null;
  gender: Gender | null;
  condition: Condition | null;
  flaws: string | null;
  era: string | null;
  tagPrice: number | null;
}

export interface Settings {
  homePlatform: Platform;
  /** BR-5: minimum net profit for BUY, in dollars. */
  minProfit: number;
  /** BR-5: maximum estimated days to sell for BUY. */
  maxDays: number;
  /** BR-2: e.g. 0.0875 for 8.75%. */
  salesTaxRate: number;
}

export interface Comp {
  platform: Platform;
  title: string;
  price: number;
  soldAt: string | null;
  url: string;
  size?: string | null;
  gender?: Gender | null;
}

export interface ExcludedComp extends Comp {
  reason: string;
}

/** What a comps provider returns for one platform. */
export interface PlatformListings {
  platform: Platform;
  sold: Comp[];
  /** Number of sold listings in the last 30 days (BR-10). */
  soldLast30d: number;
  /** Number of currently active listings for the same query (BR-10). */
  activeListings: number;
}

export interface PlatformResult {
  platform: Platform;
  compsUsed: number;
  median: number;
  p25: number;
  p75: number;
  fees: number;
  shipping: number;
  /** Net profit after fees, shipping, and purchase cost (BR-2). Excludes purchase cost when tag price is unknown. */
  netProfit: number;
  estDaysToSell: number;
  comps: Comp[];
  excluded: ExcludedComp[];
}

export type Verdict = "BUY" | "MAYBE" | "PASS" | "NOT_ENOUGH_DATA" | "BUY_UNDER";
export type Confidence = "normal" | "low";
export type DataSource = "demo" | "live";
export type UnderstoodBy = "claude" | "heuristic";

/** SPEC §5: the single object that feeds both the card and the spoken answer (BR-15). */
export interface PriceCheckResult {
  item: ItemAttributes;
  assumptions: string[];
  platforms: PlatformResult[];
  recommendedPlatform: Platform | null;
  verdict: Verdict;
  confidence: Confidence;
  /** BR-7: set when the sourcer gave no tag price. */
  maxBuyPrice: number | null;
  reason: string;
  spoken: string;
  dataSource: DataSource;
  /** BR-19: when the comps were fetched; null for demo data. */
  dataAsOf: string | null;
  understoodBy: UnderstoodBy;
}

export interface Turn {
  role: "sourcer" | "assistant";
  text: string;
}

export interface CheckRequest {
  conversation: Turn[];
  followUpsAsked: number;
  settings: Settings;
}

export type CheckResponse =
  | { kind: "followup"; question: string; item: ItemAttributes; understoodBy: UnderstoodBy }
  | { kind: "result"; result: PriceCheckResult }
  | { kind: "error"; message: string };
