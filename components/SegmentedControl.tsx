"use client";

import { useId } from "react";
import type { UserIcon } from "@phosphor-icons/react";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Shown in `bold` weight, and in `fill` weight when selected. */
  icon: typeof UserIcon;
}

interface SegmentedControlProps<T extends string> {
  /** Visible group label, e.g. "Cost split". */
  label: string;
  /** Short muted text on the label's row, e.g. "Prices stay in ₦". Never changes the row's height. */
  note?: string;
  /** Ids of other visible elements that join the label in the group's accessible name. */
  labelledBy?: readonly string[];
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Native radios with custom visuals (DESIGN §5.5), so the arrow keys move the selection
 * for free. The selected segment has a thick inner ink frame, bold text and a `fill` icon:
 * shape and weight, never colour alone. It is deliberately not an ink block, because five of
 * them in a list outweighed the totals (T4.4). Generic, so T5.1 can reuse it for the currency control.
 */
export function SegmentedControl<T extends string>({
  label,
  note,
  labelledBy = [],
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const id = useId();
  const labelId = `${id}-label`;
  const noteId = `${id}-note`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="block text-[length:var(--t-xs)] text-muted">
          {label}
        </span>
        {note !== undefined && (
          <span id={noteId} className="text-right text-[length:var(--t-xs)] text-muted">
            {note}
          </span>
        )}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={[labelId, ...labelledBy].join(" ")}
        aria-describedby={note !== undefined ? noteId : undefined}
        className="mt-2 grid grid-flow-col auto-cols-[minmax(max-content,1fr)]"
      >
        {options.map((option, i) => {
          const selected = option.value === value;
          const Icon = option.icon;
          return (
            <label key={option.value} className={`relative flex cursor-pointer ${i > 0 ? "-ml-0.5" : ""}`}>
              <input
                type="radio"
                name={id}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span
                className="flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap border-2 border-ink bg-surface px-2 text-[length:var(--t-sm)] text-ink peer-checked:relative peer-checked:z-[1] peer-checked:font-bold peer-checked:shadow-[inset_0_0_0_3px_var(--ink)] peer-focus-visible:relative peer-focus-visible:z-10 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--focus)"
              >
                <Icon size={20} weight={selected ? "fill" : "bold"} aria-hidden="true" />
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
