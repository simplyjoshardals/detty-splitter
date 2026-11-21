/**
 * App state (DATA_MODEL.md §2). Plain TypeScript, no React, so it can be tested directly.
 * Only `selectPreset` exists so far. The editing, currency, rate and load actions arrive
 * in Slices 4, 5 and 8, together with their clamping.
 */
import { DEFAULT_RATES } from "@/config";
import { DEFAULT_PRESET_ID, PRESETS, type Preset } from "@/data/presets";
import type { AppState, PresetId } from "@/lib/types";

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

export type AppAction = { type: "selectPreset"; presetId: PresetId };

// When a second action type is added, end the switch with a `default` that assigns
// `action` to a `never` variable, so a forgotten case becomes a compile error.
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "selectPreset":
      // "Reset to preset" is this same action with the current presetId.
      return stateFromPreset(action.presetId, state);
  }
}
