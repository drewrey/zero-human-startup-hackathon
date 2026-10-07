import { describe, expect, it } from "vitest";
import { FEES, platformFee } from "./config";

describe("BR-3 Mercari fee config", () => {
  const rule = FEES.mercari;

  it("BR-3: Mercari has no fixed-fee placeholder (10% only)", () => {
    expect(rule.percent).toBe(0.1);
    expect(rule.fixed).toBe(0);
    expect(platformFee(rule, 20)).toBeCloseTo(2, 10);
    expect(platformFee(rule, 100)).toBeCloseTo(10, 10);
  });

  it("BR-3: Mercari rule carries source URL and as-of date", () => {
    expect(rule.verified).toBe(true);
    expect(rule.source).toMatch(/mercari\.com\/us\/help_center\/article\/169/);
    expect(rule.asOf).toBe("2026-10-07");
  });
});
