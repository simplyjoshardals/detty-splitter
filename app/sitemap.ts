import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config";

// A static export only writes this file to `out/` if the route is marked static.
export const dynamic = "force-static";

/**
 * `sitemap.xml` (T10.5): the one page. The URL is the canonical link: Next renders
 * `alternates.canonical: "/"` (layout.tsx) against `metadataBase` as the bare origin, with no
 * trailing slash, so the sitemap uses `SITE_URL` as it is (e2e/seo.spec.ts compares the two in
 * the built page). Share links
 * keep the calculation in the #hash, so they are not separate pages. No `lastModified`: a build
 * date would claim a change on every deploy.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL }];
}
