// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportButton } from "@/components/ExportButton";
import type { AnalyticsEvent } from "@/lib/analytics";
import type { PrerenderSnapshot } from "@/lib/receipt/prerender";
import { AppStateProvider, useAppState } from "@/state/AppStateProvider";

/** A stand-in for the app-wide pre-render, so a test decides what the button sees. */
const fake = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let snapshot: PrerenderSnapshot = { status: "idle" };
  return {
    start: vi.fn<() => void>(),
    retry: vi.fn<() => void>(),
    getSnapshot: (): PrerenderSnapshot => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(next: PrerenderSnapshot) {
      snapshot = next;
      listeners.forEach((listener) => listener());
    },
  };
});

vi.mock("@/lib/receipt/prerender", () => ({
  prerender: {
    start: fake.start,
    retry: fake.retry,
    getSnapshot: fake.getSnapshot,
    subscribe: fake.subscribe,
    update: vi.fn(),
  },
}));

/** Stands in for the adapter, so a test sees what would be sent. */
const analytics = vi.hoisted(() => ({ track: vi.fn<(event: AnalyticsEvent) => void>() }));
vi.mock("@/lib/analytics", () => ({ track: analytics.track }));

const BLOB = new Blob(["png-bytes"], { type: "image/png" });
const READY: PrerenderSnapshot = {
  status: "ready",
  blob: BLOB,
  diagnostics: { fonts: [], renderMs: 1, blobBytes: BLOB.size },
};

const TAP_AGAIN = "Printing… tap again in a moment.";
const READY_TEXT = "Receipt ready. Go and post am.";
const FAILED_TEXT = "Receipt no gree print. Try again.";
const FONT_FAILED_TEXT = "The receipt font didn't load. Check your connection and try again.";
const DOWNLOADED_TEXT = "Receipt saved. Check your downloads.";
const HOLD_TEXT = "Press and hold the picture to save.";
const RIGHT_CLICK_TEXT = "Right-click the picture to save it.";
const IN_APP_TIP = "Tip: open this page in your browser for the best save and share.";
const INSTAGRAM_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/21F90 Instagram 340.0.0.28.115";
const SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1";

/** One edit, so a test can change the numbers after a result. */
function Edit() {
  const { dispatch } = useAppState();
  return (
    <button type="button" onClick={() => dispatch({ type: "setGroupSize", value: 7 })}>
      Make it seven
    </button>
  );
}

const mount = () =>
  render(
    <AppStateProvider>
      <ExportButton />
      <Edit />
    </AppStateProvider>,
  );

const exportButton = () => screen.getByRole("button", { name: /^(Export receipt|Printing…)$/ });
const statusText = () => screen.getByRole("status").textContent;
const tap = () => act(async () => void fireEvent.click(exportButton()));
const retryButton = () => screen.getByRole("button", { name: "Retry" });
const queryRetry = () => screen.queryByRole("button", { name: "Retry" });
const clickRetry = () => act(async () => void fireEvent.click(retryButton()));

/** What the real `prerender.retry()` does to the snapshot of a failed render. */
const retryStartsRendering = () =>
  fake.retry.mockImplementation(() => fake.set({ status: "rendering" }));

/** `(pointer: coarse)` matches for a finger, not for a mouse. */
const stubPointer = (coarse: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: coarse && query === "(pointer: coarse)",
  }));

/** A browser with a user agent, which downloads (no file sharing) unless `share` is given. */
function browserWith(userAgent: string, shareImpl?: () => Promise<void>) {
  const share = vi.fn<(data: ShareData) => Promise<void>>(shareImpl ?? (() => Promise.resolve()));
  const canShare = vi.fn<(data: ShareData) => boolean>(() => true);
  vi.stubGlobal(
    "navigator",
    shareImpl === undefined ? { userAgent } : { userAgent, share, canShare },
  );
  return { share, canShare };
}

/** A click that throws makes the download fail, so the chain ends at the inline image. */
function downloadThrows() {
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
    throw new Error("blocked");
  });
}

