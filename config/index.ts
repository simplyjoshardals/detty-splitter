/**
 * Single source for site-wide constants and env-driven flags.
 * Every environment variable is read here and nowhere else (ARCHITECTURE §7).
 * NEXT_PUBLIC_* values are public by design: never put secrets in them.
 *
 * Env vars must be accessed as literal `process.env.NEXT_PUBLIC_X` so Next.js
 * can inline them at build time. Do not destructure or index them dynamically.
 */

import type { Rates } from "@/lib/types";

/** Placeholder until Cloudflare assigns the real URL (T1.3) or a custom domain is set. */
export const SITE_URL = "https://detty-splitter.pages.dev";

/** The CTA is on only if the variable is exactly the string "true". */
export const CTA_ENABLED: boolean =
  process.env.NEXT_PUBLIC_CTA_ENABLED === "true";

/** Returns the URL string only if it parses with the https: protocol, else null. */
function parseHttpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export const CTA_URL: string | null = parseHttpsUrl(
  process.env.NEXT_PUBLIC_CTA_URL,
);

/**
 * PLACEHOLDER default rates, in naira per 1 unit of foreign currency. Not real:
 * 1,500 is the DATA_MODEL example and the GBP figure is made up. Replace both from a
 * real source before launch (DATA_MODEL §0 decision 5). The "as of" date arrives in T5.2.
 */
export const DEFAULT_RATES: Rates = { ngnPerUsd: 1500, ngnPerGbp: 2000 };
