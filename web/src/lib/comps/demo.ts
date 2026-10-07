import { PLATFORMS, type Comp, type ItemAttributes, type Platform, type PlatformListings } from "../types";

/**
 * DEMO DATA ONLY. Generates plausible, deterministic listings so the app can be exercised
 * before the Apify integration exists. The UI labels every result from here as demo data.
 */

const BRAND_BASE: Record<string, number> = {
  patagonia: 48,
  "the north face": 42,
  arcteryx: 95,
  lululemon: 38,
  levis: 28,
  carhartt: 40,
  "ralph lauren": 26,
  nike: 30,
  adidas: 24,
  "j crew": 16,
  "old navy": 8,
  gap: 10,
  zara: 14,
  "free people": 30,
  madewell: 26,
  "eileen fisher": 34,
  coach: 60,
  "dr martens": 55,
};

const PLATFORM_MULT: Record<Platform, number> = { ebay: 1, poshmark: 1.08, depop: 0.92, mercari: 0.85 };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const brandKey = (b: string) => b.toLowerCase().replace(/[^a-z ]/g, "").trim();

export async function fetchDemoListings(item: ItemAttributes, now: Date): Promise<PlatformListings[]> {
  const key = [item.brand, item.type, item.variant, item.size, item.gender].join("|").toLowerCase();
  const base = (item.brand && BRAND_BASE[brandKey(item.brand)]) || 18;
  const conditionMult =
    item.condition === "new_with_tags" ? 1.35 : item.condition === "fair" ? 0.75 : item.condition === "poor" ? 0.5 : 1;

  return PLATFORMS.map((platform) => {
    const rand = rng(hash(`${key}|${platform}`));
    const center = base * PLATFORM_MULT[platform] * conditionMult;
    const count = 2 + Math.floor(rand() * 14);
    const title = [item.brand, item.variant ?? item.type, item.gender ? `${item.gender}'s` : "", item.size ?? ""]
      .filter(Boolean)
      .join(" ");

    const sold: Comp[] = Array.from({ length: count }, (_, i) => ({
      platform,
      title,
      price: Math.round(center * (0.75 + rand() * 0.5)),
      soldAt: new Date(now.getTime() - Math.floor(rand() * 80) * 86400000).toISOString(),
      url: `https://example.com/demo/${platform}/${i}`,
      size: item.size,
      gender: item.gender,
    }));
    // A couple of realistic contaminants so filtering is visible in the "why?" view.
    if (count > 5) {
      sold.push({ ...sold[0], title: `Lot of 3 ${title}`, price: Math.round(center * 2.2), url: `${sold[0].url}-lot` });
      sold.push({ ...sold[1], price: Math.round(center * 3.5), url: `${sold[1].url}-high` });
    }

    const soldLast30d = Math.max(1, Math.round(count * (0.5 + rand() * 0.5)));
    const activeListings = Math.round(soldLast30d * (0.3 + rand() * 1.7));
    return { platform, sold, soldLast30d, activeListings, coverageComplete: true };
  });
}
