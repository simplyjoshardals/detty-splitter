"use client";

import { useId, useMemo } from "react";
import { ArrowDownIcon } from "@phosphor-icons/react";
import { TIERS } from "@/data/tiers";
import { calculate } from "@/lib/calc";
import { formatAmount } from "@/lib/money";
import { useAppState } from "@/state/AppStateProvider";
import { useSettledMessage, useTargetFound, useTargetInView } from "./meterHooks";
import { meterSizeToken, totalsAnnouncement, type MeterSizeToken } from "./meterText";

/**
 * The id the receipt section will carry (T6.3). The meter looks it up after mount, so it works
 * before the receipt exists: no target means no "See receipt" button and a bar that never hides.
 */
const DEFAULT_TARGET_ID = "receipt";

// Whole class names, so Tailwind can see them when it scans the source.
const DIGIT_SIZE_CLASS: Record<MeterSizeToken, string> = {
  "--t-xl": "text-[length:var(--t-xl)]",
  "--t-lg": "text-[length:var(--t-lg)]",
};

/**
 * Scrolls the target into view. Motion follows the system setting. Focus follows the jump only
 * when the target opted in with a `tabindex` (the receipt should use `tabIndex={-1}`), because
 * the button that was just pressed is hidden as soon as the receipt is on screen and focus would
 * otherwise be dropped. A plain `<a href="#receipt">` is not used: the page hash is reserved
 * for share links (DATA_MODEL §4).
 */
function jumpTo(id: string): void {
  const target = document.getElementById(id);
  if (target === null) return;
  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  if (target.hasAttribute("tabindex")) target.focus({ preventScroll: true });
}

/**
 * The bar ignores its own strip of the screen when it decides whether the totals are visible:
 * about 68px tall (84px in the empty state) plus about 34px of home-indicator inset on notched
 * iPhones, rounded to 100 (T6.3 review, widened from 88 after the iOS Safari fix). It is one
 * number because both checks use it: the observer's bottom root margin and the manual re-measure
 * that corrects a stuck observer (`useTargetInView`).
 */
const BAR_CLEARANCE_PX = 100;
/**
 * The same strip at the top of the screen: totals whose bottom edge is within 100px of the top
 * are about to leave and no longer count as visible. Without it, the last sliver of the totals
 * kept the bar hidden while the CTA card (about 600px further down) was already coming into
 * view, so the bar seemed to leave at the CTA card.
 */
const TOP_CLEARANCE_PX = 100;
const BAR_ROOT_MARGIN = `-${TOP_CLEARANCE_PX}px 0px -${BAR_CLEARANCE_PX}px 0px`;

interface DamageMeterProps {
  /** Id of the element that "See receipt" jumps to and focuses. */
  targetId?: string;
  /**
   * Id of the element whose visibility hides the bar. Defaults to `targetId`. The page passes
   * the receipt's totals: the receipt is taller than a phone screen, so hiding the bar as soon
   * as its top edge appeared left a long stretch with neither the bar nor the totals in view.
   */
  watchId?: string;
}

