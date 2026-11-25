"use client";

import { XIcon } from "@phosphor-icons/react";
import { useAppState } from "@/state/AppStateProvider";

/** Fixed copy, DESIGN §9 "Bad share link". A string, so the apostrophes need no escaping. */
const NOTICE_TEXT = "We couldn't read that link, so here's a fresh calculation.";

const DISMISS_BUTTON =
  "inline-flex min-h-11 items-center gap-2 text-[length:var(--t-sm)] text-ink underline underline-offset-4 " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus) " +
  "active:bg-danfo active:text-danfo-ink";

/**
 * The bad-link notice (DESIGN §5.11, S6): a dashed banner above the calculator that says the
 * link was rejected and the numbers are a fresh calculation. It never blocks anything.
 *
 * The `role="status"` wrapper is always in the page and empty until the notice is raised, so
 * screen readers announce the text when it appears. Empty, it has no height and no margin.
 */
export function LinkNotice() {
  const { linkNotice, dismissLinkNotice } = useAppState();
  return (
    <div role="status">
      {linkNotice && (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-2 border-dashed border-border p-3 text-[length:var(--t-sm)] text-muted">
          <p className="min-w-0 flex-1 basis-56 text-balance">{NOTICE_TEXT}</p>
          <button type="button" onClick={dismissLinkNotice} className={`${DISMISS_BUTTON} ml-auto`}>
            <XIcon size={20} weight="bold" aria-hidden="true" />
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
