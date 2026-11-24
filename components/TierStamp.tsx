"use client";

import { useState } from "react";

interface TierStampProps {
  badge: string;
  tagline: string;
}

/**
 * Tier verdict (DESIGN §5.8): red double-border stamp, rotated -4 degrees (static),
 * tagline beneath. The block reserves two lines of height so a tier change never
 * shifts the page.
 *
 * The "thump" (DESIGN §8) runs only when the badge changes, never on first paint and never for
 * an edit that stays in the same tier. Each change remounts the stamp (a new `key`) so the CSS
 * animation restarts. `.stamp-thump` is defined only under `prefers-reduced-motion:
 * no-preference` (globals.css), so under reduce the stamp is static. The badge is the key
 * because each tier has its own, which keeps the tier id out of the receipt contract.
 */
export function TierStamp({ badge, tagline }: TierStampProps) {
  const [shownBadge, setShownBadge] = useState(badge);
  const [changes, setChanges] = useState(0);
  // Adjusting state while rendering, not in an effect: no extra paint with the old stamp.
  if (shownBadge !== badge) {
    setShownBadge(badge);
    setChanges(changes + 1);
  }

  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-4 py-4">
      <p
        key={changes}
        data-thump={changes > 0 ? "" : undefined}
        className={`w-fit max-w-full -rotate-[4deg] border-[6px] border-double border-stamp px-4 py-2 text-center font-display text-[length:var(--t-lg)] leading-tight text-stamp${
          changes > 0 ? " stamp-thump" : ""
        }`}
      >
        {badge}
      </p>
      <p className="text-balance text-center text-[length:var(--t-sm)] text-muted">{tagline}</p>
    </div>
  );
}
