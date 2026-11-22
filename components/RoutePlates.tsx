"use client";

import { useId } from "react";
import { BusIcon, CheckIcon, ConfettiIcon, CrownSimpleIcon } from "@phosphor-icons/react";
import { PRESETS, PRESET_ORDER } from "@/data/presets";
import type { PresetId } from "@/lib/types";

// All icons share one component type.
const PLATE_ICONS: Record<PresetId, typeof BusIcon> = {
  budget: BusIcon,
  soft: ConfettiIcon,
  baller: CrownSimpleIcon,
};

interface RoutePlatesProps {
  value: PresetId;
  onChange: (presetId: PresetId) => void;
}

/**
 * The three presets as danfo route plates (DESIGN §5.3). Native radios with custom
 * visuals, so the arrow keys move the selection for free. The selected plate is told
 * apart by shape as well as colour: yellow fill, `fill` icon, 3px border, hard shadow
 * and a check badge (yellow on paper is only 1.4:1). Both states have the same outer
 * size: the 1px of extra border is taken out of the padding, so nothing shifts. The right
 * padding makes room for the check badge only when the plate is a row (under 480px); in a
 * column the badge sits beside the icon and the text can use the full width.
 */
export function RoutePlates({ value, onChange }: RoutePlatesProps) {
  const name = useId();

  return (
    <fieldset>
      <legend className="mb-3 font-display text-[length:var(--t-sm)]">Pick your route</legend>
      <div className="grid gap-3 min-[480px]:grid-cols-3">
        {PRESET_ORDER.map((id) => {
          const preset = PRESETS[id];
          const selected = id === value;
          const Icon = PLATE_ICONS[id];
          return (
            <label key={id} className="flex cursor-pointer">
              <input
                type="radio"
                name={name}
                value={id}
                checked={selected}
                onChange={() => onChange(id)}
                className="peer sr-only"
              />
              <span
                className={`relative flex w-full items-center gap-3 border-ink peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--focus) min-[480px]:flex-col min-[480px]:items-start min-[480px]:gap-2 ${
                  selected
                    ? "border-[3px] bg-danfo p-[11px] pr-[39px] text-danfo-ink [box-shadow:var(--shadow-hard)] min-[480px]:pr-[11px]"
                    : "border-2 bg-paper p-3 pr-10 text-ink min-[480px]:pr-3"
                }`}
              >
                <Icon size={28} weight={selected ? "fill" : "bold"} aria-hidden="true" className="shrink-0" />
                <span className="min-w-0">
                  <span className="block font-display text-[length:var(--t-sm)] leading-tight">
                    {preset.label}
                  </span>
                  <span
                    className={`mt-1 block text-[length:var(--t-xs)] ${selected ? "text-danfo-ink" : "text-muted"}`}
                  >
                    {preset.blurb}
                  </span>
                </span>
                {selected && (
                  <span
                    aria-hidden="true"
                    className="absolute right-2 top-2 flex size-6 items-center justify-center bg-ink text-paper"
                  >
                    <CheckIcon size={16} weight="bold" />
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
