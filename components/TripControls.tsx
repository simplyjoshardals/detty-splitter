"use client";

import { useEffect, useState } from "react";
import { ArrowCounterClockwiseIcon, CheckIcon } from "@phosphor-icons/react";
import { PRESETS } from "@/data/presets";
import { RANGES } from "@/lib/input";
import type { PresetId } from "@/lib/types";
import { useAppState } from "@/state/AppStateProvider";
import { RoutePlates } from "./RoutePlates";
import { Stepper } from "./Stepper";

/** How long the status line stays after an action (DESIGN §5.9). */
const STATUS_MS = 6000;

const TEXT_BUTTON =
  "inline-flex min-h-11 items-center gap-2 text-[length:var(--t-sm)] text-ink underline underline-offset-4 " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus) " +
  "active:bg-danfo active:text-danfo-ink";

/**
 * Route plates and the group row: group size, "Apply to all shared" and "Reset to preset"
 * (DESIGN §4, §5.3). Each of these can replace many numbers at once with no undo, so a
 * status line says what just happened, including when "Apply to all shared" had nothing
 * to change.
 */
export function TripControls() {
  const { state, dispatch } = useAppState();
  const [status, setStatus] = useState<string | null>(null);
  const { groupSize } = state;

  useEffect(() => {
    if (status === null) return;
    const timer = setTimeout(() => setStatus(null), STATUS_MS);
    return () => clearTimeout(timer);
  }, [status]);

  function selectRoute(presetId: PresetId) {
    dispatch({ type: "selectPreset", presetId });
    setStatus(`Route set to ${PRESETS[presetId].label}.`);
  }

  function resetToPreset() {
    // Reset is the same action as picking a plate, for the plate already picked.
    dispatch({ type: "selectPreset", presetId: state.presetId });
    setStatus(`Reset to ${PRESETS[state.presetId].label}.`);
  }

  function applyToShared() {
    const shared = state.buckets.filter((b) => b.mode === "shared");
    const changing = shared.filter((b) => b.headcount !== groupSize).length;
    if (shared.length === 0) {
      setStatus("No shared items to change.");
    } else if (changing === 0) {
      setStatus(`Shared items already split ${groupSize} ${groupSize === 1 ? "way" : "ways"}.`);
    } else {
      dispatch({ type: "applyGroupSizeToShared" });
      setStatus(
        `Set ${changing} shared ${changing === 1 ? "item" : "items"} to ${groupSize} ${groupSize === 1 ? "person" : "people"}.`,
      );
    }
  }

  return (
    <div className="flex flex-col gap-6 border-b-2 border-dashed border-rule pb-2">
      <RoutePlates value={state.presetId} onChange={selectRoute} />
      <div>
        <Stepper
          label="Group size"
          range={RANGES.groupSize}
          value={groupSize}
          suffix={groupSize === 1 ? "person" : "people"}
          onCommit={(value) => dispatch({ type: "setGroupSize", value })}
        />
        <div className="mt-2 flex flex-wrap gap-x-5">
          <button type="button" onClick={applyToShared} className={TEXT_BUTTON}>
            Apply to all shared
          </button>
          <button type="button" onClick={resetToPreset} className={TEXT_BUTTON}>
            <ArrowCounterClockwiseIcon size={20} weight="bold" aria-hidden="true" />
            Reset to preset
          </button>
        </div>
        {/* Always in the page, and one line high even when empty, so the list below never shifts. */}
        <div role="status" className="min-h-5 text-[length:var(--t-xs)]">
          {status !== null && (
            <p className="flex items-start gap-1.5">
              <CheckIcon size={16} weight="bold" aria-hidden="true" className="shrink-0" />
              <span>{status}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
