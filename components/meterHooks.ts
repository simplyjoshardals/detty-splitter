import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** How long the totals must stay unchanged before they are announced (DESIGN §9). */
export const SETTLE_MS = 600;

/**
 * The message to put in the live region: it follows `message`, but only once `message` has
 * stayed the same for `delayMs`, so a burst of edits is announced once (DESIGN §9).
 *
 * - Nothing is announced on first render: the starting message is the baseline.
 * - After the delay the message is announced only if it differs from the last one announced
 *   (or from the starting one). Editing and reverting inside the window announces nothing.
 * - Returns "" until the first announcement.
 */
export function useSettledMessage(message: string, delayMs: number = SETTLE_MS): string {
  const [announced, setAnnounced] = useState("");
  // The last message that was announced, or the first one rendered. Only read in the effect
  // and written in the timer, never during render.
  const baseline = useRef(message);

  useEffect(() => {
    if (message === baseline.current) return;
    const timer = setTimeout(() => {
      baseline.current = message;
      setAnnounced(message);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [message, delayMs]);

  return announced;
}

/** Calls `onChange` whenever nodes are added to or removed from the page. */
function subscribeToDom(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

/**
 * Whether the element with this id is on the page, with no observer. False on the server and
 * on the first client render, then it follows the page (T6.3: the meter needs this alone for
 * the "See receipt" button, while the bar hides on a different element).
 */
export function useTargetFound(id: string): boolean {
  return useSyncExternalStore(
    subscribeToDom,
    () => document.getElementById(id) !== null,
    () => false,
  );
}

/**
 * Whether the element with this id is on the page, and whether any of it is on screen.
 *
 * The receipt does not exist until T6.3, and later it is mounted by another component, so
 * `found` follows the page rather than being looked up once. The meter shows "See receipt"
 * only when `found`, and hides only when `inView`.
 *
 * - `found` is false on the server and on the first client render, then follows the page.
 * - Without `IntersectionObserver`, `inView` stays false: the bar stays visible, which is the
 *   safe side.
 * - `inView` is always false while the element is missing, so a removed target can never leave
 *   the bar hidden.
 * - `rootMargin` shrinks the area that counts as "on screen" (the usual IntersectionObserver
 *   option), so the bar can ignore the strip it covers itself.
 * - `recheckClearancePx` (optional, the meter passes it) adds a safety net for iOS Safari,
 *   which delivers `IntersectionObserver` callbacks late or not at all around momentum
 *   scrolling, toolbar collapse and expand, and back/forward restores. The last callback then
 *   stays true and the bar never comes back. With this set, the target is also measured by hand
 *   (`getBoundingClientRect`) on `scroll`, `resize`, `visualViewport` resize and scroll,
 *   `pageshow` and `visibilitychange`, one measurement per frame, and `inView` follows the
 *   newest answer. "On screen" then means above the bottom `recheckClearancePx` of the visible
 *   viewport, the same area as a matching bottom `rootMargin`. Left out, the hook is observer
 *   only (the pre-render does not need the net).
 * - `topClearancePx` (optional, default 0, only used with `recheckClearancePx`) ignores the strip
 *   at the top of the screen: a target whose bottom edge is within that many px of the top is
 *   about to leave and no longer counts as on screen, the same area as a matching top
 *   `rootMargin`. The meter uses it so a last sliver of the totals scrolling out of the top
 *   does not keep the bar hidden while the CTA card comes into view.
 */
export function useTargetInView(
  id: string,
  rootMargin?: string,
  recheckClearancePx?: number,
  topClearancePx: number = 0,
): { found: boolean; inView: boolean } {
  const found = useTargetFound(id);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!found || typeof IntersectionObserver === "undefined") return;
    const target = document.getElementById(id);
    if (target === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Entries come oldest first: the last one is the current state.
        const latest = entries[entries.length - 1];
        if (latest !== undefined) setInView(latest.isIntersecting);
      },
      rootMargin === undefined ? undefined : { rootMargin },
    );
    observer.observe(target);

    if (recheckClearancePx === undefined) return () => observer.disconnect();

    // Safety net: measure by hand on events iOS Safari delivers reliably.
    let frame = 0;
    const recheck = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        setInView(rect.bottom > topClearancePx && rect.top < viewportHeight - recheckClearancePx);
      });
    };
    window.addEventListener("scroll", recheck, { passive: true });
    window.addEventListener("resize", recheck);
    window.addEventListener("pageshow", recheck);
    document.addEventListener("visibilitychange", recheck);
    window.visualViewport?.addEventListener("resize", recheck);
    window.visualViewport?.addEventListener("scroll", recheck);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", recheck);
      window.removeEventListener("resize", recheck);
      window.removeEventListener("pageshow", recheck);
      document.removeEventListener("visibilitychange", recheck);
      window.visualViewport?.removeEventListener("resize", recheck);
      window.visualViewport?.removeEventListener("scroll", recheck);
    };
  }, [id, found, rootMargin, recheckClearancePx, topClearancePx]);

  return { found, inView: found && inView };
}
