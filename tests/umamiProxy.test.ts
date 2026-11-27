import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { ANALYTICS_SCRIPT_SRC } from "@/config";
import {
  COLLECT_PATH,
  UMAMI_COLLECT_UPSTREAM,
  UMAMI_SCRIPT_UPSTREAM,
  forwardCollect,
  serveScript,
} from "@/lib/umami-proxy";

const ORIGIN = "https://detty-splitter.pages.dev";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const EVENT = JSON.stringify({ type: "event", payload: { name: "link_copy" } });

const upstream = (body: string, init?: ResponseInit) =>
  vi.fn(async () => new Response(body, init));

function post(headers: Record<string, string> = {}, body: string = EVENT): Request {
  return new Request(`${ORIGIN}${COLLECT_PATH}`, { method: "POST", headers, body });
}

describe("serveScript", () => {
  it("relays the tracker script from the one fixed upstream URL", async () => {
    const fetcher = upstream("console.log(1)");
    const res = await serveScript(new Request(`${ORIGIN}/m/lib`), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(UMAMI_SCRIPT_UPSTREAM);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("console.log(1)");
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("answers HEAD without a body", async () => {
    const res = await serveScript(new Request(`${ORIGIN}/m/lib`, { method: "HEAD" }), upstream("x"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  it("refuses other methods without calling upstream", async () => {
    const fetcher = upstream("x");
    const res = await serveScript(new Request(`${ORIGIN}/m/lib`, { method: "POST", body: "{}" }), fetcher);
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, HEAD");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("answers 502, and caches nothing, when upstream fails or errors", async () => {
    const down = await serveScript(
      new Request(`${ORIGIN}/m/lib`),
      upstream("nope", { status: 500 }),
    );
    expect(down.status).toBe(502);
    expect(down.headers.get("cache-control")).toBe("no-store");
    const thrown = await serveScript(new Request(`${ORIGIN}/m/lib`), async () => {
      throw new Error("network");
    });
    expect(thrown.status).toBe(502);
  });
});

describe("forwardCollect", () => {
  it("posts the body to the one fixed upstream URL and returns its answer", async () => {
    const fetcher = upstream("session-token", { status: 200, headers: { "content-type": "text/plain" } });
    const res = await forwardCollect(post(), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(UMAMI_COLLECT_UPSTREAM);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(EVENT);
    expect(init.redirect).toBe("manual");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("session-token");
    expect(res.headers.get("content-type")).toBe("text/plain");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("forwards only the allow-listed headers", async () => {
    const fetcher = upstream("ok");
    await forwardCollect(
      post({
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 test",
        "x-umami-hostname": "detty-splitter.pages.dev",
        "x-umami-website-id": "55b900bc-c714-418e-9af1-e74817cce70f",
        "x-umami-cache": "token",
        "cf-connecting-ip": "203.0.113.7",
        cookie: "session=secret",
        authorization: "Bearer secret",
        referer: `${ORIGIN}/#v1-plan`,
        origin: ORIGIN,
        "x-custom": "nope",
      }),
      fetcher,
    );
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    const sent = new Headers(init.headers);
    expect(sent.get("content-type")).toBe("application/json");
    expect(sent.get("user-agent")).toBe("Mozilla/5.0 test");
    expect(sent.get("x-umami-hostname")).toBe("detty-splitter.pages.dev");
    expect(sent.get("x-umami-website-id")).toBe("55b900bc-c714-418e-9af1-e74817cce70f");
    expect(sent.get("x-umami-cache")).toBe("token");
    expect(sent.get("x-forwarded-for")).toBe("203.0.113.7");
    for (const name of ["cookie", "authorization", "referer", "origin", "x-custom", "cf-connecting-ip"]) {
      expect(sent.has(name)).toBe(false);
    }
  });

  it("sends no x-forwarded-for when the visitor's IP is unknown", async () => {
    const fetcher = upstream("ok");
    await forwardCollect(post({ "user-agent": "ua" }), fetcher);
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(init.headers).has("x-forwarded-for")).toBe(false);
  });

  it("never passes upstream cookies back to the browser", async () => {
    const res = await forwardCollect(
      post(),
      upstream("ok", { headers: { "set-cookie": "a=b", "x-other": "1" } }),
    );
    expect(res.headers.has("set-cookie")).toBe(false);
    expect(res.headers.has("x-other")).toBe(false);
  });

  it("refuses other methods without calling upstream", async () => {
    const fetcher = upstream("x");
    const res = await forwardCollect(new Request(`${ORIGIN}${COLLECT_PATH}`), fetcher);
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses an empty or oversized body without calling upstream", async () => {
    const fetcher = upstream("x");
    expect((await forwardCollect(post({}, ""), fetcher)).status).toBe(400);
    expect((await forwardCollect(post({}, "x".repeat(16 * 1024 + 1)), fetcher)).status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("passes an upstream client error through, and turns a redirect or server error into 502", async () => {
    expect((await forwardCollect(post(), upstream("bad", { status: 400 }))).status).toBe(400);
    expect(
      (await forwardCollect(post(), upstream("", { status: 302, headers: { location: "https://x.test" } })))
        .status,
    ).toBe(502);
    expect((await forwardCollect(post(), upstream("boom", { status: 503 }))).status).toBe(502);
  });

  it("answers 502, and does not throw, when upstream is unreachable", async () => {
    const res = await forwardCollect(post(), async () => {
      throw new Error("network");
    });
    expect(res.status).toBe(502);
  });
});

describe("wiring", () => {
  it("has a Pages Function file for the script path in config", () => {
    expect(ANALYTICS_SCRIPT_SRC.startsWith("/")).toBe(true);
    const file = resolve(ROOT, `functions${ANALYTICS_SCRIPT_SRC}.ts`);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toContain("serveScript");
  });

  it("has a Pages Function file for the collect path", () => {
    const file = resolve(ROOT, `functions${COLLECT_PATH}.ts`);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toContain("forwardCollect");
  });

  it("keeps the Umami hosts in lib/umami-proxy only", () => {
    for (const rel of ["config/index.ts", "lib/analytics/index.ts", "app/layout.tsx"]) {
      expect(readFileSync(resolve(ROOT, rel), "utf8")).not.toMatch(/https:\/\/(cloud|gateway)\.umami/);
    }
  });
});
