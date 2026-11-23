/**
 * Text for the damage meter (DESIGN §5.7, T6.2). Pure, so it is tested without React.
 * The meter shows the per-person total in big digits and announces totals through a hidden
 * live region; the sentence for that region and the digit size live here.
 */
import { formatAmount } from "@/lib/money";
import type { CurrencyCode } from "@/lib/types";

/** Type tokens the meter digits may use (DESIGN §3). */
export type MeterSizeToken = "--t-xl" | "--t-lg";

/**
 * The meter digits are 28px (`--t-xl`) for up to 13 characters and 20px (`--t-lg`) from 14.
 * The digits share the bar with a 44px button and a 12px gap, so at 320px they have
 * 288 - 56 = 232px. Space Mono is about 0.61em wide: 13 characters at 28px are about 223px,
 * 14 would be about 240px; at 20px the longest amount, 17 characters (`$4,995,000,000.00`),
 * is about 208px. Counted in characters, not UTF-16 units, so "₦" counts as one.
 */
export function meterSizeToken(text: string): MeterSizeToken {
  return [...text].length <= 13 ? "--t-xl" : "--t-lg";
}

/**
 * The sentence the live region announces once an edit has settled, for example
 * "Per person ₦1,347,500. Group total ₦5,390,000 for 4 people."
 * Amounts are in the display currency, formatted as on screen, so what is heard matches what
 * is seen. The tier is left out on purpose to keep the announcement short.
 */
export function totalsAnnouncement(
  perPersonMinor: number,
  groupTotalMinor: number,
  groupSize: number,
  currency: CurrencyCode,
): string {
  const perPerson = formatAmount(perPersonMinor, currency);
  const groupTotal = formatAmount(groupTotalMinor, currency);
  const people = `${groupSize} ${groupSize === 1 ? "person" : "people"}`;
  return `Per person ${perPerson}. Group total ${groupTotal} for ${people}.`;
}
