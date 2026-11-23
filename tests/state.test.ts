import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/calc";
import { DEFAULT_RATES } from "@/config";
import { PRESETS } from "@/data/presets";
import { TIERS } from "@/data/tiers";
import type { AppState, BucketId, Mode, PresetId } from "@/lib/types";
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

describe("setGroupSize", () => {
  it("golden: group of 6 leaves the per-person total alone and scales the group total", () => {
    const base = createInitialState();
    const next = appReducer(base, { type: "setGroupSize", value: 6 });
    expect(next.groupSize).toBe(6);
    const before = calculate(base, TIERS);
    const after = calculate(next, TIERS);
    expect(after.perPersonMinor).toBe(before.perPersonMinor);
    expect(after.groupTotalMinor).toBe(1347500 * 6);
    expect(after.tier.id).toBe(before.tier.id);
  });

  it("does not touch any bucket, so shared headcounts stay as they were", () => {
    const base = createInitialState();
    const next = appReducer(base, { type: "setGroupSize", value: 9 });
    expect(next.buckets).toBe(base.buckets);
    expect(next.presetId).toBe(base.presetId);
    expect(next.currency).toBe(base.currency);
    expect(next.rates).toEqual(base.rates);
  });

  it("clamps to the DATA_MODEL §2.2 range", () => {
    const base = createInitialState();
    const set = (value: number) => appReducer(base, { type: "setGroupSize", value }).groupSize;
    expect(set(0)).toBe(1);
    expect(set(-3)).toBe(1);
    expect(set(1)).toBe(1);
    expect(set(100)).toBe(100);
    expect(set(101)).toBe(100);
  });

  it("ignores values that are not safe integers, so NaN never reaches state", () => {
    const base = createInitialState();
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(appReducer(base, { type: "setGroupSize", value })).toBe(base);
    }
  });

  it("returns the same state object when the size is already set", () => {
    const base = createInitialState();
    expect(appReducer(base, { type: "setGroupSize", value: 4 })).toBe(base);
  });

  it("does not mutate the state it is given", () => {
    const frozen = deepFreeze(createInitialState()); // any mutation would throw
    const snapshot = structuredClone(frozen);
    appReducer(frozen, { type: "setGroupSize", value: 7 });
    expect(frozen).toEqual(snapshot);
  });
});

describe("applyGroupSizeToShared", () => {
  const sizedTo = (groupSize: number): AppState => ({ ...createInitialState(), groupSize });

  it("sets the headcount of every shared bucket to the group size", () => {
    const next = appReducer(sizedTo(6), { type: "applyGroupSizeToShared" });
    const shared = next.buckets.filter((b) => b.mode === "shared");
    expect(shared.map((b) => b.id)).toEqual(["stay", "tables", "transport"]);
    expect(shared.every((b) => b.headcount === 6)).toBe(true);
  });

  it("leaves per-person buckets alone, so their stored split survives", () => {
    const base: AppState = mapBuckets(sizedTo(6), (b) =>
      b.mode === "perPerson" ? { ...b, headcount: 2 } : b,
    );
    const next = appReducer(base, { type: "applyGroupSizeToShared" });
    for (const id of ["events", "food"] as const) {
      expect(next.buckets.find((b) => b.id === id)).toEqual(base.buckets.find((b) => b.id === id));
    }
  });

  it("golden: a group of 8 sharing the stay halves its share and keeps the other fields", () => {
    const base = sizedTo(8);
    const next = appReducer(base, { type: "applyGroupSizeToShared" });
    const stay = next.buckets[0];
    expect(stay).toEqual({ ...GOLDEN.buckets[0], headcount: 8 });
    expect(next.groupSize).toBe(8);
    expect(next.presetId).toBe(base.presetId);
    expect(next.currency).toBe(base.currency);
    expect(next.rates).toEqual(base.rates);
    expect(calculate(next, TIERS).lines[0]?.shareMinor).toBe(131250);
  });

  it("returns the same state object when every shared bucket already matches", () => {
    const base = createInitialState();
    expect(appReducer(base, { type: "applyGroupSizeToShared" })).toBe(base);
  });

  it("returns the same state object when no bucket is shared", () => {
    const base = mapBuckets(sizedTo(6), (b) => ({ ...b, mode: "perPerson" }));
    expect(appReducer(base, { type: "applyGroupSizeToShared" })).toBe(base);
  });

  it("does not mutate the state it is given", () => {
    const frozen = deepFreeze(sizedTo(6)); // any mutation would throw
    const snapshot = structuredClone(frozen);
    appReducer(frozen, { type: "applyGroupSizeToShared" });
    expect(frozen).toEqual(snapshot);
  });

  it("Reset to preset undoes it, and brings the group size back too", () => {
    const applied = appReducer(sizedTo(6), { type: "applyGroupSizeToShared" });
    const reset = appReducer(applied, { type: "selectPreset", presetId: applied.presetId });
    expect(reset.groupSize).toBe(4);
    expect(reset.buckets).toEqual(GOLDEN.buckets);
  });
});

