import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config";

// A static export only writes this file to `out/` if the route is marked static.
export const dynamic = "force-static";

/**
 * `robots.txt` (T10.5). Everything may be crawled and there is one page, so there is nothing to
 * disallow. The analytics relay paths are left alone on purpose: listing them would add a place
 * that has to stay in step with ANALYTICS_SCRIPT_SRC for no gain.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
