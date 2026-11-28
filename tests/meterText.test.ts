import { describe, expect, it } from "vitest";
import { meterSizeToken, totalsAnnouncement } from "@/components/meterText";
import { calculate } from "@/lib/calc";
import { formatAmount } from "@/lib/money";
import { TIERS } from "@/data/tiers";
import { GOLDEN } from "./fixtures";

describe("totalsAnnouncement", () => {
  it("reads the golden example in naira", () => {
    const result = calculate(GOLDEN, TIERS);
    expect(totalsAnnouncement(result.perPersonMinor, result.groupTotalMinor, 4, "NGN")).toBe(
      "Per person ₦1,347,500. Group total ₦5,390,000 for 4 people.",
    );
  });

  it("uses the display currency and never mixes symbols", () => {
    const usd = calculate({ ...GOLDEN, currency: "USD" }, TIERS);
    const text = totalsAnnouncement(usd.perPersonMinor, usd.groupTotalMinor, 4, "USD");
    expect(text).toBe("Per person $898.34. Group total $3,593.36 for 4 people.");
    expect(text).not.toContain("₦");

    const gbp = calculate({ ...GOLDEN, currency: "GBP" }, TIERS);
    const gbpText = totalsAnnouncement(gbp.perPersonMinor, gbp.groupTotalMinor, 4, "GBP");
    expect(gbpText).toBe("Per person £673.75. Group total £2,695.00 for 4 people.");
  });

  it('says "1 person" for a group of one', () => {
    expect(totalsAnnouncement(500000, 500000, 1, "NGN")).toBe(
      "Per person ₦500,000. Group total ₦500,000 for 1 person.",
    );
  });

  it("still reads a zero total", () => {
    expect(totalsAnnouncement(0, 0, 4, "NGN")).toBe("Per person ₦0. Group total ₦0 for 4 people.");
    expect(totalsAnnouncement(0, 0, 2, "USD")).toBe(
      "Per person $0.00. Group total $0.00 for 2 people.",
    );
  });

  it("is the same text for the same numbers, and different when any number changes", () => {
    const base = totalsAnnouncement(1000, 4000, 4, "NGN");
    expect(totalsAnnouncement(1000, 4000, 4, "NGN")).toBe(base);
    expect(totalsAnnouncement(1001, 4004, 4, "NGN")).not.toBe(base);
    expect(totalsAnnouncement(1000, 4000, 5, "NGN")).not.toBe(base);
    expect(totalsAnnouncement(1000, 4000, 4, "USD")).not.toBe(base);
  });

  it("reads the largest reachable amounts in full", () => {
    // Every price at the maximum: 5 lines x 50,000,000 x 999, split by 1.
    const perPerson = 5 * 50_000_000 * 999;
    expect(totalsAnnouncement(perPerson, perPerson * 100, 100, "NGN")).toBe(
      "Per person ₦249,750,000,000. Group total ₦24,975,000,000,000 for 100 people.",
    );
  });
});

describe("meterSizeToken", () => {
  it("uses the larger digits up to 13 characters", () => {
    expect(meterSizeToken("₦0")).toBe("--t-xl");
    expect(meterSizeToken("₦1,347,500")).toBe("--t-xl"); // 10, the default
    expect(meterSizeToken("1".repeat(13))).toBe("--t-xl");
  });

  it("steps down from 14 characters", () => {
    expect(meterSizeToken("1".repeat(14))).toBe("--t-lg");
    expect(meterSizeToken("$4,995,000,000.00")).toBe("--t-lg"); // 17, the longest reachable
  });

  it("counts ₦ as one character, not by UTF-16 units or bytes", () => {
    expect(meterSizeToken(`₦${"1".repeat(12)}`)).toBe("--t-xl"); // 13
    expect(meterSizeToken(`₦${"1".repeat(13)}`)).toBe("--t-lg"); // 14
  });

  it("sizes the real formatted amounts the meter will show", () => {
    expect(meterSizeToken(formatAmount(898_33, "USD"))).toBe("--t-xl"); // $898.33
    expect(meterSizeToken(formatAmount(249_750_000_000, "NGN"))).toBe("--t-lg"); // 16
  });
});
