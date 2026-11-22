"use client";

import { useEffect, useState } from "react";
import { ArrowCounterClockwiseIcon, CheckIcon } from "@phosphor-icons/react";
import { PRESETS } from "@/data/presets";
import { RANGES } from "@/lib/input";
import type { PresetId } from "@/lib/types";
import { useAppState } from "@/state/AppStateProvider";
import { HintMessage } from "./HintMessage";
import { hintText, useRowHint } from "./numberHint";
import { RoutePlates } from "./RoutePlates";
import { Stepper } from "./Stepper";

/** How long the status line stays after an action (DESIGN §5.9). */
const STATUS_MS = 6000;

/** The slot below the buttons: it holds the status line or the group size hint. */
const STATUS_ID = "trip-controls-status";

const TEXT_BUTTON =
  "inline-flex min-h-11 items-center gap-2 text-[length:var(--t-sm)] text-ink underline underline-offset-4 " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus) " +
  "active:bg-danfo active:text-danfo-ink";

/**
 * Route plates and the group row: group size, "Apply to all shared" and "Reset to preset"
 * (DESIGN §4, §5.3). Each of these can replace many numbers at once with no undo, so a
 * status line says what just happened, including when "Apply to all shared" had nothing
 * to change.
 *
 * The group size hint (typed 0, or text that isn't a number) shares the status slot below the
 * buttons, so it never pushes the buttons down while the user is reaching for one (DESIGN §4).
 * The latest message wins: an action's status replaces the hint, and the status says the
 * number that was kept ("Shared items already split 4 ways.").
 */
export function TripControls() {
  const { state, dispatch } = useAppState();
  const [status, setStatus] = useState<string | null>(null);
  const { groupSize } = state;
  const hints = useRowHint<"groupSize">({ groupSize });

  useEffect(() => {
    if (status === null) return;
    const timer = setTimeout(() => setStatus(null), STATUS_MS);
    return () => clearTimeout(timer);
  }, [status]);

  /** A status is newer than any hint, so it takes the one slot. */
  function say(message: string) {
    hints.clear();
    setStatus(message);
  }

  function selectRoute(presetId: PresetId) {
    dispatch({ type: "selectPreset", presetId });
    say(`Route set to ${PRESETS[presetId].label}.`);
  }

  function resetToPreset() {
    // Reset is the same action as picking a plate, for the plate already picked.
    dispatch({ type: "selectPreset", presetId: state.presetId });
    say(`Reset to ${PRESETS[state.presetId].label}.`);
  }

  function applyToShared() {
    const shared = state.buckets.filter((b) => b.mode === "shared");
    const changing = shared.filter((b) => b.headcount !== groupSize).length;
    if (shared.length === 0) {
      say("No shared items to change.");
    } else if (changing === 0) {
      say(`Shared items already split ${groupSize} ${groupSize === 1 ? "way" : "ways"}.`);
    } else {
      dispatch({ type: "applyGroupSizeToShared" });
      say(
        `Set ${changing} shared ${changing === 1 ? "item" : "items"} to ${groupSize} ${groupSize === 1 ? "person" : "people"}.`,
      );
    }
  }

  return (
    <div className="flex flex-col gap-6 border-b-2 border-dashed border-rule pb-1">
      <RoutePlates value={state.presetId} onChange={selectRoute} />
      <div>
        <Stepper
          label="Group size"
          range={RANGES.groupSize}
          value={groupSize}
          suffix={groupSize === 1 ? "person" : "people"}
          onCommit={(value) => dispatch({ type: "setGroupSize", value })}
          hintId={STATUS_ID}
          {...hints.forField("groupSize")}
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
        {/* Always in the page, and two lines high (16px each) even when empty, so a hint or a
            wrapped status never shifts the list below. Nothing tappable is under it. The row's
            bottom padding is only 4px because this slot already supplies the space. */}
        <div
          id={STATUS_ID}
          role="status"
          className="mt-1 min-h-8 text-[length:var(--t-xs)] leading-4"
        >
          {hints.active !== null ? (
            <HintMessage
              hint={hints.active.hint}
              field="Group size"
              text={hintText(hints.active.hint, RANGES.groupSize, "")}
            />
          ) : (
            status !== null && (
              <p className="flex items-start gap-1.5">
                <CheckIcon size={16} weight="bold" aria-hidden="true" className="shrink-0" />
                <span>{status}</span>
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
