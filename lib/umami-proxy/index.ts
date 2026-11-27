/**
 * Same-origin proxy for Umami Cloud (T10.4, ARCHITECTURE §3.9). Plain TypeScript, no React and no
 * Node-only APIs: it runs inside the Cloudflare Pages Functions in `functions/` and in Vitest.
 *
 * Why: an ISP or DNS block, or an ad blocker's filter list, usually targets the Umami hostnames
 * (`cloud.umami.is`, `gateway.umami.is`). The browser talks only to this site's own origin; the
 * function relays the two requests. Both upstream URLs are fixed constants below, so the function
 * can never be pointed at another host, and only a short allow-list of request headers goes
 * upstream. Cookies, referrer and origin never do.
 */

/** The tracker script, as documented by Umami for Cloud. */
export const UMAMI_SCRIPT_UPSTREAM = "https://cloud.umami.is/script.js";
/** Where Umami Cloud's tracker posts events (Umami docs, "Sending stats"). Confirm in DevTools. */
export const UMAMI_COLLECT_UPSTREAM = "https://gateway.umami.is/api/send";
/** The path the tracker posts to on its `data-host-url` origin. Fixed by the tracker, not by us. */
export const COLLECT_PATH = "/api/send";

/** An event payload is a few hundred bytes. Anything near this is not from the tracker. */
const MAX_BODY_BYTES = 16 * 1024;
/** One hour: new tracker versions reach visitors within the hour, and repeat visits skip the relay. */
const SCRIPT_CACHE_CONTROL = "public, max-age=3600";

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const realFetch: Fetcher = (input, init) => fetch(input, init);

function plain(status: number, text: string, extra?: Record<string, string>): Response {
  return new Response(text, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}

/** GET (or HEAD) of the tracker script, relayed from Umami. */
export async function serveScript(
  request: Request,
  fetcher: Fetcher = realFetch,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return plain(405, "Method not allowed", { allow: "GET, HEAD" });
  }
  try {
    const upstream = await fetcher(UMAMI_SCRIPT_UPSTREAM);
    if (!upstream.ok) return plain(502, "Bad gateway");
    const script = await upstream.text();
    return new Response(request.method === "HEAD" ? null : script, {
      status: 200,
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": SCRIPT_CACHE_CONTROL,
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return plain(502, "Bad gateway");
  }
}

/** The only request headers that go upstream. Built from scratch, never copied wholesale. */
function upstreamHeaders(request: Request): Headers {
  const out = new Headers();
  out.set("content-type", request.headers.get("content-type") ?? "application/json");
  // Umami drops events without a real User-Agent (its docs say so), so the visitor's goes along.
  const userAgent = request.headers.get("user-agent");
  if (userAgent) out.set("user-agent", userAgent);
  // The tracker's own headers: hostname, website ID and the session cache token.
  request.headers.forEach((value, name) => {
    if (name.toLowerCase().startsWith("x-umami-")) out.set(name, value);
  });
  // Without this, Umami would see Cloudflare's IP and put every visitor in one country.
  const visitorIp = request.headers.get("cf-connecting-ip");
  if (visitorIp) out.set("x-forwarded-for", visitorIp);
  return out;
}

/** POST of one event from the tracker, relayed to Umami Cloud. */
export async function forwardCollect(
  request: Request,
  fetcher: Fetcher = realFetch,
): Promise<Response> {
  if (request.method !== "POST") {
    return plain(405, "Method not allowed", { allow: "POST" });
  }
  try {
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MAX_BODY_BYTES) return plain(413, "Payload too large");
    const body = await request.text();
    if (body.length === 0) return plain(400, "Empty body");
    if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
      return plain(413, "Payload too large");
    }
    const upstream = await fetcher(UMAMI_COLLECT_UPSTREAM, {
      method: "POST",
      headers: upstreamHeaders(request),
      body,
      redirect: "manual",
    });
    // Pass a success or a client error through (the tracker reads the body as its session token).
    // A redirect or a server error from upstream is not something the browser should follow.
    const passes = upstream.status < 300 || (upstream.status >= 400 && upstream.status < 500);
    if (!passes) return plain(502, "Bad gateway");
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return plain(502, "Bad gateway");
  }
}
