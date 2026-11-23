import { AUTHOR_NAME, AUTHOR_URL } from "@/config";
import { authorCredit, type AuthorCredit } from "@/lib/author";

interface FooterProps {
  /** Defaults to the config credit. Tests pass their own, so they never mock config. */
  credit?: AuthorCredit | null;
}

/** Estimates note and the optional "Built in Lagos by <name>" credit (DESIGN §5.15). */
export function Footer({ credit = authorCredit(AUTHOR_NAME, AUTHOR_URL) }: FooterProps) {
  return (
    <footer className="border-t-2 border-dashed border-rule">
      <div className="mx-auto w-full max-w-[560px] px-4 py-6 text-[length:var(--t-xs)] text-muted">
        <p>Estimates only, not quotes. Tap any number to edit.</p>
        {credit !== null && (
          <p className="mt-1 flex flex-wrap items-center gap-x-1">
            Built in Lagos by
            {/* Underlined, so it is not colour alone. 44px tall tap area (DESIGN §4). */}
            <a
              href={credit.url}
              rel="noopener"
              className="inline-flex min-h-11 min-w-11 items-center text-ink underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
            >
              {credit.name}
            </a>
          </p>
        )}
      </div>
    </footer>
  );
}
