"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckIcon, ReceiptIcon, WarningIcon } from "@phosphor-icons/react";
import { exportReceipt } from "@/lib/export";
import type { ExportResult } from "@/lib/export";
import { prerender } from "@/lib/receipt/prerender";
import type { PrerenderSnapshot } from "@/lib/receipt/prerender";
import { buildReceiptView } from "@/lib/receipt/view";
import type { AppState } from "@/lib/types";
import { useAppState } from "@/state/AppStateProvider";

const STATUS_ID = "export-status";

/** What the server (and the first client render) sees: nothing is pre-rendered yet. */
const SERVER_SNAPSHOT: PrerenderSnapshot = { status: "idle" };

// Drafts, DESIGN §9. T9.2 replaces the failure line with a Retry button and the icons.
const COPY = {
  printing: "Printing…",
  tapAgain: "Printing… tap again in a moment.",
  ready: "Receipt ready. Go and post am.",
  shared: "Receipt shared.",
  downloaded: "Receipt saved. Check your downloads.",
  inline: "Press and hold the picture to save.",
  failed: "Receipt no gree print. Change any number to try again.",
} as const;

/**
 * The last thing a tap produced. `printing` (a tap is waiting for the PNG) and `tap_again` are
 * about the pre-render, not a receipt. The rest describe one receipt, so they carry the state
 * they were made from and are dropped as soon as the numbers change.
 */
type Last =
  | { kind: "printing" }
  | { kind: "tap_again" }
  | { kind: "shared" | "downloaded" | "failed"; state: AppState }
  | { kind: "inline"; state: AppState; url: string; alt: string };

function receiptAlt(state: AppState): string {
  const view = buildReceiptView(state);
  const people = view.groupSize === 1 ? "1 person" : `${view.groupSize} people`;
  return `Receipt: ${view.perPersonTotal} per person, ${view.groupTotal} for ${people}.`;
}

/**
 * Turns a result into what the status line and the inline panel show. `null` is the silent
 * cancel. The inline image is made from the blob that was ready at the tap.
 */
function toLast(result: ExportResult, state: AppState, snapshot: PrerenderSnapshot): Last | null {
  switch (result.status) {
    case "not_ready":
      return { kind: "tap_again" };
    case "cancelled":
      return null;
    case "failed":
      return { kind: "failed", state };
    case "shared":
    case "downloaded":
      return { kind: result.status, state };
    case "inline": {
      if (snapshot.status !== "ready") return { kind: "failed", state };
      try {
        return { kind: "inline", state, url: URL.createObjectURL(snapshot.blob), alt: receiptAlt(state) };
      } catch {
        return { kind: "failed", state };
      }
    }
  }
}

interface StatusLine {
  tone: "plain" | "ok" | "error";
  text: string;
}

function statusLine(last: Last | null, snapshot: PrerenderSnapshot): StatusLine | null {
  if (last === null) return null;
  switch (last.kind) {
    case "printing":
      return { tone: "plain", text: COPY.printing };
    case "tap_again":
      // The person asked for a receipt that wasn't ready: answer when it becomes ready or fails.
      if (snapshot.status === "ready") return { tone: "ok", text: COPY.ready };
      if (snapshot.status === "failed") return { tone: "error", text: COPY.failed };
      return { tone: "plain", text: COPY.tapAgain };
    case "shared":
      return { tone: "ok", text: COPY.shared };
    case "downloaded":
      return { tone: "ok", text: COPY.downloaded };
    case "inline":
      return { tone: "plain", text: COPY.inline };
    case "failed":
      return { tone: "error", text: COPY.failed };
  }
}

/**
 * Export receipt (DESIGN §4 item 7, §5.1, §5.9, §5.10; UI_PLAN §2.5). It sits above `ShareBar`.
 *
 * The tap calls `exportReceipt()` with nothing awaited before it: `share()` has to start inside
 * the tap (`lib/export`). Where the browser can't share files, `exportReceipt` waits for the PNG
 * and finishes on the first tap ("Printing…" shows meanwhile); where it can, a tap that comes
 * too early is answered with "tap again". The button only says "Printing…" while the PNG isn't
 * ready; it uses
 * `aria-disabled`, not `disabled`, so a tap still reaches the handler and gets the "tap again"
 * answer. The status slot is always in the page and two lines high, so messages never move
 * what is below it.
 */
export function ExportButton() {
  const { state } = useAppState();
  const snapshot = useSyncExternalStore(
    prerender.subscribe,
    prerender.getSnapshot,
    () => SERVER_SNAPSHOT,
  );
  const [last, setLast] = useState<Last | null>(null);
  const latestState = useRef(state);

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

  function exportTap() {
    if (last?.kind === "printing") return; // already waiting for the PNG: one export per tap
    const tapState = state;
    // No await before this call: `share()` has to start inside the tap.
    const pending = exportReceipt();
    // Where sharing is impossible the tap waits for the PNG, so say so while it does.
    if (printing) setLast({ kind: "printing" });
    void pending.then((result) => {
      // The numbers changed meanwhile: this result is about an old receipt.
      if (result.status !== "not_ready" && latestState.current !== tapState) {
        setLast((current) => (current?.kind === "printing" ? null : current));
        return;
      }
      // An inline image comes from the blob that is ready now (the same one the chain used).
      setLast(toLast(result, tapState, prerender.getSnapshot()));
    });
  }

  return (
    <div className="mx-auto mt-4 w-full max-w-[380px]">
      <button
        type="button"
        onClick={exportTap}
        aria-disabled={printing}
        className="flex h-12 w-full items-center justify-center gap-2 border-2 border-ink bg-danfo font-display text-[length:var(--t-base)] text-danfo-ink shadow-(--shadow-hard) transition-[translate,box-shadow] duration-(--dur-fast) ease-(--ease) focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus) aria-disabled:border-ink/50 aria-disabled:bg-danfo/50 aria-disabled:shadow-none aria-[disabled=false]:active:shadow-[1px_1px_0_var(--ink)] motion-safe:aria-[disabled=false]:active:translate-x-0.5 motion-safe:aria-[disabled=false]:active:translate-y-0.5 motion-reduce:transition-none"
      >
        <ReceiptIcon size={20} weight="bold" aria-hidden="true" />
        {printing ? COPY.printing : "Export receipt"}
      </button>
      {/* Always in the page and two lines high even when empty, like the share status
          (DESIGN §5.9), so a message appearing never moves what is below it. */}
      <div id={STATUS_ID} role="status" className="mt-2 min-h-8 text-[length:var(--t-xs)] leading-4">
        {line !== null && (
          <p className={`flex items-start gap-1.5 ${line.tone === "error" ? "text-danger" : ""}`}>
            {line.tone === "ok" && <CheckIcon size={16} weight="bold" aria-hidden="true" className="shrink-0" />}
            {line.tone === "error" && (
              <WarningIcon size={16} weight="bold" aria-hidden="true" className="shrink-0" />
            )}
            <span>{line.text}</span>
          </p>
        )}
      </div>
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