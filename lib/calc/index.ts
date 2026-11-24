/**
 * Calculation core (DATA_MODEL.md §2.4, §3.2). Pure functions, no React.
 * Inputs are assumed valid (integers within DATA_MODEL §2.2 ranges): the reducer
 * clamps them and the share-link decoder validates them before they get here.
 */
import { toMinorUnits } from "@/lib/money";
import type {
  AppState,
  Bucket,
  BucketId,
  CurrencyCode,
  Rates,
} from "@/lib/types";

/** The only tier field the math needs. The full Tier (badge, tagline) lives in data/. */
export interface TierBand {
  minPerPersonNgn: number;
}

export interface LineResult {
  id: BucketId;
  /** unitPriceNgn x quantity, whole naira. */
  lineTotalNgn: number;
  /** Your share in display minor units (naira, cents or pence), already rounded. */
  shareMinor: number;
}

export interface CalcResult<T extends TierBand> {
  lines: LineResult[];
  /** Sum of the displayed lines, so the receipt always adds up. */
  perPersonMinor: number;
  /** perPersonMinor x groupSize. */
  groupTotalMinor: number;
  /** Chosen from the exact naira total, so it never depends on the currency. */
  tier: T;
}

export type CalcInput = Pick<
  AppState,
  "buckets" | "groupSize" | "currency" | "rates"
>;

export function lineTotalNgn(bucket: Bucket): number {
  return bucket.unitPriceNgn * bucket.quantity;
}

/** The number of people the line is split between: headcount if shared, otherwise 1. */
function shareDivisor(bucket: Bucket): number {
  return bucket.mode === "shared" ? bucket.headcount : 1;
}

export function calcLine(
  bucket: Bucket,
  currency: CurrencyCode,
  rates: Rates,
): LineResult {
  const total = lineTotalNgn(bucket);
  return {
    id: bucket.id,
    lineTotalNgn: total,
    shareMinor: toMinorUnits(total, shareDivisor(bucket), currency, rates),
  };
}

/**
 * The highest tier whose minPerPersonNgn <= the EXACT per-person naira total.
 * The total is a sum of fractions (lineTotal / divisor). Floating point can land a hair
 * below a threshold that the exact total meets (e.g. 100,000/3 + 200,000/3 + 200,000
 * is exactly 300,000), so the comparison is done with exact BigInt fractions.
 */
export function selectTier<T extends TierBand>(
  buckets: readonly Bucket[],
  tiers: readonly T[],
): T {
  const terms = buckets.map((b) => ({
    numerator: BigInt(lineTotalNgn(b)),
    divisor: BigInt(shareDivisor(b)),
  }));
  const common = terms.reduce((product, t) => product * t.divisor, BigInt(1));
  const scaledTotal = terms.reduce(
    (sum, t) => sum + t.numerator * (common / t.divisor),
    BigInt(0),
  );

  let selected: T | undefined;
  for (const tier of tiers) {
    const qualifies = BigInt(tier.minPerPersonNgn) * common <= scaledTotal;
    if (
      qualifies &&
      (selected === undefined ||
        tier.minPerPersonNgn > selected.minPerPersonNgn)
    ) {
      selected = tier;
    }
  }
  if (selected === undefined) {
    throw new RangeError("tiers must include one with minPerPersonNgn = 0");
  }
  return selected;
}

export function calculate<T extends TierBand>(
  input: CalcInput,
  tiers: readonly T[],
): CalcResult<T> {
  const lines = input.buckets.map((b) =>
    calcLine(b, input.currency, input.rates),
  );
  const perPersonMinor = lines.reduce((sum, line) => sum + line.shareMinor, 0);
  return {
    lines,
    perPersonMinor,
    groupTotalMinor: perPersonMinor * input.groupSize,
    tier: selectTier(input.buckets, tiers),
  };
}
