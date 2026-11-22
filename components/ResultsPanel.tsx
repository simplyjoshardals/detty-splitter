"use client";

import { useMemo } from "react";
import { TIERS } from "@/data/tiers";
import { calculate } from "@/lib/calc";
import { formatAmount } from "@/lib/money";
import { useAppState } from "@/state/AppStateProvider";
import { BucketLine } from "./BucketLine";
import { TierStamp } from "./TierStamp";

/** Type tokens the per-person total may use (DESIGN §3). */
export type TotalSizeToken = "--t-2xl" | "--t-xl";

/**
 * The per-person total is 40px (`--t-2xl`) while it fits one line and 28px (`--t-xl`) once it
 * is 12 characters or more. Space Mono is about 0.61em wide, so 11 characters at 40px are
 * about 269px, inside the 288px column at 320px; 12 would be about 294px and would not fit.
 * Counted in characters, not UTF-16 units, so "₦" counts as one.
 */
export function totalSizeToken(text: string): TotalSizeToken {
  return [...text].length <= 11 ? "--t-2xl" : "--t-xl";
}

// Whole class names, so Tailwind can see them when it scans the source.
const TOTAL_SIZE_CLASS: Record<TotalSizeToken, string> = {
  "--t-2xl": "text-[length:var(--t-2xl)]",
  "--t-xl": "text-[length:var(--t-xl)]",
};

/** Results from the app state: editable line items, totals and the tier stamp. */
export function ResultsPanel() {
  const { state } = useAppState();
  const result = useMemo(() => calculate(state, TIERS), [state]);
  const { currency, groupSize } = state;
  const perPerson = formatAmount(result.perPersonMinor, currency);

  return (
    <section aria-labelledby="results-heading">
      <h2 id="results-heading" className="sr-only">
        Your damage
      </h2>

      <ul>
        {state.buckets.map((bucket, i) => {
          const line = result.lines[i];
          if (!line) return null;
          return <BucketLine key={bucket.id} bucket={bucket} line={line} currency={currency} />;
        })}
      </ul>

      <dl className="flex flex-col gap-3 border-t-4 border-double border-ink pt-4">
        <div>
          <dt className="font-display text-[length:var(--t-sm)]">Per person</dt>
          {/* Size by length first; nowrap plus overflow-wrap is only the safety net. */}
          <dd
            className={`whitespace-nowrap font-mono font-bold leading-tight [overflow-wrap:anywhere] ${
              TOTAL_SIZE_CLASS[totalSizeToken(perPerson)]
            }`}
          >
            {perPerson}
          </dd>
        </div>
        {/* Wraps instead of squeezing: at max values the amount drops below the label. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <dt className="min-w-0 text-[length:var(--t-sm)] text-muted">
            Group total · {groupSize} {groupSize === 1 ? "person" : "people"}
          </dt>
          <dd className="ml-auto max-w-full font-mono text-[length:var(--t-lg)] font-bold [overflow-wrap:anywhere]">
            {formatAmount(result.groupTotalMinor, currency)}
          </dd>
        </div>
      </dl>

      <TierStamp badge={result.tier.badge} tagline={result.tier.tagline} />
    </section>
  );
}
