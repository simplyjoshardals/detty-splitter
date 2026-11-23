// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SETTLE_MS, useSettledMessage, useTargetInView } from "@/components/meterHooks";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
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

  constructor(private readonly callback: IntersectionObserverCallback) {
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
