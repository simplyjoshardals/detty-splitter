import { WarningIcon } from "@phosphor-icons/react";
import type { Hint } from "./numberHint";

interface HintMessageProps {
  hint: Hint;
  /** Copy from `hintText`. */
  text: string;
}

/**
 * The hint line (DESIGN §5.2): icon plus 12px text, so it never relies on colour alone.
 * An empty or invalid revert is `--danger`; a clamp is `--ink`.
 * Rendered inside the row's reserved `role="status"` slot, never in the flow of a field.
 */
export function HintMessage({ hint, text }: HintMessageProps) {
  return (
    <p
      className={`flex items-start gap-1.5 ${
        hint.kind === "reverted" ? "text-danger" : "text-ink"
      }`}
    >
      <WarningIcon size={16} weight="bold" aria-hidden="true" className="shrink-0" />
      <span>{text}</span>
    </p>
  );
}
