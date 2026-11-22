/**
 * App state (DATA_MODEL.md §2). Plain TypeScript, no React, so it can be tested directly.
 * `selectPreset` and `setBucketNumber` exist so far. The other editing, currency, rate and
 * load actions arrive in Slices 4, 5 and 8, together with their clamping.
 */
import { DEFAULT_RATES } from "@/config";
import { DEFAULT_PRESET_ID, PRESETS, type Preset } from "@/data/presets";
import { RANGES, clampInteger } from "@/lib/input";
import type { AppState, Bucket, BucketId, PresetId } from "@/lib/types";

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

/** The numeric fields of one bucket that the user can type into. */
export type BucketNumberField = "unitPriceNgn" | "quantity" | "headcount";

export type AppAction =
  | { type: "selectPreset"; presetId: PresetId }
  | { type: "setBucketNumber"; bucketId: BucketId; field: BucketNumberField; value: number };

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

      const edit = (b: Bucket): Bucket =>
        b.id === action.bucketId ? { ...b, [action.field]: next } : b;
      const [stay, events, tables, transport, food] = state.buckets;
      return {
        ...state,
        buckets: [edit(stay), edit(events), edit(tables), edit(transport), edit(food)],
      };
    }
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}
