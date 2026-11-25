/**
 * Export handler chain (T9.1; ARCHITECTURE §3.6, UI_PLAN §2.5, T2.2 decisions 1 to 3).
 * Plain TypeScript, no React. The tap handler calls `exportReceipt()` and shows the result.
 *
 * The chain, on the blob the pre-render already built:
 *   1. `canShare({ files })` true  -> `share()`.  Done: `shared`.
 *      `AbortError` (the user closed the sheet) -> `cancelled`. Silent, and it does NOT fall
 *      through, because the user chose to stop.
 *   2. No sharing, or `share()` rejected for any other reason -> download anchor: `downloaded`.
 *   3. Anchor unsupported or throwing -> `inline` (the UI shows the image, "press and hold").
 *
 * Rules:
 * - `exportReceipt` is NOT `async` on purpose. Everything up to the `share()` call (reading the
 *   snapshot, building the `File`, `canShare`) runs synchronously inside the tap, so the
 *   gesture is still live (UI_PLAN §2.5). Only the promise `share()` returns is awaited.
 * - It never renders and never waits for a render. A blob that isn't ready is a `not_ready`
 *   result; the UI says "Printing…" and asks for another tap.
 * - Nothing here throws or rejects: every failure is a value.
 */
import { prerender } from "@/lib/receipt/prerender";
import type { Prerender, PrerenderFailureReason } from "@/lib/receipt/prerender";
import type { RenderFailureReason } from "@/lib/receipt/render";
import { browserExportEnv } from "./browser";
import type { ExportEnv } from "./browser";

export { browserExportEnv, downloadViaAnchor } from "./browser";
export type { ExportEnv } from "./browser";

/** Name of the saved file. */
export const EXPORT_FILE_NAME = "detty-splitter-receipt.png";
const EXPORT_MIME = "image/png";

export type ExportMethod = "share" | "download" | "inline";
/** Same four reasons as UI_PLAN §1.2; the pre-render's extra `"load"` is mapped to `"unknown"`. */
export type ExportFailureReason = RenderFailureReason;

/** UI_PLAN §1.2. */
export type ExportOutcome =
  | { status: "shared" | "downloaded" | "inline"; method: ExportMethod }
  | { status: "cancelled" }
  | { status: "failed"; reason: ExportFailureReason };

/** What a tap returns: an `ExportOutcome`, or `not_ready` when there is no blob yet (T9.1 adds this). */
export type ExportResult = ExportOutcome | { status: "not_ready" };

/** The part of the pre-render the handler uses. Defaults to the app-wide `prerender`. */
export type ExportSource = Pick<Prerender, "getSnapshot" | "start">;

export interface ExportOptions {
  source?: ExportSource;
  env?: ExportEnv;
}

function isAbortError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  return (error as { name?: unknown }).name === "AbortError";
}

function toFailureReason(reason: PrerenderFailureReason): ExportFailureReason {
  return reason === "load" ? "unknown" : reason;
}

/** `null` when the browser can't build a `File` (old engines); sharing is then skipped. */
function makeFile(blob: Blob): File | null {
  try {
    return new File([blob], EXPORT_FILE_NAME, { type: EXPORT_MIME });
  } catch {
    return null;
  }
}

/** Steps 2 and 3. Never throws. */
function saveOrShowInline(blob: Blob, env: ExportEnv): ExportOutcome {
  try {
    if (env.download(blob, EXPORT_FILE_NAME)) return { status: "downloaded", method: "download" };
  } catch {
    // Fall through to the inline image.
  }
  return { status: "inline", method: "inline" };
}

/**
 * Starts the share if the browser can share this file. Returns the pending promise, or `null`
 * when there is nothing to wait for (no file, no API, `canShare` false, or anything threw).
 * Runs synchronously: this is the only code between the tap and `share()`.
 */
function startShare(file: File | null, env: ExportEnv): Promise<void> | null {
  if (file === null || env.share === undefined || env.canShare === undefined) return null;
  try {
    const data: ShareData = { files: [file] };
    // Older Safari throws from `canShare` instead of returning false.
    if (env.canShare(data) !== true) return null;
    return env.share(data);
  } catch {
    return null;
  }
}

export function exportReceipt(options: ExportOptions = {}): Promise<ExportResult> {
  const source = options.source ?? prerender;
  const snapshot = source.getSnapshot();

  if (snapshot.status === "failed") {
    // A failed import can recover on a later start(); a failed draw can't (retry is T9.2).
    if (snapshot.reason === "load") source.start();
    return Promise.resolve({ status: "failed", reason: toFailureReason(snapshot.reason) });
  }
  if (snapshot.status !== "ready") {
    // Without this, a tap before the pre-render ever started would say "Printing…" forever.
    source.start();
    return Promise.resolve({ status: "not_ready" });
  }

  const { blob } = snapshot;
  const env = options.env ?? browserExportEnv();

  const pending = startShare(makeFile(blob), env);
  if (pending === null) return Promise.resolve(saveOrShowInline(blob, env));

  return pending.then(
    (): ExportOutcome => ({ status: "shared", method: "share" }),
    (error: unknown): ExportOutcome =>
      isAbortError(error) ? { status: "cancelled" } : saveOrShowInline(blob, env),
  );
}