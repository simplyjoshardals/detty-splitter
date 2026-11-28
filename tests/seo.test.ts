import { describe, expect, it } from "vitest";
import robots, { dynamic as robotsDynamic } from "@/app/robots";
import sitemap, { dynamic as sitemapDynamic } from "@/app/sitemap";
import { GOOGLE_SITE_VERIFICATION, SITE_URL } from "@/config";

/**
 * Guards the crawl files and the Search Console tag (T10.5, REQUIREMENTS D9). Plain Node, no DOM.
 * That the files really land in `out/` is checked against the built site in e2e/seo.spec.ts.
 */
describe("robots.txt", () => {
  it("lets every crawler in and names the sitemap on the site's own origin", () => {
    const result = robots();
    expect(result.rules).toEqual({ userAgent: "*", allow: "/" });
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  it("is marked static, which a static export needs to write the file", () => {
    expect(robotsDynamic).toBe("force-static");
  });
});

describe("sitemap.xml", () => {
  it("lists the one page, at the same address as its canonical link", () => {
    const entries = sitemap();
    expect(entries).toHaveLength(1);
    // layout.tsx sets `canonical: "/"`, which Next renders as the bare origin (no trailing slash).
    // SITE_URL is a bare origin (tests/metadata.test.ts), so it is used as it is. The rendered
    // link itself is compared in e2e/seo.spec.ts.
    expect(entries[0]?.url).toBe(SITE_URL);
  });

  it("has no lastModified, because a build date would claim a change on every deploy", () => {
    expect(sitemap()[0]).not.toHaveProperty("lastModified");
  });

  it("is marked static, which a static export needs to write the file", () => {
    expect(sitemapDynamic).toBe("force-static");
  });
});

describe("Search Console tag", () => {
  it("is empty (no tag) or only the token value, not quotes, spaces or tag markup", () => {
    expect(GOOGLE_SITE_VERIFICATION).toMatch(/^[\w-]*$/);
  });
});
