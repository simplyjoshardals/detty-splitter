import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Pins the Content-Security-Policy in public/_headers (T11.3). Cloudflare applies the file; nothing
 * in the unit tests does, so this only checks what is written. The e2e suite runs the app under
 * the same line.
 */
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const HEADERS = readFileSync(resolve(ROOT, "public/_headers"), "utf8");

const CSP_LINES = HEADERS.split(/\r?\n/).filter((line) =>
  /^\s+Content-Security-Policy:/.test(line),
);
const CSP = (CSP_LINES[0] ?? "").replace(/^\s+Content-Security-Policy:\s*/, "").trim();

/** Directive name -> its sources, e.g. "img-src" -> ["'self'", "data:", "blob:"]. */
const DIRECTIVES = new Map<string, string[]>(
  CSP.split(";")
    .map((part) => part.trim().split(/\s+/))
    .filter((tokens) => tokens[0] !== "")
    .map((tokens): [string, string[]] => [tokens[0], tokens.slice(1)]),
);

describe("public/_headers", () => {
  it("has exactly one CSP line, within Cloudflare's 2,000 character line limit", () => {
    expect(CSP_LINES).toHaveLength(1);
    expect(CSP.length).toBeGreaterThan(0);
    expect(CSP_LINES[0].length).toBeLessThan(2000);
  });

  it("keeps the other two headers", () => {
    expect(HEADERS).toMatch(/^\s+X-Content-Type-Options: nosniff/m);
    expect(HEADERS).toMatch(/^\s+Referrer-Policy: strict-origin-when-cross-origin/m);
  });

  it("allows only keywords and the data: and blob: schemes: no wildcard, no host, no eval", () => {
    const allowed = new Set(["'self'", "'none'", "'unsafe-inline'", "data:", "blob:"]);
    const offenders = [...DIRECTIVES].flatMap(([name, sources]) =>
      sources.filter((source) => !allowed.has(source)).map((source) => `${name} ${source}`),
    );
    expect(offenders).toEqual([]);
  });

  it("keeps everything on this origin, with blob: only for the export image", () => {
    expect(DIRECTIVES.get("default-src")).toEqual(["'self'"]);
    expect(DIRECTIVES.get("connect-src")).toEqual(["'self'"]);
    expect(DIRECTIVES.get("font-src")).toEqual(["'self'"]);
    expect(DIRECTIVES.get("img-src")).toEqual(expect.arrayContaining(["'self'", "blob:"]));
    expect(DIRECTIVES.get("script-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(DIRECTIVES.get("style-src")).toEqual(["'self'", "'unsafe-inline'"]);
  });

  it("shuts the doors that need no exception", () => {
    expect(DIRECTIVES.get("object-src")).toEqual(["'none'"]);
    expect(DIRECTIVES.get("base-uri")).toEqual(["'self'"]);
    expect(DIRECTIVES.get("form-action")).toEqual(["'self'"]);
    expect(DIRECTIVES.get("frame-ancestors")).toEqual(["'none'"]);
  });
});
