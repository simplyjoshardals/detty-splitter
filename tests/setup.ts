import { afterEach, vi } from "vitest";

/**
 * The unit tests run on fixed preset prices and default rates (the original placeholders, which
 * equal the DATA_MODEL golden example), so retuning data/presets.ts or config/ after price
 * research never breaks a UI or reducer test. tests/data.test.ts and tests/rates.test.ts read the
 * real values with vi.importActual and check them.
 */
vi.mock("@/data/presets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/presets")>();
  const row = (unitPriceNgn: number, quantity: number, mode: "shared" | "perPerson") => ({
    unitPriceNgn,
    quantity,
    mode,
    headcount: 4,
  });
  return {
    ...actual,
    PRESETS: {
      budget: {
        ...actual.PRESETS.budget,
        buckets: [
          row(40000, 7, "shared"),
          row(25000, 2, "perPerson"),
          row(150000, 1, "shared"),
          row(30000, 7, "shared"),
          row(10000, 7, "perPerson"),
        ],
      },
      soft: {
        ...actual.PRESETS.soft,
        buckets: [
          row(150000, 7, "shared"),
          row(100000, 3, "perPerson"),
          row(800000, 2, "shared"),
          row(60000, 7, "shared"),
          row(40000, 7, "perPerson"),
        ],
      },
      baller: {
        ...actual.PRESETS.baller,
        buckets: [
          row(500000, 7, "shared"),
          row(300000, 4, "perPerson"),
          row(3000000, 3, "shared"),
          row(250000, 7, "shared"),
          row(150000, 7, "perPerson"),
        ],
      },
    },
  };
});

vi.mock("@/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config")>();
  return {
    ...actual,
    DEFAULT_RATES: { ngnPerUsd: 1500, ngnPerGbp: 2000 },
    RATES_AS_OF: "2026-11-23",
  };
});

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
