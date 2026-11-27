/**
 * Analytics adapter (DATA_MODEL §7, ARCHITECTURE §3.9). Plain TypeScript, no React.
 *
 * Three events, with small fixed properties, and nothing else: never an amount, a headcount, a
 * rate or the share string. `track()` takes one of the typed events below, checks every value
 * again at runtime (types can be bypassed), and sends only the allowed keys, so an extra field
 * on an object can never leave the page. It never throws, and it does nothing when the Umami
 * script is absent (no site ID, blocked by an ad blocker, still loading, or a dev build).
 *
 * The script and its events go through this site's own origin (T10.4, lib/umami-proxy), so the
 * tag points at a same-origin path and carries `data-host-url`.
 */
import type { ExportMethod } from "@/lib/export";
import type { CurrencyCode } from "@/lib/types";

export type AnalyticsEvent =
  | {
      name: "receipt_export";
      /** The receipt tier id, 1 to 5 (data/tiers.ts). */
      tier: 1 | 2 | 3 | 4 | 5;
      currency: CurrencyCode;
      method: ExportMethod;
    }
  | { name: "link_copy" }
  | { name: "cta_click" };

type EventData = Record<string, string | number>;

/** The part of `window.umami` the adapter uses. */
export interface Tracker {
  track: (name: string, data?: EventData) => void;
}

const CURRENCIES: readonly string[] = ["NGN", "USD", "GBP"];
const METHODS: readonly string[] = ["share", "download", "inline"];

interface Payload {
  name: string;
  data?: EventData;
}

/** The event as it is sent, or `null` when anything about it is off. */
function toPayload(event: AnalyticsEvent): Payload | null {
  // Read as unknown: a wrong value from a caller must be dropped, not trusted to its type.
  const raw: Readonly<Record<string, unknown>> = event;
  switch (raw.name) {
    case "link_copy":
    case "cta_click":
      return { name: raw.name };
    case "receipt_export": {
      const { tier, currency, method } = raw;
      if (
        typeof tier !== "number" ||
        !Number.isInteger(tier) ||
        tier < 1 ||
        tier > 5
      )
        return null;
      if (typeof currency !== "string" || !CURRENCIES.includes(currency))
        return null;
      if (typeof method !== "string" || !METHODS.includes(method)) return null;
      return { name: "receipt_export", data: { tier, currency, method } };
    }
    default:
      return null;
  }
}

/** `window.umami` when the script has loaded and has a `track` function, else `undefined`. */
function browserTracker(): Tracker | undefined {
  if (typeof window === "undefined") return undefined;
  const candidate: unknown = (window as Window & { umami?: unknown }).umami;
  if (typeof candidate !== "object" || candidate === null) return undefined;
  return typeof (candidate as { track?: unknown }).track === "function"
    ? (candidate as Tracker)
    : undefined;
}

/** Sends one event. Safe to call anywhere: it never throws and never blocks. */
export function track(
  event: AnalyticsEvent,
  tracker: Tracker | undefined = browserTracker(),
): void {
  const payload = toPayload(event);
  if (payload === null || tracker === undefined) return;
  try {
    if (payload.data === undefined) tracker.track(payload.name);
    else tracker.track(payload.name, payload.data);
  } catch {
    // Analytics must never break the app.
  }
}

const SITE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Attributes for the Umami `<script>` tag. */
export interface UmamiScriptProps {
  /** A same-origin path (served by functions/m/lib.ts), never an Umami URL. */
  src: string;
  "data-website-id": string;
  /** Only this host sends data: localhost, previews and tests stay silent. */
  "data-domains": string;
  /**
   * Where events are posted: this site's own origin. Required, because without it the tracker
   * falls back to Umami's gateway host, the one a block or an ad blocker targets.
   */
  "data-host-url": string;
  /** Without these two the pageview URL would carry the share link, which holds the plan. */
  "data-exclude-hash": "true";
  "data-exclude-search": "true";
  /** Visitors whose browser says Do Not Track are not counted. */
  "data-do-not-track": "true";
}

/** A path on this site: one leading slash, plain characters, no `//` or `..`. */
const SAME_ORIGIN_PATH = /^\/[A-Za-z0-9_-][A-Za-z0-9._/-]*$/;

/**
 * The script tag's attributes, or `null` when there should be no script: no site ID, an ID that
 * is not a UUID, a script source that is not a same-origin path, or a site URL that is not a
 * valid https URL.
 */
export function umamiScriptProps(
  siteId: string,
  scriptSrc: string,
  siteUrl: string,
): UmamiScriptProps | null {
  const id = siteId.trim();
  if (
    !SITE_ID_PATTERN.test(id) ||
    !SAME_ORIGIN_PATH.test(scriptSrc) ||
    scriptSrc.includes("..")
  )
    return null;
  let site: URL;
  try {
    site = new URL(siteUrl);
  } catch {
    return null;
  }
  if (site.protocol !== "https:" || !site.hostname) return null;
  return {
    src: scriptSrc,
    "data-website-id": id,
    "data-domains": site.hostname,
    "data-host-url": site.origin,
    "data-exclude-hash": "true",
    "data-exclude-search": "true",
    "data-do-not-track": "true",
  };
}
