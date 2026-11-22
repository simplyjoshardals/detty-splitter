// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResultsPanel } from "@/components/ResultsPanel";
import { TripControls } from "@/components/TripControls";
import { AppStateProvider } from "@/state/AppStateProvider";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderPage() {
  render(
    <AppStateProvider>
      <TripControls />
      <ResultsPanel />
    </AppStateProvider>,
  );
}

function setup() {
  renderPage();
  return { user: userEvent.setup() };
}

function inputValue(element: HTMLElement): string {
  if (!(element instanceof HTMLInputElement)) throw new Error("expected an <input>");
  return element.value;
}

const priceValues = () =>
  screen.getAllByRole("textbox", { name: /^Price / }).map((el) => inputValue(el));
const splitValues = () =>
  screen.getAllByRole("textbox", { name: /^Split between / }).map((el) => inputValue(el));
const groupSizeBox = () => screen.getByRole("textbox", { name: "Group size" });
const stayPrice = () =>
  screen.getByRole("textbox", { name: "Price per night Short-lets / Accommodation" });

describe("route plates", () => {
  it("is a named group of three radios, with Soft Life Standard picked first", () => {
    setup();
    const group = screen.getByRole("group", { name: "Pick your route" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(screen.getByRole("radio", { name: /Soft Life Standard/ })).toHaveProperty("checked", true);
    expect(screen.getByRole("radio", { name: /Outside on a Budget/ })).toHaveProperty("checked", false);
  });

  it("fills all five buckets and updates the totals at once", async () => {
    const { user } = setup();
    await user.click(screen.getByText("Outside on a Budget"));
    expect(priceValues()).toEqual(["40,000", "25,000", "150,000", "30,000", "10,000"]);
    expect(screen.getByText("₦280,000")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Outside on a Budget/ })).toHaveProperty("checked", true);
    expect(screen.getByText("Route set to Outside on a Budget.")).toBeTruthy();
  });

  it("moves the selection with the arrow keys, and the totals follow", async () => {
    const { user } = setup();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: /Soft Life Standard/ }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /Full IJGB/ })).toHaveProperty("checked", true);
    expect(screen.getByText("₦5,812,500")).toBeTruthy();
  });
});

describe("group size", () => {
  it("scales the group total and leaves the per-person total and the splits alone", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Increase Group size" }));
    expect(inputValue(groupSizeBox())).toBe("5");
    expect(screen.getByText("Group total · 5 people")).toBeTruthy();
    expect(screen.getByText("₦6,737,500")).toBeTruthy();
    expect(screen.getByText("₦1,347,500")).toBeTruthy();
    expect(splitValues()).toEqual(["4", "4", "4"]);
  });
});

describe("Apply to all shared", () => {
  it("sets every shared split to the group size just typed, and says so", async () => {
    const { user } = setup();
    await user.click(groupSizeBox());
    await user.clear(groupSizeBox());
    await user.type(groupSizeBox(), "6");
    await user.click(screen.getByRole("button", { name: "Apply to all shared" }));
    expect(splitValues()).toEqual(["6", "6", "6"]);
    expect(screen.getByText("Set 3 shared items to 6 people.")).toBeTruthy();
  });

  it("says so when every shared split already matches", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Apply to all shared" }));
    expect(screen.getByText("Shared items already split 4 ways.")).toBeTruthy();
    expect(splitValues()).toEqual(["4", "4", "4"]);
  });

  it("says so when no line is shared", async () => {
    const { user } = setup();
    for (const radio of screen.getAllByRole("radio", { name: "Per person" })) {
      await user.click(radio);
    }
    await user.click(screen.getByRole("button", { name: "Apply to all shared" }));
    expect(screen.getByText("No shared items to change.")).toBeTruthy();
  });
});

describe("Reset to preset", () => {
  it("restores the preset's prices and group size", async () => {
    const { user } = setup();
    await user.click(stayPrice());
    await user.clear(stayPrice());
    await user.type(stayPrice(), "1");
    await user.tab();
    await user.click(screen.getByRole("button", { name: "Increase Group size" }));
    expect(inputValue(stayPrice())).toBe("1");

    await user.click(screen.getByRole("button", { name: "Reset to preset" }));
    expect(inputValue(stayPrice())).toBe("150,000");
    expect(inputValue(groupSizeBox())).toBe("4");
    expect(screen.getByText("Reset to Soft Life Standard.")).toBeTruthy();
  });

  it("restores the last-picked preset, not the first one", async () => {
    const { user } = setup();
    await user.click(screen.getByText("Outside on a Budget"));
    await user.click(stayPrice());
    await user.clear(stayPrice());
    await user.type(stayPrice(), "1");
    await user.tab();
    await user.click(screen.getByRole("button", { name: "Reset to preset" }));
    expect(inputValue(stayPrice())).toBe("40,000");
    expect(screen.getByText("Reset to Outside on a Budget.")).toBeTruthy();
  });
});