/** A browser that can share files. */
function sharingBrowser(shareImpl: () => Promise<void> = () => Promise.resolve()) {
  const share = vi.fn<(data: ShareData) => Promise<void>>(shareImpl);
  const canShare = vi.fn<(data: ShareData) => boolean>(() => true);
  vi.stubGlobal("navigator", { share, canShare });
  return { share, canShare };
}

let createObjectURL: ReturnType<typeof vi.fn<(blob: Blob) => string>>;
let revokeObjectURL: ReturnType<typeof vi.fn<(url: string) => void>>;
let anchorClicks: string[];

beforeEach(() => {
  fake.set({ status: "idle" });
  fake.start.mockClear();
  fake.retry.mockReset();
  vi.stubGlobal("navigator", {});
  createObjectURL = vi.fn(() => "blob:test/1");
  revokeObjectURL = vi.fn();
  Object.defineProperty(URL, "createObjectURL", {
    value: createObjectURL,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: revokeObjectURL,
    configurable: true,
    writable: true,
  });
  anchorClicks = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    anchorClicks.push(this.download);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(URL, "createObjectURL");
  Reflect.deleteProperty(URL, "revokeObjectURL");
});

describe("ExportButton: blob not ready", () => {
  it("reads Printing…, is aria-disabled, and has an empty status region", () => {
    mount();
    const button = exportButton();
    expect(button.textContent).toBe("Printing…");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(statusText()).toBe("");
  });

  it("a tap still reaches the handler: asks for another tap and starts the pre-render", async () => {
    const { share } = sharingBrowser();
    mount();
    await tap();
    expect(statusText()).toBe(TAP_AGAIN);
    expect(fake.start).toHaveBeenCalledTimes(1);
    expect(share).not.toHaveBeenCalled();
  });

  it("says the receipt is ready once the blob arrives, and the button turns live", async () => {
    sharingBrowser();
    mount();
    await tap();
    act(() => fake.set(READY));
    expect(statusText()).toBe(READY_TEXT);
    const button = exportButton();
    expect(button.textContent).toBe("Export receipt");
    expect(button.getAttribute("aria-disabled")).toBe("false");
  });

  it("says nothing about being ready if nobody tapped", () => {
    sharingBrowser();
    mount();
    act(() => fake.set(READY));
    expect(statusText()).toBe("");
  });

  it("reports a failed pre-render to someone who was waiting", async () => {
    sharingBrowser();
    mount();
    await tap();
    act(() => fake.set({ status: "failed", reason: "draw" }));
    expect(statusText()).toBe(FAILED_TEXT);
  });
});

describe("ExportButton: blob not ready, browser cannot share files", () => {
  it("waits for the blob and downloads on the first tap", async () => {
    mount(); // navigator is {}: no share
    await tap();
    expect(statusText()).toBe("Printing…");
    expect(anchorClicks).toEqual([]);
    expect(fake.start).toHaveBeenCalledTimes(1);

    await act(async () => fake.set(READY));
    expect(anchorClicks).toEqual(["detty-splitter-receipt.png"]);
    expect(statusText()).toBe("Receipt saved. Check your downloads.");
  });

  it("shows the inline image on the first tap when the download is unsupported", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("blocked");
    });
    mount();
    await tap();
    await act(async () => fake.set(READY));
    expect(statusText()).toBe("Press and hold the picture to save.");
    expect(screen.getByRole("img").getAttribute("src")).toBe("blob:test/1");
    expect(createObjectURL).toHaveBeenCalledWith(BLOB);
  });

  it("a second tap while waiting does not export twice", async () => {
    mount();
    await tap();
    await tap();
    await act(async () => fake.set(READY));
    expect(anchorClicks).toHaveLength(1);
  });

  it("reports a render failure that happens while waiting", async () => {
    mount();
    await tap();
    await act(async () => fake.set({ status: "failed", reason: "font" }));
    expect(statusText()).toBe(FONT_FAILED_TEXT);
  });

  it("drops the waiting message if the numbers change before the blob arrives", async () => {
    mount();
    await tap();
    fireEvent.click(screen.getByRole("button", { name: "Make it seven" }));
    await act(async () => fake.set(READY));
    expect(statusText()).toBe("");
  });
});

