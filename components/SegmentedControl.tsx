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
  /** Ids of other visible elements that join the label in the group's accessible name. */
  labelledBy?: readonly string[];
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Native radios with custom visuals (DESIGN §5.5), so the arrow keys move the selection
 * for free. The selected segment is filled with ink, with a `fill` icon: shape and
 * weight as well as colour. Generic, so T5.1 can reuse it for the currency control.
 */
export function SegmentedControl<T extends string>({
  label,
  labelledBy = [],
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const id = useId();
  const labelId = `${id}-label`;

  return (
    <div>
      <span id={labelId} className="block text-[length:var(--t-xs)] text-muted">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={[labelId, ...labelledBy].join(" ")}
        className="mt-2 grid grid-flow-col auto-cols-fr"
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
                className="flex h-11 w-full items-center justify-center gap-2 border-2 border-ink bg-surface px-2 text-[length:var(--t-sm)] text-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:relative peer-focus-visible:z-10 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--focus)"
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
