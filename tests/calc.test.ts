import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/calc";
import { formatAmount } from "@/lib/money";
import type { AppState, CurrencyCode } from "@/lib/types";
import { GOLDEN, TEST_TIERS, deepFreeze, eventsOnly, makeBucket, mapBuckets } from "./fixtures";

function inCurrency(state: AppState, currency: CurrencyCode): AppState {
  return { ...state, currency };
}

describe("golden example (DATA_MODEL §2.5)", () => {
  it("matches in naira", () => {
    const result = calculate(GOLDEN, TEST_TIERS);
    expect(result.lines.map((l) => l.lineTotalNgn)).toEqual([
      1050000, 300000, 1600000, 420000, 280000,
    ]);
    expect(result.lines.map((l) => l.shareMinor)).toEqual([262500, 300000, 400000, 105000, 280000]);
    expect(result.perPersonMinor).toBe(1347500);
    expect(result.groupTotalMinor).toBe(5390000);
    expect(result.tier.id).toBe(3);
    expect(formatAmount(result.perPersonMinor, "NGN")).toBe("₦1,347,500");
    expect(formatAmount(result.groupTotalMinor, "NGN")).toBe("₦5,390,000");
  });

  it("matches in dollars: lines sum to $898.34, group $3,593.36", () => {
    const result = calculate(inCurrency(GOLDEN, "USD"), TEST_TIERS);
    expect(result.lines.map((l) => formatAmount(l.shareMinor, "USD"))).toEqual([
      "$175.00",
      "$200.00",
      "$266.67",
      "$70.00",
      "$186.67",
    ]);
    expect(formatAmount(result.perPersonMinor, "USD")).toBe("$898.34");
    expect(formatAmount(result.groupTotalMinor, "USD")).toBe("$3,593.36");
    expect(result.tier.id).toBe(3);
  });

  it("always shows a per-person total equal to the sum of the displayed lines", () => {
    for (const currency of ["NGN", "USD", "GBP"] as const) {
      const result = calculate(inCurrency(GOLDEN, currency), TEST_TIERS);
      const sum = result.lines.reduce((total, l) => total + l.shareMinor, 0);
      expect(result.perPersonMinor).toBe(sum);
      expect(result.groupTotalMinor).toBe(sum * GOLDEN.groupSize);
    }
  });
});

const BOUNDARY_CASES: ReadonlyArray<[number, number]> = [
  [0, 1],
  [299999, 1],
  [300000, 2],
  [749999, 2],
  [750000, 3],
  [1499999, 3],
  [1500000, 4],
  [2999999, 4],
  [3000000, 5],
];

describe("tiers", () => {
  it("puts an all-zero scenario in Tier 1", () => {
    const zero = mapBuckets(GOLDEN, (b) => ({ ...b, quantity: 0 }));
    const result = calculate(zero, TEST_TIERS);
    expect(result.perPersonMinor).toBe(0);
    expect(result.groupTotalMinor).toBe(0);
    expect(result.tier.id).toBe(1);
  });

  it.each(BOUNDARY_CASES)(
    "per-person ₦%s selects Tier %s (lower bound inclusive)",
    (price, tierId) => {
      expect(calculate(eventsOnly(price), TEST_TIERS).tier.id).toBe(tierId);
    },
  );

  it("never changes tier when the currency changes", () => {
    for (const price of [299999, 300000, 750000, 1499999, 3000000]) {
      const state = eventsOnly(price);
      const ids = (["NGN", "USD", "GBP"] as const).map(
        (currency) => calculate(inCurrency(state, currency), TEST_TIERS).tier.id,
      );
      expect(new Set(ids).size).toBe(1);
    }
  });

  it("uses the exact total, not the rounded one", () => {
    // 100,000/3 + 200,000/3 + 200,000 is exactly 300,000 -> Tier 2,
    // although the displayed lines round up and add to ₦300,001.
    const exactly300k: AppState = {
      ...GOLDEN,
      buckets: [
        makeBucket("stay", 100000, 1, "shared", 3),
        makeBucket("events", 200000, 1, "perPerson", 1),
        makeBucket("tables", 200000, 1, "shared", 3),
        makeBucket("transport", 0, 0, "shared", 1),
        makeBucket("food", 0, 0, "perPerson", 1),
      ],
    };
    const exact = calculate(exactly300k, TEST_TIERS);
    expect(exact.tier.id).toBe(2);
    expect(exact.perPersonMinor).toBe(300001);

    // One naira-third less is 299,999.67 exactly -> Tier 1.
    const justBelow: AppState = {
      ...exactly300k,
      buckets: [
        makeBucket("stay", 100000, 1, "shared", 3),
        makeBucket("events", 200000, 1, "perPerson", 1),
        makeBucket("tables", 199999, 1, "shared", 3),
        makeBucket("transport", 0, 0, "shared", 1),
        makeBucket("food", 0, 0, "perPerson", 1),
      ],
    };
    expect(calculate(justBelow, TEST_TIERS).tier.id).toBe(1);
  });

  it("throws if the tiers have none that the total qualifies for", () => {
    const zero = mapBuckets(GOLDEN, (b) => ({ ...b, quantity: 0 }));
    expect(() => calculate(zero, [{ id: 2, minPerPersonNgn: 300000 }])).toThrow(RangeError);
  });
});

