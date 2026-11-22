/**
 * App state (DATA_MODEL.md §2). Plain TypeScript, no React, so it can be tested directly.
 * `selectPreset`, `setBucketNumber`, `setBucketMode`, `setGroupSize` and
 * `applyGroupSizeToShared` exist so far. The currency, rate and load actions arrive in
 * Slices 5 and 8, together with their clamping.
 */
import { DEFAULT_RATES } from "@/config";
import { DEFAULT_PRESET_ID, PRESETS, type Preset } from "@/data/presets";
import { RANGES, clampInteger } from "@/lib/input";
import type { AppState, Bucket, BucketId, Mode, PresetId } from "@/lib/types";

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
  | { type: "applyGroupSizeToShared" };

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
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}