describe("ExportButton: ready", () => {
  beforeEach(() => fake.set(READY));

  it("shares inside the tap, with no await first", async () => {
    const { share } = sharingBrowser();
    mount();
    fireEvent.click(exportButton());
    expect(share).toHaveBeenCalledTimes(1);
    const file = share.mock.calls[0]?.[0].files?.[0];
    expect(file?.type).toBe("image/png");
    await act(async () => undefined); // let the result land
  });

  it("says the receipt was shared", async () => {
    sharingBrowser();
    mount();
    await tap();
    expect(statusText()).toBe("Receipt shared.");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("is silent when the user cancels the share sheet", async () => {
    sharingBrowser(() => Promise.reject(new DOMException("cancelled", "AbortError")));
    mount();
    await tap();
    expect(statusText()).toBe("");
    expect(anchorClicks).toEqual([]);
  });

  it("a cancel clears an earlier message", async () => {
    const { share } = sharingBrowser();
    mount();
    await tap();
    expect(statusText()).toBe("Receipt shared.");
    share.mockRejectedValueOnce(new DOMException("cancelled", "AbortError"));
    await tap();
    expect(statusText()).toBe("");
  });

  it("downloads when the browser cannot share, and says so", async () => {
    mount(); // navigator is {}: no share
    await tap();
    expect(anchorClicks).toEqual(["detty-splitter-receipt.png"]);
    expect(statusText()).toBe("Receipt saved. Check your downloads.");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows the image inline, with alt text and a press-and-hold line, when the download is unsupported", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("blocked");
    });
    mount();
    await tap();
    expect(statusText()).toBe("Press and hold the picture to save.");
    const image = screen.getByRole("img", {
      name: /^Detty December 2026 receipt, .+: .+ per person, .+ for \d+ people?\.$/,
    });
    expect(image.getAttribute("src")).toBe("blob:test/1");
    expect(createObjectURL).toHaveBeenCalledWith(BLOB);
  });

  it("hides the inline image and frees its URL when the numbers change", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("blocked");
    });
    mount();
    await tap();
    expect(screen.getByRole("img")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Make it seven" }));
    expect(screen.queryByRole("img")).toBeNull();
    expect(statusText()).toBe("");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test/1");
  });

  it("frees the inline image URL on unmount", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("blocked");
    });
    const view = mount();
    await tap();
    view.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test/1");
  });

  it("drops a share result for old numbers", async () => {
    let finish: () => void = () => undefined;
    sharingBrowser(() => new Promise<void>((resolve) => void (finish = resolve)));
    mount();
    await tap();
    fireEvent.click(screen.getByRole("button", { name: "Make it seven" }));
    await act(async () => finish());
    expect(statusText()).toBe("");
  });
});

