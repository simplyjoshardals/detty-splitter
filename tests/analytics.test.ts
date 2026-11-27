import { afterEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_SCRIPT_SRC, ANALYTICS_SITE_ID, SITE_URL } from "@/config";
import { parseHttpsUrl } from "@/lib/author";
import { track, umamiScriptProps } from "@/lib/analytics";
import type { AnalyticsEvent } from "@/lib/analytics";

const SITE_ID = "94db1cb1-74f4-4a40-ad6c-962362670409";
const SCRIPT = "https://cloud.umami.is/script.js";

/** Bypasses the types on purpose: callers can be wrong at runtime. */
const loose = (event: unknown): AnalyticsEvent => event as AnalyticsEvent;

describe("track", () => {
  it("sends receipt_export with exactly tier, currency and method", () => {
    const tracker = { track: vi.fn() };
    track({ name: "receipt_export", tier: 3, currency: "USD", method: "share" }, tracker);
    expect(tracker.track).toHaveBeenCalledTimes(1);
    expect(tracker.track).toHaveBeenCalledWith("receipt_export", {
      tier: 3,
      currency: "USD",
      method: "share",
    });
  });

  it("sends link_copy and cta_click with no properties", () => {
    const tracker = { track: vi.fn() };
    track({ name: "link_copy" }, tracker);
    track({ name: "cta_click" }, tracker);
    expect(tracker.track).toHaveBeenNthCalledWith(1, "link_copy");
    expect(tracker.track).toHaveBeenNthCalledWith(2, "cta_click");
  });

  it("accepts every tier, currency and method", () => {
    const tracker = { track: vi.fn() };
    for (const tier of [1, 2, 3, 4, 5] as const) {
      for (const currency of ["NGN", "USD", "GBP"] as const) {
        for (const method of ["share", "download", "inline"] as const) {
          track({ name: "receipt_export", tier, currency, method }, tracker);
        }
      }
    }
    expect(tracker.track).toHaveBeenCalledTimes(5 * 3 * 3);
  });

  it("never sends extra fields: no amounts, headcounts, rates or share string", () => {
    const tracker = { track: vi.fn() };
    track(
      loose({
        name: "receipt_export",
        tier: 4,
        currency: "NGN",
        method: "download",
        perPersonNgn: 1_347_500,
        groupSize: 4,
        rates: { ngnPerUsd: 1500 },
        link: "https://example.com/#v1-secret",
      }),
      tracker,
    );
    expect(tracker.track).toHaveBeenCalledWith("receipt_export", {
      tier: 4,
      currency: "NGN",
      method: "download",
    });
    const sent = JSON.stringify(tracker.track.mock.calls);
    expect(sent).not.toContain("1347500");
    expect(sent).not.toContain("secret");
  });

  it("drops an event with an invalid value", () => {
    const tracker = { track: vi.fn() };
    const base = { name: "receipt_export", tier: 3, currency: "USD", method: "share" };
    for (const bad of [
      { ...base, tier: 0 },
      { ...base, tier: 6 },
      { ...base, tier: 2.5 },
      { ...base, tier: "3" },
      { ...base, tier: Number.NaN },
      { ...base, currency: "EUR" },
      { ...base, currency: undefined },
      { ...base, method: "print" },
      { ...base, method: undefined },
    ]) {
      track(loose(bad), tracker);
    }
    expect(tracker.track).not.toHaveBeenCalled();
  });

  it("drops an unknown event name", () => {
    const tracker = { track: vi.fn() };
    track(loose({ name: "preset_selected", preset: "soft" }), tracker);
    track(loose({}), tracker);
    expect(tracker.track).not.toHaveBeenCalled();
  });

  it("does nothing, and does not throw, with no tracker", () => {
    expect(() => track({ name: "link_copy" }, undefined)).not.toThrow();
  });

  it("swallows an error thrown by the tracker", () => {
    const tracker = {
      track: vi.fn(() => {
        throw new Error("blocked");
      }),
    };
    expect(() => track({ name: "cta_click" }, tracker)).not.toThrow();
    expect(tracker.track).toHaveBeenCalledTimes(1);
  });

  describe("with window.umami", () => {
    // Vitest runs in the node environment here, so `window` is stubbed, not read from jsdom.
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("does nothing on the server, where there is no window", () => {
      expect(() => track({ name: "link_copy" })).not.toThrow();
    });

    it("uses window.umami when the script has loaded", () => {
      const umami = { track: vi.fn() };
      vi.stubGlobal("window", { umami });
      track({ name: "link_copy" });
      expect(umami.track).toHaveBeenCalledWith("link_copy");
    });

    it("does nothing when the script is not there", () => {
      vi.stubGlobal("window", {});
      expect(() => track({ name: "link_copy" })).not.toThrow();
    });

    it("does nothing when window.umami has no track function", () => {
      vi.stubGlobal("window", { umami: { identify: vi.fn() } });
      expect(() => track({ name: "link_copy" })).not.toThrow();
      vi.stubGlobal("window", { umami: "nope" });
      expect(() => track({ name: "link_copy" })).not.toThrow();
    });
  });
});

describe("umamiScriptProps", () => {
  it("builds the tag attributes, with the hash and search excluded", () => {
    expect(umamiScriptProps(SITE_ID, SCRIPT, "https://detty-splitter.pages.dev/")).toEqual({
      src: SCRIPT,
      "data-website-id": SITE_ID,
      "data-domains": "detty-splitter.pages.dev",
      "data-exclude-hash": "true",
      "data-exclude-search": "true",
      "data-do-not-track": "true",
    });
  });

  it("limits tracking to the host of the site URL, not its path", () => {
    expect(umamiScriptProps(SITE_ID, SCRIPT, "https://example.com/some/path?x=1")?.["data-domains"]).toBe(
      "example.com",
    );
  });

  it("trims the site ID", () => {
    expect(umamiScriptProps(`  ${SITE_ID}\n`, SCRIPT, SITE_URL)?.["data-website-id"]).toBe(SITE_ID);
  });

  it("returns null, so no script, for a missing or malformed site ID", () => {
    for (const id of ["", "   ", "not-an-id", `${SITE_ID}"><script>`, SITE_ID.slice(1)]) {
      expect(umamiScriptProps(id, SCRIPT, SITE_URL)).toBeNull();
    }
  });

  it("returns null for a script URL that is not https", () => {
    expect(umamiScriptProps(SITE_ID, "http://cloud.umami.is/script.js", SITE_URL)).toBeNull();
    expect(umamiScriptProps(SITE_ID, "", SITE_URL)).toBeNull();
  });

  it("returns null for a site URL that does not parse", () => {
    expect(umamiScriptProps(SITE_ID, SCRIPT, "not a url")).toBeNull();
  });
});

describe("analytics config", () => {
  it("has a site ID that is empty (no analytics) or a UUID", () => {
    expect(ANALYTICS_SITE_ID === "" || umamiScriptProps(ANALYTICS_SITE_ID, SCRIPT, SITE_URL) !== null).toBe(
      true,
    );
  });

  it("loads the script over https", () => {
    expect(parseHttpsUrl(ANALYTICS_SCRIPT_SRC)).not.toBeNull();
  });
});
