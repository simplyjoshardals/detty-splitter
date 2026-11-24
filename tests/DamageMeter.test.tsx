// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DamageMeter } from "@/components/DamageMeter";
import { SETTLE_MS } from "@/components/meterHooks";
import { AppStateProvider, useAppState } from "@/state/AppStateProvider";
import type { BucketId } from "@/lib/types";

const BUCKET_IDS: readonly BucketId[] = ["stay", "events", "tables", "transport", "food"];

/**
 * Stands in for the real controls: plain buttons that dispatch, so these tests exercise the
 * meter alone (the real controls have a status line of their own, which would also match
 * `role="status"`). Default state is Soft Life Standard: per person ₦1,347,500, group of 4.
 */
function Controls() {
  const { dispatch } = useAppState();
  return (
    <div>
      <button type="button" onClick={() => dispatch({ type: "selectPreset", presetId: "budget" })}>
        Budget
      </button>
      <button type="button" onClick={() => dispatch({ type: "selectPreset", presetId: "soft" })}>
        Soft
      </button>
      <button type="button" onClick={() => dispatch({ type: "selectPreset", presetId: "baller" })}>
        Baller
      </button>
      <button type="button" onClick={() => dispatch({ type: "setGroupSize", value: 5 })}>
        Five people
      </button>
      <button type="button" onClick={() => dispatch({ type: "setCurrency", currency: "USD" })}>
        Dollars
      </button>
      <button
        type="button"
        onClick={() => {
          for (const bucketId of BUCKET_IDS) {
            dispatch({ type: "setBucketNumber", bucketId, field: "quantity", value: 0 });
          }
        }}
      >
        Zero everything
      </button>
    </div>
  );
}

