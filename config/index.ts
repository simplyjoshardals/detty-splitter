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

/**
 * The live site URL (T1.3), a bare origin. Also the base of `robots.txt` and `sitemap.xml` (T10.5).
 * If a custom domain is ever set, change it here and add the new URL in Search Console.
 */
export const SITE_URL = "https://detty-splitter.pages.dev";

/**
 * Google Search Console ownership token (T10.5): the `content` value of the HTML-tag method,
 * rendered as the `google-site-verification` meta tag. Public by design (it sits in the page
 * source), so a plain constant, not an env var. Empty means no tag is added. Paste only the
 * value, not the whole tag (tests/seo.test.ts rejects quotes, spaces and markup).
 */
export const GOOGLE_SITE_VERIFICATION: string = "ALZDGDk04I4lwp05i-vyzoPomGvw_gNkJlKahVrXFPs";

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
 * Wording kept after C1 (copy refinement); the CTA is off at launch. CTA_DISCLOSURE is empty for your own link.
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
 * so localhost, previews and tests never count.
 *
 * Both the script and the events go through this site's own origin (T10.4), so a DNS block or
 * an ad blocker on Umami's hostnames does not matter. ANALYTICS_SCRIPT_SRC is a path on this
 * site, served by `functions/m/lib.ts`; events post to `<SITE_URL origin>/api/send`, served by
 * `functions/api/send.ts`. Rename the path and the file together (tests/umamiProxy.test.ts
 * checks they match). The Umami hosts themselves live in lib/umami-proxy.
 */
export const ANALYTICS_SITE_ID = "55b900bc-c714-418e-9af1-e74817cce70f";
export const ANALYTICS_SCRIPT_SRC = "/m/lib";

/**
 * Optional footer credit, "Built in Lagos by <name>" (DESIGN §5.15). Plain constants,
 * public by design. Empty means no credit; the footer shows it only when the name is
 * non-empty and the URL is a valid https: URL (see authorCredit in lib/author).
 */
export const AUTHOR_NAME = "Joshardals";
export const AUTHOR_URL = "https://x.com/joshardals";

/**
 * Default rates, in naira per 1 unit of foreign currency (R1, 28 Nov 2026). USD is the CBN
 * official rate (central rate 1,391.75 on 25 Nov 2026, rounded); GBP is the mid-market rate
 * rounded (about 1,855 to 1,865). Street rates run higher, so the rates panel stays editable.
 * Refresh both, and RATES_AS_OF, from a real source when they drift (DATA_MODEL §0 decision 5).
 * Each must stay inside RANGES.rate, with at most 2 decimals (tests/rates.test.ts checks).
 */
export const DEFAULT_RATES: Rates = { ngnPerUsd: 1356.9, ngnPerGbp: 1773.3 };

/**
 * The date DEFAULT_RATES were read from the real source, as an ISO date (YYYY-MM-DD). The UI
 * shows it as "as of 28 Nov 2026" until a rate is edited. Set it together with DEFAULT_RATES.
 */
export const RATES_AS_OF = "2026-11-28";
