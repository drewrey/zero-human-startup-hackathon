"use client";

import { DEFAULT_SETTINGS } from "./config";
import type { Platform, Settings, Verdict } from "./types";

export interface HaulItem {
  id: string;
  name: string;
  tagPrice: number | null;
  purchaseCost: number | null;
  netProfit: number;
  platform: Platform | null;
  verdict: Verdict;
  savedAt: string;
}

const SETTINGS_KEY = "sourcer.settings.v1";
const HAUL_KEY = "sourcer.haul.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage blocked: the app still works for this session.
  }
}

export const loadSettings = (): Settings => ({ ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(SETTINGS_KEY, {}) });
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s);

/** Today's haul only: items saved before local midnight are dropped. */
export function loadHaul(): HaulItem[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return read<HaulItem[]>(HAUL_KEY, []).filter((i) => Date.parse(i.savedAt) >= start.getTime());
}
export const saveHaul = (items: HaulItem[]) => write(HAUL_KEY, items);
