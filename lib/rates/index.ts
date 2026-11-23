/**
 * Exchange-rate helpers (DATA_MODEL.md §2.2, §6). Pure functions, no React.
 */
import type { Rates } from "@/lib/types";

/**
 * True when either rate differs from the defaults. Derived, never stored (DATA_MODEL §6):
 * once a rate is edited the defaults' "as of" date is no longer true, and editing a rate
 * back to its default makes it true again.
 */
export function ratesAreCustom(rates: Rates, defaults: Rates): boolean {
  return rates.ngnPerUsd !== defaults.ngnPerUsd || rates.ngnPerGbp !== defaults.ngnPerGbp;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * "2026-11-23" -> "23 Nov 2026". Hand-written, like `formatAmount`: Intl output varies by
 * engine, locale and time zone, and a server/client difference would break hydration.
 * Throws a RangeError for anything that is not a real calendar date (`config/` is the only
 * caller, and a typo there must fail a test, not show a wrong date).
 */
export function formatAsOfDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  const day = Number(match?.[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    match !== null &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  const name = MONTHS[month - 1];
  if (!isRealDate || name === undefined) {
    throw new RangeError(`"${iso}" is not an ISO date (YYYY-MM-DD)`);
  }
  return `${day} ${name} ${year}`;
}
