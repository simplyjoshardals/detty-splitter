"use client";

import { useEffect, useMemo } from "react";
import { prerender } from "@/lib/receipt/prerender";
import { buildReceiptView } from "@/lib/receipt/view";
import { useAppState } from "@/state/AppStateProvider";
import { useTargetInView } from "./meterHooks";

/** The renderer chunk starts loading when the receipt is this close to the viewport (T7.3). */
export const PRERENDER_ROOT_MARGIN = "800px";

/** Without IntersectionObserver there is no "near the viewport": start once the browser is idle. */
export const IDLE_START_DELAY_MS = 200;

/**
 * Keeps the background PNG pre-render (`lib/receipt/prerender`, ARCHITECTURE §2.5) in step with
 * the page. It renders nothing, so `Receipt.tsx` is untouched.
 *
 * - Every state change hands the freshly built view to the controller, which skips equal views,
 *   clears a stale blob at once and debounces the render itself.
 * - The controller's `start()` (the lazy import of the renderer) is called once the receipt is
 *   within `PRERENDER_ROOT_MARGIN` of the viewport. It is safe to call again, so scrolling back
 *   and forth does nothing extra.
 * - This file must not import `lib/receipt/render` or `layout`: the controller's dynamic import
 *   is the only reference, which is what keeps the renderer out of the first-load JS.
 */
export function ReceiptPrerender(): null {
  const { state } = useAppState();
  const view = useMemo(() => buildReceiptView(state), [state]);
  const { inView } = useTargetInView("receipt", PRERENDER_ROOT_MARGIN);

  // Declared before the start effect, so the first view is already known when `start()` runs.
  useEffect(() => {
    prerender.update(view);
  }, [view]);

  useEffect(() => {
    if (inView) prerender.start();
  }, [inView]);

  useEffect(() => {
    if (typeof IntersectionObserver !== "undefined") return;
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(() => prerender.start());
      return () => window.cancelIdleCallback(handle);
    }
    const timer = setTimeout(() => prerender.start(), IDLE_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
