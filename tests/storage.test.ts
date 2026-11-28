import { afterEach, describe, expect, it, vi } from "vitest";
import { SNAPSHOT_KEY, readSnapshot, writeSnapshot } from "@/lib/storage";

interface FakeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function fakeStorage(
  overrides: Partial<FakeStorage> = {},
): FakeStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    ...overrides,
  };
}

/** Storage where merely reading `localStorage.anything` throws, as in some blocked browsers. */
const blocked = () =>
  new Proxy(
    {},
    {
      get: () => {
        throw new Error("blocked");
      },
    },
  );

afterEach(() => vi.unstubAllGlobals());

describe("readSnapshot", () => {
  it("uses the DATA_MODEL §5 key", () => {
    expect(SNAPSHOT_KEY).toBe("detty26:v1:last");
  });

  it("returns null when nothing is saved", () => {
    vi.stubGlobal("localStorage", fakeStorage());
    expect(readSnapshot()).toEqual({ ok: true, value: null });
  });

  it("returns what is saved, untouched", () => {
    const storage = fakeStorage();
    storage.data.set(SNAPSHOT_KEY, "#v1-anything");
    vi.stubGlobal("localStorage", storage);
    expect(readSnapshot()).toEqual({ ok: true, value: "#v1-anything" });
  });

  it("reports unavailable instead of throwing when storage is blocked", () => {
    vi.stubGlobal("localStorage", blocked());
    expect(readSnapshot()).toEqual({ ok: false });
  });

  it("reports unavailable when getItem throws", () => {
    vi.stubGlobal(
      "localStorage",
      fakeStorage({
        getItem: () => {
          throw new Error("SecurityError");
        },
      }),
    );
    expect(readSnapshot()).toEqual({ ok: false });
  });

  it("reports unavailable when there is no localStorage at all", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(readSnapshot()).toEqual({ ok: false });
  });
});

describe("writeSnapshot", () => {
  it("writes under the key and reports success", () => {
    const storage = fakeStorage();
    vi.stubGlobal("localStorage", storage);
    expect(writeSnapshot("#v1-x")).toEqual({ ok: true });
    expect(storage.data.get(SNAPSHOT_KEY)).toBe("#v1-x");
  });

  it("reports failure instead of throwing when the storage is full", () => {
    vi.stubGlobal(
      "localStorage",
      fakeStorage({
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      }),
    );
    expect(writeSnapshot("#v1-x")).toEqual({ ok: false });
  });

  it("reports failure instead of throwing when storage is blocked or missing", () => {
    vi.stubGlobal("localStorage", blocked());
    expect(writeSnapshot("#v1-x")).toEqual({ ok: false });
    vi.stubGlobal("localStorage", undefined);
    expect(writeSnapshot("#v1-x")).toEqual({ ok: false });
  });
});
