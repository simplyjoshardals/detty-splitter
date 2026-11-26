/**
 * Background pre-render of the receipt PNG (T7.3, ARCHITECTURE §2.5).
 *
 * Plain TypeScript, no React. It owns three things: the lazy import of the
 * canvas renderer, a debounce after the last edit, and the latest PNG blob.
 *
 * Rules:
 * - `load` is the ONLY reference to the renderer, and it is a dynamic
 *   `import()`, so the renderer stays a separate chunk. The renderer types
 *   below are `import type` and are erased at build time.
 * - Nothing is imported or rendered before `start()`.
 * - The first render runs right after the import, with no debounce. Later
 *   edits wait `debounceMs` after the last one.
 * - A view equal to the current one is skipped.
 * - The blob is cleared the moment the view changes, so a stale PNG is never
 *   served. A late result for an older view is dropped.
 * - Nothing here throws: failures are values in the snapshot.
 * - `retry()` (T9.2) runs a failed view again at once, with no debounce, and does nothing in any
 *   other state. Without it a failed draw is stuck: `start()` skips the loaded renderer and
 *   `update()` skips an unchanged view. A retried render also asks the renderer to bring failed
 *   fonts back (`reloadFonts`): the browser never retries a font on its own, so without that a
 *   font failure would fail again at once, even with the network back. Ordinary renders are
 *   called with the view alone.
 */
import type { RenderOptions, RenderResult } from "./render";
import type { ReceiptView } from "./view";

type RenderSuccess = Extract<RenderResult, { ok: true }>;
type RenderFailure = Extract<RenderResult, { ok: false }>;

/** A render failure reason, or `"load"` when the renderer chunk failed to import. */
export type PrerenderFailureReason = RenderFailure["reason"] | "load";

export type PrerenderSnapshot =
  | { status: "idle" }
  | { status: "waiting" }
  | { status: "rendering" }
  | ({ status: "ready" } & Omit<RenderSuccess, "ok">)
  | { status: "failed"; reason: PrerenderFailureReason };

export interface RenderModule {
  renderReceipt: (view: ReceiptView, options?: RenderOptions) => Promise<RenderResult>;
}

export interface PrerenderOptions {
  /** Imports the renderer. Defaults to a dynamic `import("./render")`. */
  load?: () => Promise<RenderModule>;
  /** Quiet time after the last edit before a render starts. Default 500. */
  debounceMs?: number;
}

export interface Prerender {
  /** Begin loading the renderer (call when the receipt nears the viewport). Safe to call again. */
  start: () => void;
  /** Tell the controller the receipt now looks like `view`. */
  update: (view: ReceiptView) => void;
  /**
   * Try the current view again after a failure (T9.2). If the renderer never imported it is
   * imported again, otherwise the view is drawn again at once, with the failed fonts brought
   * back first. Does nothing unless the snapshot is `failed`, so a stray tap cannot start a
   * second render.
   */
  retry: () => void;
  getSnapshot: () => PrerenderSnapshot;
  subscribe: (listener: () => void) => () => void;
}

const IDLE: PrerenderSnapshot = { status: "idle" };

export function createPrerender(options: PrerenderOptions = {}): Prerender {
  const load = options.load ?? (() => import("./render"));
  const debounceMs = options.debounceMs ?? 500;

  const listeners = new Set<() => void>();
  let snapshot: PrerenderSnapshot = IDLE;

  let started = false;
  let loading = false;
  let renderer: RenderModule | null = null;
  /** True once any render has started; only the very first render skips the debounce. */
  let renderStarted = false;
  /** Set by `retry()`; the next render asks the renderer to bring failed fonts back. */
  let reloadFonts = false;

  let currentView: ReceiptView | null = null;
  let currentKey: string | null = null;
  /** Bumped on every view change; a render only publishes if it is still current. */
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function publish(next: PrerenderSnapshot): void {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function render(view: ReceiptView, forGeneration: number): Promise<void> {
    if (renderer === null || forGeneration !== generation) return;
    renderStarted = true;
    const retrying = reloadFonts;
    reloadFonts = false;
    publish({ status: "rendering" });
    let result: RenderResult | null = null;
    try {
      result = await (retrying
        ? renderer.renderReceipt(view, { reloadFonts: true })
        : renderer.renderReceipt(view));
    } catch {
      result = null; // renderReceipt never throws by contract; belt and braces
    }
    if (forGeneration !== generation) return; // the view changed meanwhile: drop it
    if (result === null) {
      publish({ status: "failed", reason: "unknown" });
    } else if (result.ok) {
      publish({ ...result, status: "ready" });
    } else {
      publish({ status: "failed", reason: result.reason });
    }
  }

  function schedule(delay: number): void {
    clearTimer();
    const view = currentView;
    if (view === null) return;
    const forGeneration = generation;
    if (delay <= 0) {
      void render(view, forGeneration);
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      void render(view, forGeneration);
    }, delay);
  }

  function ensureLoaded(): void {
    if (renderer !== null || loading) return;
    loading = true;
    load().then(
      (module) => {
        loading = false;
        renderer = module;
        // First render goes right after the import, no debounce. If an edit
        // is already waiting on its own timer, leave that timer alone.
        if (currentView !== null && timer === null) schedule(0);
      },
      () => {
        // Not memoised: `renderer` stays null, so a later start() or edit retries.
        loading = false;
        if (currentView !== null) publish({ status: "failed", reason: "load" });
      },
    );
  }

  return {
    start() {
      if (started && (renderer !== null || loading)) return;
      started = true;
      if (currentView !== null && snapshot.status === "idle") publish({ status: "waiting" });
      ensureLoaded();
    },

    update(view) {
      const key = JSON.stringify(view);
      if (key === currentKey) return;
      currentKey = key;
      currentView = view;
      generation += 1;
      clearTimer();
      if (!started) return; // stays idle (there is no blob yet); start() will pick the view up
      publish({ status: "waiting" }); // clears any blob straight away
      if (renderer === null) {
        ensureLoaded(); // still importing, or the last import failed: try (again)
        return;
      }
      schedule(renderStarted ? debounceMs : 0);
    },

    retry() {
      if (snapshot.status !== "failed" || currentView === null) return;
      clearTimer();
      if (renderer === null) {
        // The import failed. Ask for it again; the first render follows it with no debounce.
        publish({ status: "waiting" });
        ensureLoaded();
        return;
      }
      reloadFonts = true; // a font that failed stays failed in the browser until it is re-created
      schedule(0); // starts at once and publishes "rendering" straight away
    },

    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The app-wide instance. The wiring component (Stage 4) and the export handler (T9.1) share it. */
export const prerender: Prerender = createPrerender();