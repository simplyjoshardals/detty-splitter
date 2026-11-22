/**
 * The muted formula under a bucket's controls (DESIGN §5.4). Pure, so it is tested without React.
 * Like every other amount on the page it is shown in the display currency and converted from
 * the stored naira, so switching currency changes the text and never the data (T5.1).
 */
import { formatAmount, toMinorUnits } from "@/lib/money";
import type { Bucket, CurrencyCode, Rates } from "@/lib/types";

export function describeLine(
  bucket: Bucket,
  lineTotalNgn: number,
  currency: CurrencyCode,
  rates: Rates,
): string {
  if (bucket.mode === "perPerson") return "Each person pays this";
  // Divisor 1: the whole bill in display units. The split is written next to it, not applied.
  const total = formatAmount(toMinorUnits(lineTotalNgn, 1, currency, rates), currency);
  return `${total} total ÷ ${bucket.headcount}`;
}
