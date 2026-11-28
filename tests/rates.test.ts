import { describe, expect, it, vi } from "vitest";
import { RANGES, parseNumberInput } from "@/lib/input";
import { formatAsOfDate, ratesAreCustom } from "@/lib/rates";
import type { Rates } from "@/lib/types";

// The real config values: tests/setup.ts mocks them for the other tests.
const { DEFAULT_RATES, RATES_AS_OF } = await vi.importActual<typeof import("@/config")>("@/config");

const DEFAULTS: Rates = { ngnPerUsd: 1500, ngnPerGbp: 2000 };

describe("ratesAreCustom", () => {
  it("is false for the defaults, even as a different object", () => {
    expect(ratesAreCustom({ ...DEFAULTS }, DEFAULTS)).toBe(false);
  });

  it("is true when either rate differs, so one custom rate is enough", () => {
    expect(ratesAreCustom({ ngnPerUsd: 1600, ngnPerGbp: 2000 }, DEFAULTS)).toBe(true);
    expect(ratesAreCustom({ ngnPerUsd: 1500, ngnPerGbp: 2000.01 }, DEFAULTS)).toBe(true);
    expect(ratesAreCustom({ ngnPerUsd: 1600, ngnPerGbp: 2100 }, DEFAULTS)).toBe(true);
  });

  it("goes back to false when a rate is edited back to its default", () => {
    expect(ratesAreCustom({ ngnPerUsd: 1500, ngnPerGbp: 2000 }, DEFAULTS)).toBe(false);
  });
});

describe("formatAsOfDate", () => {
  it.each([
    ["2026-11-23", "23 Nov 2026"],
    ["2026-01-05", "5 Jan 2026"],
    ["2028-02-29", "29 Feb 2028"], // a real leap day
    ["2026-12-31", "31 Dec 2026"],
  ])("formats %s as %s", (iso, expected) => {
    expect(formatAsOfDate(iso)).toBe(expected);
  });

  it.each([
    "",
    "23 Nov 2026",
    "2026-13-01",
    "2026-00-10",
    "2026-02-30",
    "2027-02-29", // not a leap year
    "2026-11-31",
    "2026-1-5",
    "2026-11-23T10:00:00Z",
  ])("throws for %j instead of showing a wrong date", (bad) => {
    expect(() => formatAsOfDate(bad)).toThrow(RangeError);
  });
});

describe("config defaults (to catch a typo when the real values are set before launch)", () => {
  it('has an "as of" date that is a real ISO date', () => {
    expect(() => formatAsOfDate(RATES_AS_OF)).not.toThrow();
  });

  it("has defaults the rate field itself would accept, so a reset can't land outside the range", () => {
    for (const rate of [DEFAULT_RATES.ngnPerUsd, DEFAULT_RATES.ngnPerGbp]) {
      // Typing the default back in must be accepted as it is (in range, at most 2 decimals).
      expect(parseNumberInput(String(rate), RANGES.rate, 1)).toEqual({ status: "ok", value: rate });
    }
  });
});
