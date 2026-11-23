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

/** The CTA is on only if the variable is exactly the string "true". */
export const CTA_ENABLED: boolean =
  process.env.NEXT_PUBLIC_CTA_ENABLED === "true";

export const CTA_URL: string | null = parseHttpsUrl(
  process.env.NEXT_PUBLIC_CTA_URL,
);

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
