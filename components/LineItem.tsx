import type { BedIcon } from "@phosphor-icons/react";

interface LineItemProps {
  label: string;
  icon: typeof BedIcon;
  /** Your share, already formatted for the display currency. */
  amount: string;
  /** e.g. "₦150,000 per night × 7 · split 4 ways" */
  formula: string;
}

/** One bucket, read-only (DESIGN §5.4). Dashed-rule separated, not boxed. */
export function LineItem({ label, icon: Icon, amount, formula }: LineItemProps) {
  return (
    <li className="flex gap-3 border-b-2 border-dashed border-rule py-4 last:border-b-0">
      <span className="flex size-8 shrink-0 items-center justify-center border-2 border-ink">
        <Icon size={20} weight="bold" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 font-display text-[length:var(--t-sm)] leading-tight">
            {label}
          </h3>
          <p className="shrink-0 whitespace-nowrap font-mono text-[length:var(--t-base)] font-bold">
            {amount}
          </p>
        </div>
        <p className="mt-1 text-[length:var(--t-xs)] text-muted">{formula}</p>
      </div>
    </li>
  );
}
