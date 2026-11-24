import { afterEach } from "vitest";

/**
 * Since T8.2 the provider reads the URL hash and `localStorage` on mount and saves edits to it.
 * A jsdom page lives for a whole test file, so without this one test's saved calculation or
 * link would be loaded by the next test. Plain Node tests have no `window` and skip it.
 */
afterEach(() => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.clear();
  } catch {
    // A test that blocked storage on purpose.
  }
  window.history.replaceState(null, "", window.location.pathname);
});
