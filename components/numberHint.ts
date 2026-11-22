import { useState } from "react";
import { formatNumberInput, type NumberRange, type ParseResult } from "@/lib/input";

/**
 * What the last commit told the user. `forValue` is the saved number the hint was about:
 * when the saved number changes some other way (a preset switch), the hint goes away.
 */
export type Hint =
  | { kind: "clamped"; bound: "min" | "max"; forValue: number }
  | { kind: "reverted"; reason: "empty" | "invalid"; forValue: number };

export function hintFromResult(result: ParseResult): Hint | null {
  switch (result.status) {
    case "ok":
      return null;
    case "clamped":
      return { kind: "clamped", bound: result.bound, forValue: result.value };
    case "reverted":
      return { kind: "reverted", reason: result.reason, forValue: result.value };
  }
}

/** Hint copy from DESIGN §9. */
export function hintText(hint: Hint, range: NumberRange, prefix: string): string {
  if (hint.kind === "clamped") {
    const limit = hint.bound === "max" ? range.max : range.min;
    const name = hint.bound === "max" ? "Max" : "Min";
    return `${name} is ${prefix}${formatNumberInput(limit)}, so we adjusted it.`;
  }
  return hint.reason === "empty"
    ? "Nothing there, so we kept your old number."
    : "That number no make sense. We kept your old one.";
}

/** What a field needs from its row to show its hint in the row's shared slot. */
export interface FieldHintProps {
  /** The hint to show for this field, or null (none, or it belongs to another field). */
  hint: Hint | null;
  onHintChange: (hint: Hint | null) => void;
}

/**
 * One hint per row (DESIGN §4). A row with several fields (a bucket has price, quantity and
 * headcount) shows at most one hint, in one slot below all its controls, so a hint appearing
 * never moves a control the user is about to tap. The latest commit or focus wins.
 *
 * `values` holds each field's saved number. A hint is dropped as soon as its field's saved
 * number is no longer the one it was about (a preset switch, a reset). That is done while
 * rendering, so there is no effect and no frame with a stale hint.
 */
export function useRowHint<F extends string>(values: Readonly<Record<F, number>>) {
  const [stored, setStored] = useState<{ field: F; hint: Hint } | null>(null);

  const active =
    stored !== null && values[stored.field] === stored.hint.forValue ? stored : null;
  if (stored !== null && active === null) setStored(null);

  function forField(field: F): FieldHintProps {
    return {
      hint: active !== null && active.field === field ? active.hint : null,
      onHintChange: (hint) => setStored(hint === null ? null : { field, hint }),
    };
  }

  /** The hint to show in the row's slot, and which field it came from. */
  return { active, forField, clear: () => setStored(null) };
}
