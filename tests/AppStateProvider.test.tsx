// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeShare, encodeShare } from "@/lib/share";
import { SNAPSHOT_KEY } from "@/lib/storage";
import { AppStateProvider, useAppState } from "@/state/AppStateProvider";
import { SAVE_DELAY_MS } from "@/state/useLocalSave";
import { GOLDEN, MAX_VALUES } from "./fixtures";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Shows what the provider holds, and the two controls the tests press. */
function Probe() {
  const { state, hydrated, linkNotice, dispatch, dismissLinkNotice } = useAppState();
  return (
    <div>
      <output aria-label="Group size">{state.groupSize}</output>
      <output aria-label="Hydrated">{String(hydrated)}</output>
      <output aria-label="Link notice">{String(linkNotice)}</output>
      <button type="button" onClick={() => dispatch({ type: "setGroupSize", value: 7 })}>
        Make it seven
      </button>
      <button type="button" onClick={() => dispatch({ type: "setGroupSize", value: 8 })}>
        Make it eight
      </button>
      <button type="button" onClick={dismissLinkNotice}>
        Dismiss
      </button>
    </div>
  );
}

const mount = () =>
  render(
    <AppStateProvider>
      <Probe />
    </AppStateProvider>,
  );

const read = (name: string) => screen.getByRole("status", { name }).textContent;
const setHash = (hash: string) => window.history.replaceState(null, "", `/${hash}`);
const saved = () => window.localStorage.getItem(SNAPSHOT_KEY);
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const press = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

const NINE = encodeShare({ ...GOLDEN, groupSize: 9 });

describe("loading", () => {
  it("shows the default scenario when there is no link and no snapshot", () => {
    mount();
    expect(read("Group size")).toBe("4");
    expect(read("Hydrated")).toBe("true");
    expect(read("Link notice")).toBe("false");
  });

  it("a link in the URL reproduces its numbers", () => {
    setHash(NINE);
    mount();
    expect(read("Group size")).toBe("9");
    expect(read("Link notice")).toBe("false");
  });

  it("a link wins over a saved snapshot", () => {
    window.localStorage.setItem(SNAPSHOT_KEY, encodeShare({ ...GOLDEN, groupSize: 20 }));
    setHash(NINE);
    mount();
    expect(read("Group size")).toBe("9");
  });

  it("with no link, the saved snapshot is resumed", () => {
    window.localStorage.setItem(SNAPSHOT_KEY, encodeShare({ ...GOLDEN, groupSize: 20 }));
    mount();
    expect(read("Group size")).toBe("20");
    expect(read("Link notice")).toBe("false");
  });

  it("a corrupt snapshot is ignored without a notice", () => {
    window.localStorage.setItem(SNAPSHOT_KEY, "garbage");
    mount();
    expect(read("Group size")).toBe("4");
    expect(read("Link notice")).toBe("false");
  });

  it("a bad link shows the default and the notice, which can be dismissed", () => {
    window.localStorage.setItem(SNAPSHOT_KEY, encodeShare({ ...GOLDEN, groupSize: 20 }));
    setHash("#v1-<script>alert(1)</script>");
    mount();
    expect(read("Group size")).toBe("4");
    expect(read("Link notice")).toBe("true");
    press("Dismiss");
    expect(read("Link notice")).toBe("false");
  });

  it("works from the link alone when localStorage is blocked", () => {
    vi.stubGlobal(
      "localStorage",
      new Proxy({}, { get: () => { throw new Error("blocked"); } }),
    );
    setHash(NINE);
    mount();
    expect(read("Group size")).toBe("9");
    press("Make it seven");
    expect(read("Group size")).toBe("7");
  });
});

describe("saving", () => {
  it("writes nothing until the user changes something", () => {
    vi.useFakeTimers();
    mount();
    advance(SAVE_DELAY_MS * 10);
    expect(saved()).toBeNull();
  });

  it("opening a bad link never overwrites a good snapshot", () => {
    vi.useFakeTimers();
    const snapshot = encodeShare({ ...GOLDEN, groupSize: 20 });
    window.localStorage.setItem(SNAPSHOT_KEY, snapshot);
    setHash("#v1");
    mount();
    advance(SAVE_DELAY_MS * 10);
    expect(saved()).toBe(snapshot);
  });

  it("an edit is written once it has been quiet for the delay", () => {
    vi.useFakeTimers();
    mount();
    press("Make it seven");
    advance(SAVE_DELAY_MS - 1);
    expect(saved()).toBeNull();
    advance(1);
    const result = decodeShare(saved() ?? "");
    expect(result.ok && result.state.groupSize).toBe(7);
  });

  it("a burst of edits is written once, with the last value, after the last edit", () => {
    vi.useFakeTimers();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    mount();
    press("Make it seven");
    advance(SAVE_DELAY_MS / 2);
    press("Make it eight");
    advance(SAVE_DELAY_MS - 1);
    expect(setItem).not.toHaveBeenCalled();
    advance(1);
    expect(setItem).toHaveBeenCalledTimes(1);
    const result = decodeShare(saved() ?? "");
    expect(result.ok && result.state.groupSize).toBe(8);
  });

  it("a pending edit is flushed when the page is hidden", () => {
    vi.useFakeTimers();
    mount();
    press("Make it seven");
    expect(saved()).toBeNull();
    window.dispatchEvent(new Event("pagehide"));
    expect(saved()).not.toBeNull();
  });

  it("a pending edit is flushed when the provider unmounts", () => {
    vi.useFakeTimers();
    const { unmount } = mount();
    press("Make it seven");
    unmount();
    expect(saved()).not.toBeNull();
  });

  it("a full or blocked store never breaks editing", () => {
    vi.useFakeTimers();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    mount();
    press("Make it seven");
    expect(() => advance(SAVE_DELAY_MS)).not.toThrow();
    expect(read("Group size")).toBe("7");
  });

  it("a worst-case snapshot resumes exactly", () => {
    window.localStorage.setItem(SNAPSHOT_KEY, encodeShare(MAX_VALUES));
    mount();
    expect(read("Group size")).toBe("100");
  });
});
