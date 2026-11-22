"use client";

import { useMemo } from "react";
import {
  BedIcon,
  BeerBottleIcon,
  CarIcon,
  ChampagneIcon,
  TicketIcon,
} from "@phosphor-icons/react";
import { BUCKETS } from "@/data/buckets";
import { TIERS } from "@/data/tiers";
import { calculate } from "@/lib/calc";
import { RANGES } from "@/lib/input";
import { formatAmount } from "@/lib/money";
import type { Bucket, BucketId } from "@/lib/types";
import { useAppState } from "@/state/AppStateProvider";
import { LineItem } from "./LineItem";
import { NumberField } from "./NumberField";
import { TierStamp } from "./TierStamp";

// All icons share one component type.
const BUCKET_ICONS: Record<BucketId, typeof BedIcon> = {
  stay: BedIcon,
  events: TicketIcon,
  tables: ChampagneIcon,
  transport: CarIcon,
  food: BeerBottleIcon,
};

/** Prices are shown in naira until the currency toggle exists (T5.1 converts them). */
function describeLine(bucket: Bucket): string {
  const price = formatAmount(bucket.unitPriceNgn, "NGN");
  const base = `${price} ${BUCKETS[bucket.id].unitLabel} × ${bucket.quantity}`;
  if (bucket.mode === "perPerson") return `${base} · per person`;
  const ways = bucket.headcount === 1 ? "way" : "ways";
  return `${base} · split ${bucket.headcount} ${ways}`;
}

/** Results from the app state: line items (price editable), totals and the tier stamp. */
export function ResultsPanel() {
  const { state, dispatch } = useAppState();
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
          const headingId = `line-${bucket.id}-heading`;
          return (
            <LineItem
              key={bucket.id}
              label={BUCKETS[bucket.id].label}
              headingId={headingId}
              icon={BUCKET_ICONS[bucket.id]}
              amount={formatAmount(line.shareMinor, currency)}
              formula={describeLine(bucket)}
              priceField={
                <NumberField
                  label={`Price ${BUCKETS[bucket.id].unitLabel}`}
                  labelledBy={[headingId]}
                  prefix="₦"
                  range={RANGES.unitPriceNgn}
                  value={bucket.unitPriceNgn}
                  onCommit={(value) =>
                    dispatch({
                      type: "setBucketNumber",
                      bucketId: bucket.id,
                      field: "unitPriceNgn",
                      value,
                    })
                  }
                />
              }
            />
          );
        })}
      </ul>

      <dl className="flex flex-col gap-3 border-t-4 border-double border-ink pt-4">
        <div>
          <dt className="font-display text-[length:var(--t-sm)]">Per person</dt>
          <dd className="font-mono text-[length:var(--t-2xl)] font-bold leading-tight [overflow-wrap:anywhere]">
            {formatAmount(result.perPersonMinor, currency)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="min-w-0 text-[length:var(--t-sm)] text-muted">
            Group total · {groupSize} {groupSize === 1 ? "person" : "people"}
          </dt>
          <dd className="font-mono text-[length:var(--t-lg)] font-bold [overflow-wrap:anywhere]">
            {formatAmount(result.groupTotalMinor, currency)}
          </dd>
        </div>
      </dl>

      <TierStamp badge={result.tier.badge} tagline={result.tier.tagline} />
    </section>
  );
}