/**
 * Sticky bottom bar (DESIGN §4, §5.7): black, yellow digits, the per-person total, and a jump
 * to the receipt. It reads the state and runs `calculate` itself, so `ResultsPanel` is untouched.
 *
 * - No count-up: the digits are the current value on every render (DESIGN §8).
 * - Hidden while the receipt is on screen with `visibility: hidden`, not `display: none`, so
 *   the bar keeps its height and the layout never moves (a collapse could push the receipt back
 *   out of view and make the bar flicker). Nothing animates. The inline style is on purpose: it
 *   also takes the bar out of the accessibility tree and the tab order, and it needs no CSS.
 * - iOS Safari: `IntersectionObserver` callbacks can arrive late or never (momentum scrolling,
 *   toolbar collapse, back/forward restore), which left the bar hidden for good. The hook also
 *   re-measures by hand on scroll, resize, `visualViewport`, `pageshow` and `visibilitychange`,
 *   so a stale "in view" corrects itself. The bar has `transform-gpu` so WebKit gives the sticky
 *   element its own layer and repaints it when `visibility` flips back.
 * - The live region is a sibling of the bar, not a child, because a hidden bar would silence it
 *   and the totals keep changing while the receipt is on screen. It is empty until the first
 *   settled edit and announces once per settled edit (`useSettledMessage`).
 *
 * Layout: the section pads only by the iOS safe-area insets. The 16px gutters sit on the inner
 * 560px column, the same box model as `main` and `Footer`, so the text lines up with the page
 * content at every width (gutters outside the column put it 16px left of the page above 592px).
 *
 * From 1280px the receipt is a sticky column that is always on screen, so the bar is not drawn
 * (`min-[1280px]:hidden`, T6.3). The live region is a sibling and keeps announcing.
 *
 * Needs `.on-meter` (globals.css, Stage 4) for the focus colour: the ink ring is invisible on
 * the bar in light mode and the yellow ring would sit on the yellow button in dark mode.
 */
export function DamageMeter({ targetId = DEFAULT_TARGET_ID, watchId }: DamageMeterProps) {
  const { state } = useAppState();
  const result = useMemo(() => calculate(state, TIERS), [state]);
  const { currency, groupSize } = state;
  const perPerson = formatAmount(result.perPersonMinor, currency);
  const announced = useSettledMessage(
    totalsAnnouncement(result.perPersonMinor, result.groupTotalMinor, groupSize, currency),
  );
  const found = useTargetFound(targetId);
  const { inView } = useTargetInView(
    watchId ?? targetId,
    BAR_ROOT_MARGIN,
    BAR_CLEARANCE_PX,
    TOP_CLEARANCE_PX,
  );
  const labelId = useId();
  // DESIGN §9: the empty-state line replaces the caption while there is nothing to pay.
  const caption =
    result.perPersonMinor === 0 ? "Meter never start. Add a number, oya." : "per person";

  return (
    <>
      <section
        aria-labelledby={labelId}
        style={inView ? { visibility: "hidden" } : undefined}
        className="on-meter transform-gpu sticky bottom-0 z-20 min-[1280px]:hidden border-t-2 border-transparent bg-meter-bg pt-2 pr-[env(safe-area-inset-right)] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] text-meter-fg dark:border-meter-fg"
      >
        <div className="mx-auto flex w-full max-w-[560px] items-center justify-between gap-3 px-4">
          <div className="min-w-0">
            {/* The caption wraps below the label on a narrow bar. In the empty state it is the
                longer "Meter never start" line, so the bar grows by one line there only. */}
            <p className="flex flex-wrap items-baseline gap-x-2 text-[length:var(--t-xs)] leading-4">
              <span id={labelId} className="font-display">
                DAMAGE METER
              </span>
              <span>{caption}</span>
            </p>
            {/* Size by length first; nowrap plus overflow-wrap is only the safety net. */}
            <p
              className={`whitespace-nowrap font-mono font-bold leading-tight [overflow-wrap:anywhere] ${
                DIGIT_SIZE_CLASS[meterSizeToken(perPerson)]
              }`}
            >
              {perPerson}
            </p>
          </div>
          {found && (
            // Icon only below 480px (44x44), icon and text from 480px. The name is the same
            // either way. Yellow fill with no hard shadow: the shadow would vanish on black.
            <button
              type="button"
              aria-label="See receipt"
              onClick={() => jumpTo(targetId)}
              className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 bg-meter-fg px-0 text-meter-bg active:bg-(--receipt-paper) focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus) min-[480px]:px-3"
            >
              <ArrowDownIcon size={20} weight="bold" aria-hidden="true" />
              <span className="hidden text-[length:var(--t-sm)] font-bold min-[480px]:inline">
                See receipt
              </span>
            </button>
          )}
        </div>
      </section>
      <div role="status" className="sr-only">
        {announced}
      </div>
    </>
  );
}