describe("headcount and group size", () => {
  it("makes your share equal the line total when headcount is 1", () => {
    const solo = mapBuckets(GOLDEN, (b) => ({ ...b, headcount: 1 }));
    const result = calculate(solo, TEST_TIERS);
    expect(result.lines.map((l) => l.shareMinor)).toEqual(result.lines.map((l) => l.lineTotalNgn));
    expect(result.perPersonMinor).toBe(3650000);
    expect(result.tier.id).toBe(5);
  });

  it("ignores headcount for per-person buckets", () => {
    const changed = mapBuckets(GOLDEN, (b) =>
      b.mode === "perPerson" ? { ...b, headcount: 37 } : b,
    );
    expect(calculate(changed, TEST_TIERS).perPersonMinor).toBe(1347500);
  });
});

describe("currency switching", () => {
  it("leaves the naira inputs and results untouched after NGN -> USD -> GBP -> NGN", () => {
    const original = structuredClone(GOLDEN);
    const frozen = deepFreeze(structuredClone(GOLDEN)); // any mutation would throw
    const first = calculate(frozen, TEST_TIERS);
    calculate(inCurrency(frozen, "USD"), TEST_TIERS);
    calculate(inCurrency(frozen, "GBP"), TEST_TIERS);
    const last = calculate(inCurrency(frozen, "NGN"), TEST_TIERS);
    expect(last).toEqual(first);
    expect(frozen).toEqual(original);
  });
});

describe("largest values", () => {
  const maxBucket = (id: "stay" | "events" | "tables" | "transport" | "food") =>
    makeBucket(id, 50000000, 999, "shared", 1);

  const max: AppState = {
    presetId: "baller",
    currency: "USD",
    groupSize: 100,
    rates: { ngnPerUsd: 50, ngnPerGbp: 50 },
    buckets: [
      maxBucket("stay"),
      maxBucket("events"),
      maxBucket("tables"),
      maxBucket("transport"),
      maxBucket("food"),
    ],
  };

  it("stays exact in USD at the minimum rate", () => {
    const result = calculate(max, TEST_TIERS);
    expect(result.perPersonMinor).toBe(499500000000);
    expect(result.groupTotalMinor).toBe(49950000000000);
    expect(result.tier.id).toBe(5);
    expect(formatAmount(result.perPersonMinor, "USD")).toBe("$4,995,000,000.00");
  });

  it("stays exact in naira", () => {
    const result = calculate(inCurrency(max, "NGN"), TEST_TIERS);
    expect(result.perPersonMinor).toBe(249750000000);
    expect(result.groupTotalMinor).toBe(24975000000000);
  });

  it("selects a tier without error for awkward headcounts", () => {
    const [a, b, c, d, e] = max.buckets;
    const mixed: AppState = {
      ...max,
      buckets: [
        { ...a, headcount: 97 },
        { ...b, headcount: 89 },
        { ...c, headcount: 83 },
        { ...d, headcount: 79 },
        { ...e, headcount: 73 },
      ],
    };
    expect(calculate(mixed, TEST_TIERS).tier.id).toBe(5);
  });
});
