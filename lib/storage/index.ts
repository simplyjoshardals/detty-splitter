/**
 * Safe `localStorage` wrapper for the last-calculation snapshot (DATA_MODEL §5). No React and
 * no DOM types beyond `localStorage` itself, so it is testable in plain Node.
 *
 * Storage can be missing, blocked or full (private mode, in-app browsers, quota), and merely
 * touching `localStorage` can throw. Nothing here ever throws: every call is in try/catch and
 * returns a typed result, and the app works without persistence (ARCHITECTURE §5).
 */

/** The one key this app writes. The value is the share-link string (DATA_MODEL §5). */
export const SNAPSHOT_KEY = "detty26:v1:last";

/** `value` is null when nothing is saved. `ok: false` means storage itself is unavailable. */
export type ReadResult = { ok: true; value: string | null } | { ok: false };

export type WriteResult = { ok: true } | { ok: false };

export function readSnapshot(): ReadResult {
  try {
    return { ok: true, value: globalThis.localStorage.getItem(SNAPSHOT_KEY) };
  } catch {
    return { ok: false };
  }
}

export function writeSnapshot(link: string): WriteResult {
  try {
    globalThis.localStorage.setItem(SNAPSHOT_KEY, link);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