describe("status line", () => {
  it("clears after a few seconds", () => {
    vi.useFakeTimers();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Reset to preset" }));
    expect(screen.getByText("Reset to Soft Life Standard.")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByText("Reset to Soft Life Standard.")).toBeNull();
  });
});

describe("group size hint", () => {
  const applyButton = () => screen.getByRole("button", { name: "Apply to all shared" });
  const resetButton = () => screen.getByRole("button", { name: "Reset to preset" });

  it("lets Apply land when it is tapped straight after typing text that isn't a number", async () => {
    const { user } = setup();
    await user.click(groupSizeBox());
    await user.clear(groupSizeBox());
    await user.paste("abc");
    const apply = applyButton();
    // The click blurs the box first, which commits and raises the hint. The button must
    // be the same element afterwards, or the tap is lost.
    await user.click(apply);
    expect(applyButton()).toBe(apply);
    expect(screen.getByText("Shared items already split 4 ways.")).toBeTruthy();
    expect(inputValue(groupSizeBox())).toBe("4");
    expect(splitValues()).toEqual(["4", "4", "4"]);
  });

  it("lets Apply land straight after typing 0, using the clamped group size", async () => {
    const { user } = setup();
    await user.click(groupSizeBox());
    await user.clear(groupSizeBox());
    await user.type(groupSizeBox(), "0");
    await user.click(applyButton());
    expect(splitValues()).toEqual(["1", "1", "1"]);
    expect(screen.getByText("Set 3 shared items to 1 person.")).toBeTruthy();
  });

  it("shows the hint after both buttons, not between the stepper and them", async () => {
    const { user } = setup();
    await user.click(groupSizeBox());
    await user.clear(groupSizeBox());
    await user.type(groupSizeBox(), "0");
    await user.tab();
    const hint = screen.getByText("Min is 1, so we adjusted it.");
    const follows = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(applyButton(), hint)).toBe(true);
    expect(follows(resetButton(), hint)).toBe(true);
  });

  it("points the stepper at the hint with aria-describedby while it shows", async () => {
    const { user } = setup();
    expect(groupSizeBox().getAttribute("aria-describedby")).toBeNull();
    await user.click(groupSizeBox());
    await user.clear(groupSizeBox());
    await user.paste("abc");
    await user.tab();
    const slot = document.getElementById(groupSizeBox().getAttribute("aria-describedby") ?? "");
    expect(slot?.textContent).toBe("That number no make sense. We kept your old one.");
  });

  it("gives way to the next status line, and to focusing the box again", async () => {
    const { user } = setup();
    await user.click(groupSizeBox());
    await user.clear(groupSizeBox());
    await user.type(groupSizeBox(), "0");
    await user.tab();
    expect(screen.getByText("Min is 1, so we adjusted it.")).toBeTruthy();
    await user.click(screen.getByText("Outside on a Budget"));
    expect(screen.queryByText("Min is 1, so we adjusted it.")).toBeNull();
    expect(screen.getByText("Route set to Outside on a Budget.")).toBeTruthy();

    await user.click(groupSizeBox());
    await user.clear(groupSizeBox());
    await user.paste("abc");
    await user.tab();
    expect(screen.getByText("That number no make sense. We kept your old one.")).toBeTruthy();
    await user.click(groupSizeBox());
    expect(screen.queryByText(/no make sense/)).toBeNull();
  });

  it("drops a price hint when a route change replaces the number it was about", async () => {
    const { user } = setup();
    await user.click(stayPrice());
    await user.clear(stayPrice());
    await user.type(stayPrice(), "99999999999");
    await user.tab();
    expect(screen.getByText("Max is ₦50,000,000, so we adjusted it.")).toBeTruthy();
    await user.click(screen.getByText("Outside on a Budget"));
    expect(screen.queryByText(/we adjusted/)).toBeNull();
    expect(inputValue(stayPrice())).toBe("40,000");
  });
});
