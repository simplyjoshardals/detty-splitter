import { serveScript } from "../../lib/umami-proxy";

/**
 * Cloudflare Pages Function: serves the tracker script from this site's own origin at `/m/lib`
 * (ANALYTICS_SCRIPT_SRC). The path is deliberately neutral. All logic lives in lib/umami-proxy.
 * Relative import on purpose: Pages bundles functions on its own and does not know the "@/" alias.
 */
export const onRequest = ({ request }: { request: Request }): Promise<Response> =>
  serveScript(request);
