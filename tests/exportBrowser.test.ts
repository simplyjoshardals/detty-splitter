// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REVOKE_DELAY_MS, browserExportEnv, downloadViaAnchor, prefersShareSheet } from "@/lib/export/browser";

const BLOB = new Blob(["png-bytes"], { type: "image/png" });

/** jsdom has no object URLs; these stand in for them. */
function stubObjectUrls() {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:test/1");
  const revokeObjectURL = vi.fn<(url: string) => void>();
  Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true, writable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true, writable: true });
  return { createObjectURL, revokeObjectURL };
}

interface Click {
  download: string;
  href: string;
  connected: boolean;
}

/** Records the anchor at click time and keeps jsdom from "navigating". */
function spyOnClicks(): Click[] {
  const clicks: Click[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push({ download: this.download, href: this.href, connected: this.isConnected });
  });
  return clicks;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(URL, "createObjectURL");
  Reflect.deleteProperty(URL, "revokeObjectURL");
  document.body.replaceChildren();
});

describe("downloadViaAnchor", () => {
  it("clicks a hidden anchor with the file name and removes it again", () => {
    const { createObjectURL } = stubObjectUrls();
    const clicks = spyOnClicks();

    expect(downloadViaAnchor(BLOB, "receipt.png")).toBe(true);

    expect(createObjectURL).toHaveBeenCalledWith(BLOB);
    expect(clicks).toEqual([{ download: "receipt.png", href: "blob:test/1", connected: true }]);
    expect(document.querySelector("a")).toBeNull();
  });

  it("keeps the object URL alive until the delay has passed", () => {
    const { revokeObjectURL } = stubObjectUrls();
    spyOnClicks();

    downloadViaAnchor(BLOB, "receipt.png");
    vi.advanceTimersByTime(REVOKE_DELAY_MS - 1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test/1");
  });

  it("returns false, and makes no URL, when anchors have no download support", () => {
    const { createObjectURL } = stubObjectUrls();
    const original = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "download");
    Reflect.deleteProperty(HTMLAnchorElement.prototype, "download");
    try {
      expect(downloadViaAnchor(BLOB, "receipt.png")).toBe(false);
      expect(createObjectURL).not.toHaveBeenCalled();
    } finally {
      if (original !== undefined) Object.defineProperty(HTMLAnchorElement.prototype, "download", original);
    }
  });

  it("revokes the URL at once, removes the anchor and rethrows when the click throws", () => {
    const { revokeObjectURL } = stubObjectUrls();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => downloadViaAnchor(BLOB, "receipt.png")).toThrow("blocked");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test/1");
    expect(document.querySelector("a")).toBeNull();
  });
});

describe("browserExportEnv", () => {
  it("calls share and canShare as methods of navigator", async () => {
    const seen: unknown[] = [];
    const fakeNavigator = {
      share(this: unknown): Promise<void> {
        seen.push(this);
        return Promise.resolve();
      },
      canShare(this: unknown): boolean {
        seen.push(this);
        return true;
      },
    };
    vi.stubGlobal("navigator", fakeNavigator);

    const env = browserExportEnv();
    expect(env.canShare?.({ files: [] })).toBe(true);
    await env.share?.({ files: [] });

    expect(seen).toEqual([fakeNavigator, fakeNavigator]);
  });

  it("leaves share and canShare undefined when the browser has neither", () => {
    vi.stubGlobal("navigator", {});
    const env = browserExportEnv();
    expect(env.share).toBeUndefined();
    expect(env.canShare).toBeUndefined();
    expect(env.download).toBe(downloadViaAnchor);
  });

  it("copes with no navigator at all", () => {
    vi.stubGlobal("navigator", undefined);
    const env = browserExportEnv();
    expect(env.share).toBeUndefined();
    expect(env.canShare).toBeUndefined();
  });
});

describe("prefersShareSheet and the desktop rule", () => {
  const stubPointer = (coarse: boolean) =>
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: coarse && query === "(pointer: coarse)" }));
  const sharingNavigator = () => ({ share: () => Promise.resolve(), canShare: () => true });

  it("keeps sharing where the primary pointer is a finger", () => {
    stubPointer(true);
    vi.stubGlobal("navigator", sharingNavigator());
    expect(prefersShareSheet()).toBe(true);
    const env = browserExportEnv();
    expect(env.share).toBeTypeOf("function");
    expect(env.canShare).toBeTypeOf("function");
  });

  it("skips sharing on a desktop (mouse or trackpad) even though the browser can share files", () => {
    stubPointer(false);
    vi.stubGlobal("navigator", sharingNavigator());
    expect(prefersShareSheet()).toBe(false);
    const env = browserExportEnv();
    expect(env.share).toBeUndefined();
    expect(env.canShare).toBeUndefined();
    expect(env.download).toBe(downloadViaAnchor);
  });

  it("keeps sharing when matchMedia is missing, because it cannot tell", () => {
    vi.stubGlobal("matchMedia", undefined);
    vi.stubGlobal("navigator", sharingNavigator());
    expect(prefersShareSheet()).toBe(true);
    expect(browserExportEnv().share).toBeTypeOf("function");
  });
});