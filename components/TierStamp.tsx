interface TierStampProps {
  badge: string;
  tagline: string;
}

/**
 * Tier verdict (DESIGN §5.8): red double-border stamp, rotated -4 degrees (static),
 * tagline beneath. The block reserves two lines of height so a tier change never
 * shifts the page.
 */
export function TierStamp({ badge, tagline }: TierStampProps) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-4 py-4">
      <p className="w-fit max-w-full -rotate-[4deg] border-[6px] border-double border-stamp px-4 py-2 text-center font-display text-[length:var(--t-lg)] leading-tight text-stamp">
        {badge}
      </p>
      <p className="text-center text-[length:var(--t-sm)] text-muted">{tagline}</p>
    </div>
  );
}
