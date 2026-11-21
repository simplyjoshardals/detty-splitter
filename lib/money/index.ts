/**
 * Currency conversion and formatting (DATA_MODEL.md §2.4).
 * Pure functions, no React. All math is on integers so rounding never drifts:
 * amounts are whole naira, or cents/pence ("minor units") for USD and GBP.
 */
import type { CurrencyCode, Rates } from "@/lib/types";

/** Decimal places shown per currency. NGN has none (whole naira, no kobo). */
export const MINOR_DIGITS: Record<CurrencyCode, number> = {
  NGN: 0,
  USD: 2,
  GBP: 2,
};

const SYMBOLS: Record<CurrencyCode, string> = {
  NGN: "₦",
  USD: "$",
  GBP: "£",
};

/** n / d rounded up. Both are non-negative safe integers and d >= 1. */
function ceilDiv(n: number, d: number): number {
  const remainder = n % d;
  const quotient = (n - remainder) / d;
  return remainder > 0 ? quotient + 1 : quotient;
}

/** n / d rounded to nearest, halves up. Both are non-negative safe integers and d >= 1. */
function roundDiv(n: number, d: number): number {
  const remainder = n % d;
  const quotient = (n - remainder) / d;
  return 2 * remainder >= d ? quotient + 1 : quotient;
}

/** A rate with at most 2 decimals, as a whole number of hundredths (1500.55 -> 150055). */
export function rateToHundredths(rate: number): number {
  return Math.round(rate * 100);
}

/**
 * Converts the exact naira amount `numeratorNgn / denominator` to display minor units.
 * - NGN: rounded UP to whole naira, so a shared bill is never undercounted.
 * - USD / GBP: rounded to the nearest cent or penny, halves up.
 * Rates are "naira per 1 unit of foreign currency".
 */
export function toMinorUnits(
  numeratorNgn: number,
  denominator: number,
  currency: CurrencyCode,
  rates: Rates,
): number {
  if (currency === "NGN") return ceilDiv(numeratorNgn, denominator);
  const rate = currency === "USD" ? rates.ngnPerUsd : rates.ngnPerGbp;
  // cents = ngn x 100 / rate, and rate = hundredths / 100, so cents = ngn x 10,000 / hundredths.
  return roundDiv(numeratorNgn * 10000, denominator * rateToHundredths(rate));
}

/**
 * Formats minor units for display: "₦1,347,500", "$898.34", "£0.05".
 * Hand-written on purpose: Intl output for ₦ varies by engine and locale, and the
 * canvas receipt must match the screen exactly.
 */
export function formatAmount(minorUnits: number, currency: CurrencyCode): string {
  const digits = MINOR_DIGITS[currency];
  const sign = minorUnits < 0 ? "-" : "";
  const abs = Math.abs(minorUnits);
  const scale = 10 ** digits;
  const whole = Math.floor(abs / scale);
  const fraction = abs - whole * scale;
  const wholeText = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fractionText = digits > 0 ? `.${String(fraction).padStart(digits, "0")}` : "";
  return `${sign}${SYMBOLS[currency]}${wholeText}${fractionText}`;
}
