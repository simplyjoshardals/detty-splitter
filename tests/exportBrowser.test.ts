// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  REVOKE_DELAY_MS,
  browserExportEnv,
  downloadViaAnchor,
  isInAppBrowser,
  prefersShareSheet,
} from "@/lib/export/browser";

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

// Instagram and X strings were captured on a real iPhone and a real Android phone (26 Nov 2026).
// The TikTok Android string is from memory and unverified: no in-app browser was reachable.
describe("isInAppBrowser", () => {
  const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";
  const ANDROID = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko)";

  it.each([
    ["Instagram on iOS", `${IOS} Mobile/21F90 Instagram 340.0.0.28.115 (iPhone14,5; iOS 17_5; en_US)`],
    ["Instagram on Android", `${ANDROID} Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 340.0.0.0.0 Android (29/10)`],
    ["Facebook on Android", `${ANDROID} Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.38.108;]`],
    ["Facebook on iOS", `${IOS} Mobile/21F90 [FBAN/FBIOS;FBAV/450.0.0.0.0;FBDV/iPhone14,5;FBSN/iOS]`],
    ["TikTok on iOS (older string, from memory)", `${IOS} Mobile/21F90 musical_ly_34.0.0 JsSdk/2.0 BytedanceWebview/d8a21c6`],
    ["Instagram on iOS (real device)", `Mozilla/5.0 (iPhone; CPU iPhone OS 18_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22D72 Instagram 441.0.0.29.79 (iPhone11,8; iOS 18_3_1; en_GB; en-GB; scale=2.00; 828x1792; IABMV/1; 1030250346) NW/3 Safari/604.1`],
    ["Instagram on Android (real device)", `Mozilla/5.0 (Linux; Android 14; Infinix X6531B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/158.0.8127.46 Mobile Safari/537.36 Instagram 457.0.0.55.73 Android (34/14; 320dpi; 720x1600; INFINIX/Infinix; Infinix X6531B; Infinix-X6531B; mt6768; en_US; 1122313541)`],
    ["X on iOS (real device)", `Mozilla/5.0 (iPhone; CPU iPhone OS 18_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22D72 Twitter for iPhone/12.36`],
    ["X on Android (real device)", `Mozilla/5.0 (Linux; Android 14; Infinix X6531B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/158.0.8127.46 Mobile Safari/537.36 TwitterAndroid/12.44.0-prod.01 (312440001-r-01) Infinix+X6531B/14 (INFINIX;Infinix+X6531B;Infinix;X6531B-OP;0;;1;2015)`],
    ["TikTok on Android (unverified, from memory)", `${ANDROID} Chrome/126.0.0.0 Mobile Safari/537.36 trill_340000 AppName/musical_ly BytedanceWebview/d8a21c6`],
    ["Line on iOS", `${IOS} Mobile/21F90 Safari Line/13.17.0`],
    ["WeChat", `${ANDROID} Chrome/126.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.47 Process/appbrand0`],
    ["an Android WebView with no app marker", `${ANDROID.replace("K)", "K; wv)")} Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36`],
  ])("recognises %s", (_name, userAgent) => {
    expect(isInAppBrowser(userAgent)).toBe(true);
  });

  it.each([
    ["Safari on iPhone", `${IOS} Version/17.5 Mobile/15E148 Safari/604.1`],
    ["Chrome on iPhone", `${IOS} CriOS/126.0.0.0 Mobile/15E148 Safari/604.1`],
    ["Chrome on Android", `${ANDROID} Chrome/126.0.0.0 Mobile Safari/537.36`],
    ["Chrome on Windows", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"],
    ["Firefox on Linux (\"Linux\" is not \"Line/\")", "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0"],
    ["TikTok on iOS (real device: a bare WKWebView string, known miss)", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"],
    ["an empty user agent", ""],
  ])("does not flag %s", (_name, userAgent) => {
    expect(isInAppBrowser(userAgent)).toBe(false);
  });
});