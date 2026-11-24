// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  IDLE_START_DELAY_MS,
  PRERENDER_ROOT_MARGIN,
  ReceiptPrerender,
} from "@/components/ReceiptPrerender";
import { buildReceiptView } from "@/lib/receipt/view";
import { AppStateProvider, useAppState } from "@/state/AppStateProvider";
import { createInitialState } from "@/state/reducer";

// The controller is mocked: this file tests the wiring only (the controller has its own tests).
const controller = vi.hoisted(() => ({
  start: vi.fn<() => void>(),
  update: vi.fn<(view: unknown) => void>(),
}));
vi.mock("@/lib/receipt/prerender", () => ({ prerender: controller }));

/** Stands in for the browser's IntersectionObserver, which jsdom does not have. */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observed: Element[] = [];

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

function addReceiptTarget(): HTMLElement {
  const element = document.createElement("div");
  element.id = "receipt";
  document.body.append(element);
  return element;
}

/** Lets a test change the state the way the page does. */
function GroupSizeButton({ value }: { value: number }) {
  const { dispatch } = useAppState();
  return (
    <button type="button" onClick={() => dispatch({ type: "setGroupSize", value })}>
      set group size
    </button>
  );
}

function renderWiring(extra?: React.ReactNode) {
  return render(
    <AppStateProvider>
      <ReceiptPrerender />
      {extra}
    </AppStateProvider>,
  );
}

beforeEach(() => {
  controller.start.mockClear();
  controller.update.mockClear();
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("ReceiptPrerender", () => {
  it("renders nothing", () => {
    const { container } = renderWiring();
    expect(container.innerHTML).toBe("");
  });

  it("hands the controller the view of the current state on mount", () => {
    renderWiring();
    expect(controller.update).toHaveBeenCalledTimes(1);
    expect(controller.update).toHaveBeenCalledWith(buildReceiptView(createInitialState()));
  });

  it("does not start the renderer until the receipt is near the viewport", () => {
    addReceiptTarget();
    renderWiring();
    expect(controller.start).not.toHaveBeenCalled();
    act(() => latestObserver()?.emit(false));
    expect(controller.start).not.toHaveBeenCalled();
  });

  it("watches the receipt with an 800px root margin", () => {
    const target = addReceiptTarget();
    renderWiring();
    expect(PRERENDER_ROOT_MARGIN).toBe("800px");
    expect(latestObserver()?.observed).toEqual([target]);
    expect(latestObserver()?.options).toEqual({ rootMargin: "800px" });
  });

  it("starts the renderer when the receipt comes near, after the first view is known", () => {
    addReceiptTarget();
    renderWiring();
    act(() => latestObserver()?.emit(true));
    expect(controller.start).toHaveBeenCalledTimes(1);
    expect(controller.update.mock.invocationCallOrder[0]).toBeLessThan(
      controller.start.mock.invocationCallOrder[0] ?? Number.NEGATIVE_INFINITY,
    );
  });

  it("leaving the viewport does not stop it, and coming back calls start again (the controller ignores repeats)", () => {
    addReceiptTarget();
    renderWiring();
    act(() => latestObserver()?.emit(true));
    act(() => latestObserver()?.emit(false));
    expect(controller.start).toHaveBeenCalledTimes(1);
    act(() => latestObserver()?.emit(true));
    expect(controller.start).toHaveBeenCalledTimes(2);
  });

  it("does not start when the receipt is not on the page", () => {
    renderWiring();
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
    expect(controller.start).not.toHaveBeenCalled();
  });

  it("hands over a new view on every state change, and none when the state does not change", async () => {
    const { findByRole } = renderWiring(<GroupSizeButton value={9} />);
    const button = await findByRole("button", { name: "set group size" });
    expect(controller.update).toHaveBeenCalledTimes(1);

    act(() => button.click());
    expect(controller.update).toHaveBeenCalledTimes(2);
    const next = { ...createInitialState(), groupSize: 9 };
    expect(controller.update).toHaveBeenLastCalledWith(buildReceiptView(next));

    act(() => button.click()); // same value: the reducer returns the same state
    expect(controller.update).toHaveBeenCalledTimes(2);
  });

  describe("without IntersectionObserver", () => {
    beforeEach(() => {
      vi.stubGlobal("IntersectionObserver", undefined);
    });

    it("starts once the idle callback fires", () => {
      let idle: (() => void) | null = null;
      vi.stubGlobal("requestIdleCallback", (callback: () => void) => {
        idle = callback;
        return 7;
      });
      vi.stubGlobal("cancelIdleCallback", vi.fn());
      renderWiring();
      expect(controller.start).not.toHaveBeenCalled();
      act(() => idle?.());
      expect(controller.start).toHaveBeenCalledTimes(1);
    });

    it("falls back to a short timeout when there is no requestIdleCallback", () => {
      vi.useFakeTimers();
      renderWiring();
      vi.advanceTimersByTime(IDLE_START_DELAY_MS - 1);
      expect(controller.start).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(controller.start).toHaveBeenCalledTimes(1);
    });

    it("cancels the pending start when unmounted", () => {
      vi.useFakeTimers();
      const { unmount } = renderWiring();
      unmount();
      vi.advanceTimersByTime(IDLE_START_DELAY_MS * 5);
      expect(controller.start).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it("does not use the idle fallback when IntersectionObserver exists", () => {
    vi.useFakeTimers();
    addReceiptTarget();
    renderWiring();
    vi.advanceTimersByTime(IDLE_START_DELAY_MS * 5);
    expect(controller.start).not.toHaveBeenCalled();
  });
});
