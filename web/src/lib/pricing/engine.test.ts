import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SPEED_SIGNAL_TEXT } from "../config";
import type { Comp, ItemAttributes, Platform, PlatformListings, Settings } from "../types";
import {
  decideVerdict,
  maxBuyPrice,
  priceCheck,
  recommendPlatform,
  sellSpeed,
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

const listings = (platform: Platform, prices: number[], soldLast30d = 20, activeListings = 20, coverageComplete = true): PlatformListings => ({
  platform,
  sold: prices.map((p) => comp(p, { platform })),
  soldLast30d,
  activeListings,
  coverageComplete,
});

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over });

const LATER = new Date("2026-10-12T12:00:00Z");
const run = (over: { now?: Date; item?: Partial<ItemAttributes>; settings?: Partial<Settings>; listings?: PlatformListings[] } = {}) =>
  priceCheck({
    item: item(over.item),
    assumptions: [],
    listings: over.listings ?? [listings("ebay", [40, 42, 45, 45, 48, 50, 52])],
    settings: settings(over.settings),
    now: over.now ?? NOW,
    dataSource: "demo",
    understoodBy: "heuristic",
  });

describe("BR-4 / BR-5 verdict", () => {
  it("BR-4: never BUY when net profit is <= 0, even with min profit 0", () => {
    expect(decideVerdict(0, "meets_target", settings({ minProfit: 0 }))).toBe("PASS");
    expect(decideVerdict(-3, "meets_target", settings({ minProfit: 0 }))).toBe("PASS");
    expect(decideVerdict(-3, "unknown", settings({ minProfit: 0 }))).toBe("PASS");
  });

  it("BR-5: BUY when profit passes and a known rate meets the target", () => {
    expect(decideVerdict(20, "meets_target", settings(), true)).toBe("BUY");
  });

  it("BR-5: MAYBE when exactly one threshold fails", () => {
    expect(decideVerdict(5, "meets_target", settings())).toBe("MAYBE");
    expect(decideVerdict(20, "below_target", settings())).toBe("MAYBE");
  });

  it("BR-5: PASS when low profit and a known slow rate", () => {
    expect(decideVerdict(5, "below_target", settings())).toBe("PASS");
  });

  it("BR-5: unknown speed with positive profit is MAYBE, never BUY or PASS", () => {
    expect(decideVerdict(20, "unknown", settings())).toBe("MAYBE");
    expect(decideVerdict(5, "unknown", settings())).toBe("MAYBE");
  });

  it("BR-5: changing min profit in settings changes the verdict", () => {
    expect(run({ settings: { minProfit: 10 } }).verdict).toBe("BUY");
    expect(run({ settings: { minProfit: 100 } }).verdict).toBe("MAYBE");
  });

  it("BR-5: changing max days changes the verdict without code changes", () => {
    const l = [listings("ebay", [40, 42, 45, 45, 48, 50, 52], 6, 12)];
    expect(run({ now: LATER, listings: l, settings: { maxDays: 30 } }).verdict).toBe("MAYBE");
    expect(run({ now: LATER, listings: l, settings: { maxDays: 60 } }).verdict).toBe("BUY");
  });

  it("BR-5: fewer than 3 matched comps is NOT_ENOUGH_DATA regardless of speed", () => {
    const r = run({ listings: [listings("ebay", [40, 45])] });
    expect(r.verdict).toBe("NOT_ENOUGH_DATA");
    expect(r.recommendedPlatform).toBeNull();
  });

  it("BR-5: unknown speed on a profitable item is MAYBE end to end", () => {
    const r = run({ now: LATER, listings: [listings("ebay", [40, 42, 45, 45, 48, 50, 52], 20, 20, false)] });
    expect(r.verdict).toBe("MAYBE");
    expect(r.spoken).toContain("Speed unknown");
  });
});

