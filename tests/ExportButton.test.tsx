// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportButton } from "@/components/ExportButton";
import type { PrerenderSnapshot } from "@/lib/receipt/prerender";
import { AppStateProvider, useAppState } from "@/state/AppStateProvider";

/** A stand-in for the app-wide pre-render, so a test decides what the button sees. */
const fake = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let snapshot: PrerenderSnapshot = { status: "idle" };
  return {
    start: vi.fn<() => void>(),
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
    getSnapshot: fake.getSnapshot,
    subscribe: fake.subscribe,
    update: vi.fn(),
  },
}));

const BLOB = new Blob(["png-bytes"], { type: "image/png" });
const READY: PrerenderSnapshot = {
  status: "ready",
  blob: BLOB,
  diagnostics: { fonts: [], renderMs: 1, blobBytes: BLOB.size },
};

const TAP_AGAIN = "Printing… tap again in a moment.";
const READY_TEXT = "Receipt ready. Go and post am.";
const FAILED_TEXT = "Receipt no gree print. Change any number to try again.";

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
  vi.stubGlobal("navigator", {});
  createObjectURL = vi.fn(() => "blob:test/1");
  revokeObjectURL = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true, writable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true, writable: true });
  anchorClicks = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
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
    expect(statusText()).toBe(FAILED_TEXT);
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
    const image = screen.getByRole("img", { name: /^Receipt: .+ per person, .+ for \d+ people?\.$/ });
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
  it.each(["font", "draw", "blob", "unknown"] as const)("a tap after a %s failure says so and shares nothing", async (reason) => {
    fake.set({ status: "failed", reason });
    const { share } = sharingBrowser();
    mount();
    expect(exportButton().textContent).toBe("Export receipt");
    await tap();
    expect(statusText()).toBe(FAILED_TEXT);
    expect(share).not.toHaveBeenCalled();
  });
});