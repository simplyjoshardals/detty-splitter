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
 * - It never renders. A blob that isn't ready is handled one of two ways:
 *     - the browser can share files: `not_ready`. The UI says "Printing…" and asks for another
 *       tap, because waiting here would lose the gesture `share()` needs;
 *     - the browser can't share files: nothing needs the gesture (a download or the inline
 *       image works any time), so it waits for the blob, up to `WAIT_FOR_BLOB_MS`, and
 *       finishes on the first tap. A timeout is `not_ready`.
 * - Nothing here throws or rejects: every failure is a value.
 */
import { prerender } from "@/lib/receipt/prerender";
import type { Prerender, PrerenderFailureReason, PrerenderSnapshot } from "@/lib/receipt/prerender";
import type { RenderFailureReason } from "@/lib/receipt/render";
import { browserExportEnv } from "./browser";
import type { ExportEnv } from "./browser";

export { browserExportEnv, downloadViaAnchor, isInAppBrowser, prefersShareSheet } from "./browser";
export type { ExportEnv } from "./browser";

/** How long a tap waits for the blob in a browser that can't share files. */
export const WAIT_FOR_BLOB_MS = 10_000;

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
export type ExportSource = Pick<Prerender, "getSnapshot" | "start" | "subscribe">;

export interface ExportOptions {
  source?: ExportSource;
  env?: ExportEnv;
  /** Longest wait for the blob where sharing is impossible. Defaults to `WAIT_FOR_BLOB_MS`. */
  waitMs?: number;
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

/**
 * Whether this browser would accept a PNG file in `share()`. Asked with an empty stand-in file:
 * `canShare` only looks at the file's name and type, and needs no tap. Any doubt (no API,
 * `false`, a throw) means "no", so the tap waits for the blob instead of asking for another.
 */
function canShareFiles(env: ExportEnv): boolean {
  const probe = makeFile(new Blob([], { type: EXPORT_MIME }));
  if (probe === null || env.share === undefined || env.canShare === undefined) return false;
  try {
    return env.canShare({ files: [probe] }) === true;
  } catch {
    return false;
  }
}

/** Resolves with the first `ready` or `failed` snapshot, or `null` after `timeoutMs`. */
function waitUntilSettled(
  source: ExportSource,
  timeoutMs: number,
): Promise<PrerenderSnapshot | null> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: (() => void) | null = null;
    const finish = (value: PrerenderSnapshot | null): void => {
      if (timer !== null) clearTimeout(timer);
      unsubscribe?.();
      resolve(value);
    };
    unsubscribe = source.subscribe(() => {
      const current = source.getSnapshot();
      if (current.status === "ready" || current.status === "failed") finish(current);
    });
    timer = setTimeout(() => finish(null), timeoutMs);
  });
}

export function exportReceipt(options: ExportOptions = {}): Promise<ExportResult> {
  const source = options.source ?? prerender;
  const snapshot = source.getSnapshot();

  if (snapshot.status === "failed") {
    // A failed import can recover on a later start(); a failed draw only through prerender.retry()
    // (the Retry button, T9.2) or an edit. This tap just reports it.
    if (snapshot.reason === "load") source.start();
    return Promise.resolve({ status: "failed", reason: toFailureReason(snapshot.reason) });
  }
  if (snapshot.status !== "ready") {
    // Without this, a tap before the pre-render ever started would wait or say "Printing…" forever.
    source.start();
    const env = options.env ?? browserExportEnv();
    // Where `share()` could run, waiting would lose the tap it needs: ask for another tap.
    if (canShareFiles(env)) return Promise.resolve({ status: "not_ready" });
    return waitUntilSettled(source, options.waitMs ?? WAIT_FOR_BLOB_MS).then(
      (settled): ExportResult => {
        if (settled === null) return { status: "not_ready" };
        if (settled.status === "failed")
          return { status: "failed", reason: toFailureReason(settled.reason) };
        if (settled.status === "ready") return saveOrShowInline(settled.blob, env);
        return { status: "not_ready" };
      },
    );
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
