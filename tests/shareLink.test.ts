import { afterEach, describe, expect, it, vi } from "vitest";
import { SITE_URL } from "@/config";
import { decodeShare, encodeShare } from "@/lib/share";
import { buildShareUrl, copyText } from "@/lib/share/link";
import { GOLDEN, MAX_VALUES } from "./fixtures";

afterEach(() => vi.unstubAllGlobals());

describe("buildShareUrl", () => {
  it("is this page's address plus the encoder's hash", () => {
    const url = buildShareUrl(GOLDEN, { origin: "https://example.test", pathname: "/" });
    expect(url).toBe(`https://example.test/${encodeShare(GOLDEN)}`);
  });

  it("keeps a path prefix", () => {
    const url = buildShareUrl(GOLDEN, { origin: "https://example.test", pathname: "/app/" });
    expect(url.startsWith("https://example.test/app/#v1-")).toBe(true);
  });

  it("the worst-case link is under 200 characters and decodes to the same state", () => {
    const url = buildShareUrl(MAX_VALUES, { origin: SITE_URL, pathname: "/" });
    expect(url.length).toBeLessThan(200);
    expect(decodeShare(new URL(url).hash)).toEqual({ ok: true, state: MAX_VALUES, clamped: [] });
  });
});

describe("copyText", () => {
  it("writes the text and says copied", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await copyText("hello")).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("says denied when the browser refuses", async () => {
    const writeText = vi.fn(() => Promise.reject(new Error("NotAllowedError")));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await copyText("hello")).toBe("denied");
  });

  it("says denied when writeText throws at once", async () => {
    const writeText = vi.fn(() => {
      throw new Error("SecurityError");
    });
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await copyText("hello")).toBe("denied");
  });

  it("says denied when there is no clipboard API (an insecure page)", async () => {
    vi.stubGlobal("navigator", {});
    expect(await copyText("hello")).toBe("denied");
  });

  it("says denied when there is no navigator at all", async () => {
    vi.stubGlobal("navigator", undefined);
    expect(await copyText("hello")).toBe("denied");
  });
});
