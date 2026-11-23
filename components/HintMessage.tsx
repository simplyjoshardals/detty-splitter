import { WarningIcon } from "@phosphor-icons/react";
import type { Hint } from "./numberHint";

interface HintMessageProps {
  hint: Hint;
  /** Which field the hint is about, e.g. "Price" or "Nights". The hint sits below the whole
   * row, not under its field, so it has to say which field it means (DESIGN §5.2). */
  field: string;
  /** Copy from `hintText`. */
  text: string;
}

/**
 * The hint line (DESIGN §5.2): icon plus 12px text, so it never relies on colour alone.
 * A revert is `--danger` (the typed number was thrown away: empty, invalid, and for the rates
 * out of range or too many decimals); a clamp is `--ink` (the number was adjusted but kept).
 * Starts with the field's name in bold ("Nights: Max is 999, so we adjusted it."), because it is
 * drawn below the whole row and a clamp has no red border to point at the field.
 * Rendered inside the row's reserved `role="status"` slot, never in the flow of a field.
 */
export function HintMessage({ hint, field, text }: HintMessageProps) {
  return (
    <p
      className={`flex items-start gap-1.5 ${
        hint.kind === "reverted" ? "text-danger" : "text-ink"
      }`}
    >
      <WarningIcon size={16} weight="bold" aria-hidden="true" className="shrink-0" />
      <span>
        <span className="font-bold">{field}:</span> {text}
      </span>
    </p>
  );
}
