import type { DataSource, ItemAttributes, PlatformListings } from "../types";
import { fetchDemoListings } from "./demo";
import { ebayFetcher } from "./ebay";
import { lookup } from "./price-index";
import { getStore } from "./store";

export interface CompsResult {
  listings: PlatformListings[];
  /** When the underlying data was fetched (BR-19). */
  asOf: string | null;
}

export interface CompsSource {
  dataSource: DataSource;
  fetch(item: ItemAttributes, now: Date): Promise<CompsResult>;
}

/**
 * Live eBay comps (through the price index) when APIFY_TOKEN is set; otherwise labeled demo data.
 * Poshmark, Depop, and Mercari plug in here as additional live sources.
 */
export function getCompsSource(): CompsSource {
  if (process.env.APIFY_TOKEN && process.env.COMPS_SOURCE !== "demo") {
    return {
      dataSource: "live",
      fetch: async (item, now) => {
        const r = await lookup(getStore(), ebayFetcher, item, now);
        return { listings: [r.listings], asOf: r.asOf };
      },
    };
  }
  return {
    dataSource: "demo",
    fetch: async (item, now) => ({ listings: await fetchDemoListings(item, now), asOf: null }),
  };
}
