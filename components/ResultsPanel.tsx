"use client";

import { useMemo } from "react";
import { TIERS } from "@/data/tiers";
import { calculate } from "@/lib/calc";
import { formatAmount } from "@/lib/money";
import { useAppState } from "@/state/AppStateProvider";
import { BucketLine } from "./BucketLine";
import { TierStamp } from "./TierStamp";

/** Results from the app state: editable line items, totals and the tier stamp. */
export function ResultsPanel() {
  const { state } = useAppState();
  const result = useMemo(() => calculate(state, TIERS), [state]);
  const { currency, groupSize } = state;

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
          <dd className="font-mono text-[length:var(--t-2xl)] font-bold leading-tight [overflow-wrap:anywhere]">
            {formatAmount(result.perPersonMinor, currency)}
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
