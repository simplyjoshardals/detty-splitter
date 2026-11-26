import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPrerender } from "@/lib/receipt/prerender";
import type { PrerenderSnapshot, RenderModule } from "@/lib/receipt/prerender";
import type { RenderResult } from "@/lib/receipt/render";
import type { ReceiptView } from "@/lib/receipt/view";

type RenderSuccess = Extract<RenderResult, { ok: true }>;
type RenderFailure = Extract<RenderResult, { ok: false }>;

/** A minimal view; only `perPersonTotal` varies between tests. */
const BASE_VIEW = {
  title: "Detty December 2026",
  lines: [],
  groupSize: 4,
  perPersonTotal: "₦1",
  groupTotal: "₦4",
  currency: "NGN",
  ratesNote: "Custom rates",
  badge: "SOFT LIFE",
  tagline: "tagline",
  balanceLine: "AVAIL BAL: ₦0",
  authCode: "0000ABCD",
  siteUrl: "example.com",
} as ReceiptView;

function viewWith(perPersonTotal: string): ReceiptView {
  return { ...BASE_VIEW, perPersonTotal };
}

/** Stand-in for a successful render; the controller only passes the result through. */
function okResult(label: string): RenderSuccess {
  return { ok: true as const, blob: new Blob([label]) } as RenderSuccess;
}

