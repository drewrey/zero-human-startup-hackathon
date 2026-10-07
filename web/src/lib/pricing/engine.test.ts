import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../config";
import type { Comp, ItemAttributes, Platform, PlatformListings, Settings } from "../types";
import {
  decideVerdict,
  estimateDaysToSell,
  maxBuyPrice,
  priceCheck,
  recommendPlatform,
  selectComps,
} from "./engine";

const NOW = new Date("2026-10-07T12:00:00Z");

const item = (over: Partial<ItemAttributes> = {}): ItemAttributes => ({
  brand: "Patagonia",
  type: "fleece pullover",
  variant: "Synchilla Snap-T",
  size: "L",
  gender: "men",
  condition: "good",
  flaws: null,
  era: null,
  tagPrice: 9,
  ...over,
});

const comp = (price: number, over: Partial<Comp> = {}): Comp => ({
  platform: "ebay",
  title: "Patagonia Synchilla Snap-T Fleece Mens L",
  price,
  soldAt: "2026-09-20T00:00:00Z",
  url: "https://example.com",
  size: "L",
  gender: "men",
  ...over,
});

const listings = (platform: Platform, prices: number[], soldLast30d = 20, activeListings = 20): PlatformListings => ({
  platform,
  sold: prices.map((p) => comp(p, { platform })),
  soldLast30d,
  activeListings,
});

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over });

const run = (over: { item?: Partial<ItemAttributes>; settings?: Partial<Settings>; listings?: PlatformListings[] } = {}) =>
  priceCheck({
    item: item(over.item),
    assumptions: [],
    listings: over.listings ?? [listings("ebay", [40, 42, 45, 45, 48, 50, 52])],
    settings: settings(over.settings),
    now: NOW,
    dataSource: "demo",
    understoodBy: "heuristic",
  });

describe("BR-4 / BR-5 verdict", () => {
  it("BR-4: never BUY when net profit is <= 0, even with min profit 0", () => {
    expect(decideVerdict(0, 5, settings({ minProfit: 0 }))).toBe("PASS");
    expect(decideVerdict(-3, 5, settings({ minProfit: 0 }))).toBe("PASS");
  });

  it("BR-5: BUY when profit and speed both pass", () => {
    expect(decideVerdict(20, 10, settings())).toBe("BUY");
  });

  it("BR-5: MAYBE when exactly one threshold fails", () => {
    expect(decideVerdict(5, 10, settings())).toBe("MAYBE");
    expect(decideVerdict(20, 90, settings())).toBe("MAYBE");
  });

  it("BR-5: PASS when both thresholds fail", () => {
    expect(decideVerdict(5, 90, settings())).toBe("PASS");
  });

  it("BR-5: changing min profit in settings changes the verdict", () => {
    expect(run({ settings: { minProfit: 10 } }).verdict).toBe("BUY");
    expect(run({ settings: { minProfit: 100 } }).verdict).toBe("MAYBE");
  });

  it("BR-5: fewer than 3 matched comps is NOT_ENOUGH_DATA", () => {
    const r = run({ listings: [listings("ebay", [40, 45])] });
    expect(r.verdict).toBe("NOT_ENOUGH_DATA");
    expect(r.recommendedPlatform).toBeNull();
  });
});

describe("BR-2 net profit", () => {
  it("subtracts fees, shipping, and tag price with sales tax", () => {
    const r = run({ settings: { salesTaxRate: 0.1 }, item: { tagPrice: 10 } });
    const ebay = r.platforms[0];
    expect(ebay.netProfit).toBeCloseTo(ebay.median - ebay.fees - ebay.shipping - 11, 2);
  });
});

describe("BR-7 missing tag price", () => {
  it("returns a max buy price instead of BUY/PASS", () => {
    const r = run({ item: { tagPrice: null } });
    expect(r.verdict).toBe("BUY_UNDER");
    expect(r.maxBuyPrice).not.toBeNull();
    expect(r.spoken).toContain(`Worth it under $${r.maxBuyPrice}`);
  });

  it("the max buy price, used as the tag price, still yields BUY", () => {
    const max = run({ item: { tagPrice: null } }).maxBuyPrice!;
    expect(run({ item: { tagPrice: max } }).verdict).toBe("BUY");
    expect(run({ item: { tagPrice: max + 1 } }).verdict).not.toBe("BUY");
  });

  it("returns null when no price clears min profit", () => {
    expect(maxBuyPrice(8, settings({ minProfit: 10 }))).toBeNull();
  });
});

describe("BR-8 home-platform preference", () => {
  const ebay = { platform: "ebay", compsUsed: 10, netProfit: 30 } as never;
  const depopSlightlyBetter = { platform: "depop", compsUsed: 10, netProfit: 33 } as never;
  const depopMuchBetter = { platform: "depop", compsUsed: 10, netProfit: 40 } as never;

  it("keeps home when the other platform is within the bias", () => {
    expect(recommendPlatform([ebay, depopSlightlyBetter], settings({ homePlatform: "ebay" }))?.platform).toBe("ebay");
  });

  it("switches when another platform clearly wins", () => {
    expect(recommendPlatform([ebay, depopMuchBetter], settings({ homePlatform: "ebay" }))?.platform).toBe("depop");
  });
});

describe("BR-10 sell speed", () => {
  it("estimates days from sell-through and clamps", () => {
    expect(estimateDaysToSell(30, 30)).toBe(30);
    expect(estimateDaysToSell(60, 20)).toBe(10);
    expect(estimateDaysToSell(0, 50)).toBe(180);
    expect(estimateDaysToSell(1000, 1)).toBe(1);
  });
});

describe("BR-11 / BR-12 comp selection", () => {
  it("excludes lots, wrong size, wrong brand, stale sales, and outliers", () => {
    const { comps, excluded } = selectComps(
      item(),
      [
        comp(40),
        comp(42),
        comp(45),
        comp(46),
        comp(48),
        comp(400),
        comp(30, { title: "Lot of 3 Patagonia fleeces" }),
        comp(44, { size: "S" }),
        comp(44, { title: "North Face Denali Fleece" }),
        comp(44, { soldAt: "2026-01-01T00:00:00Z" }),
      ],
      NOW,
    );
    expect(comps.map((c) => c.price)).toEqual([40, 42, 45, 46, 48]);
    expect(excluded.map((e) => e.reason)).toEqual([
      "Lot or bundle",
      "Size S",
      "Different brand",
      "Sold more than 90 days ago",
      "Unusually high price",
    ]);
  });
});

describe("BR-13 / BR-14 / BR-15 output", () => {
  it("BR-13: 3-5 comps on the recommended platform is low confidence", () => {
    const r = run({ listings: [listings("ebay", [40, 45, 50])] });
    expect(r.confidence).toBe("low");
    expect(r.spoken.startsWith("Low confidence.")).toBe(true);
  });

  it("BR-14: spoken answer is at most 20 words and matches card numbers", () => {
    const r = run();
    expect(r.spoken.split(/\s+/).length).toBeLessThanOrEqual(20);
    const rec = r.platforms.find((p) => p.platform === r.recommendedPlatform)!;
    expect(r.spoken).toContain(`$${Math.round(rec.netProfit)}`);
    expect(r.spoken).toContain(`${rec.estDaysToSell} days`);
  });

  it("BR-14: losing items say how much you'd lose", () => {
    const r = run({ item: { tagPrice: 60 } });
    expect(r.verdict).toBe("PASS");
    expect(r.spoken).toMatch(/^Pass\. You'd lose about \$\d+ on eBay\.$/);
  });
});
