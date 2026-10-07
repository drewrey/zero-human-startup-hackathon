/** Quantile with linear interpolation on a sorted copy. */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export const median = (values: number[]) => quantile(values, 0.5);

/** BR-12: Tukey fences. Returns the bounds outside which a value is an outlier. */
export function iqrBounds(values: number[]): { low: number; high: number } {
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  return { low: q1 - 1.5 * iqr, high: q3 + 1.5 * iqr };
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
