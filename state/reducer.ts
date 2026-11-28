/**
 * App state (DATA_MODEL.md §2). Plain TypeScript, no React, so it can be tested directly.
 * `selectPreset`, `setBucketNumber`, `setBucketMode`, `setGroupSize`,
 * `applyGroupSizeToShared`, `setCurrency`, `setRate`, `resetRates` and `loadState` (a link or
 * the saved snapshot, T8.2) exist.
 */
import { DEFAULT_RATES } from "@/config";
import { DEFAULT_PRESET_ID, PRESETS, type Preset } from "@/data/presets";
import { RANGES, clampDecimal, clampInteger } from "@/lib/input";
import { isCurrencyCode } from "@/lib/money";
import { ratesAreCustom } from "@/lib/rates";
import { decodeShare, encodeShare } from "@/lib/share";
import type { AppState, Bucket, BucketId, CurrencyCode, Mode, PresetId, Rates } from "@/lib/types";

/** Copies preset values into fresh bucket objects (nothing is shared with PRESETS). */
function bucketsFromPreset(preset: Preset): AppState["buckets"] {
  const [stay, events, tables, transport, food] = preset.buckets;
  return [
    { id: "stay", ...stay },
    { id: "events", ...events },
    { id: "tables", ...tables },
    { id: "transport", ...transport },
    { id: "food", ...food },
  ];
}

/**
 * Fills the state from a preset. Keeps the user's currency and rates
 * (DATA_MODEL §3.1), and replaces group size and every bucket.
 */
export function stateFromPreset(
  presetId: PresetId,
  keep: Pick<AppState, "currency" | "rates">,
): AppState {
  const preset = PRESETS[presetId];
  return {
    presetId,
    currency: keep.currency,
    groupSize: preset.groupSize,
    rates: { ...keep.rates },
    buckets: bucketsFromPreset(preset),
  };
}

/** The default scenario: Soft Life Standard, group of 4, shown in naira. */
export function createInitialState(): AppState {
  return stateFromPreset(DEFAULT_PRESET_ID, { currency: "NGN", rates: DEFAULT_RATES });
}

/** Applies `change` to one bucket and keeps the fixed five-bucket tuple type. */
function withBucketChanged(
  state: AppState,
  bucketId: BucketId,
  change: (bucket: Bucket) => Bucket,
): AppState {
  const edit = (b: Bucket): Bucket => (b.id === bucketId ? change(b) : b);
  const [stay, events, tables, transport, food] = state.buckets;
  return {
    ...state,
    buckets: [edit(stay), edit(events), edit(tables), edit(transport), edit(food)],
  };
}

/** The numeric fields of one bucket that the user can type into. */
export type BucketNumberField = "unitPriceNgn" | "quantity" | "headcount";

export type AppAction =
  | { type: "selectPreset"; presetId: PresetId }
  | { type: "setBucketNumber"; bucketId: BucketId; field: BucketNumberField; value: number }
  | { type: "setBucketMode"; bucketId: BucketId; mode: Mode }
  | { type: "setGroupSize"; value: number }
  | { type: "applyGroupSizeToShared" }
  | { type: "setCurrency"; currency: CurrencyCode }
  | { type: "setRate"; rate: keyof Rates; value: number }
  | { type: "resetRates" }
  | { type: "loadState"; state: AppState };

// Every action type needs a case. The `never` assignment in `default` turns a forgotten
// case into a compile error.
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "selectPreset":
      // "Reset to preset" is this same action with the current presetId.
      return stateFromPreset(action.presetId, state);
    case "setBucketNumber": {
      // The field has already clamped, but the reducer enforces the ranges too
      // (DATA_MODEL §2.2). A value that isn't a safe integer is ignored, never written.
      const next = clampInteger(action.value, RANGES[action.field]);
      if (next === null) return state;
      const current = state.buckets.find((b) => b.id === action.bucketId);
      if (current === undefined || current[action.field] === next) return state;
      return withBucketChanged(state, action.bucketId, (b) => ({ ...b, [action.field]: next }));
    }
    case "setBucketMode": {
      // Anything but the two known modes is ignored, never written. `headcount` is left
      // alone, so switching to per-person and back restores the old split.
      if (action.mode !== "shared" && action.mode !== "perPerson") return state;
      const current = state.buckets.find((b) => b.id === action.bucketId);
      if (current === undefined || current.mode === action.mode) return state;
      return withBucketChanged(state, action.bucketId, (b) => ({ ...b, mode: action.mode }));
    }
    case "setGroupSize": {
      // Same rule as setBucketNumber: clamp, and ignore a value that isn't a safe integer.
      // Only the group total moves; shared headcounts are left for applyGroupSizeToShared.
      const next = clampInteger(action.value, RANGES.groupSize);
      if (next === null || next === state.groupSize) return state;
      return { ...state, groupSize: next };
    }
    case "applyGroupSizeToShared": {
      // Shared buckets only. A per-person headcount is stored but unused, and is left
      // alone so switching that bucket to shared restores its old split.
      const { groupSize } = state;
      const needsChange = (b: Bucket) => b.mode === "shared" && b.headcount !== groupSize;
      if (!state.buckets.some(needsChange)) return state;
      const apply = (b: Bucket): Bucket => (needsChange(b) ? { ...b, headcount: groupSize } : b);
      const [stay, events, tables, transport, food] = state.buckets;
      return {
        ...state,
        buckets: [apply(stay), apply(events), apply(tables), apply(transport), apply(food)],
      };
    }
    case "setCurrency": {
      // Display only (DATA_MODEL §2.2): nothing but `currency` changes, so the stored naira
      // values, the rates and therefore the tier are untouched. An unknown code is ignored,
      // never written, like an unknown mode.
      if (!isCurrencyCode(action.currency) || action.currency === state.currency) return state;
      return { ...state, currency: action.currency };
    }
    case "setRate": {
      // Only the two known rates are written. The field rejects an out-of-range number before
      // it gets here (RANGES.rate, T5.2); this is the second line of defence (DATA_MODEL §2.2):
      // clamp into 50..100,000, so 0 or a negative rate can never be stored, and ignore a value
      // that isn't finite or has more than 2 decimals.
      if (action.rate !== "ngnPerUsd" && action.rate !== "ngnPerGbp") return state;
      const next = clampDecimal(action.value, RANGES.rate);
      if (next === null || next === state.rates[action.rate]) return state;
      return { ...state, rates: { ...state.rates, [action.rate]: next } };
    }
    case "resetRates": {
      // Back to the config defaults. Nothing else changes, and an unchanged state is returned as is.
      if (!ratesAreCustom(state.rates, DEFAULT_RATES)) return state;
      return { ...state, rates: { ...DEFAULT_RATES } };
    }
    case "loadState": {
      // Replaces the whole state with one read from a link or the snapshot. The caller passes
      // decoder output, and the reducer still sends it through the codec (DATA_MODEL §2.2,
      // second line of defence): encodeShare clamps every number into range (a non-finite one
      // becomes the minimum) and decodeShare rebuilds the bucket ids and order, so a state that
      // was built by hand and is out of range can never be stored. A valid state comes back
      // equal. If the codec somehow rejects it, the current state is kept.
      const checked = decodeShare(encodeShare(action.state));
      return checked.ok ? checked.state : state;
    }
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}
