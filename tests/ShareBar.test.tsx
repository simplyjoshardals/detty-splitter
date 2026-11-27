// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareBar } from "@/components/ShareBar";
import type { AnalyticsEvent } from "@/lib/analytics";
import { decodeShare } from "@/lib/share";
import { buildShareUrl } from "@/lib/share/link";
import { createInitialState } from "@/state/reducer";
import { AppStateProvider, useAppState } from "@/state/AppStateProvider";

/** Stands in for the adapter, so a test sees what would be sent. */
const analytics = vi.hoisted(() => ({ track: vi.fn<(event: AnalyticsEvent) => void>() }));
vi.mock("@/lib/analytics", () => ({ track: analytics.track }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const COPIED = "Link copied. Drop it in the group chat.";
const BLOCKED = "Copy blocked. Press and hold the link below to copy.";

/** One edit, so a test can change the numbers after the link was copied or refused. */
function Edit() {
  const { dispatch } = useAppState();
  return (
    <button type="button" onClick={() => dispatch({ type: "setGroupSize", value: 7 })}>
      Make it seven
    </button>
  );
}

const mount = () =>
  render(
    <AppStateProvider>
      <ShareBar />
      <Edit />
    </AppStateProvider>,
  );

/** A clipboard that works and records what it was given. */
function workingClipboard() {
  const written: string[] = [];
  const writeText = vi.fn((text: string) => {
    written.push(text);
    return Promise.resolve();
  });
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  return { written, writeText };
}

const tapCopy = () =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  });

function linkField(): HTMLInputElement {
  const field = screen.getByRole("textbox", { name: "Share link" });
  if (!(field instanceof HTMLInputElement)) throw new Error("expected an <input>");
  return field;
}

const statusText = () => screen.getByRole("status").textContent;

describe("ShareBar: before any tap", () => {
  it("has a Copy link button, an empty status region and no link field", () => {
    mount();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
    expect(statusText()).toBe("");
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("ShareBar: copied", () => {
  it("writes the full link for the current numbers and says so", async () => {
    const { written, writeText } = workingClipboard();
    mount();
    await tapCopy();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(written[0]).toBe(buildShareUrl(createInitialState(), window.location));
    expect(statusText()).toBe(COPIED);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("copies the numbers as they are now, not as they were on load", async () => {
    const { written } = workingClipboard();
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Make it seven" }));
    await tapCopy();
    const result = decodeShare(new URL(written[0] ?? "").hash);
    expect(result.ok && result.state.groupSize).toBe(7);
  });

  it("clears the message after 2 seconds", async () => {
    vi.useFakeTimers();
    workingClipboard();
    mount();
    await tapCopy();
    act(() => void vi.advanceTimersByTime(1999));
    expect(statusText()).toBe(COPIED);
    act(() => void vi.advanceTimersByTime(1));
    expect(statusText()).toBe("");
  });

  it("a second tap restarts the 2 seconds", async () => {
    vi.useFakeTimers();
    workingClipboard();
    mount();
    await tapCopy();
    act(() => void vi.advanceTimersByTime(1500));
    await tapCopy();
    act(() => void vi.advanceTimersByTime(1500));
    expect(statusText()).toBe(COPIED);
    act(() => void vi.advanceTimersByTime(500));
    expect(statusText()).toBe("");
  });
});

describe("ShareBar: copy denied", () => {
  it("with no clipboard API: says so and shows the link, read-only, focused and selected", async () => {
    vi.stubGlobal("navigator", {});
    mount();
    await tapCopy();
    expect(statusText()).toBe(BLOCKED);
    const field = linkField();
    expect(field.readOnly).toBe(true);
    expect(field.value).toBe(buildShareUrl(createInitialState(), window.location));
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, field.value.length]);
  });

  it("when the browser refuses the write: the same fallback", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: () => Promise.reject(new Error("NotAllowedError")) },
    });
    mount();
    await tapCopy();
    expect(statusText()).toBe(BLOCKED);
    expect(linkField().value).toContain("#v1");
  });

  it("keeps the field's link in step with edits made after the refusal", async () => {
    vi.stubGlobal("navigator", {});
    mount();
    await tapCopy();
    const before = linkField().value;
    fireEvent.click(screen.getByRole("button", { name: "Make it seven" }));
    const after = linkField().value;
    expect(after).not.toBe(before);
    const result = decodeShare(new URL(after).hash);
    expect(result.ok && result.state.groupSize).toBe(7);
  });

  it("does not time out: the field stays until a copy works", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", {});
    mount();
    await tapCopy();
    act(() => void vi.advanceTimersByTime(60_000));
    expect(statusText()).toBe(BLOCKED);
    expect(linkField()).toBeTruthy();
  });

  it("a later tap that works replaces the fallback with the copied message", async () => {
    vi.stubGlobal("navigator", {});
    mount();
    await tapCopy();
    workingClipboard();
    await tapCopy();
    expect(statusText()).toBe(COPIED);
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("ShareBar: analytics", () => {
  beforeEach(() => analytics.track.mockClear());

  it("sends link_copy once, with no properties, after the link was copied", async () => {
    workingClipboard();
    mount();
    await tapCopy();
    expect(analytics.track).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith({ name: "link_copy" });
  });

  it("never sends the link or the numbers", async () => {
    const { written } = workingClipboard();
    mount();
    await tapCopy();
    const sent = JSON.stringify(analytics.track.mock.calls);
    expect(sent).not.toContain("#");
    expect(sent).not.toContain(written[0] ?? "no link was written");
  });

  it("sends nothing when the browser refuses the copy", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: () => Promise.reject(new Error("NotAllowedError")) },
    });
    mount();
    await tapCopy();
    expect(statusText()).toBe(BLOCKED);
    expect(analytics.track).not.toHaveBeenCalled();
  });
});
