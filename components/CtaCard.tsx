import { ArrowSquareOutIcon } from "@phosphor-icons/react/ssr";
import { CTA_BUTTON_TEXT, CTA_DISCLOSURE, CTA_ENABLED, CTA_TITLE, CTA_URL } from "@/config";
import { parseHttpsUrl } from "@/lib/author";
import { CtaLink } from "./CtaLink";

interface CtaCardProps {
  /** Defaults to the config flag. Tests pass their own, so they never mock config. */
  enabled?: boolean;
  /** Parsed again here, so a bad value can never become a link, whoever passes it. */
  url?: string | null;
  title?: string;
  buttonText?: string;
  /** Non-empty: shown under the button, and the link gets `sponsored`. */
  disclosure?: string;
}

const TITLE_ID = "cta-title";
const DISCLOSURE_ID = "cta-disclosure";

/**
 * "Next stop" card (DESIGN §5.12). Renders nothing, not even a wrapper, unless the flag is on
 * and the URL is a valid https: link, so a hidden card leaves no gap. The page puts it after
 * `main`, not inside the grid: Chrome bounds a sticky grid item by the whole grid container, so a
 * card in a grid row was overlapped by the sticky receipt column (T10.1 review). The outer div
 * (page column, 940px from 1280px so the card lines up under the receipt column) belongs to the
 * card, so it disappears with it. A server component: it is in the static HTML, so nothing
 * shifts on hydration.
 */
export function CtaCard({
  enabled = CTA_ENABLED,
  url = CTA_URL,
  title = CTA_TITLE,
  buttonText = CTA_BUTTON_TEXT,
  disclosure = CTA_DISCLOSURE,
}: CtaCardProps) {
  const href = enabled === true ? parseHttpsUrl(url ?? undefined) : null;
  const heading = title.trim();
  const label = buttonText.trim();
  // A card without a title or a button label would be an unnamed link, so it stays hidden too.
  if (href === null || !heading || !label) return null;

  const note = disclosure.trim();
  const rel = note ? "noopener noreferrer sponsored" : "noopener noreferrer";

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-6 min-[1280px]:max-w-[940px]">
      <section
        aria-labelledby={TITLE_ID}
        className="on-danfo mx-auto w-full max-w-[380px] border-2 border-ink bg-danfo p-4 min-[1280px]:mr-0 dark:border-danfo"
      >
        <p className="font-display text-[length:var(--t-xs)] text-ink">NEXT STOP</p>
        <h2
          id={TITLE_ID}
          className="mt-1 font-display text-[length:var(--t-lg)] leading-tight text-balance text-ink"
        >
          {heading}
        </h2>
        <CtaLink
          href={href}
          target="_blank"
          rel={rel}
          aria-label={`${label} (opens in a new tab)`}
          aria-describedby={note ? DISCLOSURE_ID : undefined}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 border-2 border-ink bg-surface font-display text-[length:var(--t-sm)] text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus) active:bg-ink active:text-danfo"
        >
          {label}
          <ArrowSquareOutIcon size={20} weight="bold" aria-hidden="true" />
        </CtaLink>
        {note && (
          <p
            id={DISCLOSURE_ID}
            className="mt-2 text-[length:var(--t-xs)] leading-4 text-balance text-muted"
          >
            {note}
          </p>
        )}
      </section>
    </div>
  );
}