/** Stand-in for a failed render; `fonts` is required by the real type. */
function failResult(reason: RenderFailure["reason"]): RenderFailure {
  return { ok: false as const, reason, message: `${reason} failed`, fonts: [] };
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets pending promise callbacks run (fake timers do not flush microtasks). */
async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

function setup(renderImpl?: (view: ReceiptView) => Promise<RenderResult>) {
  const renderReceipt = vi.fn<(view: ReceiptView) => Promise<RenderResult>>(
    renderImpl ?? (async (view) => okResult(view.perPersonTotal)),
  );
  const load = vi.fn<() => Promise<RenderModule>>(async () => ({ renderReceipt }));
  const controller = createPrerender({ load, debounceMs: 500 });
  return { renderReceipt, load, controller };
}

function statusOf(snapshot: PrerenderSnapshot): string {
  return snapshot.status;
}

describe("createPrerender", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not import or render anything before start()", async () => {
    const { controller, load, renderReceipt } = setup();
    controller.update(viewWith("a"));
    await vi.advanceTimersByTimeAsync(5000);
    expect(load).not.toHaveBeenCalled();
    expect(renderReceipt).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toEqual({ status: "idle" });
  });

  it("renders the first view right after the import, with no debounce", async () => {
    const { controller, load, renderReceipt } = setup();
    controller.update(viewWith("a"));
    controller.start();
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(renderReceipt).toHaveBeenCalledTimes(1);
    expect(renderReceipt).toHaveBeenCalledWith(viewWith("a"));
    const snapshot = controller.getSnapshot();
    expect(snapshot.status).toBe("ready");
    if (snapshot.status === "ready") expect(snapshot.blob).toBeInstanceOf(Blob);
  });

  it("renders a view that arrives after the import finished", async () => {
    const { controller, renderReceipt } = setup();
    controller.start();
    await flush();
    expect(renderReceipt).not.toHaveBeenCalled(); // nothing to draw yet
    controller.update(viewWith("a"));
    await flush();
    expect(renderReceipt).toHaveBeenCalledTimes(1);
    expect(statusOf(controller.getSnapshot())).toBe("ready");
  });

  it("calls load once however often start() is called", async () => {
    const { controller, load } = setup();
    controller.start();
    controller.start();
    await flush();
    controller.start();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("waits 500 ms after the last edit and renders only the latest view", async () => {
    const { controller, renderReceipt } = setup();
    controller.update(viewWith("a"));
    controller.start();
    await flush();
    renderReceipt.mockClear();

    controller.update(viewWith("b"));
    await vi.advanceTimersByTimeAsync(300);
    controller.update(viewWith("c"));
    await vi.advanceTimersByTimeAsync(499);
    expect(renderReceipt).not.toHaveBeenCalled();
    expect(statusOf(controller.getSnapshot())).toBe("waiting");

    await vi.advanceTimersByTimeAsync(1);
    expect(renderReceipt).toHaveBeenCalledTimes(1);
    expect(renderReceipt).toHaveBeenCalledWith(viewWith("c"));
    expect(statusOf(controller.getSnapshot())).toBe("ready");
  });

  it("skips a view equal to the current one", async () => {
    const { controller, renderReceipt } = setup();
    controller.update(viewWith("a"));
    controller.start();
    await flush();
    const before = controller.getSnapshot();
    renderReceipt.mockClear();

    controller.update(viewWith("a")); // a new object with the same content
    await vi.advanceTimersByTimeAsync(2000);
    expect(renderReceipt).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toBe(before); // still ready, blob kept
  });

  it("clears the blob as soon as the view changes", async () => {
    const { controller } = setup();
    controller.update(viewWith("a"));
    controller.start();
    await flush();
    expect(statusOf(controller.getSnapshot())).toBe("ready");

    controller.update(viewWith("b"));
    const snapshot = controller.getSnapshot();
    expect(snapshot).toEqual({ status: "waiting" });
    expect("blob" in snapshot).toBe(false);
  });

  it("drops a late result for an older view", async () => {
    const slow = deferred<RenderResult>();
    const calls: string[] = [];
    const { controller, renderReceipt } = setup((view) => {
      calls.push(view.perPersonTotal);
      return view.perPersonTotal === "a" ? slow.promise : Promise.resolve(okResult(view.perPersonTotal));
    });
    controller.update(viewWith("a"));
    controller.start();
    await flush();
    expect(statusOf(controller.getSnapshot())).toBe("rendering");

    controller.update(viewWith("b")); // edit while "a" is still drawing
    slow.resolve(okResult("a")); // the old result arrives late
    await flush();
    expect(statusOf(controller.getSnapshot())).toBe("waiting"); // not ready with the old blob

    await vi.advanceTimersByTimeAsync(500);
    expect(calls).toEqual(["a", "b"]);
    expect(renderReceipt).toHaveBeenCalledTimes(2);
    const snapshot = controller.getSnapshot();
    expect(snapshot.status).toBe("ready");
    if (snapshot.status === "ready") expect(snapshot.blob.size).toBe(1); // "b", not "a"
  });

  it("reports a render failure with its reason and never throws", async () => {
    const { controller } = setup(async () => failResult("font"));
    controller.update(viewWith("a"));
    controller.start();
    await flush();
    expect(controller.getSnapshot()).toEqual({ status: "failed", reason: "font" });
  });

  it("turns a throwing renderer into an unknown failure", async () => {
    const { controller } = setup(async () => {
      throw new Error("boom");
    });
    controller.update(viewWith("a"));
    controller.start();
    await flush();
    expect(controller.getSnapshot()).toEqual({ status: "failed", reason: "unknown" });
  });

  it("recovers from a failed render on the next edit", async () => {
    let fail = true;
    const { controller } = setup(async (view) =>
      fail ? failResult("draw") : okResult(view.perPersonTotal),
    );
    controller.update(viewWith("a"));
    controller.start();
    await flush();
    expect(statusOf(controller.getSnapshot())).toBe("failed");

    fail = false;
    controller.update(viewWith("b"));
    await vi.advanceTimersByTimeAsync(500);
    expect(statusOf(controller.getSnapshot())).toBe("ready");
  });

  it("reports a failed import as load and retries on the next edit (not memoised)", async () => {
    const renderReceipt = vi.fn(async (view: ReceiptView): Promise<RenderResult> => okResult(view.perPersonTotal));
    let attempts = 0;
    const load = vi.fn(async (): Promise<RenderModule> => {
      attempts += 1;
      if (attempts === 1) throw new Error("chunk failed");
      return { renderReceipt };
    });
    const controller = createPrerender({ load, debounceMs: 500 });

    controller.update(viewWith("a"));
    controller.start();
    await flush();
    expect(controller.getSnapshot()).toEqual({ status: "failed", reason: "load" });
    expect(renderReceipt).not.toHaveBeenCalled();

    controller.update(viewWith("b")); // an edit tries the import again
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(renderReceipt).toHaveBeenCalledWith(viewWith("b"));
    expect(statusOf(controller.getSnapshot())).toBe("ready");
  });

  it("retries a failed import when start() is called again", async () => {
    let attempts = 0;
    const renderReceipt = vi.fn(async (): Promise<RenderResult> => okResult("x"));
    const load = vi.fn(async (): Promise<RenderModule> => {
      attempts += 1;
      if (attempts === 1) throw new Error("offline");
      return { renderReceipt };
    });
    const controller = createPrerender({ load });
    controller.update(viewWith("a"));
    controller.start();
    await flush();
    expect(statusOf(controller.getSnapshot())).toBe("failed");
    controller.start();
    await flush();
    expect(statusOf(controller.getSnapshot())).toBe("ready");
  });

  it("renders the latest view once a slow import finishes", async () => {
    const gate = deferred<RenderModule>();
    const renderReceipt = vi.fn(async (view: ReceiptView): Promise<RenderResult> => okResult(view.perPersonTotal));
    const load = vi.fn(() => gate.promise);
    const controller = createPrerender({ load });
    controller.update(viewWith("a"));
    controller.start();
    controller.update(viewWith("b")); // edit while the chunk is still downloading
    expect(controller.getSnapshot()).toEqual({ status: "waiting" });
    gate.resolve({ renderReceipt });
    await flush();
    expect(renderReceipt).toHaveBeenCalledTimes(1);
    expect(renderReceipt).toHaveBeenCalledWith(viewWith("b"));
  });

  it("notifies subscribers on change, stops after unsubscribe, and keeps the snapshot stable otherwise", async () => {
    const { controller } = setup();
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    const first = controller.getSnapshot();
    expect(controller.getSnapshot()).toBe(first);

    controller.update(viewWith("a"));
    controller.start();
    await flush();
    expect(listener).toHaveBeenCalled();
    const calls = listener.mock.calls.length;
    const ready = controller.getSnapshot();
    expect(controller.getSnapshot()).toBe(ready);

    unsubscribe();
    controller.update(viewWith("b"));
    expect(listener.mock.calls.length).toBe(calls);
  });

  describe("retry (T9.2)", () => {
    it("draws a failed view again at once, with no debounce, and can be repeated", async () => {
      let failures = 2;
      const { controller, renderReceipt } = setup(async (view) =>
        failures-- > 0 ? failResult("draw") : okResult(view.perPersonTotal),
      );
      controller.update(viewWith("a"));
      controller.start();
      await flush();
      expect(controller.getSnapshot()).toEqual({ status: "failed", reason: "draw" });

      controller.retry();
      expect(statusOf(controller.getSnapshot())).toBe("rendering"); // no wait, not even a tick
      await flush(); // advances no time, so there was no 500 ms debounce
      expect(renderReceipt).toHaveBeenCalledTimes(2);
      expect(controller.getSnapshot()).toEqual({ status: "failed", reason: "draw" }); // failed again

      controller.retry();
      await flush();
      expect(renderReceipt).toHaveBeenCalledTimes(3);
      expect(renderReceipt).toHaveBeenLastCalledWith(viewWith("a"));
      const snapshot = controller.getSnapshot();
      expect(snapshot.status).toBe("ready");
      if (snapshot.status === "ready") expect(snapshot.blob).toBeInstanceOf(Blob);
    });

    it("imports the renderer again after a failed import, then draws the view", async () => {
      const renderReceipt = vi.fn(async (view: ReceiptView): Promise<RenderResult> => okResult(view.perPersonTotal));
      let attempts = 0;
      const load = vi.fn(async (): Promise<RenderModule> => {
        attempts += 1;
        if (attempts === 1) throw new Error("offline");
        return { renderReceipt };
      });
      const controller = createPrerender({ load });
      controller.update(viewWith("a"));
      controller.start();
      await flush();
      expect(controller.getSnapshot()).toEqual({ status: "failed", reason: "load" });

      controller.retry();
      expect(controller.getSnapshot()).toEqual({ status: "waiting" }); // importing, nothing to show yet
      await flush();
      expect(load).toHaveBeenCalledTimes(2);
      expect(renderReceipt).toHaveBeenCalledTimes(1);
      expect(renderReceipt).toHaveBeenCalledWith(viewWith("a"));
      expect(statusOf(controller.getSnapshot())).toBe("ready");
    });

    it("reports load again when the import fails a second time, and can be retried again", async () => {
      const load = vi.fn(async (): Promise<RenderModule> => {
        throw new Error("still offline");
      });
      const controller = createPrerender({ load });
      const seen: string[] = [];
      controller.subscribe(() => seen.push(statusOf(controller.getSnapshot())));
      controller.update(viewWith("a"));
      controller.start();
      await flush();
      seen.length = 0;

      controller.retry();
      await flush();
      expect(load).toHaveBeenCalledTimes(2);
      expect(seen).toEqual(["waiting", "failed"]); // the UI sees the retry happen
      expect(controller.getSnapshot()).toEqual({ status: "failed", reason: "load" });

      controller.retry();
      await flush();
      expect(load).toHaveBeenCalledTimes(3);
    });

    it("does nothing unless the snapshot is failed", async () => {
      const slow = deferred<RenderResult>();
      const { controller, load, renderReceipt } = setup((view) =>
        view.perPersonTotal === "slow" ? slow.promise : Promise.resolve(okResult(view.perPersonTotal)),
      );

      controller.retry(); // idle, before anything started
      expect(controller.getSnapshot()).toEqual({ status: "idle" });
      expect(load).not.toHaveBeenCalled();

      controller.update(viewWith("a"));
      controller.start();
      await flush();
      const ready = controller.getSnapshot();
      controller.retry(); // ready: the blob stays
      expect(controller.getSnapshot()).toBe(ready);
      expect(renderReceipt).toHaveBeenCalledTimes(1);

      controller.update(viewWith("slow"));
      await vi.advanceTimersByTimeAsync(500);
      expect(statusOf(controller.getSnapshot())).toBe("rendering");
      controller.retry(); // rendering: no second render
      expect(renderReceipt).toHaveBeenCalledTimes(2);

      slow.resolve(okResult("slow"));
      await flush();
      controller.update(viewWith("b"));
      controller.retry(); // waiting on the debounce: the timer is not skipped
      expect(statusOf(controller.getSnapshot())).toBe("waiting");
      expect(renderReceipt).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(500);
      expect(renderReceipt).toHaveBeenCalledTimes(3);
    });

    it("drops the late result of a retried render when the view changes meanwhile", async () => {
      const slow = deferred<RenderResult>();
      let call = 0;
      const { controller, renderReceipt } = setup((view) => {
        call += 1;
        if (call === 1) return Promise.resolve(failResult("font"));
        if (call === 2) return slow.promise; // the retry, still drawing "a"
        return Promise.resolve(okResult(view.perPersonTotal));
      });
      controller.update(viewWith("a"));
      controller.start();
      await flush();
      expect(statusOf(controller.getSnapshot())).toBe("failed");

      controller.retry();
      expect(statusOf(controller.getSnapshot())).toBe("rendering");
      controller.update(viewWith("b")); // edit while the retry is still drawing
      slow.resolve(okResult("a")); // the old result arrives late
      await flush();
      expect(statusOf(controller.getSnapshot())).toBe("waiting"); // not ready with the old blob

      await vi.advanceTimersByTimeAsync(500);
      expect(renderReceipt).toHaveBeenCalledTimes(3);
      const snapshot = controller.getSnapshot();
      expect(snapshot.status).toBe("ready");
      if (snapshot.status === "ready") expect(snapshot.blob.size).toBe(1); // "b", not "a"
    });
  });
});