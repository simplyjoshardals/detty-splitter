import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/calc";
import { PRESET_ORDER } from "@/data/presets";
import { TIERS } from "@/data/tiers";
import { CURRENCY_CODES } from "@/lib/money";
import type { AppState, CurrencyCode } from "@/lib/types";
import { appReducer, createInitialState } from "@/state/reducer";
import { TEST_TIERS, deepFreeze, eventsOnly, mapBuckets } from "./fixtures";

/** T5.1 Done-when, end to end through the reducer: the display currency is display only. */
function switchTo(state: AppState, currency: CurrencyCode): AppState {
  return appReducer(state, { type: "setCurrency", currency });
}

function stateFor(presetId: (typeof PRESET_ORDER)[number]): AppState {
  return appReducer(createInitialState(), { type: "selectPreset", presetId });
}

describe("switching currency never changes the tier or the stored naira values", () => {
  for (const presetId of PRESET_ORDER) {
    it(`${presetId}: same tier and same buckets in every currency`, () => {
      const base = deepFreeze(stateFor(presetId));
      const tier = calculate(base, TIERS).tier;
      for (const currency of CURRENCY_CODES) {
        const shown = switchTo(base, currency);
        expect(calculate(shown, TIERS).tier).toBe(tier);
        expect(shown.buckets).toBe(base.buckets);
        expect(shown.rates).toBe(base.rates);
      }
    });

    it(`${presetId}: NGN > USD > GBP > NGN gives back identical results`, () => {
      const base = stateFor(presetId);
      const round = switchTo(switchTo(switchTo(base, "USD"), "GBP"), "NGN");
      expect(round).toEqual(base);
      expect(calculate(round, TIERS)).toEqual(calculate(base, TIERS));
    });
  }

  it("keeps the tier at an exact threshold even when the converted amount is not whole", () => {
    // 300,000 is the Tier 2 floor. At rates with no clean quotient the displayed amount is
    // rounded, but the tier still comes from the exact naira total.
    const rates = { ngnPerUsd: 1537.37, ngnPerGbp: 1999.99 };
    for (const [price, tierId] of [
      [299999, 1],
      [300000, 2],
    ] as const) {
      for (const currency of CURRENCY_CODES) {
        const state = { ...switchTo(eventsOnly(price), currency), rates };
        expect(calculate(state, TEST_TIERS).tier.id).toBe(tierId);
      }
    }
  });
});

describe("the displayed total equals the sum of the displayed lines", () => {
  const awkwardRates = [
    { ngnPerUsd: 1500, ngnPerGbp: 2000 },
    { ngnPerUsd: 1537.37, ngnPerGbp: 1999.99 },
    { ngnPerUsd: 50, ngnPerGbp: 100000 },
  ];

  for (const presetId of PRESET_ORDER) {
    for (const currency of CURRENCY_CODES) {
      it(`${presetId} in ${currency}, group of 7, headcount 3, three rate pairs`, () => {
        for (const rates of awkwardRates) {
          const state = mapBuckets(
            { ...switchTo(stateFor(presetId), currency), groupSize: 7, rates },
            (b) => ({ ...b, headcount: 3 }),
          );
          const result = calculate(state, TIERS);
          const sum = result.lines.reduce((total, line) => total + line.shareMinor, 0);
          expect(result.perPersonMinor).toBe(sum);
          expect(result.groupTotalMinor).toBe(sum * 7);
        }
      });
    }
  }
});
