"use client";

import { useId, useMemo } from "react";
import { buildReceiptView, RECEIPT_COPY } from "@/lib/receipt/view";
import { useAppState } from "@/state/AppStateProvider";
import { TierStamp } from "./TierStamp";
import { totalSizeToken, type TotalSizeToken } from "./totalSize";

// Whole class names, so Tailwind can see them when it scans the source.
const TOTAL_SIZE_CLASS: Record<TotalSizeToken, string> = {
  "--t-2xl": "text-[length:var(--t-2xl)]",
  "--t-xl": "text-[length:var(--t-xl)]",
  "--t-lg": "text-[length:var(--t-lg)]",
};

/**
 * Printer slot and the live receipt hanging from it (DESIGN §5.13, §7). The bands follow the
 * export table top to bottom: danfo band and stripe, POS header, lines, double rule, totals,
 * status, stamp, balance line, footer lines, danfo band with the site URL. All text comes from
 * `buildReceiptView`, so the screen and the PNG say the same thing; this component does no maths.
 *
 * - `id="receipt"` and `tabIndex={-1}` are what the damage meter's "See receipt" jumps to and
 *   focuses (DESIGN §4). The ring is drawn outside the paper, on the page.
 * - It is a fixed-cream object in both themes: the `on-receipt` scope (globals.css) gives it
 *   the `--receipt-*` colours.
 * - Nothing here is a live region: the meter announces the totals once an edit has settled.
 * - Always the same height class of content (five lines, a stamp block that reserves two
 *   lines), so a tier change never moves the page.
 */
export function Receipt() {
  const { state } = useAppState();
  const view = useMemo(() => buildReceiptView(state), [state]);
  const headingId = useId();

  return (
    <section
      id="receipt"
      tabIndex={-1}
      aria-labelledby={headingId}
      className="on-receipt mx-auto w-full max-w-[380px] scroll-mt-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
    >
      <h2 id={headingId} className="sr-only">
        Receipt
      </h2>

      {/* The slot: black, 10px high, 4px radius. The light border keeps it visible on the dark page. */}
      <div aria-hidden="true" className="h-2.5 rounded-md border border-rule bg-ink" />

      <div className="mx-2 bg-(--receipt-paper) text-ink shadow-[0_0_0_1px_var(--rule)]">
        <p className="bg-danfo px-3 py-3 text-center font-display text-[length:var(--t-base)] leading-none text-danfo-ink">
          {view.title.toUpperCase()}
        </p>
        <div aria-hidden="true" className="h-[var(--stripe)] bg-danfo-ink" />

        <div className="px-3">
          <div className="py-3 text-center text-[length:var(--t-xs)] leading-5">
            {RECEIPT_COPY.posHeader.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>

          <ul className="border-t border-dashed border-rule">
            {view.lines.map((line) => (
              <li
                key={line.label}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-dashed border-rule py-2"
              >
                <span className="text-[length:var(--t-sm)] leading-5">{line.label}</span>
                <span className="whitespace-nowrap text-right font-mono text-[length:var(--t-base)] font-bold leading-5">
                  {line.yourShare}
                </span>
                <span className="col-span-2 text-[length:var(--t-xs)] leading-4 text-muted [overflow-wrap:anywhere]">
                  {line.formula}
                </span>
              </li>
            ))}
          </ul>

          <dl className="flex flex-col gap-3 border-t-4 border-double border-ink pt-4">
            <div>
              <dt className="font-display text-[length:var(--t-sm)]">PER PERSON</dt>
              {/* Size by length first; nowrap plus overflow-wrap is only the safety net. */}
              <dd
                className={`whitespace-nowrap font-mono font-bold leading-tight [overflow-wrap:anywhere] ${
                  TOTAL_SIZE_CLASS[totalSizeToken(view.perPersonTotal)]
                }`}
              >
                {view.perPersonTotal}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <dt className="text-[length:var(--t-sm)] text-muted">GROUP ({view.groupSize})</dt>
              <dd className="ml-auto max-w-full font-mono text-[length:var(--t-base)] font-bold [overflow-wrap:anywhere]">
                {view.groupTotal}
              </dd>
            </div>
          </dl>

          <p className="pt-4 text-center text-[length:var(--t-sm)] font-bold">{RECEIPT_COPY.status}</p>

          <TierStamp badge={view.badge} tagline={view.tagline} />

          <div className="flex flex-col gap-1 pb-4 text-center">
            <p className="text-[length:var(--t-sm)] font-bold">{view.balanceLine}</p>
            <p className="text-[length:var(--t-xs)] leading-4 text-muted">AUTH: {view.authCode}</p>
            <p className="text-[length:var(--t-xs)] leading-4 text-muted">{RECEIPT_COPY.customerCopy}</p>
            <p className="text-[length:var(--t-xs)] leading-4 text-muted">{view.ratesNote}</p>
          </div>
        </div>

        <p className="bg-danfo px-3 py-3 text-center font-mono text-[length:var(--t-xs)] font-bold leading-4 text-danfo-ink [overflow-wrap:anywhere]">
          {view.siteUrl}
        </p>
      </div>
    </section>
  );
}
