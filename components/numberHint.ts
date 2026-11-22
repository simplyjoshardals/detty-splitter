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
