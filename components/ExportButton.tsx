"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  DoorOpenIcon,
  DownloadSimpleIcon,
  ImageIcon,
  PrinterIcon,
  ReceiptIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { exportReceipt, isInAppBrowser, prefersShareSheet } from "@/lib/export";
import type { ExportFailureReason, ExportResult } from "@/lib/export";
import { prerender } from "@/lib/receipt/prerender";
import type { PrerenderSnapshot } from "@/lib/receipt/prerender";
import { buildReceiptView } from "@/lib/receipt/view";
import type { AppState } from "@/lib/types";
import { useAppState } from "@/state/AppStateProvider";

const STATUS_ID = "export-status";

/** What the server (and the first client render) sees: nothing is pre-rendered yet. */
const SERVER_SNAPSHOT: PrerenderSnapshot = { status: "idle" };

// Drafts, DESIGN §9.
const COPY = {
  printing: "Printing…",
  tapAgain: "Printing… tap again in a moment.",
  ready: "Receipt ready. Go and post am.",
  shared: "Receipt shared.",
  downloaded: "Receipt saved. Check your downloads.",
  inlineTouch: "Press and hold the picture to save.",
  inlineMouse: "Right-click the picture to save it.",
  // The font failure is usually the connection; every other reason has the same advice.
  failedFont: "The receipt font didn't load. Check your connection and try again.",
  failed: "Receipt no gree print. Try again.",
  inApp: "Tip: open this page in your browser for the best save and share.",
} as const;

/**
 * The last thing a tap produced. `printing` (a tap is waiting for the PNG) and `tap_again` are
 * about the pre-render, not a receipt; `retry` says the tap came from Retry, so the Retry row
 * stays (dimmed) until the answer is in. The rest describe one receipt, so they carry the state
 * they were made from and are dropped as soon as the numbers change.
 */
type Last =
  | { kind: "printing"; retry: boolean }
  | { kind: "tap_again"; retry: boolean }
  | { kind: "shared" | "downloaded"; state: AppState }
  | { kind: "failed"; state: AppState; reason: ExportFailureReason }
  | { kind: "inline"; state: AppState; url: string; alt: string; touch: boolean };

/** Restates the key numbers, in the order a sighted reader takes them in (DESIGN §10). */
function receiptAlt(state: AppState): string {
  const view = buildReceiptView(state);
  const people = view.groupSize === 1 ? "1 person" : `${view.groupSize} people`;
  return `${view.title} receipt, ${view.badge}: ${view.perPersonTotal} per person, ${view.groupTotal} for ${people}.`;
}

/**
 * Turns a result into what the status line and the inline panel show. `null` is the silent
 * cancel. The inline image is made from the blob that was ready at the tap.
 */
function toLast(
  result: ExportResult,
  state: AppState,
  snapshot: PrerenderSnapshot,
  fromRetry: boolean,
): Last | null {
  switch (result.status) {
    case "not_ready":
      return { kind: "tap_again", retry: fromRetry };
    case "cancelled":
      return null;
    case "failed":
      return { kind: "failed", state, reason: result.reason };
    case "shared":
    case "downloaded":
      return { kind: result.status, state };
    case "inline": {
      if (snapshot.status !== "ready") return { kind: "failed", state, reason: "unknown" };
      try {
        return {
          kind: "inline",
          state,
          url: URL.createObjectURL(snapshot.blob),
          alt: receiptAlt(state),
          // Same rule as the share sheet: a finger presses and holds, a mouse right-clicks.
          touch: prefersShareSheet(),
        };
      } catch {
        return { kind: "failed", state, reason: "unknown" };
      }
    }
  }
}

type Glyph = "printer" | "check" | "download" | "image" | "warning";
/** `ready`: the Retry button is live. `busy`: a retry is running, so it is shown dimmed. */
type RetryState = "none" | "ready" | "busy";

interface StatusLine {
  glyph: Glyph;
  text: string;
  error: boolean;
  retry: RetryState;
  /** Where the in-app browser tip applies: the saves that can go wrong, and failures. */
  tip: boolean;
}

function failedLine(reason: ExportFailureReason): StatusLine {
  return {
    glyph: "warning",
    text: reason === "font" ? COPY.failedFont : COPY.failed,
    error: true,
    retry: "ready",
    tip: true,
  };
}

