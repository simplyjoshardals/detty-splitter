import { forwardCollect } from "../../lib/umami-proxy";

/**
 * Cloudflare Pages Function: receives the tracker's events at `/api/send` on this site's own
 * origin (the tracker always posts to `<data-host-url>/api/send`) and relays them to Umami Cloud.
 * All logic lives in lib/umami-proxy.
 */
export const onRequest = ({ request }: { request: Request }): Promise<Response> =>
  forwardCollect(request);
