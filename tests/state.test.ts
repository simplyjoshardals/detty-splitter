import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/calc";
import { DEFAULT_RATES } from "@/config";
import { PRESETS } from "@/data/presets";
import { TIERS } from "@/data/tiers";
import type { AppState, PresetId } from "@/lib/types";
import { appReducer, createInitialState } from "@/state/reducer";
import { GOLDEN, deepFreeze, mapBuckets } from "./fixtures";

describe("initial state", () => {
  it("is the default scenario: Soft Life Standard, group of 4, naira", () => {
    const state = createInitialState();
    expect(state.presetId).toBe("soft");
    expect(state.currency).toBe("NGN");
    expect(state.groupSize).toBe(4);
    expect(state.rates).toEqual(DEFAULT_RATES);
  });

  it("holds the golden example, so the page shows the golden numbers", () => {
    const state = createInitialState();
    expect(state.buckets).toEqual(GOLDEN.buckets);

    const result = calculate(state, TIERS);
    expect(result.perPersonMinor).toBe(1347500);
    expect(result.groupTotalMinor).toBe(5390000);
    expect(result.tier.id).toBe(3);
    expect(result.tier.badge).toBe("Soft Life Certified");
  });

  it("returns fresh objects every time", () => {
    const a = createInitialState();
    const b = createInitialState();
    expect(a === b).toBe(false);
    expect(a.buckets === b.buckets).toBe(false);
    expect(a.buckets[0] === b.buckets[0]).toBe(false);
    expect(a.rates === DEFAULT_RATES).toBe(false);
  });

  it("is not tied to the preset data, so editing state can't change a preset", () => {
    const state = createInitialState();
    state.buckets[0].unitPriceNgn = 1;
    expect(PRESETS.soft.buckets[0].unitPriceNgn).toBe(150000);
  });
});

describe("selectPreset", () => {
  const cases: ReadonlyArray<[PresetId, number, number]> = [
    ["budget", 280000, 1],
    ["soft", 1347500, 3],
    ["baller", 5812500, 5],
  ];

  it.each(cases)("%s gives ₦%s per person and Tier %s", (presetId, perPerson, tierId) => {
    const state = appReducer(createInitialState(), { type: "selectPreset", presetId });
    expect(state.presetId).toBe(presetId);
    const result = calculate(state, TIERS);
    expect(result.perPersonMinor).toBe(perPerson);
    expect(result.tier.id).toBe(tierId);
  });

  it("replaces group size and every bucket, and keeps currency and rates", () => {
    const edited: AppState = {
      ...createInitialState(),
      currency: "USD",
      groupSize: 9,
      rates: { ngnPerUsd: 1600.5, ngnPerGbp: 2100 },
    };
    const next = appReducer(edited, { type: "selectPreset", presetId: "budget" });
    expect(next.presetId).toBe("budget");
    expect(next.groupSize).toBe(PRESETS.budget.groupSize);
    expect(next.buckets.map((b) => b.unitPriceNgn)).toEqual([40000, 25000, 150000, 30000, 10000]);
    expect(next.currency).toBe("USD");
    expect(next.rates).toEqual({ ngnPerUsd: 1600.5, ngnPerGbp: 2100 });
  });

  it("resets edited values when the current preset is selected again", () => {
    const base = createInitialState();
    const edited: AppState = {
      ...mapBuckets(base, (b) => (b.id === "stay" ? { ...b, unitPriceNgn: 1 } : b)),
      groupSize: 12,
    };
    const reset = appReducer(edited, { type: "selectPreset", presetId: edited.presetId });
    expect(reset.groupSize).toBe(4);
    expect(reset.buckets).toEqual(GOLDEN.buckets);
  });

  it("does not mutate the state it is given", () => {
    const frozen = deepFreeze(createInitialState()); // any mutation would throw
    const snapshot = structuredClone(frozen);
    appReducer(frozen, { type: "selectPreset", presetId: "baller" });
    expect(frozen).toEqual(snapshot);
  });
});
