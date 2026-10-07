import type { Condition, Gender, ItemAttributes, Turn } from "../types";
import type { Understanding } from "./schema";

/**
 * Keyword fallback used when no Claude credentials are configured, so the app still works
 * end to end in local dev. Deliberately simple.
 */

const BRANDS: [RegExp, string][] = [
  [/\bpatagonia\b/i, "Patagonia"],
  [/\b(the )?north ?face\b/i, "The North Face"],
  [/\barc'?\s?teryx\b/i, "Arc'teryx"],
  [/\blulu(lemon)?\b/i, "Lululemon"],
  [/\blevi'?s?\b/i, "Levi's"],
  [/\bcarhartt\b/i, "Carhartt"],
  [/\b(polo )?ralph lauren\b/i, "Ralph Lauren"],
  [/\bnike\b/i, "Nike"],
  [/\badidas\b/i, "Adidas"],
  [/\bj\.? ?crew\b/i, "J.Crew"],
  [/\bold navy\b/i, "Old Navy"],
  [/\bgap\b/i, "Gap"],
  [/\bzara\b/i, "Zara"],
  [/\bfree people\b/i, "Free People"],
  [/\bmadewell\b/i, "Madewell"],
  [/\beileen fisher\b/i, "Eileen Fisher"],
  [/\bcoach\b/i, "Coach"],
  [/\bdr\.? ?martens?\b|\bdocs\b/i, "Dr. Martens"],
];

const TYPES = [
  "fleece", "jacket", "coat", "vest", "parka", "hoodie", "sweatshirt", "sweater", "cardigan", "jeans",
  "pants", "leggings", "shorts", "skirt", "dress", "shirt", "flannel", "tee", "t-shirt", "polo",
  "blouse", "boots", "sneakers", "shoes", "bag", "purse",
];

const SIZE = /(?<![\w'’])(xxs|xs|s|m|l|xl|xxl|2xl|3xl|small|medium|large|x-large|extra large|\d{2}x\d{2}|size \d{1,2})(?![\w'’])/i;
const SIZE_NORMAL: Record<string, string> = { small: "S", medium: "M", large: "L", "x-large": "XL", "extra large": "XL" };

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
};

function parsePrice(text: string): number | null {
  const digits = text.match(/\$\s?(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:bucks|dollars)/i);
  if (digits) return Number(digits[1] ?? digits[2]);
  const n = Object.keys(NUMBER_WORDS).join("|");
  const words = text.match(new RegExp(`\\b(?:(twenty|thirty|forty|fifty)[\\s-])?(${n})\\s+(?:bucks|dollars)\\b`, "i"));
  if (words) {
    const tens = words[1] ? NUMBER_WORDS[words[1].toLowerCase()] : 0;
    return tens + NUMBER_WORDS[words[2].toLowerCase()];
  }
  return null;
}

function parseGender(text: string): Gender | null {
  if (/\bwomen'?s?\b|\bladies\b/i.test(text)) return "women";
  if (/\bmen'?s?\b/i.test(text)) return "men";
  if (/\bkids?\b|\byouth\b/i.test(text)) return "kids";
  return null;
}

function parseCondition(text: string): Condition | null {
  if (/\bnwt\b|new with tags/i.test(text)) return "new_with_tags";
  if (/\b(excellent|like new|mint)\b/i.test(text)) return "excellent";
  if (/\b(stain|hole|pilling|piling|worn|fade)/i.test(text)) return "fair";
  if (/\bgood\b/i.test(text)) return "good";
  return null;
}

export function understandWithHeuristics(conversation: Turn[], followUpsAllowed: boolean): Understanding {
  const text = conversation.filter((t) => t.role === "sourcer").map((t) => t.text).join(". ");
  const sizeMatch = text.match(SIZE);
  const size = sizeMatch ? (SIZE_NORMAL[sizeMatch[1].toLowerCase()] ?? sizeMatch[1].toUpperCase()) : null;

  const item: ItemAttributes = {
    brand: BRANDS.find(([re]) => re.test(text))?.[1] ?? null,
    type: TYPES.find((t) => new RegExp(`\\b${t}s?\\b`, "i").test(text)) ?? null,
    variant: null,
    size,
    gender: parseGender(text),
    condition: parseCondition(text),
    flaws: null,
    era: /\bvintage\b|\b[5-9]0s\b/i.test(text) ? "vintage" : null,
    tagPrice: parsePrice(text),
  };

  const missing: string[] = [];
  if (!item.brand) missing.push("What brand is it?");
  if (!item.size) missing.push("What size?");
  if (!item.type && missing.length < 2) missing.push("What kind of item?");

  const assumptions: string[] = [];
  if (!item.condition) assumptions.push("condition: good");

  return {
    item,
    assumptions,
    followUpQuestion: followUpsAllowed && missing.length > 0 ? missing.slice(0, 2).join(" ") : null,
  };
}
