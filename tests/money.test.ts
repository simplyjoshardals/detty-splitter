import { describe, expect, it } from "vitest";
import { formatAmount, rateToHundredths, toMinorUnits } from "@/lib/money";
import type { CurrencyCode } from "@/lib/types";

const RATES = { ngnPerUsd: 1500, ngnPerGbp: 2000 };

const FORMAT_CASES: ReadonlyArray<[number, CurrencyCode, string]> = [
  [1347500, "NGN", "₦1,347,500"],
  [0, "NGN", "₦0"],
  [999, "NGN", "₦999"],
  [1000, "NGN", "₦1,000"],
  [49950000000, "NGN", "₦49,950,000,000"],
  [89834, "USD", "$898.34"],
  [5, "USD", "$0.05"],
  [123456789, "USD", "$1,234,567.89"],
  [100, "GBP", "£1.00"],
  [0, "GBP", "£0.00"],
];

describe("formatAmount", () => {
  it.each(FORMAT_CASES)("formats %s %s as %s", (minor, currency, expected) => {
    expect(formatAmount(minor, currency)).toBe(expected);
  });
});

const RATE_CASES: ReadonlyArray<[number, number]> = [
  [1500, 150000],
  [1500.55, 150055],
  [1.1, 110],
  [50, 5000],
];

describe("rateToHundredths", () => {
  it.each(RATE_CASES)("turns %s into %s hundredths", (rate, expected) => {
    expect(rateToHundredths(rate)).toBe(expected);
  });
});

describe("toMinorUnits: NGN rounds up to whole naira", () => {
  it("splits a shared bill exactly when it divides evenly", () => {
    expect(toMinorUnits(1050000, 4, "NGN", RATES)).toBe(262500);
  });

  it("rounds a share UP so a shared bill is never undercounted", () => {
    expect(toMinorUnits(100000, 3, "NGN", RATES)).toBe(33334);
    expect(toMinorUnits(200000, 3, "NGN", RATES)).toBe(66667);
  });

  it("leaves a per-person amount unchanged", () => {
    expect(toMinorUnits(300000, 1, "NGN", RATES)).toBe(300000);
  });
});

describe("toMinorUnits: USD and GBP round to the nearest cent, halves up", () => {
  it("converts the golden lines at 1,500 per $1", () => {
    expect(toMinorUnits(1050000, 4, "USD", RATES)).toBe(17500);
    expect(toMinorUnits(300000, 1, "USD", RATES)).toBe(20000);
    expect(toMinorUnits(1600000, 4, "USD", RATES)).toBe(26667);
    expect(toMinorUnits(420000, 4, "USD", RATES)).toBe(7000);
    expect(toMinorUnits(280000, 1, "USD", RATES)).toBe(18667);
  });

  it("rounds an exact half-cent up", () => {
    const rates = { ngnPerUsd: 200, ngnPerGbp: 200 };
    expect(toMinorUnits(1, 1, "USD", rates)).toBe(1); // 0.5 cents
    expect(toMinorUnits(3, 1, "USD", rates)).toBe(2); // 1.5 cents
    expect(toMinorUnits(1, 1, "GBP", { ngnPerUsd: 300, ngnPerGbp: 300 })).toBe(0); // 0.33 cents
  });

  it("handles a rate with two decimals", () => {
    const rates = { ngnPerUsd: 1500.55, ngnPerGbp: 2000 };
    expect(toMinorUnits(150000, 1, "USD", rates)).toBe(9996);
  });

  it("converts GBP with its own rate", () => {
    expect(toMinorUnits(262500, 1, "GBP", RATES)).toBe(13125);
  });

  it("stays exact at the largest values", () => {
    // 49,950,000,000 naira at the minimum rate of 50 is exactly $999,000,000.00
    const rates = { ngnPerUsd: 50, ngnPerGbp: 50 };
    expect(toMinorUnits(49950000000, 1, "USD", rates)).toBe(99900000000);
  });
});
