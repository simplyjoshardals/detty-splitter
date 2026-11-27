/**
 * Single source for site-wide constants and env-driven flags.
 * Every environment variable is read here and nowhere else (ARCHITECTURE §7).
 * NEXT_PUBLIC_* values are public by design: never put secrets in them.
 *
 * Env vars must be accessed as literal `process.env.NEXT_PUBLIC_X` so Next.js
 * can inline them at build time. Do not destructure or index them dynamically.
 */

import { parseHttpsUrl } from "@/lib/author";
import type { Rates } from "@/lib/types";

/** Placeholder until Cloudflare assigns the real URL (T1.3) or a custom domain is set. */
export const SITE_URL = "https://detty-splitter.pages.dev";

/**
 * Page metadata and link preview (T10.2, REQUIREMENTS D4/M10): one static, site-wide preview, no
 * per-link image. Plain constants, public by design. DRAFT copy in the app's voice (DESIGN §9);
 * refine freely, but keep the description at or under 160 characters (tests/metadata.test.ts).
 * The image is `public/og-image.png`, a 1200x630 sample danfo debit-alert receipt. If you change
 * its size, change OG_IMAGE_SIZE too (the test reads the real file and compares).
 */
export const SITE_NAME = "Detty Dec 2026";
export const SITE_TITLE = "Detty December 2026: Plan the damage";
export const SITE_DESCRIPTION =
  "Plan the damage before December plans you. Price your trip, split it with the group, and get your debit alert. Estimates only.";
export const OG_IMAGE_PATH = "/og-image.png";
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_ALT =
  "A danfo-yellow debit alert receipt: Detty Dec 2026, ₦1,347,500 per person for a group of 4, stamped Soft Life Certified.";

/**
 * `og:locale`. Facebook's English locales are en_GB and en_US (there is no en_NG), so en_GB, the
 * closest to Nigerian English spelling. Format `ll_CC`, checked in tests/metadata.test.ts.
 */
export const OG_LOCALE = "en_GB";

/** The author's X handle, shown as the card's attribution (`twitter:site`). Public by design. */
export const X_HANDLE = "@joshardals";

/**
 * Mobile browser toolbar colour (`theme-color`): danfo yellow, which matches the header band in
 * both themes (the band is a light island, DESIGN §3.1). Must equal `--danfo` in globals.css;
 * tests/metadata.test.ts reads the CSS and compares.
 */
export const THEME_COLOR = "#FFC400";

/** The CTA is on only if the variable is exactly the string "true". */
export const CTA_ENABLED: boolean =
  process.env.NEXT_PUBLIC_CTA_ENABLED === "true";

export const CTA_URL: string | null = parseHttpsUrl(
  process.env.NEXT_PUBLIC_CTA_URL,
);

/**
 * CTA card copy (DATA_MODEL §3.3, DESIGN §5.12). Plain constants, public by design.
 * PLACEHOLDER wording until C1 (copy refinement). CTA_DISCLOSURE is empty for your own link.
 * For an affiliate or paid link, set it (for example "Sponsored link. We may earn a
 * commission."): that shows the line under the button and marks the link `rel="sponsored"`.
 */
export const CTA_TITLE = "Still planning the trip?";
export const CTA_BUTTON_TEXT = "Take me there";
export const CTA_DISCLOSURE = "";

/**
 * Analytics (DATA_MODEL §3.3 and §7, ARCHITECTURE §3.9): Umami Cloud. The site ID is public by
 * design (it sits in the page source), so it is a plain constant, not an env var. Empty means no
 * script is added and `track()` does nothing. Paste the website ID (a UUID) from the Umami
 * dashboard before launch. The script only sends from the host of SITE_URL (`data-domains`),
 * so localhost, previews and tests never count. Change the host here and the CSP together.
 */
export const ANALYTICS_SITE_ID = "55b900bc-c714-418e-9af1-e74817cce70f";
export const ANALYTICS_SCRIPT_SRC = "https://cloud.umami.is/script.js";

/**
 * Optional footer credit, "Built in Lagos by <name>" (DESIGN §5.15). Plain constants,
 * public by design. Empty means no credit; the footer shows it only when the name is
 * non-empty and the URL is a valid https: URL (see authorCredit in lib/author).
 */
export const AUTHOR_NAME = "";
export const AUTHOR_URL = "";

/**
 * PLACEHOLDER default rates, in naira per 1 unit of foreign currency. Not real:
 * 1,500 is the DATA_MODEL example and the GBP figure is made up. Replace both, and
 * RATES_AS_OF, from a real source before launch (DATA_MODEL §0 decision 5).
 * Each must stay inside RANGES.rate, with at most 2 decimals (tests/rates.test.ts checks).
 */
export const DEFAULT_RATES: Rates = { ngnPerUsd: 1500, ngnPerGbp: 2000 };

/**
 * PLACEHOLDER: the date DEFAULT_RATES were read from the real source, as an ISO date
 * (YYYY-MM-DD). The UI shows it as "as of 23 Nov 2026" until a rate is edited. Set it
 * together with DEFAULT_RATES before launch; today's date only keeps the UI honest in dev.
 */
export const RATES_AS_OF = "2026-11-23";