function statusLine(last: Last | null, snapshot: PrerenderSnapshot): StatusLine | null {
  if (last === null) return null;
  switch (last.kind) {
    case "printing":
      return {
        glyph: "printer",
        text: COPY.printing,
        error: false,
        retry: last.retry ? "busy" : "none",
        tip: false,
      };
    case "tap_again":
      // The person asked for a receipt that wasn't ready: answer when it becomes ready or fails.
      if (snapshot.status === "ready") {
        return { glyph: "check", text: COPY.ready, error: false, retry: "none", tip: false };
      }
      // The pre-render's own "load" failure is reported as "unknown", like `exportReceipt` does.
      if (snapshot.status === "failed") {
        return failedLine(snapshot.reason === "load" ? "unknown" : snapshot.reason);
      }
      return {
        glyph: "printer",
        text: COPY.tapAgain,
        error: false,
        retry: last.retry ? "busy" : "none",
        tip: false,
      };
    case "shared":
      return { glyph: "check", text: COPY.shared, error: false, retry: "none", tip: false };
    case "downloaded":
      return { glyph: "download", text: COPY.downloaded, error: false, retry: "none", tip: true };
    case "inline":
      return {
        glyph: "image",
        text: last.touch ? COPY.inlineTouch : COPY.inlineMouse,
        error: false,
        retry: "none",
        tip: true,
      };
    case "failed":
      return failedLine(last.reason);
  }
}

function StatusGlyph({ glyph }: { glyph: Glyph }) {
  const props = { size: 16, weight: "bold", "aria-hidden": "true", className: "shrink-0" } as const;
  switch (glyph) {
    case "printer":
      return <PrinterIcon {...props} />;
    case "check":
      return <CheckIcon {...props} />;
    case "download":
      return <DownloadSimpleIcon {...props} />;
    case "image":
      return <ImageIcon {...props} />;
    case "warning":
      return <WarningIcon {...props} />;
  }
}

const subscribeNever = (): (() => void) => () => undefined;

/** Read once on the client: the user agent never changes, so there is nothing to subscribe to. */
function readInApp(): boolean {
  const userAgent: string | undefined = globalThis.navigator?.userAgent;
  return typeof userAgent === "string" && isInAppBrowser(userAgent);
}

/**
 * Export receipt (DESIGN §4 item 7, §5.1, §5.9, §5.10; UI_PLAN §2.5). It sits above `ShareBar`.
 *
 * The tap calls `exportReceipt()` with nothing awaited before it: `share()` has to start inside
 * the tap (`lib/export`). Where the browser can't share files, `exportReceipt` waits for the PNG
 * and finishes on the first tap ("Printing…" shows meanwhile); where it can, a tap that comes
 * too early is answered with "tap again". The button only says "Printing…" while the PNG isn't
 * ready; it uses `aria-disabled`, not `disabled`, so a tap still reaches the handler and gets the
 * "tap again" answer.
 *
 * Every outcome has an icon and a line (T9.2). A failure says why (the font, or anything else)
 * and offers Retry: `prerender.retry()` and then the same tap as above, so a browser that can't
 * share finishes the export on the Retry press. Retry sits outside the `role="status"` region
 * and grows the slot only on a failure, so nothing below it moves except after a tap. In an
 * in-app browser, a save or a failure also gets a tip to open the page in the real browser.
 */
