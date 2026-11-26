// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SETTLE_MS, useSettledMessage, useTargetInView } from "@/components/meterHooks";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "visualViewport");
  document.body.innerHTML = "";
});

describe("useSettledMessage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  function setup(initial: string) {
    return renderHook(({ message }) => useSettledMessage(message), {
      initialProps: { message: initial },
    });
  }

  function advance(ms: number) {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  it("announces nothing on first render, even after the delay", () => {
    const { result } = setup("A");
    expect(result.current).toBe("");
    advance(5000);
    expect(result.current).toBe("");
  });

  it("announces a change only after it has stayed the same for 600ms", () => {
    const { result, rerender } = setup("A");
    rerender({ message: "B" });
    advance(SETTLE_MS - 1);
    expect(result.current).toBe("");
    advance(1);
    expect(result.current).toBe("B");
  });

  it("announces a burst of edits once, with the last message", () => {
    const { result, rerender } = setup("A");
    rerender({ message: "B" });
    advance(300);
    rerender({ message: "C" });
    advance(300);
    rerender({ message: "D" });
    advance(SETTLE_MS - 1);
    expect(result.current).toBe("");
    advance(1);
    expect(result.current).toBe("D");
  });

  it("announces nothing when an edit is reverted inside the window", () => {
    const { result, rerender } = setup("A");
    rerender({ message: "B" });
    advance(300);
    rerender({ message: "A" });
    advance(5000);
    expect(result.current).toBe("");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("announces a revert that happens after the first edit has settled", () => {
    const { result, rerender } = setup("A");
    rerender({ message: "B" });
    advance(SETTLE_MS);
    expect(result.current).toBe("B");
    rerender({ message: "A" });
    advance(SETTLE_MS);
    expect(result.current).toBe("A");
  });

  it("does not restart the wait when it re-renders with the same message", () => {
    const { result, rerender } = setup("A");
    rerender({ message: "B" });
    advance(400);
    rerender({ message: "B" });
    advance(200);
    expect(result.current).toBe("B");
  });

  it("clears its timer when unmounted", () => {
    const { rerender, unmount } = setup("A");
    rerender({ message: "B" });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

/**
 * Stands in for the browser's IntersectionObserver, which jsdom does not have. It has only the
 * members the hook uses, so it does not depend on which DOM typings version is installed.
 */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observed: Element[] = [];
  disconnected = false;

  constructor(
    private readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(element: Element) {
    this.observed.push(element);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  emit(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

function addTarget(id: string): HTMLElement {
  const element = document.createElement("div");
  element.id = id;
  document.body.append(element);
  return element;
}

describe("useTargetInView", () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });

  const latest = () => FakeIntersectionObserver.instances[FakeIntersectionObserver.instances.length - 1];

  it("reports not found, not in view, and watches nothing when the target is missing", () => {
    const { result } = renderHook(() => useTargetInView("receipt"));
    expect(result.current).toEqual({ found: false, inView: false });
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
  });

  it("finds a target that is already on the page and follows what the observer reports", () => {
    const target = addTarget("receipt");
    const { result } = renderHook(() => useTargetInView("receipt"));
    expect(result.current).toEqual({ found: true, inView: false });
    expect(latest()?.observed).toEqual([target]);

    act(() => latest()?.emit(true));
    expect(result.current).toEqual({ found: true, inView: true });
    act(() => latest()?.emit(false));
    expect(result.current).toEqual({ found: true, inView: false });
  });

  it("passes the root margin to the observer, and none when it is not given", () => {
    addTarget("receipt");
    renderHook(() => useTargetInView("receipt"));
    expect(latest()?.options).toBeUndefined();
    renderHook(() => useTargetInView("receipt", "0px 0px -88px 0px"));
    expect(latest()?.options).toEqual({ rootMargin: "0px 0px -88px 0px" });
  });

  it("finds a target that is added after the first render", async () => {
    const { result } = renderHook(() => useTargetInView("receipt"));
    expect(result.current.found).toBe(false);
    await act(async () => {
      addTarget("receipt");
    });
    expect(result.current.found).toBe(true);
    act(() => latest()?.emit(true));
    expect(result.current.inView).toBe(true);
  });

  it("is never in view once the target is removed, and stops watching it", async () => {
    const target = addTarget("receipt");
    const { result } = renderHook(() => useTargetInView("receipt"));
    act(() => latest()?.emit(true));
    expect(result.current.inView).toBe(true);
    const observer = latest();

    await act(async () => {
      target.remove();
    });
    expect(result.current).toEqual({ found: false, inView: false });
    expect(observer?.disconnected).toBe(true);
  });

  it("keeps the bar visible when IntersectionObserver is not available", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    addTarget("receipt");
    const { result } = renderHook(() => useTargetInView("receipt"));
    expect(result.current).toEqual({ found: true, inView: false });
  });

  it("disconnects its observer when unmounted", () => {
    addTarget("receipt");
    const { unmount } = renderHook(() => useTargetInView("receipt"));
    const observer = latest();
    expect(observer?.disconnected).toBe(false);
    unmount();
    expect(observer?.disconnected).toBe(true);
  });

  it("ignores other elements", () => {
    addTarget("something-else");
    const { result } = renderHook(() => useTargetInView("receipt"));
    expect(result.current).toEqual({ found: false, inView: false });
  });
});

/**
 * The iOS Safari safety net (third argument). The fake observer plays the browser that went
 * quiet: it says "in view" once and then never reports again, while the page scrolls on and
 * only the hand measurement can notice. jsdom has no layout, so the target's rect is set by hand
 * and the viewport is `window.innerHeight` (768 in jsdom) unless a `visualViewport` is added.
 */
describe("useTargetInView safety net", () => {
  const CLEARANCE = 100;
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;

  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    frames = new Map();
    nextFrame = 1;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.set(nextFrame, callback);
      return nextFrame++;
    });
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
      frames.delete(handle);
    });
  });

  const latest = () => FakeIntersectionObserver.instances[FakeIntersectionObserver.instances.length - 1];

  /** Runs the measurements that were queued for the next frame. */
  function flushFrames() {
    act(() => {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(0);
    });
  }

  function placeTarget(target: HTMLElement, top: number, bottom: number) {
    target.getBoundingClientRect = () => ({ top, bottom }) as DOMRect;
  }

  function setup() {
    const target = addTarget("receipt-totals");
    const hook = renderHook(() =>
      useTargetInView("receipt-totals", `0px 0px -${CLEARANCE}px 0px`, CLEARANCE),
    );
    return { target, ...hook };
  }

  it("clears a stuck 'in view' when the totals have left the screen", () => {
    const { target, result } = setup();
    act(() => latest()?.emit(true));
    expect(result.current.inView).toBe(true);

    // The observer never reports again, but the page scrolled: the totals are above the screen.
    placeTarget(target, -400, -50);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    flushFrames();
    expect(result.current.inView).toBe(false);
  });

  it("finds the totals again when the observer missed them arriving", () => {
    const { target, result } = setup();
    act(() => latest()?.emit(false));

    placeTarget(target, 200, 400);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    flushFrames();
    expect(result.current.inView).toBe(true);
  });

  it("ignores the strip the bar covers: totals only under the clearance are not in view", () => {
    const { target, result } = setup();
    const viewportHeight = window.innerHeight;

    placeTarget(target, viewportHeight - CLEARANCE + 1, viewportHeight + 200);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    flushFrames();
    expect(result.current.inView).toBe(false);

    placeTarget(target, viewportHeight - CLEARANCE - 1, viewportHeight + 200);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    flushFrames();
    expect(result.current.inView).toBe(true);
  });

  it.each([
    ["resize", () => window.dispatchEvent(new Event("resize"))],
    ["pageshow", () => window.dispatchEvent(new Event("pageshow"))],
    ["visibilitychange", () => document.dispatchEvent(new Event("visibilitychange"))],
  ])("re-measures on %s", (_name, fire) => {
    const { target, result } = setup();
    act(() => latest()?.emit(true));
    placeTarget(target, -400, -50);
    act(() => {
      fire();
    });
    flushFrames();
    expect(result.current.inView).toBe(false);
  });

  it.each(["resize", "scroll"])("measures against visualViewport and re-measures on its %s", (type) => {
    const visualViewport = Object.assign(new EventTarget(), { height: 300 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: visualViewport });
    const { target, result } = setup();

    // 300px tall viewport minus the 100px clearance: a top edge at 250 is under the bar.
    placeTarget(target, 250, 500);
    act(() => {
      visualViewport.dispatchEvent(new Event(type));
    });
    flushFrames();
    expect(result.current.inView).toBe(false);

    placeTarget(target, 150, 500);
    act(() => {
      visualViewport.dispatchEvent(new Event(type));
    });
    flushFrames();
    expect(result.current.inView).toBe(true);
  });

  it("measures once per frame however many events arrive", () => {
    const { target, result } = setup();
    placeTarget(target, 100, 300);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("scroll"));
    });
    expect(frames.size).toBe(1);
    flushFrames();
    expect(result.current.inView).toBe(true);
  });

  it("is observer only when no clearance is given: events change nothing", () => {
    const target = addTarget("receipt-totals");
    const { result } = renderHook(() => useTargetInView("receipt-totals"));
    act(() => latest()?.emit(true));
    placeTarget(target, -400, -50);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    flushFrames();
    expect(frames.size).toBe(0);
    expect(result.current.inView).toBe(true);
  });

  it("is never in view while the target is missing, whatever the events say", async () => {
    const { target, result } = setup();
    placeTarget(target, 100, 300);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    flushFrames();
    expect(result.current.inView).toBe(true);

    await act(async () => {
      target.remove();
    });
    expect(result.current).toEqual({ found: false, inView: false });
  });

  it("removes every listener and the pending frame when unmounted", () => {
    const windowRemove = vi.spyOn(window, "removeEventListener");
    const documentRemove = vi.spyOn(document, "removeEventListener");
    const { target, unmount } = setup();
    placeTarget(target, 100, 300);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(frames.size).toBe(1);

    unmount();
    const removedFromWindow = windowRemove.mock.calls.map(([type]) => type);
    expect(removedFromWindow).toEqual(expect.arrayContaining(["scroll", "resize", "pageshow"]));
    expect(documentRemove.mock.calls.map(([type]) => type)).toContain("visibilitychange");
    expect(frames.size).toBe(0);
  });
});