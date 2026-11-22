import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/calc";
import { DEFAULT_RATES } from "@/config";
import { PRESETS } from "@/data/presets";
import { TIERS } from "@/data/tiers";
import type { AppState, BucketId, PresetId } from "@/lib/types";
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

describe("setBucketNumber", () => {
  const find = (state: AppState, id: BucketId) => {
    const bucket = state.buckets.find((b) => b.id === id);
    if (!bucket) throw new Error(`missing bucket ${id}`);
    return bucket;
  };

  it("sets a price, quantity or headcount on exactly one bucket", () => {
    const base = createInitialState();
    const priced = appReducer(base, {
      type: "setBucketNumber",
      bucketId: "tables",
      field: "unitPriceNgn",
      value: 1000000,
    });
    expect(find(priced, "tables").unitPriceNgn).toBe(1000000);
    expect(find(priced, "tables").quantity).toBe(find(base, "tables").quantity);
    for (const id of ["stay", "events", "transport", "food"] as const) {
      expect(find(priced, id)).toEqual(find(base, id));
    }

    const counted = appReducer(base, {
      type: "setBucketNumber",
      bucketId: "stay",
      field: "quantity",
      value: 10,
    });
    expect(find(counted, "stay").quantity).toBe(10);

    const shared = appReducer(base, {
      type: "setBucketNumber",
      bucketId: "stay",
      field: "headcount",
      value: 2,
    });
    expect(find(shared, "stay").headcount).toBe(2);
  });

  it("changes the totals: stay at 2 people instead of 4 doubles that share", () => {
    const next = appReducer(createInitialState(), {
      type: "setBucketNumber",
      bucketId: "stay",
      field: "headcount",
      value: 2,
    });
    const result = calculate(next, TIERS);
    expect(result.lines[0]?.shareMinor).toBe(525000); // 1,050,000 / 2
    expect(result.perPersonMinor).toBe(1347500 - 262500 + 525000);
  });

  it("keeps the preset, currency, rates, group size and bucket order", () => {
    const base = { ...createInitialState(), currency: "USD" as const };
    const next = appReducer(base, {
      type: "setBucketNumber",
      bucketId: "food",
      field: "unitPriceNgn",
      value: 1,
    });
    expect(next.presetId).toBe(base.presetId);
    expect(next.currency).toBe("USD");
    expect(next.rates).toEqual(base.rates);
    expect(next.groupSize).toBe(base.groupSize);
    expect(next.buckets.map((b) => b.id)).toEqual(["stay", "events", "tables", "transport", "food"]);
  });

  it("clamps to the DATA_MODEL §2.2 ranges", () => {
    const base = createInitialState();
    const set = (field: "unitPriceNgn" | "quantity" | "headcount", value: number) =>
      find(appReducer(base, { type: "setBucketNumber", bucketId: "stay", field, value }), "stay")[
        field
      ];
    expect(set("unitPriceNgn", 99000000000)).toBe(50000000);
    expect(set("unitPriceNgn", -5)).toBe(0);
    expect(set("quantity", 1000)).toBe(999);
    expect(set("quantity", 0)).toBe(0);
    expect(set("headcount", 0)).toBe(1);
    expect(set("headcount", 101)).toBe(100);
  });

  it("ignores values that are not safe integers, so NaN never reaches state", () => {
    const base = createInitialState();
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const next = appReducer(base, {
        type: "setBucketNumber",
        bucketId: "stay",
        field: "unitPriceNgn",
        value,
      });
      expect(next).toBe(base);
    }
  });

  it("returns the same state object when nothing changes", () => {
    const base = createInitialState();
    const same = appReducer(base, {
      type: "setBucketNumber",
      bucketId: "stay",
      field: "unitPriceNgn",
      value: 150000,
    });
    expect(same).toBe(base);
  });

  it("does not mutate the state it is given", () => {
    const frozen = deepFreeze(createInitialState()); // any mutation would throw
    const snapshot = structuredClone(frozen);
    appReducer(frozen, {
      type: "setBucketNumber",
      bucketId: "events",
      field: "quantity",
      value: 5,
    });
    expect(frozen).toEqual(snapshot);
  });

  it("does not touch the preset data, and Reset to preset undoes the edit", () => {
    const edited = appReducer(createInitialState(), {
      type: "setBucketNumber",
      bucketId: "stay",
      field: "unitPriceNgn",
      value: 1,
    });
    expect(PRESETS.soft.buckets[0].unitPriceNgn).toBe(150000);
    const reset = appReducer(edited, { type: "selectPreset", presetId: edited.presetId });
    expect(reset.buckets).toEqual(GOLDEN.buckets);
  });
});
