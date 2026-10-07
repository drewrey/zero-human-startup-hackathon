import { describe, expect, it } from "vitest";
import rows from "./fixtures/ebay-sold.json";
import { sellSpeed } from "../pricing/engine";
import { DEFAULT_SETTINGS } from "../config";
import { ebayQuery, toPlatformListings } from "./ebay";

describe("eBay comps mapping", () => {
  const listings = toPlatformListings(rows as never);

  it("maps sold listings with price, date, size, and gender from the title", () => {
    expect(listings.sold).toHaveLength(8);
    const first = listings.sold[0];
    expect(first.price).toBe(249.99);
    expect(first.soldAt?.startsWith("2026-10-07")).toBe(true);
    expect(first.size).toBe("XXL");
    expect(first.gender).toBe("men");
  });

  it("uses the summary row for BR-10 sell-speed inputs", () => {
    expect(listings.activeListings).toBe(3048);
    expect(listings.soldLast30d).toBe(687);
  });

  it("BR-10: keyword-level, capped, 90-day-averaged summary yields Speed unknown, never a rate", () => {
    expect(listings.coverageComplete).toBe(false);
    const s = sellSpeed(listings, DEFAULT_SETTINGS);
    expect(s.signal).toBe("unknown");
    expect(s.sellThrough).toBeNull();
    expect(s.soldLast30d).toBeNull();
  });

  it("builds a search query from brand, model, gender, and size", () => {
    expect(
      ebayQuery({
        brand: "Patagonia", type: "fleece pullover", variant: "Synchilla", size: "L", gender: "men",
        condition: null, flaws: null, era: null, tagPrice: 9,
      }),
    ).toBe("Patagonia Synchilla mens L");
  });
});
