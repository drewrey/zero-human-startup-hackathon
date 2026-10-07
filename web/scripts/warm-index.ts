/**
 * Batch jobs for the price index (agents/pricing-data.md → "Batch jobs").
 *
 *   npm run index:warm                  dry run: list what would be fetched and the estimated cost
 *   npm run index:warm -- --run         pre-warm seed segments that are missing or stale
 *   npm run index:warm -- --run --refresh-stale   also refresh every stale entry already in the index
 *   --max-usd 4                         spending ceiling for this run (default $4)
 *
 * Uses DATABASE_URL (InstaCloud Postgres) and APIFY_TOKEN from the environment.
 */
import seeds from "../data/seed-segments.json";
import { ebayFetcher, ebayQuery } from "../src/lib/comps/ebay";
import { BudgetExceededError, INDEX_TTL_DAYS, refresh } from "../src/lib/comps/price-index";
import { getStore, PostgresStore } from "../src/lib/comps/store";
import type { ItemAttributes } from "../src/lib/types";

const args = process.argv.slice(2);
const run = args.includes("--run");
const refreshStale = args.includes("--refresh-stale");
const maxUsd = Number(args[args.indexOf("--max-usd") + 1]) || 4;

async function main() {
  const store = getStore();
  if (run && !(store instanceof PostgresStore)) {
    console.warn("DATABASE_URL is not set: results would be lost when this process exits. Aborting.");
    process.exit(1);
  }
  const now = new Date();
  const staleBefore = now.getTime() - INDEX_TTL_DAYS * 86_400_000;

  const queries = new Set<string>();
  for (const s of seeds.segments) {
    for (const size of s.sizes) {
      const item: ItemAttributes = {
        brand: s.brand, type: s.type, variant: s.variant, size, gender: s.gender as ItemAttributes["gender"],
        condition: null, flaws: null, era: null, tagPrice: null,
      };
      queries.add(ebayQuery(item));
    }
  }
  if (refreshStale) for (const e of await store.list(500)) queries.add(e.query);

  const todo: string[] = [];
  for (const q of queries) {
    const e = await store.get(q.toLowerCase());
    if (!e || Date.parse(e.fetchedAt) < staleBefore) todo.push(q);
  }

  const estimate = todo.length * ebayFetcher.estimateCostUsd(null);
  console.log(`${queries.size} segments, ${todo.length} missing or stale. Estimated cost ≤ $${estimate.toFixed(2)} (cap $${maxUsd}).`);
  todo.forEach((q) => console.log(`  - ${q}`));
  if (!run) {
    console.log("Dry run. Add --run to fetch.");
    return;
  }

  // Budget for this run = what's already been spent today + this run's cap.
  const spentToday = await store.spentSince(new Date(new Date(now).setUTCHours(0, 0, 0, 0)));
  let done = 0;
  for (const q of todo) {
    try {
      const e = await refresh(store, ebayFetcher, q, new Date(), spentToday + maxUsd);
      done++;
      console.log(`✓ ${q}: ${e.listings.sold.length} sold listings ($${e.costUsd.toFixed(2)})`);
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        console.log(`Stopped: ${err.message}`);
        break;
      }
      console.log(`✗ ${q}: ${(err as Error).message}`);
    }
  }
  console.log(`Fetched ${done}/${todo.length}.`);
  if (store instanceof PostgresStore) await store.close();
}

main();
