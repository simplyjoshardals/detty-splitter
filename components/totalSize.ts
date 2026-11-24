/** Type tokens the receipt's per-person total may use (DESIGN §3). */
export type TotalSizeToken = "--t-2xl" | "--t-xl" | "--t-lg";

/**
 * The per-person total is 40px (`--t-2xl`) while it fits one line, 28px (`--t-xl`) from 11
 * characters and 20px (`--t-lg`) from 16. Space Mono is about 0.61em wide. The receipt has 12px
 * of paper padding on each side, so at 320px its text box is 264px: 10 characters at 40px are
 * about 244px (11 would be 269px), 15 at 28px about 256px (16 would be 273px), and the longest
 * amount (`$4,995,000,000.00`, or `₦249,750,000,000` with every price at its maximum) is about
 * 207px at 20px. Counted in characters, not UTF-16 units, so "₦" counts as one.
 * (Moved from `ResultsPanel` in T6.3 when the totals moved into the receipt; the steps shrank
 * by one character because the receipt box is 24px narrower than the old results column.)
 */
export function totalSizeToken(text: string): TotalSizeToken {
  const length = [...text].length;
  if (length <= 10) return "--t-2xl";
  return length <= 15 ? "--t-xl" : "--t-lg";
}