describe("BR-5 Phase 1 conservative verdict", () => {
  const patagonia = () =>
    run({ listings: [listings("ebay", [79.99, 79.99, 79.99], 1, 20, false)], item: { tagPrice: 9 } });

  it("BR-5: Patagonia $79.99 median, $9 tag is BUY at about $57", () => {
    const r = patagonia();
    expect(r.verdict).toBe("BUY");
    expect(r.platforms[0].netProfit).toBeCloseTo(57.26, 2);
    expect(r.spoken).toContain("$57");
  });

  it("BR-5: fees are charged on price + assumed shipping + assumed tax", () => {
    // 79.99 + 10 + 7.999 = 97.989 × 13.6% + 0.40
    expect(patagonia().platforms[0].fees).toBeCloseTo(13.73, 2);
  });

  it("BR-5: speed never changes the verdict before 2026-10-11", () => {
    const slow = run({ listings: [listings("ebay", [79.99, 79.99, 79.99], 3, 100)] });
    const fast = run({ listings: [listings("ebay", [79.99, 79.99, 79.99], 90, 10)] });
    expect(slow.verdict).toBe("BUY");
    expect(fast.verdict).toBe("BUY");
    expect(slow.spoken).toContain("Slower than your target");
  });

  it("BR-5: low positive profit is MAYBE, non-positive is PASS, regardless of speed", () => {
    expect(decideVerdict(5, "below_target", settings(), false)).toBe("MAYBE");
    expect(decideVerdict(5, "meets_target", settings(), false)).toBe("MAYBE");
    expect(decideVerdict(0, "meets_target", settings(), false)).toBe("PASS");
    expect(decideVerdict(10, "unknown", settings(), false)).toBe("BUY");
  });

  it("BR-5: result carries the ESTIMATE label with the assumptions, and no speed claim when unknown", () => {
    const r = patagonia();
    expect(r.assumptions.join(" ")).toMatch(/ESTIMATE.*\$10.*10%/);
    expect(r.spoken).toContain("Speed unknown");
    expect(r.spoken).not.toMatch(/days/);
  });

  it("BR-5: speed gates the verdict again from 2026-10-11", () => {
    const l = [listings("ebay", [79.99, 79.99, 79.99], 3, 100)];
    expect(run({ now: LATER, listings: l }).verdict).toBe("MAYBE");
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
  const L = (sold: number, active: number, complete = true) => listings("ebay", [], sold, active, complete);

  it("uses sold/active against the 30 / max_days threshold", () => {
    expect(sellSpeed(L(12, 12), settings()).signal).toBe("meets_target");
    expect(sellSpeed(L(6, 12), settings()).signal).toBe("below_target");
    expect(sellSpeed(L(6, 12), settings({ maxDays: 60 })).signal).toBe("meets_target");
    expect(sellSpeed(L(6, 12), settings()).sellThrough).toBe(0.5);
  });

  it("does not cap a rate above 100%", () => {
    expect(sellSpeed(L(30, 10), settings()).sellThrough).toBe(3);
  });

  it("is unknown with fewer than 3 sales, zero active, or incomplete coverage", () => {
    for (const l of [L(2, 10), L(10, 0), L(10, 10, false)]) {
      const s = sellSpeed(l, settings());
      expect(s.signal).toBe("unknown");
      expect(s.sellThrough).toBeNull();
    }
    expect(sellSpeed({ ...L(10, 10), coverageComplete: undefined }, settings()).signal).toBe("unknown");
  });

  it("3 sales is enough", () => {
    expect(sellSpeed(L(3, 3), settings()).signal).toBe("meets_target");
  });

  it("BR-7: known slow market says 'Slower market. Worth it under $X'", () => {
    const r = run({ now: LATER, item: { tagPrice: null }, listings: [listings("ebay", [40, 42, 45, 45, 48], 6, 12)] });
    expect(r.verdict).toBe("MAYBE");
    expect(r.spoken).toContain(`Slower market. Worth it under $${r.maxBuyPrice}`);
  });

  it("BR-7: no tag price with unknown speed is MAYBE with a max price", () => {
    const r = run({ now: LATER, item: { tagPrice: null }, listings: [listings("ebay", [40, 42, 45, 45, 48], 1, 5)] });
    expect(r.verdict).toBe("MAYBE");
    expect(r.maxBuyPrice).not.toBeNull();
    expect(r.spoken).toContain("Speed unknown");
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
        comp(44, { title: "Patagonia Synchilla Fleece Vest Mens L" }),
      ],
      NOW,
    );
    expect(comps.map((c) => c.price)).toEqual([40, 42, 45, 46, 48]);
    expect(excluded.map((e) => e.reason)).toEqual([
      "Lot or bundle",
      "Size S",
      "Different brand",
      "Sold more than 90 days ago",
      "Different item (vest)",
      "Unusually high price",
    ]);
  });
});

describe("BR-11 item type", () => {
  it("keeps comps whose title matches the item's own group", () => {
    const pants = item({ type: "fleece pants", variant: null });
    const { comps } = selectComps(pants, [comp(40, { title: "Patagonia Synchilla Pants Mens L" })], NOW);
    expect(comps).toHaveLength(1);
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
    expect(r.spoken).toContain(SPEED_SIGNAL_TEXT[rec.speed.signal]);
  });

  it("BR-14: speech and result never state a per-item days prediction", () => {
    for (const l of [listings("ebay", [40, 42, 45, 45, 48, 50, 52], 6, 12), listings("ebay", [40, 42, 45, 45, 48, 50, 52], 1, 0)]) {
      const r = run({ listings: [l] });
      expect(r.spoken).not.toMatch(/\bdays?\b/i);
      expect(r.reason).not.toMatch(/\bdays?\b/i);
      expect(JSON.stringify(r)).not.toMatch(/estDaysToSell/);
      expect(r.spoken.split(/\s+/).length).toBeLessThanOrEqual(20);
    }
  });

  it("BR-14: losing items say how much you'd lose", () => {
    const r = run({ item: { tagPrice: 60 } });
    expect(r.verdict).toBe("PASS");
    expect(r.spoken).toMatch(/^Pass\. You'd lose about \$\d+ on eBay\.$/);
  });
});
