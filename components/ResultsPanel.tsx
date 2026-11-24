"use client";

import { useMemo } from "react";
import { TIERS } from "@/data/tiers";
import { calculate } from "@/lib/calc";
import { useAppState } from "@/state/AppStateProvider";
import { BucketLine } from "./BucketLine";
import { RatesPanel } from "./RatesPanel";

/**
 * Results from the app state: the editable line items and the rates panel. The totals and the
 * tier stamp live in the receipt since T6.3 (DESIGN §4).
 */
export function ResultsPanel() {
  const { state } = useAppState();
  const result = useMemo(() => calculate(state, TIERS), [state]);
  const { currency, rates } = state;

  return (
    <section aria-labelledby="results-heading">
      <h2 id="results-heading" className="sr-only">
        Your damage
      </h2>

      <ul>
        {state.buckets.map((bucket, i) => {
          const line = result.lines[i];
          if (!line) return null;
          return <BucketLine
              key={bucket.id}
              bucket={bucket}
              line={line}
              currency={currency}
              rates={rates}
            />;
        })}
      </ul>

      <RatesPanel />
    </section>
  );
}