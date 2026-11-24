/**
 * Receipt view model (DATA_MODEL.md §6, T7.1). Pure functions, no React.
 *
 * The receipt, on screen and on the canvas, takes this display-ready object and never touches
 * raw state or rates, so it cannot disagree with the rest of the page. Every amount is
 * formatted here with the same `calculate` and `formatAmount` the page uses.
 */
import { DEFAULT_RATES, RATES_AS_OF, SITE_URL } from "@/config";
import { BUCKETS } from "@/data/buckets";
import { TIERS, type Tier } from "@/data/tiers";
import { calculate } from "@/lib/calc";
import { formatAmount } from "@/lib/money";
import { formatAsOfDate, ratesAreCustom } from "@/lib/rates";
import type { AppState, Bucket, CurrencyCode, Rates } from "@/lib/types";

export interface ReceiptLine {
  label: string;
  /** Price x quantity (and the split when shared), always in naira: `₦150,000 × 7 ÷ 4`. */
  formula: string;
  /** Your share, in the display currency. */
  yourShare: string;
}

export interface ReceiptView {
  title: string;
  /** Five lines, in the fixed bucket order. */
  lines: ReceiptLine[];
  groupSize: number;
  /** Formatted, the sum of the displayed lines. */
  perPersonTotal: string;
  groupTotal: string;
  currency: CurrencyCode;
  /** "Rates as of 23 Nov 2026", or "Custom rates" once either rate is edited. */
  ratesNote: string;
  badge: string;
  tagline: string;
  /** From the tier ("AVAIL BAL: ..."). */
  balanceLine: string;
  /** Decoration only (DESIGN §7.2). */
  authCode: string;
  siteUrl: string;
}

/**
 * Fixed receipt text (DESIGN §7). Not part of `ReceiptView` because it never changes: the screen
 * and the canvas both read it from here, so the copy lives in one place. Fictional and generic on
 * purpose: no real bank, brand or format.
 */
export const RECEIPT_COPY = {
  posHeader: [
    "*** DEBIT ALERT ***",
    "MERCHANT: DETTY DEC, LAGOS",
    "TXN: DAMAGE CALCULATION",
    "CARD: **** SAPA",
  ],
  status: "STATUS: APPROVED",
  customerCopy: "CUSTOMER COPY. KEEP YOUR RECEIPT. YOUR ACCOUNT WON'T.",
} as const;

export const RECEIPT_TITLE = "Detty December 2026";

/**
 * A short code that is the same for the same receipt (DESIGN §7.2): 32-bit FNV-1a of
 * `tier:perPersonMinor:currency`, as 8 upper-case hex characters. It is decoration, not a
 * transaction identifier, and it is not secret or secure.
 */
export function authCode(tierId: number, perPersonMinor: number, currency: CurrencyCode): string {
  const text = `${tierId}:${perPersonMinor}:${currency}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).toUpperCase().padStart(8, "0");
}

/** `₦150,000 × 7 ÷ 4` when shared, `₦100,000 × 3` when each person pays the whole line. */
function describeFormula(bucket: Bucket): string {
  const base = `${formatAmount(bucket.unitPriceNgn, "NGN")} × ${bucket.quantity}`;
  return bucket.mode === "shared" ? `${base} ÷ ${bucket.headcount}` : base;
}

/** What the builder reads besides the state. Defaults are the real data; tests pass their own. */
export interface ReceiptOptions {
  tiers: readonly Tier[];
  defaultRates: Rates;
  /** ISO date (YYYY-MM-DD) the default rates were read. */
  ratesAsOf: string;
  siteUrl: string;
}

const DEFAULT_OPTIONS: ReceiptOptions = {
  tiers: TIERS,
  defaultRates: DEFAULT_RATES,
  ratesAsOf: RATES_AS_OF,
  siteUrl: SITE_URL,
};

export function buildReceiptView(state: AppState, options: Partial<ReceiptOptions> = {}): ReceiptView {
  const { tiers, defaultRates, ratesAsOf, siteUrl } = { ...DEFAULT_OPTIONS, ...options };
  const { currency, groupSize, rates } = state;
  const result = calculate(state, tiers);

  const lines = state.buckets.map((bucket, i): ReceiptLine => {
    const line = result.lines[i];
    if (line === undefined) throw new RangeError("calculate returned fewer lines than buckets");
    return {
      label: BUCKETS[bucket.id].label,
      formula: describeFormula(bucket),
      yourShare: formatAmount(line.shareMinor, currency),
    };
  });

  return {
    title: RECEIPT_TITLE,
    lines,
    groupSize,
    perPersonTotal: formatAmount(result.perPersonMinor, currency),
    groupTotal: formatAmount(result.groupTotalMinor, currency),
    currency,
    ratesNote: ratesAreCustom(rates, defaultRates)
      ? "Custom rates"
      : `Rates as of ${formatAsOfDate(ratesAsOf)}`,
    badge: result.tier.badge,
    tagline: result.tier.tagline,
    balanceLine: result.tier.balanceLine,
    authCode: authCode(result.tier.id, result.perPersonMinor, currency),
    siteUrl,
  };
}
