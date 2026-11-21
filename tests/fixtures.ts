import type { AppState, Bucket, BucketId, Mode } from "@/lib/types";

export interface TestTier {
  id: 1 | 2 | 3 | 4 | 5;
  minPerPersonNgn: number;
}

/** Placeholder bounds from DATA_MODEL.md §3.2. The real tiers arrive in T3.2. */
export const TEST_TIERS: readonly TestTier[] = [
  { id: 1, minPerPersonNgn: 0 },
  { id: 2, minPerPersonNgn: 300000 },
  { id: 3, minPerPersonNgn: 750000 },
  { id: 4, minPerPersonNgn: 1500000 },
  { id: 5, minPerPersonNgn: 3000000 },
];

export function makeBucket(
  id: BucketId,
  unitPriceNgn: number,
  quantity: number,
  mode: Mode,
  headcount: number,
): Bucket {
  return { id, unitPriceNgn, quantity, mode, headcount };
}

/**
 * The worked example from DATA_MODEL.md §2.5. Illustrative numbers only: not real
 * Lagos prices. The USD rate is the doc's example (₦1,500); the GBP rate is made up
 * for these tests and is not a real rate.
 */
export const GOLDEN: AppState = {
  presetId: "soft",
  currency: "NGN",
  groupSize: 4,
  rates: { ngnPerUsd: 1500, ngnPerGbp: 2000 },
  buckets: [
    makeBucket("stay", 150000, 7, "shared", 4),
    makeBucket("events", 100000, 3, "perPerson", 4),
    makeBucket("tables", 800000, 2, "shared", 4),
    makeBucket("transport", 60000, 7, "shared", 4),
    makeBucket("food", 40000, 7, "perPerson", 4),
  ],
};

/** Applies fn to each bucket and keeps the fixed five-bucket tuple type. */
export function mapBuckets(state: AppState, fn: (bucket: Bucket) => Bucket): AppState {
  const [a, b, c, d, e] = state.buckets;
  return { ...state, buckets: [fn(a), fn(b), fn(c), fn(d), fn(e)] };
}

/** Only the events bucket costs anything: one per-person unit at the given price. */
export function eventsOnly(price: number): AppState {
  return mapBuckets(GOLDEN, (b) =>
    b.id === "events" ? { ...b, unitPriceNgn: price, quantity: 1 } : { ...b, quantity: 0 },
  );
}

/** Freezes a value and everything inside it, so any mutation throws in strict mode. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach((inner: unknown) => deepFreeze(inner));
    Object.freeze(value);
  }
  return value;
}
