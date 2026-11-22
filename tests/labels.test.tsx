// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ResultsPanel } from "@/components/ResultsPanel";
import { TripControls } from "@/components/TripControls";
import { AppStateProvider } from "@/state/AppStateProvider";

afterEach(cleanup);

describe("every input has a visible label (T4.4)", () => {
  it("names each textbox from on-screen text, not from sr-only or hidden text", () => {
    render(
      <AppStateProvider>
        <TripControls />
        <ResultsPanel />
      </AppStateProvider>,
    );
    const boxes = screen.getAllByRole("textbox");
    // 1 group size + 5 prices + 5 quantities + 3 shared headcounts
    expect(boxes).toHaveLength(14);
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
  });
});
