import type { DataSource, ItemAttributes, PlatformListings } from "../types";
import { fetchDemoListings } from "./demo";
import { fetchEbayListings } from "./ebay";

export interface CompsSource {
  dataSource: DataSource;
  fetch(item: ItemAttributes, now: Date): Promise<PlatformListings[]>;
}

/**
 * Live eBay comps when APIFY_TOKEN is set; otherwise clearly labeled demo data.
 * Poshmark, Depop, and Mercari providers plug in here as additional live sources.
 */
export function getCompsSource(): CompsSource {
  if (process.env.APIFY_TOKEN && process.env.COMPS_SOURCE !== "demo") {
    return { dataSource: "live", fetch: async (item) => [await fetchEbayListings(item)] };
  }
  return { dataSource: "demo", fetch: fetchDemoListings };
}
