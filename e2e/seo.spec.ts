import { expect, test } from "@playwright/test";

/**
 * T10.5: the crawl files exist in the built export and agree with the page. Runs against `out/`
 * like the rest of the e2e suite; the unit test (tests/seo.test.ts) checks the values against
 * config, this checks they are really on disk and that robots, sitemap and canonical line up.
 * Not imported from app code, so no app code runs in Node.
 */
test("robots.txt, sitemap.xml and the canonical link agree", async ({ page, request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok(), "robots.txt is missing from the export").toBe(true);
  const robotsText = await robots.text();
  expect(robotsText).toMatch(/^User-Agent: \*$/im);
  expect(robotsText).toMatch(/^Allow: \/$/m);
  const sitemapLine = /^Sitemap: (https:\/\/\S+\/sitemap\.xml)$/m.exec(robotsText);
  expect(sitemapLine, "robots.txt names no sitemap").not.toBeNull();

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok(), "sitemap.xml is missing from the export").toBe(true);
  const locs = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs).toHaveLength(1);

  await page.goto("/");
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(locs[0]).toBe(canonical);
  // robots.txt and the sitemap sit on the same origin as the page they describe.
  expect(new URL(sitemapLine?.[1] ?? "").origin).toBe(new URL(canonical ?? "").origin);
  // Nothing on the page asks search engines to stay away.
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});
