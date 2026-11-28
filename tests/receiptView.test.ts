import { describe, expect, it } from "vitest";
import { DEFAULT_RATES } from "@/config";
import { TIERS } from "@/data/tiers";
import { authCode, buildReceiptView, RECEIPT_COPY } from "@/lib/receipt/view";
import { GOLDEN, deepFreeze, eventsOnly, mapBuckets } from "./fixtures";
import type { AppState } from "@/lib/types";

/** The golden example (DATA_MODEL §2.5) with the config's default rates, so the note is the default. */
const DEFAULTS: AppState = { ...GOLDEN, rates: DEFAULT_RATES };
const OPTIONS = {
  defaultRates: GOLDEN.rates,
  ratesAsOf: "2026-11-23",
  siteUrl: "https://example.test",
};

/** "$1,234.50" -> 123450, "₦262,500" -> 262500. */
function minorUnits(text: string): number {
  const [whole = "", fraction] = text.slice(1).replace(/,/g, "").split(".");
  return fraction === undefined ? Number(whole) : Number(whole) * 100 + Number(fraction);
}

describe("buildReceiptView: the golden example in naira", () => {
  const view = buildReceiptView(GOLDEN, OPTIONS);

  it("has the five lines in bucket order, with the formula and your share", () => {
    expect(view.lines).toEqual([
      { label: "Short-lets / Accommodation", formula: "₦150,000 × 7 ÷ 4", yourShare: "₦262,500" },
      { label: "Concerts & Raves", formula: "₦100,000 × 3", yourShare: "₦300,000" },
      { label: "Club Tables", formula: "₦800,000 × 2 ÷ 4", yourShare: "₦400,000" },
      { label: "Transport / SUV / Security", formula: "₦60,000 × 7 ÷ 4", yourShare: "₦105,000" },
      { label: "Daily Food & Drinks", formula: "₦40,000 × 7", yourShare: "₦280,000" },
    ]);
  });

  it("has the totals, the title, the group size and the site", () => {
    expect(view.perPersonTotal).toBe("₦1,347,500");
    expect(view.groupTotal).toBe("₦5,390,000");
    expect(view.groupSize).toBe(4);
    expect(view.currency).toBe("NGN");
    expect(view.title).toBe("Detty December 2026");
    expect(view.siteUrl).toBe("https://example.test");
  });

  it("takes badge, tagline and balance line from the tier", () => {
    const tier = TIERS.find((t) => t.id === 3);
    expect(view.badge).toBe(tier?.badge);
    expect(view.tagline).toBe(tier?.tagline);
    expect(view.balanceLine).toBe(tier?.balanceLine);
    expect(view.balanceLine.startsWith("AVAIL BAL: ")).toBe(true);
  });

  it("keeps shared lines with a split of 1 as `÷ 1`, like the calculator's formula line", () => {
    const state = mapBuckets(GOLDEN, (b) => (b.id === "stay" ? { ...b, headcount: 1 } : b));
    expect(buildReceiptView(state, OPTIONS).lines[0]?.formula).toBe("₦150,000 × 7 ÷ 1");
  });
});

describe("buildReceiptView: formatted amounts equal the on-screen values", () => {
  it.each(["NGN", "USD", "GBP"] as const)(
    "the total is the sum of the displayed lines in %s",
    (currency) => {
      const view = buildReceiptView({ ...GOLDEN, currency }, OPTIONS);
      const sum = view.lines.reduce((total, line) => total + minorUnits(line.yourShare), 0);
      expect(minorUnits(view.perPersonTotal)).toBe(sum);
    },
  );

  it("shows dollars and pounds in the amounts but keeps the formula in naira", () => {
    const usd = buildReceiptView({ ...GOLDEN, currency: "USD" }, OPTIONS);
    expect(usd.perPersonTotal).toBe("$898.34");
    expect(usd.groupTotal).toBe("$3,593.36");
    expect(usd.lines[0]).toEqual({
      label: "Short-lets / Accommodation",
      formula: "₦150,000 × 7 ÷ 4",
      yourShare: "$175.00",
    });
    expect(buildReceiptView({ ...GOLDEN, currency: "GBP" }, OPTIONS).perPersonTotal).toBe(
      "£673.75",
    );
  });

  it("shows zero lines as zero, with the first tier", () => {
    const view = buildReceiptView(
      mapBuckets(GOLDEN, (b) => ({ ...b, quantity: 0 })),
      OPTIONS,
    );
    expect(view.perPersonTotal).toBe("₦0");
    expect(view.groupTotal).toBe("₦0");
    expect(view.lines.every((line) => line.yourShare === "₦0")).toBe(true);
    expect(view.badge).toBe(TIERS[0]?.badge);
  });

  it("does not change the state it was given", () => {
    expect(() => buildReceiptView(deepFreeze(structuredClone(GOLDEN)), OPTIONS)).not.toThrow();
  });
});

