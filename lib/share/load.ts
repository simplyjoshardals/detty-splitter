/**
 * Load precedence (DATA_MODEL §4.3, §4.4 step 9): the link in the URL hash, then the saved
 * snapshot, then the default scenario. Pure: the caller reads `location.hash` and storage and
 * passes the strings in, so every rule is testable in plain Node.
 *
 * The saved snapshot is the same string format as a link, so it goes through the same strict
 * `decodeShare`. Nothing is trusted because it came from our own key.
 */
import type { AppState } from "@/lib/types";
import { decodeShare, type DecodeFailure, type FieldName } from "./index";

export interface LoadResult {
  /** Where `state` came from. */
  source: "hash" | "storage" | "default";
  /** The state to show. For "default" it is exactly the `fallback` that was passed in. */
  state: AppState;
  /** Numbers that were clamped on decode, in link order. Always empty for "default". */
  clamped: FieldName[];
  /**
   * Why a link in the URL was rejected, or null. Set only when a link was present and bad:
   * the UI shows its one notice for any code, and tests tell the codes apart. An empty hash,
   * a missing snapshot and a corrupt snapshot are all silent (null).
   */
  rejected: DecodeFailure | null;
}

/**
 * @param hash `location.hash` as given (with its "#"), or "".
 * @param stored The saved snapshot, or null when there is none or storage is unavailable.
 * @param fallback The default scenario. Returned as is, never copied or changed.
 */
export function resolveInitialState(
  hash: string,
  stored: string | null,
  fallback: AppState,
): LoadResult {
  const fromHash = decodeShare(hash);
  if (fromHash.ok) {
    return { source: "hash", state: fromHash.state, clamped: fromHash.clamped, rejected: null };
  }
  // A bad link gets the default scenario, not the snapshot: the notice promises "a fresh
  // calculation" (§4.4 step 9). Only a link-less visit resumes from storage.
  if (fromHash.code !== "empty") {
    return { source: "default", state: fallback, clamped: [], rejected: fromHash.code };
  }

  if (stored !== null) {
    const fromStorage = decodeShare(stored);
    if (fromStorage.ok) {
      return {
        source: "storage",
        state: fromStorage.state,
        clamped: fromStorage.clamped,
        rejected: null,
      };
    }
  }
  return { source: "default", state: fallback, clamped: [], rejected: null };
}
