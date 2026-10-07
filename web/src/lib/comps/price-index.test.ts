import { afterAll, describe, expect, it } from "vitest";
import type { ItemAttributes, PlatformListings } from "../types";
import { BudgetExceededError, DAILY_BUDGET_USD, INDEX_TTL_DAYS, lookup, refresh, type LiveFetcher } from "./price-index";
import { MemoryStore, PostgresStore, type IndexStore } from "./store";

const NOW = new Date("2026-10-07T18:00:00Z");
const DAY = 86_400_000;

const item: ItemAttributes = {
  brand: "Patagonia", type: "fleece pullover", variant: "Synchilla", size: "L", gender: "men",
  condition: null, flaws: null, era: null, tagPrice: 9,
};

const listings = (n: number): PlatformListings => ({
  platform: "ebay",
  sold: Array.from({ length: n }, (_, i) => ({
    platform: "ebay" as const, title: `Patagonia Synchilla ${i}`, price: 60 + i, soldAt: null, url: `u${i}`,
  })),
  soldLast30d: 100,
  activeListings: 200,
});

function fakeFetcher(n = 10, cost = 0.16) {
  const calls: string[] = [];
  const fetcher: LiveFetcher = {
    query: () => "Patagonia Synchilla mens L",
    fetch: async (q) => {
      calls.push(q);
      return listings(n);
    },
    estimateCostUsd: () => cost,
  };
  return { fetcher, calls };
}

function suite(name: string, makeStore: () => Promise<IndexStore>) {
  describe(`price index (${name})`, () => {
    it("BR-18/20: a miss fetches live once, then answers from the index", async () => {
      const store = await makeStore();
      const { fetcher, calls } = fakeFetcher();
      const first = await lookup(store, fetcher, item, NOW);
      const second = await lookup(store, fetcher, item, new Date(NOW.getTime() + DAY));
      expect(first.from).toBe("live");
      expect(second.from).toBe("index");
      expect(calls).toHaveLength(1);
      expect(await store.spentSince(new Date(NOW.getTime() - DAY))).toBeCloseTo(0.16);
    });

    it("BR-19: a stale entry still answers, labeled with its date", async () => {
      const store = await makeStore();
      const { fetcher } = fakeFetcher();
      await lookup(store, fetcher, item, NOW);
      const later = new Date(NOW.getTime() + (INDEX_TTL_DAYS + 1) * DAY);
      const r = await lookup(store, fetcher, item, later);
      expect(r.from).toBe("stale-index");
      expect(r.asOf).toBe(NOW.toISOString());
    });

    it("BR-10: legacy cached eBay entries with coverageComplete=true read back as incomplete", async () => {
      const store = await makeStore();
      await store.put({
        key: "patagonia synchilla mens l", query: "Patagonia Synchilla mens L",
        listings: { ...listings(10), coverageComplete: true }, fetchedAt: NOW.toISOString(), costUsd: 0.16,
      });
      const { fetcher } = fakeFetcher();
      const fresh = await lookup(store, fetcher, item, new Date(NOW.getTime() + DAY));
      expect(fresh.from).toBe("index");
      expect(fresh.listings.coverageComplete).toBe(false);
      const stale = await lookup(store, fetcher, item, new Date(NOW.getTime() + (INDEX_TTL_DAYS + 1) * DAY));
      expect(stale.from).toBe("stale-index");
      expect(stale.listings.coverageComplete).toBe(false);
    });

    it("refuses a live fetch past the daily budget", async () => {
      const store = await makeStore();
      await store.recordSpend(DAILY_BUDGET_USD, "earlier lookups");
      const { fetcher, calls } = fakeFetcher();
      await expect(lookup(store, fetcher, item, new Date())).rejects.toBeInstanceOf(BudgetExceededError);
      expect(calls).toHaveLength(0);
    });

    it("a near-empty refresh does not overwrite good data", async () => {
      const store = await makeStore();
      await refresh(store, fakeFetcher(10).fetcher, "Patagonia Synchilla mens L", NOW);
      await refresh(store, fakeFetcher(0).fetcher, "Patagonia Synchilla mens L", new Date(NOW.getTime() + DAY));
      const entry = await store.get("patagonia synchilla mens l");
      expect(entry?.listings.sold).toHaveLength(10);
    });
  });
}

suite("memory", async () => new MemoryStore());

// Runs only when a disposable test database is provided.
const pgUrl = process.env.TEST_DATABASE_URL;
if (pgUrl) {
  const stores: PostgresStore[] = [];
  suite("postgres", async () => {
    const s = new PostgresStore(pgUrl);
    stores.push(s);
    await s.resetForTests();
    return s;
  });
  afterAll(async () => {
    await Promise.all(stores.map((x) => x.close()));
  });
}