describe("buildReceiptView: rates note", () => {
  it("says when the default rates were read while they are untouched", () => {
    expect(buildReceiptView(GOLDEN, OPTIONS).ratesNote).toBe("Rates as of 23 Nov 2026");
  });

  it("says Custom rates as soon as either rate differs", () => {
    const usd = { ...GOLDEN, rates: { ...GOLDEN.rates, ngnPerUsd: 1501 } };
    const gbp = { ...GOLDEN, rates: { ...GOLDEN.rates, ngnPerGbp: 2000.5 } };
    expect(buildReceiptView(usd, OPTIONS).ratesNote).toBe("Custom rates");
    expect(buildReceiptView(gbp, OPTIONS).ratesNote).toBe("Custom rates");
  });

  it("goes back to the date when a rate is edited back to its default", () => {
    const edited = { ...GOLDEN, rates: { ...GOLDEN.rates, ngnPerUsd: 1600 } };
    const back = { ...edited, rates: GOLDEN.rates };
    expect(buildReceiptView(edited, OPTIONS).ratesNote).toBe("Custom rates");
    expect(buildReceiptView(back, OPTIONS).ratesNote).toBe("Rates as of 23 Nov 2026");
  });

  it("uses the config's defaults when no options are given", () => {
    expect(buildReceiptView(DEFAULTS).ratesNote.startsWith("Rates as of ")).toBe(true);
  });
});

describe("authCode", () => {
  it("is 8 upper-case hex characters", () => {
    expect(authCode(3, 1347500, "NGN")).toMatch(/^[0-9A-F]{8}$/);
    expect(authCode(1, 0, "GBP")).toMatch(/^[0-9A-F]{8}$/);
  });

  it("is the same for the same input and keeps its known value", () => {
    expect(authCode(3, 1347500, "NGN")).toBe(authCode(3, 1347500, "NGN"));
    // 32-bit FNV-1a of "3:1347500:NGN": a change to the algorithm has to update this on purpose.
    expect(authCode(3, 1347500, "NGN")).toBe("D1E6E16D");
    expect(authCode(3, 89834, "USD")).toBe("13458EA4");
  });

  it("changes with the tier, the total and the currency", () => {
    const base = authCode(3, 1347500, "NGN");
    expect(authCode(2, 1347500, "NGN")).not.toBe(base);
    expect(authCode(3, 1347501, "NGN")).not.toBe(base);
    expect(authCode(3, 1347500, "USD")).not.toBe(base);
  });

  it("is the same on two builds of the same state, and does not depend on the group size", () => {
    const a = buildReceiptView(GOLDEN, OPTIONS).authCode;
    expect(buildReceiptView(GOLDEN, OPTIONS).authCode).toBe(a);
    expect(buildReceiptView({ ...GOLDEN, groupSize: 9 }, OPTIONS).authCode).toBe(a);
  });

  it("is the code of the tier and total on the view", () => {
    expect(buildReceiptView(GOLDEN, OPTIONS).authCode).toBe("D1E6E16D");
  });

  it("differs when the tier changes with the same display currency", () => {
    const cheap = buildReceiptView(eventsOnly(1000), OPTIONS).authCode;
    const dear = buildReceiptView(eventsOnly(4000000), OPTIONS).authCode;
    expect(cheap).not.toBe(dear);
  });
});

describe("RECEIPT_COPY", () => {
  it("has the four POS header lines, the status and the customer line from DESIGN §7", () => {
    expect(RECEIPT_COPY.posHeader).toEqual([
      "*** DEBIT ALERT ***",
      "MERCHANT: DETTY DEC, LAGOS",
      "TXN: DAMAGE CALCULATION",
      "CARD: **** SAPA",
    ]);
    expect(RECEIPT_COPY.status).toBe("STATUS: APPROVED");
    expect(RECEIPT_COPY.customerCopy).toBe("CUSTOMER COPY. KEEP YOUR RECEIPT. YOUR ACCOUNT WON'T.");
  });
});