describe("ExportButton: failed pre-render", () => {
  const COPY_FOR = {
    font: FONT_FAILED_TEXT,
    draw: FAILED_TEXT,
    blob: FAILED_TEXT,
    unknown: FAILED_TEXT,
    load: FAILED_TEXT, // the renderer chunk did not import: reported as "unknown"
  } as const;

  it.each(["font", "draw", "blob", "unknown", "load"] as const)(
    "a tap after a %s failure says why, offers Retry and shares nothing",
    async (reason) => {
      fake.set({ status: "failed", reason });
      const { share } = sharingBrowser();
      mount();
      expect(exportButton().textContent).toBe("Export receipt");
      expect(queryRetry()).toBeNull(); // nothing is said before a tap
      await tap();
      expect(statusText()).toBe(COPY_FOR[reason]);
      expect(retryButton().getAttribute("aria-disabled")).toBe("false");
      expect(share).not.toHaveBeenCalled();
    },
  );

  it("takes the reason from the pre-render when a tap was waiting and the render then failed", async () => {
    sharingBrowser();
    mount();
    await tap();
    expect(queryRetry()).toBeNull();
    act(() => fake.set({ status: "failed", reason: "font" }));
    expect(statusText()).toBe(FONT_FAILED_TEXT);
    expect(retryButton()).toBeTruthy();
  });

  it("drops the failure and its Retry button when the numbers change", async () => {
    fake.set({ status: "failed", reason: "draw" });
    sharingBrowser();
    mount();
    await tap();
    expect(retryButton()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Make it seven" }));
    expect(statusText()).toBe("");
    expect(queryRetry()).toBeNull();
  });
});

describe("ExportButton: Retry", () => {
  beforeEach(() => {
    fake.set({ status: "failed", reason: "draw" });
    retryStartsRendering();
  });

  it("where sharing works: starts the render again, asks for a tap, and says when it is ready", async () => {
    const { share } = sharingBrowser();
    mount();
    await tap();
    expect(statusText()).toBe(FAILED_TEXT);

    await clickRetry();
    expect(fake.retry).toHaveBeenCalledTimes(1);
    expect(statusText()).toBe(TAP_AGAIN);
    expect(retryButton().getAttribute("aria-disabled")).toBe("true"); // shown, dimmed, while it runs
    expect(share).not.toHaveBeenCalled(); // no gesture to spend yet

    act(() => fake.set(READY));
    expect(statusText()).toBe(READY_TEXT);
    expect(queryRetry()).toBeNull();
  });

  it("where sharing is impossible: finishes the export on the Retry press", async () => {
    mount(); // navigator is {}: no share
    await tap();
    expect(statusText()).toBe(FAILED_TEXT);

    await clickRetry();
    expect(statusText()).toBe("Printing…");
    expect(retryButton().getAttribute("aria-disabled")).toBe("true");
    expect(anchorClicks).toEqual([]);

    await act(async () => fake.set(READY));
    expect(anchorClicks).toEqual(["detty-splitter-receipt.png"]);
    expect(statusText()).toBe(DOWNLOADED_TEXT);
    expect(queryRetry()).toBeNull();
  });

  it("moves focus to the main button, so the dimmed Retry never holds it", async () => {
    sharingBrowser();
    mount();
    await tap();
    await clickRetry();
    expect(document.activeElement).toBe(exportButton());
  });

  it("a second press while it runs does nothing", async () => {
    sharingBrowser();
    mount();
    await tap();
    await clickRetry();
    await clickRetry();
    expect(fake.retry).toHaveBeenCalledTimes(1);
  });

  it("offers Retry again, with the new reason, when the retry fails too", async () => {
    sharingBrowser();
    mount();
    await tap();
    await clickRetry();
    act(() => fake.set({ status: "failed", reason: "font" }));
    expect(statusText()).toBe(FONT_FAILED_TEXT);
    expect(retryButton().getAttribute("aria-disabled")).toBe("false");
  });

  it("where sharing is impossible, a failed retry reports the reason and offers Retry again", async () => {
    mount();
    await tap();
    await clickRetry();
    await act(async () => fake.set({ status: "failed", reason: "blob" }));
    expect(statusText()).toBe(FAILED_TEXT);
    expect(retryButton().getAttribute("aria-disabled")).toBe("false");
  });
});

describe("ExportButton: outcomes and the inline caption", () => {
  beforeEach(() => fake.set(READY));

  it("says nothing about a cancelled share, and shows no Retry", async () => {
    sharingBrowser(() => Promise.reject(new DOMException("cancelled", "AbortError")));
    mount();
    await tap();
    expect(statusText()).toBe("");
    expect(queryRetry()).toBeNull();
  });

  it("a download that throws falls to the inline image", async () => {
    downloadThrows();
    mount();
    await tap();
    expect(screen.getByRole("img")).toBeTruthy();
    expect(queryRetry()).toBeNull();
  });

  it("tells a finger to press and hold", async () => {
    stubPointer(true);
    downloadThrows();
    mount();
    await tap();
    expect(statusText()).toBe(HOLD_TEXT);
  });

  it("tells a mouse to right-click", async () => {
    stubPointer(false);
    downloadThrows();
    mount();
    await tap();
    expect(statusText()).toBe(RIGHT_CLICK_TEXT);
  });
});

describe("ExportButton: in-app browser tip", () => {
  beforeEach(() => fake.set(READY));

  it("shows nothing before a tap", () => {
    browserWith(INSTAGRAM_UA);
    mount();
    expect(statusText()).toBe("");
  });

  it("follows a download in an in-app browser", async () => {
    browserWith(INSTAGRAM_UA);
    mount();
    await tap();
    expect(statusText()).toContain(DOWNLOADED_TEXT);
    expect(statusText()).toContain(IN_APP_TIP);
  });

  it("follows the inline image in an in-app browser", async () => {
    browserWith(INSTAGRAM_UA);
    downloadThrows();
    mount();
    await tap();
    expect(statusText()).toContain(IN_APP_TIP);
  });

  it("follows a failure in an in-app browser, next to Retry", async () => {
    fake.set({ status: "failed", reason: "draw" });
    browserWith(INSTAGRAM_UA);
    mount();
    await tap();
    expect(statusText()).toContain(FAILED_TEXT);
    expect(statusText()).toContain(IN_APP_TIP);
    expect(retryButton()).toBeTruthy();
  });

  it("is left out when the share sheet worked", async () => {
    browserWith(INSTAGRAM_UA, () => Promise.resolve());
    mount();
    await tap();
    expect(statusText()).toBe("Receipt shared.");
  });

  it("is left out in an ordinary browser", async () => {
    browserWith(SAFARI_UA);
    mount();
    await tap();
    expect(statusText()).toBe(DOWNLOADED_TEXT);
  });
});

describe("ExportButton: analytics", () => {
  beforeEach(() => {
    analytics.track.mockClear();
    fake.set(READY);
  });

  /** The one event the tap sent, with its tier checked to be a real tier id. */
  function sentExport() {
    expect(analytics.track).toHaveBeenCalledTimes(1);
    const event = analytics.track.mock.calls[0]?.[0];
    if (event?.name !== "receipt_export") throw new Error("expected a receipt_export event");
    expect([1, 2, 3, 4, 5]).toContain(event.tier);
    return event;
  }

  it("sends receipt_export with method share after the share sheet worked", async () => {
    sharingBrowser();
    mount();
    await tap();
    expect(sentExport()).toMatchObject({ currency: "NGN", method: "share" });
  });

  it("sends receipt_export with method download after a download", async () => {
    mount(); // navigator is {}: no share
    await tap();
    expect(sentExport()).toMatchObject({ currency: "NGN", method: "download" });
  });

  it("sends receipt_export with method inline when the download is unsupported", async () => {
    downloadThrows();
    mount();
    await tap();
    expect(sentExport()).toMatchObject({ currency: "NGN", method: "inline" });
  });

  it("sends only the name, tier, currency and method: no amounts, headcount, rates or link", async () => {
    mount();
    await tap();
    expect(Object.keys(sentExport()).sort()).toEqual(["currency", "method", "name", "tier"]);
  });

  it("sends nothing when the user cancels the share sheet", async () => {
    sharingBrowser(() => Promise.reject(new DOMException("cancelled", "AbortError")));
    mount();
    await tap();
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it("sends nothing when the receipt is not ready yet", async () => {
    fake.set({ status: "idle" });
    sharingBrowser();
    mount();
    await tap();
    expect(statusText()).toBe(TAP_AGAIN);
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it("sends nothing when the pre-render failed", async () => {
    fake.set({ status: "failed", reason: "draw" });
    sharingBrowser();
    mount();
    await tap();
    expect(statusText()).toBe(FAILED_TEXT);
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it("sends one event per finished export, and a second tap is a second export", async () => {
    sharingBrowser();
    mount();
    await tap();
    await tap();
    expect(analytics.track).toHaveBeenCalledTimes(2);
  });
});
