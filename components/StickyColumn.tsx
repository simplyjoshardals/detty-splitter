"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Gap kept between the sticky column and the top and bottom of the screen, in px (`top-6`). */
const GAP = 24;

/**
 * The receipt's desktop column (DESIGN §4, T6.3). It is `sticky` from 1280px and normally sits
 * `GAP` from the top. A sticky column taller than the screen can never show its bottom, and
 * the bottom is where the verdict, the balance line and the URL are, so when the column is
 * taller than the screen its `top` goes negative by the difference: it scrolls up until its
 * bottom edge is `GAP` above the bottom of the screen, then stays there. On a tall screen
 * `top` stays at `GAP` and nothing changes. Only `top` is set, so under 1280px (where the
 * column is not sticky) it has no effect.
 */
export function StickyColumn({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const update = () => {
      const top = Math.min(GAP, window.innerHeight - element.offsetHeight - GAP);
      element.style.top = `${top}px`;
    };
    update();
    window.addEventListener("resize", update);
    // The receipt changes height with the tier, long labels and the display currency.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    return () => {
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className="mt-6 min-[1280px]:sticky min-[1280px]:top-6 min-[1280px]:mt-0">
      {children}
    </div>
  );
}