export function ExportButton() {
  const { state } = useAppState();
  const snapshot = useSyncExternalStore(
    prerender.subscribe,
    prerender.getSnapshot,
    () => SERVER_SNAPSHOT,
  );
  const inApp = useSyncExternalStore(subscribeNever, readInApp, () => false);
  const [last, setLast] = useState<Last | null>(null);
  const latestState = useRef(state);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    latestState.current = state;
  }, [state]);

  // The numbers changed, so a result about the old receipt (and its image) no longer applies.
  if (last !== null && "state" in last && last.state !== state) setLast(null);

  const inlineUrl = last?.kind === "inline" ? last.url : null;
  useEffect(() => {
    if (inlineUrl === null) return;
    return () => URL.revokeObjectURL(inlineUrl);
  }, [inlineUrl]);

  // "failed" is not "printing": the button stays live so a tap can report the failure.
  const printing = snapshot.status !== "ready" && snapshot.status !== "failed";
  const line = statusLine(last, snapshot);

  function exportTap(fromRetry: boolean) {
    if (last?.kind === "printing") return; // already waiting for the PNG: one export per tap
    const tapState = state;
    // Retry first: `exportReceipt` reads the snapshot, and a failed one would be reported again.
    if (fromRetry) prerender.retry();
    const before = prerender.getSnapshot();
    const waiting = before.status !== "ready" && before.status !== "failed";
    // No await before this call: `share()` has to start inside the tap.
    const pending = exportReceipt();
    // Where sharing is impossible the tap waits for the PNG, so say so while it does.
    if (waiting) setLast({ kind: "printing", retry: fromRetry });
    void pending.then((result) => {
      // The numbers changed meanwhile: this result is about an old receipt.
      if (result.status !== "not_ready" && latestState.current !== tapState) {
        setLast((current) => (current?.kind === "printing" ? null : current));
        return;
      }
      // An inline image comes from the blob that is ready now (the same one the chain used).
      setLast(toLast(result, tapState, prerender.getSnapshot(), fromRetry));
    });
  }

  function retryTap() {
    if (line?.retry !== "ready") return; // a retry is already running
    // The Retry row stays (dimmed) while it runs, but focus belongs on the main button: it is
    // what a keyboard user presses next ("tap again"), and a dimmed button should not hold it.
    buttonRef.current?.focus();
    exportTap(true);
  }

  return (
    <div className="mx-auto mt-4 w-full max-w-[380px]">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => exportTap(false)}
        aria-disabled={printing}
        className="flex h-12 w-full items-center justify-center gap-2 border-2 border-ink bg-danfo font-display text-[length:var(--t-base)] text-danfo-ink shadow-(--shadow-hard) transition-[translate,box-shadow] duration-(--dur-fast) ease-(--ease) focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus) aria-disabled:border-ink/50 aria-disabled:bg-danfo/50 aria-disabled:shadow-none aria-[disabled=false]:active:shadow-[1px_1px_0_var(--ink)] motion-safe:aria-[disabled=false]:active:translate-x-0.5 motion-safe:aria-[disabled=false]:active:translate-y-0.5 motion-reduce:transition-none"
      >
        <ReceiptIcon size={20} weight="bold" aria-hidden="true" />
        {printing ? COPY.printing : "Export receipt"}
      </button>
      {/* Always in the page and two lines high even when empty, like the share status
          (DESIGN §5.9), so a message appearing never moves what is below it. The tip, when it
          applies, adds a line: that happens once, right after a tap. */}
      <div id={STATUS_ID} role="status" className="mt-2 min-h-8 text-[length:var(--t-xs)] leading-4">
        {line !== null && (
          <>
            <p className={`flex items-start gap-1.5 ${line.error ? "text-danger" : ""}`}>
              <StatusGlyph glyph={line.glyph} />
              <span>{line.text}</span>
            </p>
            {line.tip && inApp && (
              <p className="mt-1 flex items-start gap-1.5 text-muted">
                <DoorOpenIcon size={16} weight="bold" aria-hidden="true" className="shrink-0" />
                <span>{COPY.inApp}</span>
              </p>
            )}
          </>
        )}
      </div>
      {line !== null && line.retry !== "none" && (
        <div className="mt-1">
          <button
            type="button"
            onClick={retryTap}
            aria-disabled={line.retry === "busy"}
            className="inline-flex h-11 items-center gap-1.5 text-[length:var(--t-sm)] font-bold text-ink underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus) aria-disabled:text-muted"
          >
            <ArrowCounterClockwiseIcon size={20} weight="bold" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}
      {last?.kind === "inline" && (
        <div className="mt-2 border-t-2 border-dashed border-rule pt-3">
          {/* A blob URL: next/image can't optimise it. The 9:16 box is reserved, so decoding
              the PNG never shifts the page. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={last.url}
            alt={last.alt}
            width={1080}
            height={1920}
            className="mx-auto block aspect-[9/16] h-auto w-60 max-w-full border-2 border-ink bg-surface"
          />
        </div>
      )}
    </div>
  );
}