describe("setBucketMode", () => {
  const find = (state: AppState, id: BucketId) => {
    const bucket = state.buckets.find((b) => b.id === id);
    if (!bucket) throw new Error(`missing bucket ${id}`);
    return bucket;
  };
  const setMode = (state: AppState, bucketId: BucketId, mode: Mode) =>
    appReducer(state, { type: "setBucketMode", bucketId, mode });

  it("sets the mode on exactly one bucket", () => {
    const base = createInitialState();
    const next = setMode(base, "stay", "perPerson");
    expect(find(next, "stay").mode).toBe("perPerson");
    for (const id of ["events", "tables", "transport", "food"] as const) {
      expect(find(next, id)).toEqual(find(base, id));
    }
  });

  it("golden: Short-lets per person is the whole ₦1,050,000, not a quarter of it", () => {
    const result = calculate(setMode(createInitialState(), "stay", "perPerson"), TIERS);
    expect(result.lines[0]?.shareMinor).toBe(1050000);
    expect(result.perPersonMinor).toBe(1347500 - 262500 + 1050000); // 2,135,000
    expect(result.groupTotalMinor).toBe(2135000 * 4);
  });

  it("golden: Concerts shared by 4 is a quarter of ₦300,000", () => {
    const result = calculate(setMode(createInitialState(), "events", "shared"), TIERS);
    expect(result.lines[1]?.shareMinor).toBe(75000);
    expect(result.perPersonMinor).toBe(1347500 - 300000 + 75000); // 1,122,500
  });

  it("keeps the headcount, so per person and back restores the same split", () => {
    const base = appReducer(createInitialState(), {
      type: "setBucketNumber",
      bucketId: "stay",
      field: "headcount",
      value: 3,
    });
    const away = setMode(base, "stay", "perPerson");
    expect(find(away, "stay").headcount).toBe(3);
    expect(setMode(away, "stay", "shared")).toEqual(base);
  });

  it("keeps the preset, currency, rates, group size and bucket order", () => {
    const base = { ...createInitialState(), currency: "USD" as const };
    const next = setMode(base, "food", "shared");
    expect(next.presetId).toBe(base.presetId);
    expect(next.currency).toBe("USD");
    expect(next.rates).toEqual(base.rates);
    expect(next.groupSize).toBe(base.groupSize);
    expect(next.buckets.map((b) => b.id)).toEqual(["stay", "events", "tables", "transport", "food"]);
  });

  it("returns the same state object when the mode is already set", () => {
    const base = createInitialState();
    expect(setMode(base, "stay", "shared")).toBe(base);
    expect(setMode(base, "events", "perPerson")).toBe(base);
  });

  it("ignores a mode that is not one of the two, so nothing invalid reaches state", () => {
    const base = createInitialState();
    const bogus = "everyone" as unknown as Mode;
    expect(setMode(base, "stay", bogus)).toBe(base);
  });

  it("does not mutate the state it is given", () => {
    const frozen = deepFreeze(createInitialState()); // any mutation would throw
    const snapshot = structuredClone(frozen);
    setMode(frozen, "tables", "perPerson");
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

describe("setCurrency", () => {
  const setCurrency = (state: AppState, currency: unknown) =>
    // The cast stands in for hostile input (a decoded link, a bad caller) that types can't stop.
    appReducer(state, { type: "setCurrency", currency } as { type: "setCurrency"; currency: "NGN" });

  it("changes only the currency", () => {
    const base = createInitialState();
    const next = setCurrency(base, "USD");
    expect(next.currency).toBe("USD");
    expect({ ...next, currency: base.currency }).toEqual(base);
  });

  it("returns the same state object when the currency is already selected", () => {
    const base = createInitialState();
    expect(setCurrency(base, "NGN")).toBe(base);
    const usd = setCurrency(base, "USD");
    expect(setCurrency(usd, "USD")).toBe(usd);
  });

  it.each(["usd", "EUR", "", null, undefined, 7, {}])("ignores %j, never writes it", (bad) => {
    const base = createInitialState();
    expect(setCurrency(base, bad)).toBe(base);
  });

  it("golden: dollars show $898.34 per person and $3,593.36 for the group", () => {
    const result = calculate(setCurrency(createInitialState(), "USD"), TIERS);
    expect(result.perPersonMinor).toBe(89834);
    expect(result.groupTotalMinor).toBe(359336);
    expect(result.tier.id).toBe(3);
  });

  it("does not mutate the previous state", () => {
    const frozen = deepFreeze(createInitialState());
    setCurrency(frozen, "GBP");
  });

  it("is kept by selectPreset, so Reset to preset keeps the chosen currency", () => {
    const gbp = setCurrency(createInitialState(), "GBP");
    const reset = appReducer(gbp, { type: "selectPreset", presetId: gbp.presetId });
    expect(reset.currency).toBe("GBP");
  });
});
describe("setRate", () => {
  const setRate = (state: AppState, rate: unknown, value: number) =>
    // The cast stands in for hostile input (a decoded link, a bad caller) that types can't stop.
    appReducer(state, { type: "setRate", rate, value } as { type: "setRate"; rate: "ngnPerUsd"; value: number });

  it("changes only the one rate that was set", () => {
    const base = createInitialState();
    const usd = setRate(base, "ngnPerUsd", 1537.37);
    expect(usd.rates).toEqual({ ngnPerUsd: 1537.37, ngnPerGbp: DEFAULT_RATES.ngnPerGbp });
    expect({ ...usd, rates: base.rates }).toEqual(base);

    const gbp = setRate(base, "ngnPerGbp", 1999.99);
    expect(gbp.rates).toEqual({ ngnPerUsd: DEFAULT_RATES.ngnPerUsd, ngnPerGbp: 1999.99 });
  });

  it("returns the same state object when the rate is unchanged", () => {
    const base = createInitialState();
    expect(setRate(base, "ngnPerUsd", DEFAULT_RATES.ngnPerUsd)).toBe(base);
    const custom = setRate(base, "ngnPerGbp", 2100);
    expect(setRate(custom, "ngnPerGbp", 2100)).toBe(custom);
  });

  it("clamps into 50..100,000, so rate 0 can never be stored", () => {
    const base = createInitialState();
    expect(setRate(base, "ngnPerUsd", 0).rates.ngnPerUsd).toBe(50);
    expect(setRate(base, "ngnPerUsd", -100).rates.ngnPerUsd).toBe(50);
    expect(setRate(base, "ngnPerGbp", 49.99).rates.ngnPerGbp).toBe(50);
    expect(setRate(base, "ngnPerGbp", 1e12).rates.ngnPerGbp).toBe(100000);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1500.555])(
    "ignores %j, never writes it",
    (bad) => {
      const base = createInitialState();
      expect(setRate(base, "ngnPerUsd", bad)).toBe(base);
    },
  );

  it.each(["ngnPerEur", "USD", "", null, undefined, 7, {}])("ignores the rate key %j", (bad) => {
    const base = createInitialState();
    expect(setRate(base, bad, 1600)).toBe(base);
  });

  it("changes the dollar total and leaves the naira values and the tier alone", () => {
    const base = { ...createInitialState(), currency: "USD" as const };
    const next = setRate(base, "ngnPerUsd", 3000);
    const before = calculate(base, TIERS);
    const after = calculate(next, TIERS);
    expect(after.perPersonMinor).toBeLessThan(before.perPersonMinor);
    expect(after.tier).toBe(before.tier);
    expect(next.buckets).toBe(base.buckets);
  });

  it("is kept by selectPreset, so Reset to preset keeps custom rates", () => {
    const custom = setRate(createInitialState(), "ngnPerUsd", 1600.5);
    const reset = appReducer(custom, { type: "selectPreset", presetId: custom.presetId });
    expect(reset.rates).toEqual(custom.rates);
  });

  it("does not mutate the previous state or the config defaults", () => {
    const frozen = deepFreeze(createInitialState());
    setRate(frozen, "ngnPerUsd", 1700);
    expect(DEFAULT_RATES).toEqual({ ngnPerUsd: 1500, ngnPerGbp: 2000 });
  });
});

describe("resetRates", () => {
  const edited = () =>
    appReducer(
      appReducer(createInitialState(), { type: "setRate", rate: "ngnPerUsd", value: 1600 }),
      { type: "setRate", rate: "ngnPerGbp", value: 2100 },
    );

  it("puts both rates back to the config defaults", () => {
    expect(appReducer(edited(), { type: "resetRates" }).rates).toEqual(DEFAULT_RATES);
  });

  it("returns the same state object when the rates are already the defaults", () => {
    const base = createInitialState();
    expect(appReducer(base, { type: "resetRates" })).toBe(base);
  });

  it("changes nothing but the rates, currency and preset edits included", () => {
    const state = { ...edited(), currency: "GBP" as const, groupSize: 9 };
    const next = appReducer(state, { type: "resetRates" });
    expect({ ...next, rates: state.rates }).toEqual(state);
  });

  it("hands out a copy, so editing a rate later can't change the config defaults", () => {
    const next = appReducer(edited(), { type: "resetRates" });
    expect(next.rates === DEFAULT_RATES).toBe(false);
  });

  it("does not mutate the previous state", () => {
    appReducer(deepFreeze(edited()), { type: "resetRates" });
  });
});
