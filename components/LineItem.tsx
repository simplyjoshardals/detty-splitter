import type { ReactNode } from "react";
import type { BedIcon } from "@phosphor-icons/react";

interface LineItemProps {
  label: string;
  /** Id for the label, so the fields inside can name themselves after it. */
  headingId: string;
  icon: typeof BedIcon;
  /** Your share, already formatted for the display currency. */
  amount: string;
  /** What the line adds up to, e.g. "₦1,050,000 total ÷ 4". Never repeats the price. */
  formula: string;
  /** Id of the hint slot below the controls. The fields point `aria-describedby` at it. */
  hintId: string;
  /** The row's one hint, or null. It takes the formula line's place (DESIGN §4). */
  hint: ReactNode;
  priceField: ReactNode;
  quantityField: ReactNode;
  modeField: ReactNode;
  /** Only passed when the line is shared. */
  headcountField?: ReactNode;
}

/**
 * One bucket (DESIGN §5.4). Dashed-rule separated, not boxed.
 * Price and quantity stack below 480px and sit side by side from 480px up.
 *
 * The last row is one reserved two-line slot (32px) that holds the formula or, when a field
 * has something to say, that field's hint. It sits below every control, so a hint appearing
 * moves nothing the user might be about to tap, and being reserved it moves nothing below
 * it either. The 16px line height is set here so the 32px is exact. Bottom padding is 8px, not
 * 16px, because the slot's spare line already adds space under a one-line formula.
 */
export function LineItem({
  label,
  headingId,
  icon: Icon,
  amount,
  formula,
  hintId,
  hint,
  priceField,
  quantityField,
  modeField,
  headcountField,
}: LineItemProps) {
  return (
    <li className="flex gap-3 border-b-2 border-dashed border-rule pt-4 pb-2 last:border-b-0">
      <span className="flex size-8 shrink-0 items-center justify-center border-2 border-ink">
        <Icon size={20} weight="bold" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3
            id={headingId}
            className="min-w-0 font-display text-[length:var(--t-sm)] leading-tight"
          >
            {label}
          </h3>
          <p className="shrink-0 whitespace-nowrap font-mono text-[length:var(--t-base)] font-bold">
            {amount}
          </p>
        </div>
        <div className="mt-3 flex flex-col gap-4 min-[480px]:flex-row min-[480px]:items-start min-[480px]:gap-3">
          <div className="min-w-0 flex-1">{priceField}</div>
          {/* Lines up with the middle of the 48px price box: 18px label + 8px gap + 24px. */}
          <span
            aria-hidden="true"
            className="hidden h-12 items-center font-mono text-[length:var(--t-base)] text-muted min-[480px]:mt-[26px] min-[480px]:flex"
          >
            ×
          </span>
          {/* Fixed at the stepper's own width (44 + 56 + 44px) so a hint under it wraps inside
              the column instead of widening it and squeezing the price field. */}
          <div className="min-[480px]:w-36 min-[480px]:shrink-0">{quantityField}</div>
        </div>
        <div className="mt-4">{modeField}</div>
        {headcountField != null && <div className="mt-4">{headcountField}</div>}
        <div className="mt-3 min-h-8 text-[length:var(--t-xs)] leading-4">
          {/* Always in the page, so screen readers announce a hint when it appears. The
              formula stays outside it: it changes on every edit and shouldn't be announced. */}
          <div id={hintId} role="status">
            {hint}
          </div>
          {hint == null && <p className="text-muted">{formula}</p>}
        </div>
      </div>
    </li>
  );
}
