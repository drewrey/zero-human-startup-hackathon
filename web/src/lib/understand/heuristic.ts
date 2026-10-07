import { parseGender, parseSize } from "../text";
import type { Condition, ItemAttributes, Turn } from "../types";
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

/** Well-known model names imply the item type, so we don't need to ask for it. */
const MODELS: [RegExp, string, string][] = [
  [/\bsynchilla\b/i, "Synchilla", "fleece pullover"],
  [/\bsnap[\s-]?t\b/i, "Snap-T", "fleece pullover"],
  [/\bbetter sweater\b/i, "Better Sweater", "fleece jacket"],
  [/\bretro[\s-]?x\b/i, "Retro-X", "fleece jacket"],
  [/\bnano puff\b/i, "Nano Puff", "puffer jacket"],
  [/\bdown sweater\b/i, "Down Sweater", "puffer jacket"],
  [/\bbaggies\b/i, "Baggies", "shorts"],
  [/\bnuptse\b/i, "Nuptse", "puffer jacket"],
  [/\bdenali\b/i, "Denali", "fleece jacket"],
  [/\bthermoball\b/i, "ThermoBall", "puffer jacket"],
  [/\b(atom lt|beta ar|alpha sv)\b/i, "$1", "jacket"],
  [/\b50[15]\b/, "$&", "jeans"],
  [/\b(align|wunder under)\b/i, "$1", "leggings"],
  [/\bdefine jacket\b/i, "Define", "jacket"],
  [/\bscuba\b/i, "Scuba", "hoodie"],
  [/\b(detroit|chore) (jacket|coat)\b/i, "$1", "jacket"],
  [/\b(air max|air force 1|dunk|jordan)\b/i, "$1", "sneakers"],
  [/\b1460\b/, "1460", "boots"],
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const TENS = new Set(["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]);

/** Parse a spoken amount of 1-199 ("ninety-nine", "a hundred", "one twenty"); null if not one. */
function parseSpokenNumber(words: string[]): number | null {
  let w = words;
  let base = 0;
  if ((w[0] === "a" || w[0] === "one") && w[1] === "hundred") {
    base = 100;
    w = w.slice(2);
    if (w[0] === "and") w = w.slice(1);
    if (w.length === 0) return 100;
  } else if (w[0] === "one" && w.length >= 2 && TENS.has(w[1])) {
    base = 100; // "one twenty" = 120
    w = w.slice(1);
  }
  let v = 0;
  if (w.length === 1 && w[0] in NUMBER_WORDS) v = NUMBER_WORDS[w[0]];
  else if (w.length === 2 && TENS.has(w[0]) && w[1] in NUMBER_WORDS && NUMBER_WORDS[w[1]] < 10) {
    v = NUMBER_WORDS[w[0]] + NUMBER_WORDS[w[1]];
  } else return null;
  const total = base + v;
  return total >= 1 && total <= 199 ? total : null;
}

function parsePrice(text: string): number | null {
  const digits = text.match(/\$\s?(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:bucks|dollars)/i);
  if (digits) return Number(digits[1] ?? digits[2]);
  const m = text.toLowerCase().match(/((?:[a-z]+[\s-]+){0,4}[a-z]+)[\s-]+(?:bucks|dollars)\b/);
  if (m) {
    const toks = m[1].split(/[\s-]+/);
    for (let i = 0; i < toks.length; i++) {
      const n = parseSpokenNumber(toks.slice(i));
      if (n !== null) return n;
    }
  }
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
  const size = parseSize(text);

  const model = MODELS.map(([re, variant, type]) => {
    const m = text.match(re);
    return m ? { variant: m[0].replace(re, variant), type } : null;
  }).find(Boolean);

  const item: ItemAttributes = {
    brand: BRANDS.find(([re]) => re.test(text))?.[1] ?? null,
    type: TYPES.find((t) => new RegExp(`\\b${t}s?\\b`, "i").test(text)) ?? model?.type ?? null,
    variant: model?.variant ?? null,
    size,
    gender: parseGender(text),
    condition: parseCondition(text),
    flaws: null,
    era: /\bvintage\b|\b[5-9]0s\b/i.test(text) ? "vintage" : null,
    tagPrice: parsePrice(text),
  };

  // Never repeat a question the sourcer has already been asked.
  const asked = conversation.filter((t) => t.role === "assistant").map((t) => t.text).join(" ");
  const missing = [
    !item.brand && "What brand is it?",
    !item.size && "What size?",
    !item.type && "What kind of item?",
  ].filter((q): q is string => Boolean(q) && !asked.includes(q as string));

  const assumptions: string[] = [];
  if (!item.condition) assumptions.push("condition: good");

  return {
    item,
    assumptions,
    followUpQuestion: followUpsAllowed && missing.length > 0 ? missing.slice(0, 2).join(" ") : null,
  };
}
