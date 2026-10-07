import { parseGender, parseSize } from "../text";
import type { Comp, ItemAttributes, PlatformListings } from "../types";

/**
 * Live eBay sold comps via the Apify actor "memo23/ebay-search-scraper-ppe" (sold mode).
 * One run returns individual sold listings plus a summary row with market-wide sold and active
 * counts, which BR-10 needs for sell speed.
 *
 * Cost (Oct 2026): ~$0.02 start + $0.02 summary + $0.003 per listing → ~$0.16 for 40 listings.
 */

const ACTOR = process.env.APIFY_EBAY_ACTOR ?? "memo23~ebay-search-scraper-ppe";
const MAX_LISTINGS = 40;
/** Hard ceiling per lookup, enforced by Apify (budget guardrail, docs/PLAN.md §6). */
const MAX_CHARGE_USD = 0.25;
/** eBay category "Clothing, Shoes & Accessories". */
const EBAY_CLOTHING_CATEGORY = "11450";

interface SummaryRow {
  _analytics: true;
  totalSold?: number;
  soldPerDay?: number;
  windowDays?: number;
  totalActive?: number;
}

interface ListingRow {
  _analytics?: undefined;
  itemId?: string;
  url?: string;
  title?: string;
  priceValue?: number;
  sold?: boolean;
  soldDate?: string;
}

type Row = SummaryRow | ListingRow;

/** Search keywords for an item: brand, model (or type), gender, size. */
export function ebayQuery(item: ItemAttributes): string {
  const gender = item.gender === "men" ? "mens" : item.gender === "women" ? "womens" : "";
  return [item.brand, item.variant ?? item.type, gender, item.size]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Sold  Oct 7, 2026" → ISO date, or null. */
function parseSoldDate(s: string | undefined): string | null {
  if (!s) return null;
  const t = Date.parse(s.replace(/^Sold\s+/i, ""));
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function toPlatformListings(rows: Row[]): PlatformListings {
  const summary = rows.find((r): r is SummaryRow => r._analytics === true);
  const sold: Comp[] = rows
    .filter((r): r is ListingRow => !r._analytics && r.sold !== false && typeof r.priceValue === "number")
    .map((r) => ({
      platform: "ebay",
      title: r.title ?? "",
      price: r.priceValue!,
      soldAt: parseSoldDate(r.soldDate),
      url: r.url ?? `https://www.ebay.com/itm/${r.itemId}`,
      size: parseSize(r.title ?? ""),
      gender: parseGender(r.title ?? ""),
    }));

  // BR-10 inputs: market-wide counts from the summary row when present.
  const windowDays = summary?.windowDays ?? 90;
  const soldLast30d = summary?.soldPerDay != null
    ? Math.round(summary.soldPerDay * 30)
    : Math.round(((summary?.totalSold ?? sold.length) * 30) / windowDays);
  return { platform: "ebay", sold, soldLast30d, activeListings: summary?.totalActive ?? 0 };
}

/** Live fetch for one search query. Callers go through the price index (price-index.ts). */
export async function fetchEbayByQuery(query: string): Promise<PlatformListings> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");

  const url = new URL(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items`);
  url.searchParams.set("timeout", "60");
  url.searchParams.set("maxTotalChargeUsd", String(MAX_CHARGE_USD));

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      searchQuery: query,
      mode: "sold",
      detailedItems: false,
      includeSummary: true,
      includeLegacyFields: false,
      soldWithinDays: 90,
      maxItems: MAX_LISTINGS,
      category: EBAY_CLOTHING_CATEGORY,
    }),
    signal: AbortSignal.timeout(75_000),
  });
  if (!res.ok) throw new Error(`Apify eBay run failed: ${res.status} ${await res.text().catch(() => "")}`);
  return toPlatformListings((await res.json()) as Row[]);
}

/** Start + summary events plus per-listing charge; worst case before we know the count. */
export function estimateEbayCostUsd(listings: PlatformListings | null): number {
  return 0.04 + 0.003 * (listings ? listings.sold.length : MAX_LISTINGS);
}

export const ebayFetcher = { query: ebayQuery, fetch: fetchEbayByQuery, estimateCostUsd: estimateEbayCostUsd };
