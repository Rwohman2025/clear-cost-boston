import type { PriceStats } from "@/lib/models/types";

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo]!, b = sorted[hi]!;
  return a + (b - a) * (pos - lo);
}

export function computeStats(values: number[]): PriceStats | null {
  if (values.length === 0) return null;
  const s: number[] = [...values].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const variance = s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length;
  const first = s[0]!, last = s[s.length - 1]!;
  return {
    count: s.length,
    min: first,
    max: last,
    median: quantile(s, 0.5),
    mean,
    p25: quantile(s, 0.25),
    p75: quantile(s, 0.75),
    spreadRatio: first > 0 ? last / first : NaN,
    cv: mean > 0 ? Math.sqrt(variance) / mean : 0,
  };
}

/** Tukey fences: values beyond 1.5×IQR from the quartiles are outliers. */
export function isOutlier(value: number, stats: PriceStats): boolean {
  const iqr = stats.p75 - stats.p25;
  return value < stats.p25 - 1.5 * iqr || value > stats.p75 + 1.5 * iqr;
}

export const formatUSD = (n: number | null | undefined) =>
  n == null || Number.isNaN(n)
    ? "—"
    : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const formatPct = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n)}%`;
