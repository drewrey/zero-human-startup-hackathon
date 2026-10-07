import type { Gender } from "./types";

/** Shared parsing for spoken descriptions and marketplace listing titles. */

const SIZE =
  /(?<![\w'’/])(xxs|xs|s|sm|m|med|l|lg|xl|xxl|2xl|xxxl|3xl|small|medium|large|x-large|extra large|xx-large|\d{2}x\d{2}|size \d{1,2})(?![\w'’])/i;

const SIZE_NORMAL: Record<string, string> = {
  sm: "S",
  small: "S",
  med: "M",
  medium: "M",
  lg: "L",
  large: "L",
  "x-large": "XL",
  "extra large": "XL",
  "2xl": "XXL",
  "xx-large": "XXL",
  "3xl": "XXXL",
};

export function parseSize(text: string): string | null {
  const m = text.match(SIZE);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  if (raw.startsWith("size ")) return raw.slice(5);
  return SIZE_NORMAL[raw] ?? raw.toUpperCase();
}

export function parseGender(text: string): Gender | null {
  if (/\bwomen'?’?s?\b|\bladies\b|\bwomens\b/i.test(text)) return "women";
  if (/\bmen'?’?s?\b|\bmens\b/i.test(text)) return "men";
  if (/\bkids?\b|\byouth\b|\bboys?\b|\bgirls?\b/i.test(text)) return "kids";
  if (/\bunisex\b/i.test(text)) return "unisex";
  return null;
}