/**
 * Stands in for the browser's IntersectionObserver, which jsdom does not have. Same shape as
 * the one in meterHooks.test.ts, with only the members the hook uses.
 */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe() {}
  unobserve() {}
  disconnect() {}
  emit(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

const latestObserver = () =>
  FakeIntersectionObserver.instances[FakeIntersectionObserver.instances.length - 1];

/** A fixture for the receipt (T6.3): an element with the id, optionally focusable by script. */
function addReceipt(options: { tabindex?: string } = {}): HTMLElement {
  const element = document.createElement("div");
  element.id = "receipt";
  if (options.tabindex !== undefined) element.setAttribute("tabindex", options.tabindex);
  const scrollIntoView = vi.fn();
  element.scrollIntoView = scrollIntoView;
  document.body.append(element);
  return element;
}

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function renderMeter() {
  render(
    <AppStateProvider>
      <Controls />
      <DamageMeter />
    </AppStateProvider>,
  );
}

const press = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const bar = () => screen.getByRole("region", { name: "DAMAGE METER" });
const liveRegion = () => screen.getByRole("status");

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("the bar", () => {
  it("is a named region with the label, the caption and the per-person total", () => {
    renderMeter();
    expect(within(bar()).getByText("DAMAGE METER")).toBeTruthy();
    expect(within(bar()).getByText("per person")).toBeTruthy();
    expect(within(bar()).getByText("₦1,347,500")).toBeTruthy();
  });

  it("is not drawn from 1280px up, where the receipt is a sticky column", () => {
    renderMeter();
    // jsdom has no layout, so the breakpoint class itself is what can be checked.
    expect(bar().className).toContain("min-[1280px]:hidden");
    // The live region is a sibling, so it keeps announcing while the bar is gone.
    expect(bar().contains(liveRegion())).toBe(false);
  });

  it("shows the new total on the very next render: no count-up", () => {
    renderMeter();
    press("Budget");
    expect(within(bar()).getByText("₦280,000")).toBeTruthy();
    expect(within(bar()).queryByText("₦1,347,500")).toBeNull();
  });

  it("follows the display currency", () => {
    renderMeter();
    press("Dollars");
    expect(within(bar()).getByText("$898.34")).toBeTruthy();
  });

  it("swaps the caption for the empty-state line when there is nothing to pay", () => {
    renderMeter();
    press("Zero everything");
    expect(within(bar()).getByText("₦0")).toBeTruthy();
    expect(within(bar()).getByText("Meter never start. Add a number, oya.")).toBeTruthy();
    expect(within(bar()).queryByText("per person")).toBeNull();
  });
});

describe("See receipt", () => {
  it("is not drawn while there is no receipt, and the bar still shows", () => {
    renderMeter();
    expect(screen.queryByRole("button", { name: "See receipt" })).toBeNull();
    expect(bar()).toBeTruthy();
  });

  it("appears when the receipt is mounted later", async () => {
    renderMeter();
    expect(screen.queryByRole("button", { name: "See receipt" })).toBeNull();
    await act(async () => {
      addReceipt();
    });
    expect(within(bar()).getByRole("button", { name: "See receipt" })).toBeTruthy();
  });

  it("scrolls the receipt into view smoothly", () => {
    const receipt = addReceipt();
    renderMeter();
    fireEvent.click(screen.getByRole("button", { name: "See receipt" }));
    expect(receipt.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(receipt.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("scrolls without animation when the system asks for reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
    }));
    const receipt = addReceipt();
    renderMeter();
    fireEvent.click(screen.getByRole("button", { name: "See receipt" }));
    expect(receipt.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });

  it("moves focus to the receipt when it has a tabindex, so focus is not lost with the bar", () => {
    const receipt = addReceipt({ tabindex: "-1" });
    renderMeter();
    fireEvent.click(screen.getByRole("button", { name: "See receipt" }));
    expect(document.activeElement).toBe(receipt);
  });

  it("leaves focus alone when the receipt has no tabindex", () => {
    addReceipt();
    renderMeter();
    const button = screen.getByRole("button", { name: "See receipt" });
    button.focus();
    fireEvent.click(button);
    expect(document.activeElement).toBe(button);
  });
});

describe("hiding while the receipt is on screen", () => {
  it("hides the bar from sight and from assistive technology, and brings it back", () => {
    addReceipt();
    renderMeter();
    expect(bar()).toBeTruthy();

    act(() => latestObserver()?.emit(true));
    expect(screen.queryByRole("region", { name: "DAMAGE METER" })).toBeNull();

    act(() => latestObserver()?.emit(false));
    expect(bar()).toBeTruthy();
    expect(screen.getByRole("button", { name: "See receipt" })).toBeTruthy();
  });

  it("keeps its place in the layout instead of collapsing", () => {
    addReceipt();
    renderMeter();
    act(() => latestObserver()?.emit(true));
    const hiddenBar = screen.getByText("DAMAGE METER").closest("section");
    // display stays as it was; only visibility changes, so the page does not shift.
    expect(hiddenBar?.style.visibility).toBe("hidden");
    expect(hiddenBar?.style.display).toBe("");
  });

  it("never hides when there is no receipt", () => {
    renderMeter();
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
    expect(bar()).toBeTruthy();
  });

  it("still announces totals while the bar is hidden", () => {
    vi.useFakeTimers();
    addReceipt();
    renderMeter();
    act(() => latestObserver()?.emit(true));
    press("Budget");
    advance(SETTLE_MS);
    expect(liveRegion().textContent).toBe(
      "Per person ₦280,000. Group total ₦1,120,000 for 4 people.",
    );
  });
});

describe("the live region", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("is a sibling of the bar, so hiding the bar cannot silence it", () => {
    renderMeter();
    expect(within(bar()).queryByRole("status")).toBeNull();
    expect(liveRegion()).toBeTruthy();
  });

  it("announces nothing on first render, even after the delay", () => {
    renderMeter();
    expect(liveRegion().textContent).toBe("");
    advance(5000);
    expect(liveRegion().textContent).toBe("");
  });

  it("announces the totals once the edit has been still for 600ms", () => {
    renderMeter();
    press("Budget");
    advance(SETTLE_MS - 1);
    expect(liveRegion().textContent).toBe("");
    advance(1);
    expect(liveRegion().textContent).toBe(
      "Per person ₦280,000. Group total ₦1,120,000 for 4 people.",
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("announces a burst of edits once, with the last totals", () => {
    renderMeter();
    press("Budget");
    advance(300);
    press("Baller");
    advance(SETTLE_MS - 1);
    expect(liveRegion().textContent).toBe("");
    advance(1);
    expect(liveRegion().textContent).toBe(
      "Per person ₦5,812,500. Group total ₦23,250,000 for 4 people.",
    );
  });

  it("announces nothing when an edit is reverted inside the window", () => {
    renderMeter();
    press("Budget");
    advance(300);
    press("Soft");
    advance(5000);
    expect(liveRegion().textContent).toBe("");
  });

  it("announces a change of group size, which moves the group total only", () => {
    renderMeter();
    press("Five people");
    advance(SETTLE_MS);
    expect(liveRegion().textContent).toBe(
      "Per person ₦1,347,500. Group total ₦6,737,500 for 5 people.",
    );
  });

  it("announces a change of currency in the new currency", () => {
    renderMeter();
    press("Dollars");
    advance(SETTLE_MS);
    expect(liveRegion().textContent).toBe(
      "Per person $898.34. Group total $3,593.36 for 4 people.",
    );
  });
});
