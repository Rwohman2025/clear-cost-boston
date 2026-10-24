import { describe, expect, it } from "vitest";
import { computeStats, isOutlier } from "./stats";

describe("price statistics", () => {
  it("computes min, max, median and spread ratio", () => {
    const s = computeStats([400, 1000, 600, 800, 1200])!;
    expect(s.min).toBe(400);
    expect(s.max).toBe(1200);
    expect(s.median).toBe(800);
    expect(s.spreadRatio).toBe(3);
  });

  it("returns null when there are no prices", () => {
    expect(computeStats([])).toBeNull();
  });

  it("flags values beyond 1.5×IQR as outliers", () => {
    const s = computeStats([500, 520, 540, 560, 580, 3000])!;
    expect(isOutlier(3000, s)).toBe(true);
    expect(isOutlier(540, s)).toBe(false);
  });
});
