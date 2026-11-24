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
 */
export function useTargetInView(
  id: string,
  rootMargin?: string,
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
    return () => observer.disconnect();
  }, [id, found, rootMargin]);

  return { found, inView: found && inView };
}