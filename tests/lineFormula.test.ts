import { describe, expect, it } from "vitest";
import { describeLine } from "@/components/lineFormula";
import { lineTotalNgn } from "@/lib/calc";
import { makeBucket } from "./fixtures";

const RATES = { ngnPerUsd: 1500, ngnPerGbp: 2000 };
const stay = makeBucket("stay", 150000, 7, "shared", 4); // ₦1,050,000 in total

describe("describeLine", () => {
  it("shows the whole bill in the display currency, then the split", () => {
    const total = lineTotalNgn(stay);
    expect(describeLine(stay, total, "NGN", RATES)).toBe("₦1,050,000 total ÷ 4");
    expect(describeLine(stay, total, "USD", RATES)).toBe("$700.00 total ÷ 4");
    expect(describeLine(stay, total, "GBP", RATES)).toBe("£525.00 total ÷ 4");
  });

  it("rounds a total that does not convert evenly to the nearest cent", () => {
    const bucket = makeBucket("tables", 100000, 1, "shared", 3);
    expect(describeLine(bucket, lineTotalNgn(bucket), "USD", RATES)).toBe("$66.67 total ÷ 3");
  });

  it("says each person pays it, with no amount, for a per-person line", () => {
    const events = makeBucket("events", 100000, 3, "perPerson", 4);
    for (const currency of ["NGN", "USD", "GBP"] as const) {
      expect(describeLine(events, lineTotalNgn(events), currency, RATES)).toBe(
        "Each person pays this",
      );
    }
  });

  it("handles a zero total and a split of one", () => {
    const free = makeBucket("food", 40000, 0, "shared", 1);
    expect(describeLine(free, 0, "USD", RATES)).toBe("$0.00 total ÷ 1");
  });

  it("never mixes currencies: a dollar formula has no naira sign", () => {
    expect(describeLine(stay, lineTotalNgn(stay), "USD", RATES)).not.toContain("₦");
  });
});
