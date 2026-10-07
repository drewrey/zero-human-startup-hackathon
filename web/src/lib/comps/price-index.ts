import type { ItemAttributes, PlatformListings } from "../types";
import type { IndexStore } from "./store";

/**
 * BR-18..BR-20: check the price index before paying for a live lookup.
 *
 * - Fresh entry (≤ INDEX_TTL_DAYS): answer from the index, no Apify call.
 * - Stale entry: answer from it now (labeled with its date) and refresh in the background.
 * - Miss: fetch live, store, answer.
 * Every live fetch is checked against the daily Apify budget first (docs/PLAN.md §6).
 */

export const INDEX_TTL_DAYS = Number(process.env.INDEX_TTL_DAYS ?? 7);
export const DAILY_BUDGET_USD = Number(process.env.APIFY_DAILY_BUDGET_USD ?? 3);

export class BudgetExceededError extends Error {
  constructor(spent: number, budget: number) {
    super(`Apify daily budget reached ($${spent.toFixed(2)} of $${budget.toFixed(2)})`);
  }
}

export interface LiveFetcher {
  query(item: ItemAttributes): string;
  fetch(query: string): Promise<PlatformListings>;
  /** Estimated USD cost of one live fetch, charged against the budget. */
  estimateCostUsd(listings: PlatformListings | null): number;
}

export interface IndexedResult {
  listings: PlatformListings;
  asOf: string;
  from: "index" | "live" | "stale-index";
}

const DAY_MS = 86_400_000;

function startOfToday(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function assertBudget(store: IndexStore, fetcher: LiveFetcher, now: Date, budgetUsd = DAILY_BUDGET_USD) {
  const spent = await store.spentSince(startOfToday(now));
  if (spent + fetcher.estimateCostUsd(null) > budgetUsd) throw new BudgetExceededError(spent, budgetUsd);
}

/** Fetch live, store in the index, and record spend. Used by lookups and batch jobs alike. */
export async function refresh(
  store: IndexStore,
  fetcher: LiveFetcher,
  query: string,
  now: Date,
  budgetUsd = DAILY_BUDGET_USD,
) {
  await assertBudget(store, fetcher, now, budgetUsd);
  const listings = await fetcher.fetch(query);
  const cost = fetcher.estimateCostUsd(listings);
  await store.recordSpend(cost, `ebay: ${query}`);

  // A failed or near-empty run must not overwrite good data.
  const existing = await store.get(query.toLowerCase());
  if (existing && listings.sold.length < Math.min(3, existing.listings.sold.length)) return existing;

  const entry = { key: query.toLowerCase(), query, listings, fetchedAt: now.toISOString(), costUsd: cost };
  await store.put(entry);
  return entry;
}

export async function lookup(
  store: IndexStore,
  fetcher: LiveFetcher,
  item: ItemAttributes,
  now: Date,
): Promise<IndexedResult> {
  const query = fetcher.query(item);
  const entry = await store.get(query.toLowerCase());

  if (entry) {
    const age = now.getTime() - Date.parse(entry.fetchedAt);
    if (age <= INDEX_TTL_DAYS * DAY_MS) return { listings: entry.listings, asOf: entry.fetchedAt, from: "index" };
    // Stale: answer now, refresh in the background if the budget allows.
    void refresh(store, fetcher, query, now).catch(() => {});
    return { listings: entry.listings, asOf: entry.fetchedAt, from: "stale-index" };
  }

  const fresh = await refresh(store, fetcher, query, now);
  return { listings: fresh.listings, asOf: fresh.fetchedAt, from: "live" };
}
