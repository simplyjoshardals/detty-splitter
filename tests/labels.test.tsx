// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ResultsPanel } from "@/components/ResultsPanel";
import { TripControls } from "@/components/TripControls";
import { AppStateProvider } from "@/state/AppStateProvider";

afterEach(cleanup);

function expectVisibleLabels(boxes: HTMLElement[]) {
  for (const box of boxes) {
    const ids = (box.getAttribute("aria-labelledby") ?? "").split(" ").filter(Boolean);
    expect(ids.length).toBeGreaterThan(0);
    const [labelId] = ids;
    const label = document.getElementById(labelId ?? "");
    expect(label, `label for a textbox (${labelId})`).not.toBeNull();
    expect(label?.textContent?.trim()).toBeTruthy();
    expect(label?.closest(".sr-only")).toBeNull();
    expect(label?.closest("[hidden],[aria-hidden='true']")).toBeNull();
  }
}

function renderAll() {
  render(
    <AppStateProvider>
      <TripControls />
      <ResultsPanel />
    </AppStateProvider>,
  );
}

describe("every input has a visible label (T4.4)", () => {
  it("names each textbox from on-screen text, not from sr-only or hidden text", () => {
    renderAll();
    const boxes = screen.getAllByRole("textbox");
    // 1 group size + 5 prices + 5 quantities + 3 shared headcounts; the closed Rates panel is hidden
    expect(boxes).toHaveLength(14);
    expectVisibleLabels(boxes);
  });

  it("does the same for the two rate fields once the Rates panel is open (T5.2)", async () => {
    renderAll();
    await userEvent.setup().click(screen.getByRole("button", { name: /^Rates/ }));
    const boxes = screen.getAllByRole("textbox");
    expect(boxes).toHaveLength(16);
    expectVisibleLabels(boxes);
  });
});
