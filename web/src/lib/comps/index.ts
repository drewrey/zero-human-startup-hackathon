import type { DataSource, ItemAttributes, PlatformListings } from "../types";
import { fetchDemoListings } from "./demo";

export interface CompsSource {
  dataSource: DataSource;
  fetch(item: ItemAttributes, now: Date): Promise<PlatformListings[]>;
}

/**
 * Picks the comps provider. Only demo data exists today; the Pricing Data agent adds an
 * Apify-backed live provider (selected when APIFY_TOKEN is set).
 */
export function getCompsSource(): CompsSource {
  return { dataSource: "demo", fetch: fetchDemoListings };
}
