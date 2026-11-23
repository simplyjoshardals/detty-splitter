"use client";

import { useEffect, useId, useState } from "react";
import { ArrowCounterClockwiseIcon, CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { DEFAULT_RATES, RATES_AS_OF } from "@/config";
import { RANGES } from "@/lib/input";
import { formatAsOfDate, ratesAreCustom } from "@/lib/rates";
import type { Rates } from "@/lib/types";
import { useAppState } from "@/state/AppStateProvider";
import { HintMessage } from "./HintMessage";
import { NumberField } from "./NumberField";
import { hintText, useRowHint } from "./numberHint";

/** How long the status line stays after an action (DESIGN §5.9). */
const STATUS_MS = 6000;

/** Same look as the group row's text buttons (DESIGN §5.1). */
const TEXT_BUTTON =
  "inline-flex min-h-11 items-center gap-2 text-[length:var(--t-sm)] text-ink underline underline-offset-4 " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus) " +
  "active:bg-danfo active:text-danfo-ink";

/** The visible label doubles as the hint's field name ("₦ per $1: Use 50 to 100,000 ..."). */
const RATE_FIELDS: readonly { key: keyof Rates; label: string }[] = [
  { key: "ngnPerUsd", label: "₦ per $1" },
  { key: "ngnPerGbp", label: "₦ per £1" },
];

/**
 * Exchange rates (DESIGN §4 item 5, §5.10): a collapsed "Rates" row that opens inline.
 *
 * - The row always shows which rates are in use: "as of <date>" for the defaults, or a
 *   "Custom rates" tag as soon as either rate differs (derived from the state, never stored).
 *   It is a tag with a frame, not just a colour, so it reads in greyscale.
 * - Two rate fields with up to 2 decimals. A number outside 50 to 100,000, or with more than 2
 *   decimals, keeps the old rate and says so; 0 is outside the range.
 * - One hint per row (DESIGN §4): the field only reports it, and the row draws it in one reserved
 *   two-line slot below every control, shared with the status line. The latest message wins.
 * - The panel stays in the page while closed (`hidden`), so the toggle's `aria-controls` is valid.
 *   It opens with no animation, so there is nothing to switch off for reduced motion.
 */
export function RatesPanel() {
  const { state, dispatch } = useAppState();
  const { rates } = state;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const hints = useRowHint<keyof Rates>(rates);
  const id = useId();
  const panelId = `${id}-panel`;
  const headingId = `${id}-heading`;
  const statusId = `${id}-status`;

  const custom = ratesAreCustom(rates, DEFAULT_RATES);

  useEffect(() => {
    if (status === null) return;
    const timer = setTimeout(() => setStatus(null), STATUS_MS);
    return () => clearTimeout(timer);
  }, [status]);

  /** A status is newer than any hint, so it takes the one slot. */
  function say(message: string) {
    hints.clear();
    setStatus(message);
  }

  function toggle() {
    // Nothing from the last visit should greet the next one.
    hints.clear();
    setStatus(null);
    setOpen((wasOpen) => !wasOpen);
  }

  function resetRates() {
    if (!custom) {
      say("Rates already at the defaults.");
      return;
    }
    dispatch({ type: "resetRates" });
    say("Rates reset to the defaults.");
  }

  return (
    <section aria-labelledby={headingId} className="mb-4 border-t-2 border-dashed border-rule">
      <h3 id={headingId}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus) active:bg-danfo active:text-danfo-ink"
        >
          <span className="font-display text-[length:var(--t-sm)]">Rates</span>{" "}
          <span className="flex items-center gap-2 text-[length:var(--t-xs)]">
            {custom ? (
              <span className="border-2 border-ink px-1.5 py-0.5 font-bold text-ink">
                Custom rates
              </span>
            ) : (
              <span className="text-muted">as of {formatAsOfDate(RATES_AS_OF)}</span>
            )}
            <CaretDownIcon
              size={20}
              weight="bold"
              aria-hidden="true"
              className={open ? "rotate-180" : undefined}
            />
          </span>
        </button>
      </h3>

      <div id={panelId} hidden={!open}>
        <div className="grid grid-cols-2 gap-4">
          {RATE_FIELDS.map((field) => (
            <NumberField
              key={field.key}
              label={field.label}
              range={RANGES.rate}
              value={rates[field.key]}
              onCommit={(value) => dispatch({ type: "setRate", rate: field.key, value })}
              hintId={statusId}
              {...hints.forField(field.key)}
            />
          ))}
        </div>
        <div className="mt-2">
          <button type="button" onClick={resetRates} className={TEXT_BUTTON}>
            <ArrowCounterClockwiseIcon size={20} weight="bold" aria-hidden="true" />
            Reset rates
          </button>
        </div>
        {/* Always in the page, and two lines high (16px each) even when empty, so a hint or a
            wrapped status never shifts what is below. Nothing tappable is under it. */}
        <div
          id={statusId}
          role="status"
          className="mt-1 min-h-8 text-[length:var(--t-xs)] leading-4"
        >
          {hints.active !== null ? (
            <HintMessage
              hint={hints.active.hint}
              field={RATE_FIELDS.find((f) => f.key === hints.active?.field)?.label ?? "Rate"}
              text={hintText(hints.active.hint, RANGES.rate, "")}
            />
          ) : (
            status !== null && (
              <p className="flex items-start gap-1.5">
                <CheckIcon size={16} weight="bold" aria-hidden="true" className="shrink-0" />
                <span>{status}</span>
              </p>
            )
          )}
        </div>
      </div>
    </section>
  );
}
