import { useEffect, useRef } from "react";
import { encodeShare } from "@/lib/share";
import { writeSnapshot } from "@/lib/storage";
import type { AppState } from "@/lib/types";

/** The state must stay unchanged this long before it is written (DATA_MODEL §5, debounced). */
export const SAVE_DELAY_MS = 500;

/**
 * Keeps the last calculation in `localStorage` (DATA_MODEL §5). It renders nothing and returns
 * nothing.
 *
 * - Nothing is written until the user changes something after loading. The loaded state is the
 *   baseline (the latest one, when a link is opened while the page is already showing):
 *   opening a rejected or untouched link never overwrites a good saved snapshot, and the default
 *   scenario can never be written over it before the resume has run.
 * - Writes are debounced. A pending write is also flushed when the page is hidden, closed or
 *   unmounted, because a phone can kill the tab before the timer fires.
 * - A failed write is ignored: the app works without persistence.
 */
export function useLocalSave(
  app: AppState,
  baseline: AppState | null,
  delayMs: number = SAVE_DELAY_MS,
): void {
  // The newest state that has not been written yet.
  const pending = useRef<AppState | null>(null);

  useEffect(() => {
    if (baseline === null || app === baseline) return;
    pending.current = app;
    const timer = setTimeout(() => flush(pending), delayMs);
    return () => clearTimeout(timer);
  }, [app, baseline, delayMs]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush(pending);
    };
    const onPageHide = () => flush(pending);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      flush(pending);
    };
  }, []);
}

function flush(pending: { current: AppState | null }): void {
  const app = pending.current;
  if (app === null) return;
  pending.current = null;
  writeSnapshot(encodeShare(app));
}
